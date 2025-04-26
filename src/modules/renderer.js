/**
 * Renderer module
 * Manages optimized rendering using requestAnimationFrame
 */

import {editorEvents, EDITOR_EVENTS} from './events.js';
import {logger} from '../index.js';

export function initRenderer(elements, state) {
    const stateManager = state;

    logger.debug('Initializing renderer');

    // Listen for events that trigger rendering
    setupEventListeners();

    /**
     * Request a render frame for the next animation frame
     * @param {boolean} fullUpdate - Whether to perform a full update
     */
    function requestRender(fullUpdate = false) {
        const renderingState = stateManager.getState().rendering;

        if (fullUpdate) {
            renderingState.needsFullUpdate = true;
        }

        if (!renderingState.isPending) {
            renderingState.isPending = true;
            window.requestAnimationFrame(performRender);
        }
    }

    /**
     * Request a full render of all elements
     */
    function requestFullRender() {
        requestRender(true);
    }

    /**
     * Request a render update for a specific node
     * @param {string} nodeId - ID of the node to update
     */
    function requestNodeUpdate(nodeId) {
        const renderingState = stateManager.getState().rendering;
        renderingState.updatedNodeIds.add(nodeId);
        requestRender();
    }

    /**
     * Request a render update for a specific connection
     * @param {string} connectionId - ID of the connection to update
     */
    function requestConnectionUpdate(connectionId) {
        const renderingState = stateManager.getState().rendering;
        renderingState.updatedConnectionIds.add(connectionId);
        requestRender();
    }

    /**
     * Perform the actual rendering
     */
    function performRender() {
        const renderingState = stateManager.getState().rendering;
        renderingState.isPending = false;

        // Apply viewport transform
        applyViewportTransform();

        // Update visible area for virtual scrolling
        updateVisibleArea();

        // Update grid if needed
        if (renderingState.needsFullUpdate) {
            renderGrid();
        }

        // Render nodes and connections
        if (renderingState.needsFullUpdate) {
            renderAllNodes();
            renderAllConnections();
        } else {
            // Selective updates
            renderUpdatedNodes();
            renderUpdatedConnections();
        }

        // Render minimap if visible
        if (stateManager.getMinimap().isVisible) {
            renderMinimap();
        }

        // Clear update tracking
        renderingState.needsFullUpdate = false;
        renderingState.updatedNodeIds.clear();
        renderingState.updatedConnectionIds.clear();
    }

    /**
     * Apply viewport transformation to canvas
     */
    function applyViewportTransform() {
        const {scale, offsetX, offsetY} = stateManager.getViewport();
        const {canvas} = elements;

        // Apply transform with hardware acceleration
        canvas.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
        canvas.style.transformOrigin = '0 0';
    }

    /**
     * Update the visible area for virtual scrolling
     */
    function updateVisibleArea() {
        const {canvas} = elements;
        const {scale, offsetX, offsetY} = stateManager.getViewport();

        // Calculate visible area in world coordinates with padding
        const canvasRect = canvas.getBoundingClientRect();
        const width = canvasRect.width / scale;
        const height = canvasRect.height / scale;

        // Add padding to avoid popping at edges (50% of viewport)
        const padding = {
            x: width * 0.5,
            y: height * 0.5
        };

        stateManager.updateVisibleArea({
            minX: -offsetX / scale - padding.x,
            minY: -offsetY / scale - padding.y,
            maxX: -offsetX / scale + width + padding.x,
            maxY: -offsetY / scale + height + padding.y
        });
    }

    /**
     * Render the grid
     */
    function renderGrid() {
        const {gridCanvas} = elements;
        const grid = stateManager.getGrid();
        const viewport = stateManager.getViewport();

        if (!gridCanvas) return;

        // Resize grid canvas to match container
        const container = gridCanvas.parentElement;
        gridCanvas.width = container.clientWidth;
        gridCanvas.height = container.clientHeight;

        const ctx = gridCanvas.getContext('2d');
        ctx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);

        if (!grid.enabled) return;

        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1;

        // Calculate grid offset based on viewport
        const offsetX = (viewport.offsetX * viewport.scale) % (grid.size * viewport.scale);
        const offsetY = (viewport.offsetY * viewport.scale) % (grid.size * viewport.scale);

        // Draw vertical lines
        for (let x = offsetX; x <= gridCanvas.width; x += grid.size * viewport.scale) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, gridCanvas.height);
            ctx.stroke();
        }

        // Draw horizontal lines
        for (let y = offsetY; y <= gridCanvas.height; y += grid.size * viewport.scale) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(gridCanvas.width, y);
            ctx.stroke();
        }
    }

    /**
     * Render all nodes
     */
    function renderAllNodes() {
        // First, calculate which nodes are in the visible area
        const nodes = stateManager.getNodes();
        const visibleArea = stateManager.getVisibleArea();

        // Remove existing nodes
        const existingNodes = document.querySelectorAll('.tree-node');
        existingNodes.forEach(node => node.remove());

        // Create only nodes that are visible
        nodes.forEach(node => {
            // Check if node is in visible area
            if (isNodeVisible(node, visibleArea)) {
                createNodeElement(node);
            }
        });
    }

    /**
     * Check if a node is visible in the current viewport
     * @param {Object} node - Node to check
     * @param {Object} visibleArea - Visible area bounds
     * @returns {boolean} - Whether node is visible
     */
    function isNodeVisible(node, visibleArea) {
        return (
            node.x < visibleArea.maxX &&
            node.x + 150 > visibleArea.minX &&
            node.y < visibleArea.maxY &&
            node.y + 40 > visibleArea.minY
        );
    }

    /**
     * Render only nodes that have been updated
     */
    function renderUpdatedNodes() {
        const renderingState = stateManager.getState().rendering;
        const nodes = stateManager.getNodes();
        const visibleArea = stateManager.getVisibleArea();

        // Process nodes that need updating
        renderingState.updatedNodeIds.forEach(nodeId => {
            // Find the node
            const node = nodes.find(n => n.id === nodeId);
            if (!node) return;

            // Check if node is visible
            if (isNodeVisible(node, visibleArea)) {
                // Remove existing node element if it exists
                const existingNode = document.querySelector(`.tree-node[data-id="${nodeId}"]`);
                if (existingNode) {
                    existingNode.remove();
                }

                // Create new node element
                createNodeElement(node);
            } else {
                // Node is not visible, just remove it if it exists
                const existingNode = document.querySelector(`.tree-node[data-id="${nodeId}"]`);
                if (existingNode) {
                    existingNode.remove();
                }
            }
        });

        // Check if any existing nodes are now outside the visible area
        const existingNodes = document.querySelectorAll('.tree-node');
        existingNodes.forEach(nodeElement => {
            const nodeId = nodeElement.getAttribute('data-id');
            const node = nodes.find(n => n.id === nodeId);

            if (node && !isNodeVisible(node, visibleArea)) {
                nodeElement.remove();
            }
        });

        // Check if any nodes that should be visible are not rendered
        nodes.forEach(node => {
            if (isNodeVisible(node, visibleArea)) {
                const existingNode = document.querySelector(`.tree-node[data-id="${node.id}"]`);
                if (!existingNode) {
                    createNodeElement(node);
                }
            }
        });
    }

    /**
     * Create a DOM element for a node
     * @param {Object} node - Node data
     */
    function createNodeElement(node) {
        const {canvas} = elements;
        const selectedNodes = stateManager.getSelectedNodes();
        const monitorNodeStates = stateManager.getState().monitor.nodeStates;

        // Create node element
        const nodeEl = document.createElement('div');
        nodeEl.className = `tree-node ${node.type}`;
        nodeEl.setAttribute('data-id', node.id);

        // Add monitoring state class if available
        if (stateManager.getState().monitor.active && monitorNodeStates[node.id]) {
            nodeEl.classList.add(monitorNodeStates[node.id]);
        }

        // Add selected class if node is in selection
        if (selectedNodes.includes(node.id)) {
            nodeEl.classList.add('selected');
        }

        // Position the node (positions are stored in world coordinates)
        nodeEl.style.left = `${node.x}px`;
        nodeEl.style.top = `${node.y}px`;

        // Node content
        const contentEl = document.createElement('div');
        contentEl.className = 'node-content';

        const iconEl = document.createElement('div');
        iconEl.className = `node-icon ${node.category}`;
        contentEl.appendChild(iconEl);

        const titleEl = document.createElement('div');
        titleEl.className = 'node-title';
        titleEl.textContent = node.name;
        contentEl.appendChild(titleEl);

        nodeEl.appendChild(contentEl);

        // Node ports
        const portsEl = document.createElement('div');
        portsEl.className = 'node-ports';

        const parentPortEl = document.createElement('div');
        parentPortEl.className = 'port port-parent';
        portsEl.appendChild(parentPortEl);

        const childPortEl = document.createElement('div');
        childPortEl.className = 'port port-child';
        portsEl.appendChild(childPortEl);

        nodeEl.appendChild(portsEl);

        // Set up drag behavior
        nodeEl.draggable = true;

        // Add node to canvas
        canvas.appendChild(nodeEl);

        // Update port visibility based on node constraints
        updatePortVisibility(nodeEl, node);

        return nodeEl;
    }

    /**
     * Update port visibility based on node constraints
     * @param {HTMLElement} nodeEl - Node element
     * @param {Object} node - Node data
     */
    function updatePortVisibility(nodeEl, node) {
        // This would be implemented based on the constraints defined in node-types.js
        // For now, this is a placeholder that would need to be completed
        // based on the specific implementation details
    }

    /**
     * Render all connections
     */
    function renderAllConnections() {
        const {connectionsLayer} = elements;
        const connections = stateManager.getConnections();

        // Clear existing connections
        while (connectionsLayer.firstChild) {
            connectionsLayer.removeChild(connectionsLayer.firstChild);
        }

        // Create new connections
        connections.forEach(connection => {
            createConnectionElement(connection);
        });
    }

    /**
     * Render only connections that have been updated
     */
    function renderUpdatedConnections() {
        const renderingState = stateManager.getState().rendering;
        const connections = stateManager.getConnections();

        // Process connections that need updating
        renderingState.updatedConnectionIds.forEach(connectionId => {
            // Find the connection
            const connection = connections.find(c => c.id === connectionId);
            if (!connection) return;

            // Remove existing connection element if it exists
            const existingConnection = document.querySelector(`.connection-path[data-id="${connectionId}"]`);
            if (existingConnection) {
                existingConnection.remove();
            }

            // Create new connection element
            createConnectionElement(connection);
        });
    }

    /**
     * Create a connection element
     * @param {Object} connection - Connection data
     */
    function createConnectionElement(connection) {
        const {connectionsLayer} = elements;
        const nodes = stateManager.getNodes();

        // Find source and target nodes
        const sourceNode = nodes.find(node => node.id === connection.source);
        const targetNode = nodes.find(node => node.id === connection.target);

        if (!sourceNode || !targetNode) return;

        // Create the SVG path
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', 'connection-path');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', '#666');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('data-id', connection.id);

        // Generate the path data
        const pathData = generatePathData(sourceNode, targetNode);
        path.setAttribute('d', pathData);

        // Add to connections layer
        connectionsLayer.appendChild(path);

        return path;
    }

    /**
     * Generate SVG path data for a connection
     * @param {Object} sourceNode - Source node
     * @param {Object} targetNode - Target node
     * @returns {string} - SVG path data
     */
    function generatePathData(sourceNode, targetNode) {
        // Starting point (bottom-center of source node)
        const startX = sourceNode.x + 75;
        const startY = sourceNode.y + 40;

        // Ending point (top-center of target node)
        const endX = targetNode.x + 75;
        const endY = targetNode.y;

        // Calculate control points for curve
        const controlY = (startY + endY) / 2;

        return `M ${startX} ${startY} C ${startX} ${controlY}, ${endX} ${controlY}, ${endX} ${endY}`;
    }

    /**
     * Render the pending connection (while creating a new connection)
     */
    function renderPendingConnection() {
        const {activeConnectionLayer} = elements;
        const pendingConnection = stateManager.getState().pendingConnection;
        const nodes = stateManager.getNodes();
        const mousePosition = stateManager.getState().mousePosition;

        if (!pendingConnection) {
            activeConnectionLayer.innerHTML = '';
            return;
        }

        // Find source node
        const sourceNode = nodes.find(node => node.id === pendingConnection.sourceId);
        if (!sourceNode) return;

        // Get start point based on port type
        let startX, startY;
        if (pendingConnection.sourcePort === 'parent') {
            startX = sourceNode.x + 75; // middle top of node
            startY = sourceNode.y;
        } else {
            startX = sourceNode.x + 75; // middle bottom of node
            startY = sourceNode.y + 40;
        }

        // Create the SVG path
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', '#0066cc');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('stroke-dasharray', '5,5');

        // Generate the path data
        const controlY = (startY + mousePosition.y) / 2;
        const pathData = `M ${startX} ${startY} C ${startX} ${controlY}, ${mousePosition.x} ${controlY}, ${mousePosition.x} ${mousePosition.y}`;
        path.setAttribute('d', pathData);

        // Clear and add the new path
        activeConnectionLayer.innerHTML = '';
        activeConnectionLayer.appendChild(path);
    }

    /**
     * Render the minimap
     */
    function renderMinimap() {
        const {minimap} = elements;
        if (!minimap) return;

        const nodes = stateManager.getNodes();
        const connections = stateManager.getConnections();
        const viewport = stateManager.getViewport();
        const minimapState = stateManager.getMinimap();

        const ctx = minimap.getContext('2d');
        ctx.clearRect(0, 0, minimapState.width, minimapState.height);

        // Calculate bounds of all nodes
        const bounds = calculateNodesBounds(nodes);

        // Calculate scale to fit all nodes in minimap
        const padding = 10;
        const scaleX = (minimapState.width - padding * 2) / bounds.width;
        const scaleY = (minimapState.height - padding * 2) / bounds.height;
        const scale = Math.min(scaleX, scaleY);

        // Draw connections
        ctx.strokeStyle = '#999';
        ctx.lineWidth = 1;

        connections.forEach(conn => {
            const sourceNode = nodes.find(n => n.id === conn.source);
            const targetNode = nodes.find(n => n.id === conn.target);

            if (sourceNode && targetNode) {
                const sourceX = padding + (sourceNode.x + 75 - bounds.minX) * scale;
                const sourceY = padding + (sourceNode.y + 40 - bounds.minY) * scale;
                const targetX = padding + (targetNode.x + 75 - bounds.minX) * scale;
                const targetY = padding + (targetNode.y - bounds.minY) * scale;

                ctx.beginPath();
                ctx.moveTo(sourceX, sourceY);
                ctx.lineTo(targetX, targetY);
                ctx.stroke();
            }
        });

        // Draw nodes
        ctx.fillStyle = '#ddd';

        nodes.forEach(node => {
            const x = padding + (node.x - bounds.minX) * scale;
            const y = padding + (node.y - bounds.minY) * scale;
            const width = 150 * scale;
            const height = 40 * scale;

            ctx.fillRect(x, y, width, height);
        });

        // Draw viewport rectangle
        const viewportMinX = -viewport.offsetX / viewport.scale;
        const viewportMinY = -viewport.offsetY / viewport.scale;
        const container = minimap.parentElement.parentElement; // Editor container
        const viewportWidth = container.clientWidth / viewport.scale;
        const viewportHeight = container.clientHeight / viewport.scale;

        const viewportX = padding + (viewportMinX - bounds.minX) * scale;
        const viewportY = padding + (viewportMinY - bounds.minY) * scale;
        const viewportScaledWidth = viewportWidth * scale;
        const viewportScaledHeight = viewportHeight * scale;

        ctx.strokeStyle = '#f00';
        ctx.lineWidth = 2;
        ctx.strokeRect(viewportX, viewportY, viewportScaledWidth, viewportScaledHeight);
    }

    /**
     * Calculate bounds of all nodes for minimap
     * @param {Array} nodes - Array of nodes
     * @returns {Object} - Bounds object with minX, minY, maxX, maxY, width, height
     */
    function calculateNodesBounds(nodes) {
        if (nodes.length === 0) {
            return {minX: -500, minY: -500, maxX: 500, maxY: 500, width: 1000, height: 1000};
        }

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        nodes.forEach(node => {
            minX = Math.min(minX, node.x);
            minY = Math.min(minY, node.y);
            maxX = Math.max(maxX, node.x + 150);
            maxY = Math.max(maxY, node.y + 40);
        });

        // Add padding
        minX -= 100;
        minY -= 100;
        maxX += 100;
        maxY += 100;

        return {
            minX, minY, maxX, maxY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    /**
     * Set up event listeners for rendering
     */
    function setupEventListeners() {
        // Listen for events that require rendering
        editorEvents.on(EDITOR_EVENTS.NODE_CREATED, () => requestRender());
        editorEvents.on(EDITOR_EVENTS.NODE_UPDATED, () => requestRender());
        editorEvents.on(EDITOR_EVENTS.NODE_DELETED, () => requestRender());
        editorEvents.on(EDITOR_EVENTS.NODE_MOVED, () => requestRender());
        editorEvents.on(EDITOR_EVENTS.SELECTION_CHANGED, () => requestRender());

        editorEvents.on(EDITOR_EVENTS.CONNECTION_CREATED, () => requestRender());
        editorEvents.on(EDITOR_EVENTS.CONNECTION_DELETED, () => requestRender());

        editorEvents.on(EDITOR_EVENTS.VIEWPORT_CHANGED, () => requestRender(true));
        editorEvents.on(EDITOR_EVENTS.GRID_SETTINGS_CHANGED, () => requestRender(true));

        editorEvents.on(EDITOR_EVENTS.WINDOW_RESIZED, () => {
            updateCanvasDimensions();
            requestRender(true);
        });

        editorEvents.on(EDITOR_EVENTS.STATE_RESET, () => requestRender(true));
        editorEvents.on(EDITOR_EVENTS.STATE_LOADED, () => requestRender(true));
    }

    /**
     * Update canvas dimensions on resize
     */
    function updateCanvasDimensions() {
        const {canvas, gridCanvas, connectionsLayer, activeConnectionLayer} = elements;

        // Get container size
        const container = canvas.parentElement;
        const width = container.clientWidth;
        const height = container.clientHeight;

        // Update grid canvas size
        if (gridCanvas) {
            gridCanvas.width = width;
            gridCanvas.height = height;
        }

        // Update SVG layers sizes
        if (connectionsLayer) {
            connectionsLayer.setAttribute('width', width);
            connectionsLayer.setAttribute('height', height);
        }

        if (activeConnectionLayer) {
            activeConnectionLayer.setAttribute('width', width);
            activeConnectionLayer.setAttribute('height', height);
        }
    }

    // Return public API
    return {
        requestRender,
        requestFullRender,
        requestNodeUpdate,
        requestConnectionUpdate,
        renderPendingConnection,
        renderMinimap,
        updateCanvasDimensions
    };
}

// Helper functions

/**
 * Convert world coordinates to screen coordinates
 * @param {number} x - World X coordinate
 * @param {number} y - World Y coordinate
 * @param {Object} viewport - Viewport state
 * @returns {Object} - Screen coordinates {x, y}
 */
export function worldToScreen(x, y, viewport) {
    return {
        x: (x + viewport.offsetX) * viewport.scale,
        y: (y + viewport.offsetY) * viewport.scale
    };
}

/**
 * Convert screen coordinates to world coordinates
 * @param {number} x - Screen X coordinate
 * @param {number} y - Screen Y coordinate
 * @param {Object} viewport - Viewport state
 * @returns {Object} - World coordinates {x, y}
 */
export function screenToWorld(x, y, viewport) {
    return {
        x: x / viewport.scale - viewport.offsetX,
        y: y / viewport.scale - viewport.offsetY
    };
}