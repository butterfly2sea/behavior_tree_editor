/**
 * Renderer - Manages efficient rendering
 */
import {eventBus, EVENTS} from './events.js';
import {logger} from '../utils/logger.js';
import {config} from './config.js';
import {createSvgElement} from '../utils/dom.js';

export function initRenderer(elements, state) {
    const stateManager = state;

    // Rendering state
    let renderRequested = false;
    let needsFullRender = false;
    let updatedNodeIds = new Set();
    let updatedConnectionIds = new Set();

    // Set up event listeners
    setupEventListeners();

    /**
     * Request a render on the next animation frame
     */
    function requestRender(fullUpdate = false) {
        if (fullUpdate) {
            needsFullRender = true;
        }

        if (!renderRequested) {
            renderRequested = true;
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
     */
    function requestNodeUpdate(nodeId) {
        updatedNodeIds.add(nodeId);
        requestRender();
    }

    /**
     * Request a render update for a specific connection
     */
    function requestConnectionUpdate(connectionId) {
        updatedConnectionIds.add(connectionId);
        requestRender();
    }

    /**
     * Perform the actual rendering
     */
    function performRender() {
        renderRequested = false;

        // Apply viewport transform
        applyViewportTransform();

        // Update visible area for culling
        updateVisibleArea();

        // Update grid if needed
        if (needsFullRender) {
            renderGrid();
        }

        // Render nodes and connections
        if (needsFullRender) {
            renderAllNodes();
            renderAllConnections();
        } else {
            if (updatedNodeIds.size > 0) {
                renderUpdatedNodes();
            }

            if (updatedConnectionIds.size > 0) {
                renderUpdatedConnections();
            }
        }

        // Render minimap if visible
        if (stateManager.getMinimap().isVisible) {
            renderMinimap();
        }

        // Clear update flags and sets
        needsFullRender = false;
        updatedNodeIds.clear();
        updatedConnectionIds.clear();
    }

    /**
     * Apply viewport transformation to canvas
     */
    function applyViewportTransform() {
        const {scale, offsetX, offsetY} = stateManager.getViewport();
        const {canvas} = elements;

        // Apply transform with hardware acceleration
        canvas.style.transform = `translate(${offsetX * scale}px, ${offsetY * scale}px) scale(${scale})`;
        canvas.style.transformOrigin = '0 0';
    }

    /**
     * Update the visible area for culling
     */
    function updateVisibleArea() {
        const {canvas} = elements;
        const {scale, offsetX, offsetY} = stateManager.getViewport();

        // Calculate visible area in world coordinates with padding
        const canvasRect = canvas.getBoundingClientRect();
        const width = canvasRect.width / scale;
        const height = canvasRect.height / scale;

        // Add padding to avoid popping (50% of viewport)
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

        // Skip if grid is disabled
        if (!grid.enabled) return;

        const {scale} = viewport;
        const offsetX = (viewport.offsetX * scale) % (grid.size * scale);
        const offsetY = (viewport.offsetY * scale) % (grid.size * scale);
        const scaledGridSize = grid.size * scale;

        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1;

        // Draw vertical lines
        for (let x = offsetX; x <= gridCanvas.width; x += scaledGridSize) {
            const roundedX = Math.round(x) + 0.5;
            ctx.beginPath();
            ctx.moveTo(roundedX, 0);
            ctx.lineTo(roundedX, gridCanvas.height);
            ctx.stroke();
        }

        // Draw horizontal lines
        for (let y = offsetY; y <= gridCanvas.height; y += scaledGridSize) {
            const roundedY = Math.round(y) + 0.5;
            ctx.beginPath();
            ctx.moveTo(0, roundedY);
            ctx.lineTo(gridCanvas.width, roundedY);
            ctx.stroke();
        }
    }

    /**
     * Render all nodes
     */
    function renderAllNodes() {
        const nodes = stateManager.getNodes();
        const visibleArea = stateManager.getVisibleArea();

        // Remove existing nodes
        const existingNodes = document.querySelectorAll('.tree-node');
        existingNodes.forEach(node => node.remove());

        // Create only nodes that are visible
        nodes.forEach(node => {
            if (isNodeVisible(node, visibleArea)) {
                createNodeElement(node);
            }
        });
    }

    /**
     * Check if node is visible in the current viewport
     */
    function isNodeVisible(node, visibleArea) {
        return (
            node.x < visibleArea.maxX &&
            node.x + config.nodeWidth > visibleArea.minX &&
            node.y < visibleArea.maxY &&
            node.y + config.nodeHeight > visibleArea.minY
        );
    }

    /**
     * Render only nodes that have been updated
     */
    function renderUpdatedNodes() {
        const nodes = stateManager.getNodes();
        const visibleArea = stateManager.getVisibleArea();

        // Process nodes that need updating
        for (const nodeId of updatedNodeIds) {
            const node = nodes.find(n => n.id === nodeId);
            if (!node) continue;

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
        }

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
     * Create DOM element for a node
     */
    function createNodeElement(node) {
        const {canvas} = elements;
        const selectedNodes = stateManager.getSelectedNodes();
        const monitorNodeStates = stateManager.getMonitor().nodeStates;

        // Create node element
        const nodeEl = document.createElement('div');
        nodeEl.className = `tree-node ${node.type}`;
        nodeEl.setAttribute('data-id', node.id);
        nodeEl.draggable = true;

        // Add monitoring state class if available
        if (stateManager.getMonitor().active && monitorNodeStates[node.id]) {
            nodeEl.classList.add(monitorNodeStates[node.id]);
        }

        // Add selected class if node is in selection
        if (selectedNodes.includes(node.id)) {
            nodeEl.classList.add('selected');
        }

        // Position the node
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

        // Add to canvas
        canvas.appendChild(nodeEl);

        // Update port visibility based on constraints
        updateNodePortVisibility(nodeEl, node);

        nodeEl.addEventListener('click', (e) => {
            // 如果点击的是端口，不处理选择操作
            if (e.target.classList.contains('port')) {
                return;
            }

            // 阻止事件冒泡到画布
            e.stopPropagation();

            // 如果按住shift，添加到选择；否则清除其他选择
            if (!e.shiftKey) {
                stateManager.clearSelection();
            }

            // 选择节点
            stateManager.selectNode(node.id, e.shiftKey);
        });
        return nodeEl;
    }

    /**
     * Update port visibility based on node constraints
     */
    function updateNodePortVisibility(nodeEl, node) {
        const {getNodeDefinition} = window; // From node-types.js
        if (!getNodeDefinition) return;

        const connections = stateManager.getConnections();
        const nodeDef = getNodeDefinition(node.type, node.category);

        if (!nodeDef) return;

        // Child port visibility
        const childPort = nodeEl.querySelector('.port-child');
        if (childPort) {
            if (nodeDef.maxChildren === 0) {
                childPort.classList.add('disabled');
                childPort.title = 'This node cannot have children';
            } else {
                // Check max children constraint
                const childCount = connections.filter(conn => conn.source === node.id).length;
                if (nodeDef.maxChildren !== null && childCount >= nodeDef.maxChildren) {
                    childPort.classList.add('disabled');
                    childPort.title = `Maximum children: ${nodeDef.maxChildren}`;
                } else {
                    childPort.classList.remove('disabled');
                    childPort.title = '';
                }
            }
        }

        // Parent port visibility
        const parentPort = nodeEl.querySelector('.port-parent');
        if (parentPort) {
            const hasParent = connections.some(conn => conn.target === node.id);
            if (hasParent) {
                parentPort.classList.add('disabled');
                parentPort.title = 'This node already has a parent';
            } else {
                parentPort.classList.remove('disabled');
                parentPort.title = '';
            }
        }
    }

    /**
     * Render all connections
     */
    function renderAllConnections() {
        const {connectionsLayer} = elements;
        const connections = stateManager.getConnections();

        // Clear existing connections
        connectionsLayer.innerHTML = '';

        // Create new connections
        connections.forEach(connection => {
            createConnectionElement(connection);
        });
    }

    /**
     * Render only connections that have been updated
     */
    function renderUpdatedConnections() {
        const connections = stateManager.getConnections();

        // Process connections that need updating
        for (const connectionId of updatedConnectionIds) {
            const connection = connections.find(c => c.id === connectionId);
            if (!connection) continue;

            // Remove existing connection element if it exists
            const existingConnection = document.querySelector(`path[data-id="${connectionId}"]`);
            if (existingConnection) {
                existingConnection.remove();
            }

            // Create new connection element
            createConnectionElement(connection);
        }
    }

    /**
     * Create SVG element for a connection
     */
    function createConnectionElement(connection) {
        const {connectionsLayer} = elements;
        const nodes = stateManager.getNodes();
        const selectedConnection = stateManager.getSelectedConnection();

        // Find source and target nodes
        const sourceNode = nodes.find(node => node.id === connection.source);
        const targetNode = nodes.find(node => node.id === connection.target);

        if (!sourceNode || !targetNode) return null;

        // Create path element
        const path = createSvgElement('path', {
            'class': 'connection-path',
            'fill': 'none',
            'stroke': connection.id === selectedConnection ?
                config.connection.selectedColor :
                config.connection.normalColor,
            'stroke-width': config.connection.strokeWidth,
            'data-id': connection.id
        });

        // Generate path data
        const pathData = generateConnectionPath(sourceNode, targetNode);
        path.setAttribute('d', pathData);

        // Add to connections layer
        connectionsLayer.appendChild(path);

        return path;
    }

    /**
     * Generate SVG path for a connection
     */
    function generateConnectionPath(sourceNode, targetNode) {
        // Start point (source node's bottom center)
        const startX = sourceNode.x + config.nodeWidth / 2;
        const startY = sourceNode.y + config.nodeHeight;

        // End point (target node's top center)
        const endX = targetNode.x + config.nodeWidth / 2;
        const endY = targetNode.y;

        // Calculate control points for a nice curve
        const deltaY = endY - startY;
        const controlY1 = startY + Math.min(Math.abs(deltaY) * 0.3, 40);
        const controlY2 = endY - Math.min(Math.abs(deltaY) * 0.3, 40);

        // Return path data for a cubic bezier curve
        return `M ${startX} ${startY} C ${startX} ${controlY1}, ${endX} ${controlY2}, ${endX} ${endY}`;
    }

    /**
     * Render the pending connection during creation
     */
    function renderPendingConnection() {
        const {activeConnectionLayer} = elements;
        const pendingConnection = stateManager.getState().pendingConnection;
        const nodes = stateManager.getNodes();
        const mousePos = stateManager.getState().mousePosition;

        if (!pendingConnection) {
            activeConnectionLayer.innerHTML = '';
            return;
        }

        // Find source node
        const sourceNode = nodes.find(n => n.id === pendingConnection.sourceId);
        if (!sourceNode) return;

        // Get start coordinates based on port type
        let startX, startY;
        if (pendingConnection.sourcePort === 'parent') {
            startX = sourceNode.x + config.nodeWidth / 2;
            startY = sourceNode.y;
        } else {
            startX = sourceNode.x + config.nodeWidth / 2;
            startY = sourceNode.y + config.nodeHeight;
        }

        // Create path for pending connection
        const path = createSvgElement('path', {
            'fill': 'none',
            'stroke': config.connection.pendingColor,
            'stroke-width': config.connection.strokeWidth,
            'stroke-dasharray': '5,5'
        });

        // Generate curve
        const deltaY = mousePos.y - startY;
        const controlY1 = startY + Math.min(Math.abs(deltaY) * 0.3, 40);
        const controlY2 = mousePos.y - Math.min(Math.abs(deltaY) * 0.3, 40);
        const pathData = `M ${startX} ${startY} C ${startX} ${controlY1}, ${mousePos.x} ${controlY2}, ${mousePos.x} ${mousePos.y}`;

        path.setAttribute('d', pathData);

        // Clear and add new path
        activeConnectionLayer.innerHTML = '';
        activeConnectionLayer.appendChild(path);

        // Make layer visible
        activeConnectionLayer.style.display = 'block';
    }

    /**
     * Render minimap
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
                const sourceX = padding + (sourceNode.x + config.nodeWidth / 2 - bounds.minX) * scale;
                const sourceY = padding + (sourceNode.y + config.nodeHeight - bounds.minY) * scale;
                const targetX = padding + (targetNode.x + config.nodeWidth / 2 - bounds.minX) * scale;
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
            const width = config.nodeWidth * scale;
            const height = config.nodeHeight * scale;

            ctx.fillRect(x, y, width, height);
        });

        // Draw viewport rectangle
        const viewportMinX = -viewport.offsetX / viewport.scale;
        const viewportMinY = -viewport.offsetY / viewport.scale;
        const container = minimap.parentElement.parentElement;
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
     * Calculate bounds of all nodes
     */
    function calculateNodesBounds(nodes) {
        if (nodes.length === 0) {
            return {
                minX: -500, minY: -500,
                maxX: 500, maxY: 500,
                width: 1000, height: 1000
            };
        }

        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        nodes.forEach(node => {
            minX = Math.min(minX, node.x);
            minY = Math.min(minY, node.y);
            maxX = Math.max(maxX, node.x + config.nodeWidth);
            maxY = Math.max(maxY, node.y + config.nodeHeight);
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
     * Set up event listeners
     */
    function setupEventListeners() {
        // Node events
        eventBus.on(EVENTS.NODE_CHANGED, (data) => {
            if (data.type === 'created' || data.type === 'deleted') {
                requestFullRender();
            } else if (data.type === 'updated') {
                requestNodeUpdate(data.node.id);
            } else if (data.type === 'batch-updated') {
                data.nodeIds.forEach(id => requestNodeUpdate(id));
            } else if (data.type === 'moved') {
                data.nodeIds.forEach(id => requestNodeUpdate(id));
            }
        });

        // Connection events
        eventBus.on(EVENTS.CONNECTION_CHANGED, (data) => {
            if (data.type === 'created' || data.type === 'deleted') {
                requestConnectionUpdate(data.connection.id);
            } else if (data.type === 'selected') {
                requestFullRender();
            }
        });

        // Viewport events
        eventBus.on(EVENTS.VIEWPORT_CHANGED, () => {
            requestFullRender();
        });

        // Grid events
        eventBus.on(EVENTS.GRID_CHANGED, () => {
            requestFullRender();
        });

        // Selection events
        eventBus.on(EVENTS.SELECTION_CHANGED, () => {
            requestFullRender();
        });

        // Monitor events
        eventBus.on(EVENTS.MONITOR_CHANGED, () => {
            requestFullRender();
        });

        // State reset/load
        eventBus.on(EVENTS.STATE_RESET, () => {
            requestFullRender();
        });

        eventBus.on(EVENTS.STATE_LOADED, () => {
            requestFullRender();
        });

        // Window resize
        window.addEventListener('resize', () => {
            updateCanvasDimensions();
            requestFullRender();
        });
    }

    /**
     * Update canvas dimensions on resize
     */
    function updateCanvasDimensions() {
        const {canvas, gridCanvas, connectionsLayer, activeConnectionLayer} = elements;

        const container = canvas.parentElement;
        const width = container.clientWidth;
        const height = container.clientHeight;

        if (gridCanvas) {
            gridCanvas.width = width;
            gridCanvas.height = height;
        }

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
        renderGrid,
        renderMinimap,
        updateCanvasDimensions,
        calculateNodesBounds,

        // Coordinate conversion utilities
        screenToWorld: (x, y) => {
            const {scale, offsetX, offsetY} = stateManager.getViewport();
            return {
                x: x / scale - offsetX,
                y: y / scale - offsetY
            };
        },

        worldToScreen: (x, y) => {
            const {scale, offsetX, offsetY} = stateManager.getViewport();
            return {
                x: (x + offsetX) * scale,
                y: (y + offsetY) * scale
            };
        }
    };
}