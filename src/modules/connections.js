/**
 * Connections Module - Manages connections between nodes
 */
import {eventBus, EVENTS} from '../core/events.js';
import {logger} from '../utils/logger.js';
import {getNodeDefinition} from '../data/node-types.js';

export function initConnections(elements, state, renderer) {
    const stateManager = state;

    /**
     * Create a new connection
     */
    function createConnection(sourceId, targetId) {
        // Validate connection
        const validationResult = validateConnection(sourceId, targetId);
        if (!validationResult.valid) {
            logger.warn(`Invalid connection: ${validationResult.message}`);
            showInvalidConnectionFeedback(targetId, validationResult.message);
            return null;
        }

        // Create connection object
        const id = stateManager.generateConnectionId();
        const connection = {
            id,
            source: sourceId,
            target: targetId
        };

        // Add to state (will trigger render through events)
        stateManager.addConnection(connection);

        logger.debug(`Connection created: ${sourceId} -> ${targetId}`);
        return id;
    }

    /**
     * Delete a connection
     */
    function deleteConnection(connectionId) {
        stateManager.removeConnection(connectionId);
    }

    /**
     * Start pending connection
     */
    function startPendingConnection(nodeId, portType) {
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
     * Complete pending connection
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

        // Check connection type - need one parent port and one child port
        if (pendingConnection.sourcePort === portType) {
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

        // Create the connection
        const connectionId = createConnection(sourceId, targetId);

        // Reset pending connection state
        resetPendingConnection();

        return connectionId;
    }

    /**
     * Reset pending connection state
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

        // Emit canceled event
        eventBus.emit(EVENTS.CONNECTION_CHANGED, {type: 'canceled'});
    }

    /**
     * Validate a potential connection
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
                message: '源节点或目标节点未选中'
            };
        }

        // Cannot connect to self
        if (sourceId === targetId) {
            return {
                valid: false,
                message: '不能连接到自身'
            };
        }

        // Check if target already has a parent
        const targetParents = connections.filter(conn => conn.target === targetId);
        if (targetParents.length > 0) {
            return {
                valid: false,
                message: '目标节点已有一个源节点'
            };
        }

        const sourceNodeDef = getNodeDefinition(sourceNode.type, sourceNode.category);
        const targetNodeDef = getNodeDefinition(targetNode.type, targetNode.category);

        if (!sourceNodeDef || !targetNodeDef) {
            return {
                valid: true, // Allow connection if definition not found
                message: ''
            };
        }

        // Check if source node can have children
        if (sourceNodeDef.maxChildren === 0) {
            return {
                valid: false,
                message: `${sourceNodeDef.name} 节点不能有子节点`
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
     * Check if a connection would create a cycle
     */
    function wouldCreateCycle(sourceId, targetId) {
        const connections = stateManager.getConnections();

        // If target is ancestor of source, a cycle would be created
        let currentId = sourceId;
        const visited = new Set();

        while (currentId) {
            if (visited.has(currentId)) break;
            visited.add(currentId);

            if (currentId === targetId) return true;

            // Find parent of current node
            const parentConn = connections.find(conn => conn.target === currentId);
            currentId = parentConn ? parentConn.source : null;
        }

        return false;
    }

    /**
     * Show feedback for invalid connection attempts
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
                alert(message);
            }
        }
    }

    /**
     * Find connections by node ID
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
     * Find parent of a node
     */
    function findParentNode(nodeId) {
        const connections = stateManager.getConnections();
        const parentConn = connections.find(conn => conn.target === nodeId);
        return parentConn ? parentConn.source : null;
    }

    /**
     * Find children of a node
     */
    function findChildNodes(nodeId) {
        const connections = stateManager.getConnections();
        return connections
            .filter(conn => conn.source === nodeId)
            .map(conn => conn.target);
    }

    /**
     * Set up event listeners
     */
    function setupEventListeners() {
        // When a node is deleted, remove its connections
        eventBus.on(EVENTS.NODE_CHANGED, (data) => {
            if (data.type === 'deleted') {
                const nodeId = data.node.id;
                const connectionsToRemove = findConnectionsByNode(nodeId);

                connectionsToRemove.forEach(conn => {
                    deleteConnection(conn.id);
                });
            }
        });

        // Handle connection selection from UI
        document.addEventListener('click', (e) => {
            const path = e.target.closest('.connection-path');
            if (path) {
                const connectionId = path.getAttribute('data-id');
                stateManager.selectConnection(connectionId);
            }
        });

        // Handle port clicks
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('port')) {
                e.stopPropagation();

                const nodeElement = e.target.closest('.tree-node');
                if (!nodeElement) return;

                const nodeId = nodeElement.getAttribute('data-id');
                const portType = e.target.classList.contains('port-parent') ? 'parent' : 'child';

                // Skip if port is disabled
                if (e.target.classList.contains('disabled')) return;

                const pendingConnection = stateManager.getState().pendingConnection;

                // If no pending connection, start one
                if (!pendingConnection) {
                    const rect = elements.canvas.getBoundingClientRect();
                    const mouseX = e.clientX - rect.left;
                    const mouseY = e.clientY - rect.top;
                    const worldPos = renderer.screenToWorld(mouseX, mouseY);

                    stateManager.setMousePosition(worldPos.x, worldPos.y);
                    startPendingConnection(nodeId, portType);
                }
                // Otherwise complete the connection
                else {
                    completePendingConnection(nodeId, portType);
                }
            }
        });

        // Cancel pending connection on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && stateManager.getState().pendingConnection) {
                resetPendingConnection();
            }
        });

        // Update pending connection on mouse move
        document.addEventListener('mousemove', (e) => {
            // 只有在有待处理连接时才更新
            if (!stateManager.getState().pendingConnection) return;

            // 获取画布相对于视窗的位置
            const rect = elements.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const worldPos = renderer.screenToWorld(mouseX, mouseY);

            stateManager.setMousePosition(worldPos.x, worldPos.y);
            renderer.renderPendingConnection();
        });
    }

    // Initialize event listeners
    setupEventListeners();

    // Return public API
    return {
        createConnection,
        deleteConnection,
        startPendingConnection,
        completePendingConnection,
        resetPendingConnection,
        validateConnection,
        findConnectionsByNode,
        findParentNode,
        findChildNodes
    };
}