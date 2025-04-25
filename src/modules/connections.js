/**
 * Connections module
 * Manages connections between nodes in the behavior tree
 */

import {NODE_TYPES, getDefaultPropertiesForCategory, getDefaultConstraintsForCategory} from '../data/node-types.js';
import {editorEvents, EDITOR_EVENTS} from './events.js';
import {logger} from '../index.js';

export function initConnections(elements, state, renderer) {
    const stateManager = state;

    logger.debug('Initializing connections module');

    // Set up event listeners
    setupEventListeners();

    /**
     * Create a new connection between nodes
     * @param {string} sourceId - Source node ID
     * @param {string} targetId - Target node ID
     * @returns {string|null} - ID of the created connection or null if invalid
     */
    function createConnection(sourceId, targetId) {
        logger.debug(`Creating connection: ${sourceId} -> ${targetId}`);

        // Validate connection
        const validationResult = validateConnection(sourceId, targetId);
        if (!validationResult.valid) {
            logger.warn(`Invalid connection: ${validationResult.message}`);
            return null;
        }

        // Create connection
        const id = stateManager.generateConnectionId();
        const connection = {
            id,
            source: sourceId,
            target: targetId
        };

        // Add to state
        stateManager.addConnection(connection);

        // Request render update
        renderer.requestConnectionUpdate(id);

        return id;
    }

    /**
     * Delete a connection
     * @param {string} connectionId - ID of the connection to delete
     */
    function deleteConnection(connectionId) {
        logger.debug(`Deleting connection: ${connectionId}`);

        // Remove the connection
        stateManager.removeConnection(connectionId);

        // Request render update
        renderer.requestRender();
    }

    /**
     * Validate a potential connection
     * @param {string} sourceId - Source node ID
     * @param {string} targetId - Target node ID
     * @returns {Object} - Validation result {valid, message}
     */
    function validateConnection(sourceId, targetId) {
        const nodes = stateManager.getNodes();
        const connections = stateManager.getConnections();

        // Find source and target nodes
        const sourceNode = nodes.find(node => node.id === sourceId);
        const targetNode = nodes.find(node => node.id === targetId);

        if (!sourceNode || !targetNode) {
            return {
                valid: false,
                message: 'Source or target node not found'
            };
        }

        // Cannot connect to self
        if (sourceId === targetId) {
            return {
                valid: false,
                message: 'Cannot connect a node to itself'
            };
        }

        // Check if target already has a parent
        const targetParents = connections.filter(conn => conn.target === targetId);
        if (targetParents.length > 0) {
            return {
                valid: false,
                message: 'Target node already has a parent'
            };
        }

        // Get node type definitions to check constraints
        const sourceNodeDef = getNodeTypeDefinition(sourceNode.type, sourceNode.category);
        const targetNodeDef = getNodeTypeDefinition(targetNode.type, targetNode.category);

        if (!sourceNodeDef || !targetNodeDef) {
            return {
                valid: false,
                message: 'Invalid node type'
            };
        }

        // Check if source node can have children (leaf nodes can't have children)
        if (sourceNodeDef.maxChildren === 0) {
            return {
                valid: false,
                message: `${sourceNodeDef.name} nodes cannot have children`
            };
        }

        // Check if source node already has maximum number of children
        if (sourceNodeDef.maxChildren !== null) {
            const childCount = connections.filter(conn => conn.source === sourceId).length;
            if (childCount >= sourceNodeDef.maxChildren) {
                return {
                    valid: false,
                    message: `${sourceNodeDef.name} nodes can have at most ${sourceNodeDef.maxChildren} ${sourceNodeDef.maxChildren === 1 ? 'child' : 'children'}`
                };
            }
        }

        // Check for cycles
        if (wouldCreateCycle(sourceId, targetId)) {
            return {
                valid: false,
                message: 'Connection would create a cycle'
            };
        }

        return {valid: true, message: ''};
    }

    /**
     * Check if a connection would create a cycle in the tree
     * @param {string} sourceId - Source node ID
     * @param {string} targetId - Target node ID
     * @returns {boolean} - Whether a cycle would be created
     */
    function wouldCreateCycle(sourceId, targetId) {
        const connections = stateManager.getConnections();

        // If target is ancestor of source, a cycle would be created
        let currentId = sourceId;
        const visited = new Set();

        while (currentId) {
            // Prevent infinite loops
            if (visited.has(currentId)) break;
            visited.add(currentId);

            // If we reached the target, a cycle would be created
            if (currentId === targetId) return true;

            // Find parent of current node
            const parentConn = connections.find(conn => conn.target === currentId);
            currentId = parentConn ? parentConn.source : null;
        }

        return false;
    }

    /**
     * Start a pending connection
     * @param {string} nodeId - Source node ID
     * @param {string} portType - Port type ('parent' or 'child')
     */
    function startPendingConnection(nodeId, portType) {
        logger.debug(`Starting pending connection from ${nodeId} (${portType})`);

        stateManager.startPendingConnection(nodeId, portType);

        // Show active connection layer
        elements.activeConnectionLayer.style.display = 'block';

        // Highlight the port
        const portElement = document.querySelector(`.tree-node[data-id="${nodeId}"] .port-${portType}`);
        if (portElement) {
            portElement.classList.add('active');
        }

        // Initial rendering of the pending connection
        renderer.renderPendingConnection();
    }

    /**
     * Complete a pending connection
     * @param {string} nodeId - Target node ID
     * @param {string} portType - Port type ('parent' or 'child')
     * @returns {string|null} - ID of the created connection or null if invalid
     */
    function completePendingConnection(nodeId, portType) {
        const pendingConnection = stateManager.getState().pendingConnection;

        if (!pendingConnection) {
            logger.warn('No pending connection to complete');
            return null;
        }

        // Don't connect to self
        if (nodeId === pendingConnection.sourceId) {
            resetPendingConnection();
            return null;
        }

        // Check connection type - we need to have one parent port and one child port
        if (pendingConnection.sourcePort === portType) {
            // Can't connect same port types
            showInvalidConnectionFeedback(nodeId, 'Cannot connect same port types');
            resetPendingConnection();
            return null;
        }

        // Determine source and target nodes based on port types
        let sourceId, targetId;

        if (pendingConnection.sourcePort === 'child') {
            // Source child port to target parent port
            sourceId = pendingConnection.sourceId;
            targetId = nodeId;
        } else {
            // Source parent port to target child port
            sourceId = nodeId;
            targetId = pendingConnection.sourceId;
        }

        // Validate and create the connection
        const validationResult = validateConnection(sourceId, targetId);

        if (!validationResult.valid) {
            showInvalidConnectionFeedback(nodeId, validationResult.message);
            resetPendingConnection();
            return null;
        }

        // Create the connection
        const connectionId = createConnection(sourceId, targetId);

        // Reset pending connection state
        resetPendingConnection();

        return connectionId;
    }

    /**
     * Reset the pending connection state
     */
    function resetPendingConnection() {
        const pendingConnection = stateManager.getState().pendingConnection;

        if (pendingConnection) {
            // Remove highlight from the source port
            const portElement = document.querySelector(`.tree-node[data-id="${pendingConnection.sourceId}"] .port-${pendingConnection.sourcePort}`);
            if (portElement) {
                portElement.classList.remove('active');
            }
        }

        stateManager.clearPendingConnection();
        elements.activeConnectionLayer.style.display = 'none';
        elements.activeConnectionLayer.innerHTML = '';
    }

    /**
     * Show feedback for invalid connection attempts
     * @param {string} nodeId - Node ID
     * @param {string} message - Error message
     */
    function showInvalidConnectionFeedback(nodeId, message) {
        const nodeElement = document.querySelector(`.tree-node[data-id="${nodeId}"]`);

        if (nodeElement) {
            // Add invalid connection class
            nodeElement.classList.add('invalid-connection');

            // Remove class after animation
            setTimeout(() => {
                nodeElement.classList.remove('invalid-connection');
            }, 800);

            // Show message if provided
            if (message) {
                // Could use a tooltip or notification system here
                logger.warn(`Invalid connection: ${message}`);
                alert(message);
            }
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
        if (NODE_TYPES && NODE_TYPES[category]) {
            const builtInType = NODE_TYPES[category].find(nt => nt.type === type);
            if (builtInType) return builtInType;
        }

        // Then check custom types
        return stateManager.getCustomNodeTypes().find(nt => nt.type === type);
    }

    /**
     * Find connections by node ID
     * @param {string} nodeId - Node ID
     * @param {string} role - Role ('source', 'target', or 'both')
     * @returns {Array} - Array of matching connections
     */
    function findConnectionsByNode(nodeId, role = 'both') {
        const connections = stateManager.getConnections();

        if (role === 'source') {
            return connections.filter(conn => conn.source === nodeId);
        } else if (role === 'target') {
            return connections.filter(conn => conn.target === nodeId);
        } else {
            return connections.filter(conn => conn.source === nodeId || conn.target === nodeId);
        }
    }

    /**
     * Check if a node is a root node (has no parent)
     * @param {string} nodeId - Node ID
     * @returns {boolean} - Whether the node is a root
     */
    function isRootNode(nodeId) {
        const connections = stateManager.getConnections();
        return !connections.some(conn => conn.target === nodeId);
    }

    /**
     * Find all root nodes in the tree
     * @returns {Array} - Array of root node IDs
     */
    function findRootNodes() {
        const nodes = stateManager.getNodes();
        const connections = stateManager.getConnections();

        // Root nodes are those that have no parent
        const targetIds = connections.map(conn => conn.target);
        return nodes.filter(node => !targetIds.includes(node.id)).map(node => node.id);
    }

    /**
     * Find children of a node
     * @param {string} nodeId - Node ID
     * @returns {Array} - Array of child node IDs
     */
    function findChildNodes(nodeId) {
        const connections = stateManager.getConnections();
        return connections
            .filter(conn => conn.source === nodeId)
            .map(conn => conn.target);
    }

    /**
     * Find parent of a node
     * @param {string} nodeId - Node ID
     * @returns {string|null} - Parent node ID or null
     */
    function findParentNode(nodeId) {
        const connections = stateManager.getConnections();
        const parentConn = connections.find(conn => conn.target === nodeId);
        return parentConn ? parentConn.source : null;
    }

    /**
     * Set up event listeners for connections
     */
    function setupEventListeners() {
        // Listen for node deletion (to clean up connections)
        editorEvents.on(EDITOR_EVENTS.NODE_DELETED, node => {
            const nodeId = node.id;
            const connectionsToRemove = findConnectionsByNode(nodeId);

            connectionsToRemove.forEach(conn => {
                deleteConnection(conn.id);
            });
        });

        // Handle connection context menu events
        editorEvents.on(EDITOR_EVENTS.CONNECTION_SELECTED, connectionId => {
            stateManager.getState().selectedConnection = connectionId;
        });
    }

    // Return public API
    return {
        createConnection,
        deleteConnection,
        validateConnection,
        startPendingConnection,
        completePendingConnection,
        resetPendingConnection,
        findConnectionsByNode,
        isRootNode,
        findRootNodes,
        findChildNodes,
        findParentNode
    };
}