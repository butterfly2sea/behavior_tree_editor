/**
 * Node component
 * Manages node UI elements and interactions
 */

import { editorEvents, EDITOR_EVENTS } from '../modules/events.js';
import { logger } from '../index.js';
import { worldToScreen, screenToWorld } from '../modules/renderer.js';

export function initNodeComponent(elements, state, renderer) {
    const stateManager = state;

    logger.debug('Initializing node component');

    /**
     * Create a DOM element for a node
     * @param {Object} node - Node data
     * @returns {HTMLElement} - Created node element
     */
    function createNodeElement(node) {
        const { canvas } = elements;
        if (!canvas) return null;

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

        // Position the node in world coordinates
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

        // Add event listeners
        attachNodeEventListeners(nodeEl, node);

        // Add the node to the canvas
        canvas.appendChild(nodeEl);

        // Update port visibility
        updatePortVisibility(nodeEl, node);

        return nodeEl;
    }

    /**
     * Attach event listeners to a node element
     * @param {HTMLElement} nodeEl - Node element
     * @param {Object} node - Node data
     */
    function attachNodeEventListeners(nodeEl, node) {
        // Node click
        nodeEl.addEventListener('click', (e) => {
            // Skip if clicking on a port
            if (e.target.classList.contains('port')) return;

            e.stopPropagation();

            const viewport = stateManager.getViewport();

            // Convert screen coordinates to world coordinates
            const rect = nodeEl.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;

            // Shift+click to toggle selection
            if (e.shiftKey) {
                toggleNodeSelection(node.id);
            } else {
                // Normal click selects only this node
                clearNodeSelection();
                addNodeToSelection(node.id);
            }

            // Update node appearance
            updateNodeSelectionState(nodeEl, node.id);

            // Notify about selection change
            editorEvents.emit(EDITOR_EVENTS.NODE_SELECTED, node.id);
        });

        // Drag start
        nodeEl.addEventListener('dragstart', (e) => {
            // Skip if dragging from a port
            if (e.target.classList.contains('port')) {
                e.preventDefault();
                return false;
            }

            e.stopPropagation();

            // Set drag data
            e.dataTransfer.setData('nodeId', node.id);

            // If the node isn't selected, select only this node
            if (!stateManager.getSelectedNodes().includes(node.id)) {
                clearNodeSelection();
                addNodeToSelection(node.id);

                // Update node appearance
                updateNodeSelectionState(nodeEl, node.id);

                // Notify about selection change
                editorEvents.emit(EDITOR_EVENTS.NODE_SELECTED, node.id);
            }

            // Set drag image
            const dragImage = nodeEl.cloneNode(true);
            dragImage.style.opacity = '0.7';
            document.body.appendChild(dragImage);

            e.dataTransfer.setDragImage(dragImage, 75, 20);

            // Clean up drag image after dragstart
            setTimeout(() => {
                document.body.removeChild(dragImage);
            }, 0);
        });

        // Port click handlers
        const parentPort = nodeEl.querySelector('.port-parent');
        const childPort = nodeEl.querySelector('.port-child');

        if (parentPort) {
            parentPort.addEventListener('click', (e) => {
                e.stopPropagation();
                editorEvents.emit(EDITOR_EVENTS.PORT_CLICKED, {
                    nodeId: node.id,
                    portType: 'parent',
                    event: e
                });
            });
        }

        if (childPort) {
            childPort.addEventListener('click', (e) => {
                e.stopPropagation();
                editorEvents.emit(EDITOR_EVENTS.PORT_CLICKED, {
                    nodeId: node.id,
                    portType: 'child',
                    event: e
                });
            });
        }

        // Context menu
        nodeEl.addEventListener('contextmenu', (e) => {
            e.preventDefault();

            // Emit context menu event
            editorEvents.emit(EDITOR_EVENTS.NODE_CONTEXT_MENU, {
                nodeId: node.id,
                x: e.clientX,
                y: e.clientY
            });
        });
    }

    /**
     * Update a node's selection state
     * @param {HTMLElement} nodeEl - Node element
     * @param {string} nodeId - Node ID
     */
    function updateNodeSelectionState(nodeEl, nodeId) {
        if (stateManager.getSelectedNodes().includes(nodeId)) {
            nodeEl.classList.add('selected');
        } else {
            nodeEl.classList.remove('selected');
        }
    }

    /**
     * Update port visibility based on node constraints
     * @param {HTMLElement} nodeEl - Node element
     * @param {Object} node - Node data
     */
    function updatePortVisibility(nodeEl, node) {
        const connections = stateManager.getConnections();

        // Get node definition for constraints
        const nodeDef = getNodeTypeDefinition(node.type, node.category);
        if (!nodeDef) return;

        // Check if this node can have children
        const childPort = nodeEl.querySelector('.port-child');
        if (childPort) {
            if (nodeDef.maxChildren === 0) {
                childPort.classList.add('disabled');
                childPort.title = 'This node cannot have children';
            } else {
                // Check if this node already has max children
                const childCount = connections.filter(conn => conn.source === node.id).length;
                if (nodeDef.maxChildren !== null && childCount >= nodeDef.maxChildren) {
                    childPort.classList.add('disabled');
                    childPort.title = `This node can have at most ${nodeDef.maxChildren} ${nodeDef.maxChildren === 1 ? 'child' : 'children'}`;
                } else {
                    childPort.classList.remove('disabled');
                    childPort.title = '';
                }
            }
        }

        // Check if this node already has a parent
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
     * Add a node to the selection
     * @param {string} nodeId - Node ID to add to selection
     */
    function addNodeToSelection(nodeId) {
        stateManager.selectNode(nodeId);
    }

    /**
     * Remove a node from the selection
     * @param {string} nodeId - Node ID to remove from selection
     */
    function removeNodeFromSelection(nodeId) {
        stateManager.deselectNode(nodeId);
    }

    /**
     * Toggle a node's selection state
     * @param {string} nodeId - Node ID to toggle
     */
    function toggleNodeSelection(nodeId) {
        if (stateManager.getSelectedNodes().includes(nodeId)) {
            removeNodeFromSelection(nodeId);
        } else {
            addNodeToSelection(nodeId, true);
        }
    }

    /**
     * Clear the node selection
     */
    function clearNodeSelection() {
        stateManager.clearSelection();
    }

    /**
     * Update node appearance for monitoring
     * @param {string} nodeId - Node ID
     * @param {string} status - Status ('running', 'success', 'failure')
     */
    function updateNodeStatus(nodeId, status) {
        const nodeEl = document.querySelector(`.tree-node[data-id="${nodeId}"]`);
        if (!nodeEl) return;

        // Remove existing status classes
        nodeEl.classList.remove('running', 'success', 'failure');

        // Add new status class
        if (status) {
            nodeEl.classList.add(status);
        }
    }

    /**
     * Apply animation to a node
     * @param {string} nodeId - Node ID
     * @param {string} animationType - Animation type ('pulse', 'shake', 'highlight')
     * @param {number} duration - Animation duration in ms
     */
    function animateNode(nodeId, animationType = 'pulse', duration = 1000) {
        const nodeEl = document.querySelector(`.tree-node[data-id="${nodeId}"]`);
        if (!nodeEl) return;

        // Add animation class
        nodeEl.classList.add(`animation-${animationType}`);

        // Remove class after duration
        setTimeout(() => {
            nodeEl.classList.remove(`animation-${animationType}`);
        }, duration);
    }

    /**
     * Show invalid connection feedback
     * @param {string} nodeId - Node ID
     * @param {string} message - Error message
     */
    function showInvalidConnectionFeedback(nodeId, message) {
        const nodeEl = document.querySelector(`.tree-node[data-id="${nodeId}"]`);
        if (!nodeEl) return;

        // Add invalid connection class
        nodeEl.classList.add('invalid-connection');

        // Remove the class after a short delay
        setTimeout(() => {
            nodeEl.classList.remove('invalid-connection');
        }, 800);

        // Show tooltip if message provided
        if (message) {
            alert(message);
        }
    }

    /**
     * Get node type definition
     * @param {string} type - Node type
     * @param {string} category - Node category
     * @returns {Object|null} - Node type definition
     */
    function getNodeTypeDefinition(type, category) {
        // Check built-in types first (from the external node-types.js)
        if (window.NODE_TYPES && window.NODE_TYPES[category]) {
            const builtInType = window.NODE_TYPES[category].find(nt => nt.type === type);
            if (builtInType) return builtInType;
        }

        // Then check custom types
        return stateManager.getCustomNodeTypes().find(nt => nt.type === type);
    }

    // Set up event listeners
    function setupEventListeners() {
        // Listen for node creation events to create DOM elements
        editorEvents.on(EDITOR_EVENTS.NODE_CREATED, node => {
            if (node.id) {
                createNodeElement(node);
            }
        });

        // Listen for node update events to update DOM elements
        editorEvents.on(EDITOR_EVENTS.NODE_UPDATED, node => {
            if (node.id) {
                const nodeEl = document.querySelector(`.tree-node[data-id="${node.id}"]`);
                if (nodeEl) {
                    // Update the node element
                    updateNodeElement(nodeEl, node);
                }
            }
        });

        // Listen for connection changes to update port visibility
        editorEvents.on(EDITOR_EVENTS.CONNECTION_CREATED, () => {
            updateAllPortVisibility();
        });

        editorEvents.on(EDITOR_EVENTS.CONNECTION_DELETED, () => {
            updateAllPortVisibility();
        });
    }

    /**
     * Update a node element with new data
     * @param {HTMLElement} nodeEl - Node element
     * @param {Object} node - Node data
     */
    function updateNodeElement(nodeEl, node) {
        if (!nodeEl) return;

        // Update position
        if (node.x !== undefined) nodeEl.style.left = `${node.x}px`;
        if (node.y !== undefined) nodeEl.style.top = `${node.y}px`;

        // Update title
        if (node.name) {
            const titleEl = nodeEl.querySelector('.node-title');
            if (titleEl) titleEl.textContent = node.name;
        }

        // Update selection state
        updateNodeSelectionState(nodeEl, node.id);

        // Update port visibility
        updatePortVisibility(nodeEl,
            stateManager.getNodes().find(n => n.id === node.id) || node);
    }

    /**
     * Update port visibility for all nodes
     */
    function updateAllPortVisibility() {
        const nodes = stateManager.getNodes();

        nodes.forEach(node => {
            const nodeEl = document.querySelector(`.tree-node[data-id="${node.id}"]`);
            if (nodeEl) {
                updatePortVisibility(nodeEl, node);
            }
        });
    }

    // Initialize
    setupEventListeners();

    // Return public API
    return {
        createNodeElement,
        updateNodeElement,
        updatePortVisibility,
        updateAllPortVisibility,
        updateNodeStatus,
        animateNode,
        showInvalidConnectionFeedback,
        addNodeToSelection,
        removeNodeFromSelection,
        clearNodeSelection
    };
}