/**
 * Connections Module - Manages connections between nodes
 */
import {eventBus, EVENTS} from '../core/events.js';
import {logger} from '../utils/logger.js';

export function initConnections(elements, state, renderer) {
    const stateManager = state;

    /**
     * Create a new connection
     */
    function createConnection(sourceId, targetId) {

        // Create connection object
        const id = stateManager.generateConnectionId();
        const connection = {
            id,
            source: sourceId,
            target: targetId
        };

        // Add to state (will trigger render through events)
        stateManager.addConnection(connection);
        // 更新相关节点的端口状态
        updateConnectedNodesPorts(sourceId, targetId);

        logger.debug(`Connection created: ${sourceId} -> ${targetId}`);
        return id;
    }

    /**
     * Delete a connection
     */
    function deleteConnection(connectionId) {
        // 获取连接详情，以便在删除后更新节点
        const connection = stateManager.getConnections().find(c => c.id === connectionId);
        const sourceId = connection ? connection.source : null;
        const targetId = connection ? connection.target : null;

        stateManager.removeConnection(connectionId);

        // 如果找到了连接，更新相关节点的端口状态
        if (sourceId && targetId) {
            updateConnectedNodesPorts(sourceId, targetId);
        }
    }

    /**
     * 更新连接到的节点的端口状态
     */
    function updateConnectedNodesPorts(sourceId, targetId) {
        // 更新源节点端口
        const sourceNodeEl = document.querySelector(`.tree-node[data-id="${sourceId}"]`);
        if (sourceNodeEl) {
            const sourceNode = stateManager.getNodes().find(n => n.id === sourceId);
            if (sourceNode) {
                renderer.updateNodePortVisibility(sourceNodeEl, sourceNode);
            }
        }

        // 更新目标节点端口
        const targetNodeEl = document.querySelector(`.tree-node[data-id="${targetId}"]`);
        if (targetNodeEl) {
            const targetNode = stateManager.getNodes().find(n => n.id === targetId);
            if (targetNode) {
                renderer.updateNodePortVisibility(targetNodeEl, targetNode);
            }
        }
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

        eventBus.on(EVENTS.CONNECTION_CHANGED,(data)=>{
            if (data.type==='deleted'){
                deleteConnection(data.id)
            }
        })

        // Handle connection selection from UI
        document.addEventListener('click', (e) => {
            const path = e.target.closest('.connection-path');
            const selected_connection = stateManager.getSelectedConnection();
            if (path) {
                const connectionId = path.getAttribute('data-id');
                stateManager.selectConnection(connectionId, "selected");
            } else if (selected_connection) {
                stateManager.selectConnection(selected_connection, "unselected");
            }

            if (e.target.classList.contains('port')) {
                e.stopPropagation();

                // 如果端口被禁用，不处理点击
                if (e.target.classList.contains('disabled')) {
                    return;
                }

                const nodeElement = e.target.closest('.tree-node');
                if (!nodeElement) return;

                const nodeId = nodeElement.getAttribute('data-id');
                const portType = e.target.classList.contains('port-parent') ? 'parent' : 'child';

                const pendingConnection = stateManager.getState().pendingConnection;

                // 如果没有待处理连接，开始一个
                if (!pendingConnection) {
                    const rect = elements.canvas.getBoundingClientRect();
                    const mouseX = e.clientX - rect.left;
                    const mouseY = e.clientY - rect.top;
                    const worldPos = renderer.screenToWorld(mouseX, mouseY);

                    stateManager.setMousePosition(worldPos.x, worldPos.y);
                    startPendingConnection(nodeId, portType);
                }
                // 否则完成连接
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
        findConnectionsByNode,
        findParentNode,
        findChildNodes
    };
}