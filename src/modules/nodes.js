/**
 * Nodes module
 * Manages node operations for the behavior tree editor
 */

import {NODE_TYPES, getDefaultPropertiesForCategory, getDefaultConstraintsForCategory} from '../data/node-types.js';
import {editorEvents, EDITOR_EVENTS} from './events.js';
import {logger} from '../index.js';

export function initNodes(elements, state, renderer) {
    const stateManager = state;

    logger.debug('Initializing nodes module');

    // Set up event listeners
    setupEventListeners();

    /**
     * Create a new node
     * @param {string} type - Node type
     * @param {string} category - Node category
     * @param {number} x - X position
     * @param {number} y - Y position
     * @returns {string} - ID of the created node
     */
    function createNode(type, category, x, y) {
        logger.debug(`Creating node: ${type} (${category}) at (${x}, ${y})`);

        try {
            // Generate a unique ID for the node
            const id = stateManager.generateNodeId();

            // Get node type definition (to get default values, etc.)
            const nodeTypeDef = getNodeTypeDefinition(type, category);

            if (!nodeTypeDef) {
                throw new Error(`Node type ${type} not found in category ${category}`);
            }

            // Create properties based on node type
            const properties = {};
            if (nodeTypeDef.properties) {
                nodeTypeDef.properties.forEach(prop => {
                    properties[prop.name] = prop.default || '';
                });
            }

            // Create node object
            const node = {
                id,
                type,
                name: nodeTypeDef.name || type,
                category,
                x,
                y,
                properties
            };

            // Add node to state
            stateManager.addNode(node);

            // Request render update
            renderer.requestNodeUpdate(id);

            return id;
        } catch (error) {
            logger.error('Error creating node:', error);
            return null;
        }
    }

    /**
     * Delete a node
     * @param {string} nodeId - ID of the node to delete
     */
    function deleteNode(nodeId) {
        logger.debug(`Deleting node: ${nodeId}`);

        // Remove connections related to this node
        const connections = stateManager.getConnections();
        const connToRemove = connections.filter(
            conn => conn.source === nodeId || conn.target === nodeId
        );

        connToRemove.forEach(conn => {
            stateManager.removeConnection(conn.id);
        });

        // Remove the node
        stateManager.removeNode(nodeId);

        // Request render update
        renderer.requestRender();
    }

    /**
     * Delete multiple nodes
     * @param {Array} nodeIds - Array of node IDs to delete
     */
    function deleteNodes(nodeIds) {
        logger.debug(`Deleting multiple nodes: ${nodeIds.length}`);

        // Remove connections related to these nodes
        const connections = stateManager.getConnections();
        const connToRemove = connections.filter(
            conn => nodeIds.includes(conn.source) || nodeIds.includes(conn.target)
        );

        connToRemove.forEach(conn => {
            stateManager.removeConnection(conn.id);
        });

        // Remove the nodes
        nodeIds.forEach(nodeId => {
            stateManager.removeNode(nodeId);
        });

        // Request render update
        renderer.requestRender();
    }

    /**
     * Delete selected nodes
     */
    function deleteSelectedNodes() {
        const selectedNodes = stateManager.getSelectedNodes();

        if (selectedNodes.length === 0) return;

        deleteNodes(selectedNodes);

        // Clear selection
        stateManager.clearSelection();
    }

    /**
     * Update node properties
     * @param {string} nodeId - ID of the node to update
     * @param {Object} properties - Updated properties
     */
    function updateNodeProperties(nodeId, properties) {
        logger.debug(`Updating node properties: ${nodeId}`);

        const node = stateManager.getNodes().find(n => n.id === nodeId);

        if (!node) {
            logger.warn(`Node not found: ${nodeId}`);
            return;
        }

        // Update node properties
        const updatedProperties = {...node.properties, ...properties};
        stateManager.updateNode(nodeId, {properties: updatedProperties});

        // Request render update
        renderer.requestNodeUpdate(nodeId);

        // Notify about node update
        editorEvents.emit(EDITOR_EVENTS.NODE_UPDATED, node);
    }

    /**
     * Update node basic information (name, etc.)
     * @param {string} nodeId - ID of the node to update
     * @param {Object} updates - Updates to apply
     */
    function updateNodeInfo(nodeId, updates) {
        logger.debug(`Updating node info: ${nodeId}`);

        const node = stateManager.getNodes().find(n => n.id === nodeId);

        if (!node) {
            logger.warn(`Node not found: ${nodeId}`);
            return;
        }

        // Update node
        stateManager.updateNode(nodeId, updates);

        // Request render update
        renderer.requestNodeUpdate(nodeId);

        // Notify about node update
        editorEvents.emit(EDITOR_EVENTS.NODE_UPDATED, node);
    }

    /**
     * Add a custom node type
     * @param {Object} nodeType - Node type definition
     */
    function addCustomNodeType(nodeType) {
        logger.debug(`Adding custom node type: ${nodeType.type}`);

        // Basic validation
        if (!nodeType.type || !nodeType.name || !nodeType.category) {
            logger.error('Invalid node type definition:', nodeType);
            return;
        }

        // Add to custom node types
        stateManager.addCustomNodeType(nodeType);

        // Notify about node type addition
        editorEvents.emit(EDITOR_EVENTS.NODE_TYPE_ADDED, nodeType);
    }

    /**
     * Remove a custom node type
     * @param {string} type - Type identifier
     */
    function removeCustomNodeType(type) {
        logger.debug(`Removing custom node type: ${type}`);

        // Remove all nodes of this type
        const nodes = stateManager.getNodes();
        const nodeIds = nodes.filter(node => node.type === type).map(node => node.id);

        if (nodeIds.length > 0) {
            deleteNodes(nodeIds);
        }

        // Remove the node type
        stateManager.removeCustomNodeType(type);
    }

    /**
     * Get node type definition from built-in or custom types
     * @param {string} type - Node type
     * @param {string} category - Node category
     * @returns {Object} - Node type definition
     */
    function getNodeTypeDefinition(type, category) {
        // Check built-in types first (from the external node-types.js)
        // This requires that NODE_TYPES is defined globally
        if (NODE_TYPES && NODE_TYPES[category]) {
            const builtInType = NODE_TYPES[category].find(nt => nt.type === type);
            if (builtInType) return builtInType;
        }

        // Then check custom types
        return stateManager.getCustomNodeTypes().find(nt => nt.type === type);
    }

    /**
     * Clone a node
     * @param {string} nodeId - ID of the node to clone
     * @param {number} offsetX - X-axis offset for the clone
     * @param {number} offsetY - Y-axis offset for the clone
     * @returns {string} - ID of the cloned node
     */
    function cloneNode(nodeId, offsetX = 50, offsetY = 50) {
        const nodes = stateManager.getNodes();
        const originalNode = nodes.find(n => n.id === nodeId);

        if (!originalNode) {
            logger.warn(`Node not found for cloning: ${nodeId}`);
            return null;
        }

        logger.debug(`Cloning node: ${nodeId}`);

        // Create a new node with the same properties but a new ID
        const newId = createNode(
            originalNode.type,
            originalNode.category,
            originalNode.x + offsetX,
            originalNode.y + offsetY
        );

        if (!newId) return null;

        // Copy properties
        const newNode = nodes.find(n => n.id === newId);
        stateManager.updateNode(newId, {
            name: `${originalNode.name} (copy)`,
            properties: {...originalNode.properties}
        });

        // Request render update
        renderer.requestNodeUpdate(newId);

        return newId;
    }

    /**
     * Clone multiple nodes with their connections
     * @param {Array} nodeIds - Array of node IDs to clone
     * @param {number} offsetX - X-axis offset for the clones
     * @param {number} offsetY - Y-axis offset for the clones
     * @returns {Array} - Array of new node IDs
     */
    function cloneNodes(nodeIds, offsetX = 50, offsetY = 50) {
        if (nodeIds.length === 0) return [];

        logger.debug(`Cloning multiple nodes: ${nodeIds.length}`);

        // Create a map from original IDs to new IDs
        const idMap = {};

        // Clone all nodes first
        nodeIds.forEach(nodeId => {
            const originalNode = stateManager.getNodes().find(n => n.id === nodeId);

            if (originalNode) {
                const newId = cloneNode(nodeId, offsetX, offsetY);
                idMap[nodeId] = newId;
            }
        });

        // Clone connections between the nodes
        const connections = stateManager.getConnections();
        const internalConnections = connections.filter(
            conn => nodeIds.includes(conn.source) && nodeIds.includes(conn.target)
        );

        internalConnections.forEach(conn => {
            const newSource = idMap[conn.source];
            const newTarget = idMap[conn.target];

            if (newSource && newTarget) {
                const newConnId = stateManager.generateConnectionId();
                const newConn = {
                    id: newConnId,
                    source: newSource,
                    target: newTarget
                };

                stateManager.addConnection(newConn);
            }
        });

        // Request render update
        renderer.requestRender();

        return Object.values(idMap);
    }

    /**
     * Clone selected nodes
     * @param {number} offsetX - X-axis offset for the clones
     * @param {number} offsetY - Y-axis offset for the clones
     * @returns {Array} - Array of new node IDs
     */
    function cloneSelectedNodes(offsetX = 50, offsetY = 50) {
        const selectedNodes = stateManager.getSelectedNodes();
        return cloneNodes(selectedNodes, offsetX, offsetY);
    }

    /**
     * Align selected nodes
     * @param {string} alignType - Alignment type ('left', 'center', 'right', 'top', 'middle', 'bottom')
     */
    function alignSelectedNodes(alignType) {
        const selectedNodes = stateManager.getSelectedNodes();

        if (selectedNodes.length <= 1) {
            logger.debug('Not enough nodes selected for alignment');
            return;
        }

        logger.debug(`Aligning nodes: ${alignType}`);

        // Get the actual node objects
        const nodes = selectedNodes.map(id =>
            stateManager.getNodes().find(node => node.id === id)
        ).filter(Boolean);

        // Calculate target position based on alignment type
        let targetValue;

        switch (alignType) {
            case 'left':
                // Align to leftmost node
                targetValue = Math.min(...nodes.map(node => node.x));
                // Apply to all selected nodes
                nodes.forEach(node => {
                    stateManager.updateNode(node.id, {x: targetValue});
                });
                break;

            case 'center':
                // Find average center position
                targetValue = nodes.reduce((sum, node) => sum + (node.x + 75), 0) / nodes.length;
                // Apply to all selected nodes
                nodes.forEach(node => {
                    stateManager.updateNode(node.id, {x: targetValue - 75});
                });
                break;

            case 'right':
                // Align to rightmost node
                targetValue = Math.max(...nodes.map(node => node.x + 150));
                // Apply to all selected nodes
                nodes.forEach(node => {
                    stateManager.updateNode(node.id, {x: targetValue - 150});
                });
                break;

            case 'top':
                // Align to topmost node
                targetValue = Math.min(...nodes.map(node => node.y));
                // Apply to all selected nodes
                nodes.forEach(node => {
                    stateManager.updateNode(node.id, {y: targetValue});
                });
                break;

            case 'middle':
                // Find average middle position
                targetValue = nodes.reduce((sum, node) => sum + (node.y + 20), 0) / nodes.length;
                // Apply to all selected nodes
                nodes.forEach(node => {
                    stateManager.updateNode(node.id, {y: targetValue - 20});
                });
                break;

            case 'bottom':
                // Align to bottommost node
                targetValue = Math.max(...nodes.map(node => node.y + 40));
                // Apply to all selected nodes
                nodes.forEach(node => {
                    stateManager.updateNode(node.id, {y: targetValue - 40});
                });
                break;
        }

        // Apply grid snapping if enabled
        if (stateManager.getGrid().snap) {
            nodes.forEach(node => {
                const grid = stateManager.getGrid();
                const snappedX = Math.round(node.x / grid.size) * grid.size;
                const snappedY = Math.round(node.y / grid.size) * grid.size;

                stateManager.updateNode(node.id, {x: snappedX, y: snappedY});
            });
        }

        // Notify about node movement
        editorEvents.emit(EDITOR_EVENTS.NODE_MOVED, selectedNodes);

        // Request render update
        renderer.requestRender();
    }

    /**
     * Distribute selected nodes evenly
     * @param {string} distributeType - Distribution type ('horizontal', 'vertical')
     */
    function distributeSelectedNodes(distributeType) {
        const selectedNodes = stateManager.getSelectedNodes();

        if (selectedNodes.length <= 2) {
            logger.debug('Not enough nodes selected for distribution');
            return;
        }

        logger.debug(`Distributing nodes: ${distributeType}`);

        // Get the actual node objects
        const nodes = selectedNodes.map(id =>
            stateManager.getNodes().find(node => node.id === id)
        ).filter(Boolean);

        if (distributeType === 'horizontal') {
            // Sort nodes by x position
            nodes.sort((a, b) => a.x - b.x);

            // Find min and max x
            const minX = nodes[0].x;
            const maxX = nodes[nodes.length - 1].x;
            const totalDistance = maxX - minX;

            // Calculate spacing
            const spacing = totalDistance / (nodes.length - 1);

            // Distribute nodes
            for (let i = 1; i < nodes.length - 1; i++) {
                const targetX = minX + i * spacing;
                stateManager.updateNode(nodes[i].id, {x: targetX});
            }
        } else if (distributeType === 'vertical') {
            // Sort nodes by y position
            nodes.sort((a, b) => a.y - b.y);

            // Find min and max y
            const minY = nodes[0].y;
            const maxY = nodes[nodes.length - 1].y;
            const totalDistance = maxY - minY;

            // Calculate spacing
            const spacing = totalDistance / (nodes.length - 1);

            // Distribute nodes
            for (let i = 1; i < nodes.length - 1; i++) {
                const targetY = minY + i * spacing;
                stateManager.updateNode(nodes[i].id, {y: targetY});
            }
        }

        // Apply grid snapping if enabled
        if (stateManager.getGrid().snap) {
            nodes.forEach(node => {
                const grid = stateManager.getGrid();
                const snappedX = Math.round(node.x / grid.size) * grid.size;
                const snappedY = Math.round(node.y / grid.size) * grid.size;

                stateManager.updateNode(node.id, {x: snappedX, y: snappedY});
            });
        }

        // Notify about node movement
        editorEvents.emit(EDITOR_EVENTS.NODE_MOVED, selectedNodes);

        // Request render update
        renderer.requestRender();
    }

    /**
     * Find a node at a specific position (in world coordinates)
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {Object|null} - Node at the position or null
     */
    function findNodeAt(x, y) {
        const nodes = stateManager.getNodes();

        // Search in reverse order (top-most node first)
        for (let i = nodes.length - 1; i >= 0; i--) {
            const node = nodes[i];
            if (x >= node.x && x <= node.x + 150 && y >= node.y && y <= node.y + 40) {
                return node;
            }
        }

        return null;
    }

    /**
     * Set up event listeners for nodes
     */
    function setupEventListeners() {
        // Listen for node creation requests
        editorEvents.on(EDITOR_EVENTS.NODE_CREATED, nodeData => {
            if (typeof nodeData === 'object') {
                createNode(nodeData.type, nodeData.category, nodeData.x, nodeData.y);
            }
        });

        // Listen for alignment requests
        editorEvents.on(EDITOR_EVENTS.ALIGN_REQUESTED, alignType => {
            alignSelectedNodes(alignType);
        });

        // Listen for deletion requests
        editorEvents.on(EDITOR_EVENTS.DELETE_SELECTED_REQUESTED, () => {
            deleteSelectedNodes();
        });

        // Add event listeners for alignment buttons
        const alignButtons = {
            left: document.getElementById('align-left-btn'),
            center: document.getElementById('align-center-btn'),
            right: document.getElementById('align-right-btn'),
            top: document.getElementById('align-top-btn'),
            middle: document.getElementById('align-middle-btn'),
            bottom: document.getElementById('align-bottom-btn')
        };

        Object.entries(alignButtons).forEach(([alignType, button]) => {
            if (button) {
                button.addEventListener('click', () => {
                    alignSelectedNodes(alignType);
                });
            }
        });
    }

    // Return public API
    return {
        createNode,
        deleteNode,
        deleteNodes,
        deleteSelectedNodes,
        updateNodeProperties,
        updateNodeInfo,
        addCustomNodeType,
        removeCustomNodeType,
        getNodeTypeDefinition,
        cloneNode,
        cloneNodes,
        cloneSelectedNodes,
        alignSelectedNodes,
        distributeSelectedNodes,
        findNodeAt
    };
}