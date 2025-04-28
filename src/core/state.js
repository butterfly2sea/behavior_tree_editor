/**
 * State Management
 *
 * Handles the application state and provides methods to modify it
 */
import {eventBus, EVENTS} from './events.js';
import {config} from './config.js';
import {logger} from '../utils/logger.js';

// Initial state definition
const initialState = {
    // Nodes and connections
    nodes: [],
    connections: [],
    customNodeTypes: [],

    // UI state
    selectedNodes: [],
    selectedConnection: null,
    pendingConnection: null,
    collapsedCategories: {},

    // Selection box
    selectionBox: {
        active: false,
        startX: 0,
        startY: 0,
        endX: 0,
        endY: 0
    },

    // Dragging state
    dragging: {
        active: false,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
        nodes: [],
        isDraggingCanvas: false
    },

    // Grid
    grid: {...config.defaultGrid},

    // Current mouse position (world coordinates)
    mousePosition: {x: 0, y: 0},

    // Viewport
    viewport: {
        scale: config.viewport.defaultScale,
        offsetX: 0,
        offsetY: 0,
        minScale: config.viewport.minScale,
        maxScale: config.viewport.maxScale
    },

    // Visible area (for culling)
    visibleArea: {
        minX: 0,
        minY: 0,
        maxX: 0,
        maxY: 0
    },

    // IDs counters
    idCounters: {
        nodes: 0,
        connections: 0
    },

    // Layout settings
    layout: {
        type: config.layout.defaultType,
        options: {
            nodeSpacingX: config.layout.nodeSpacingX,
            nodeSpacingY: config.layout.nodeSpacingY,
            animation: true,
            animationDuration: config.layout.animationDuration
        }
    },

    // Minimap settings
    minimap: {
        width: 150,
        height: 150,
        isVisible: true
    },

    // Monitor state
    monitor: {
        active: false,
        eventSource: null,
        nodeStates: {}
    }
};

// State management module
export function initState() {
    // Clone initial state to avoid mutations
    let state = structuredClone(initialState);

    // State manager API
    return {
        // =============== Getters ===============
        getState: () => state,
        getNodes: () => state.nodes,
        getConnections: () => state.connections,
        getSelectedNodes: () => state.selectedNodes,
        getSelectedConnection: () => state.selectedConnection,
        getCustomNodeTypes: () => state.customNodeTypes,
        getViewport: () => state.viewport,
        getGrid: () => state.grid,
        getLayout: () => state.layout,
        getMinimap: () => state.minimap,
        getVisibleArea: () => state.visibleArea,
        getMonitor: () => state.monitor,

        // =============== Mutations ===============
        // Mouse position
        setMousePosition: (x, y) => {
            state.mousePosition = {x, y};
        },

        // Nodes
        addNode: (node) => {
            state.nodes.push(node);
            eventBus.emit(EVENTS.NODE_CHANGED, {type: 'created', node});
            return node.id;
        },

        removeNode: (nodeId) => {
            const index = state.nodes.findIndex(n => n.id === nodeId);
            if (index !== -1) {
                const node = state.nodes[index];
                state.nodes.splice(index, 1);

                // Also remove from selection
                const selIndex = state.selectedNodes.indexOf(nodeId);
                if (selIndex !== -1) {
                    state.selectedNodes.splice(selIndex, 1);
                    eventBus.emit(EVENTS.SELECTION_CHANGED, {nodes: state.selectedNodes});
                }

                eventBus.emit(EVENTS.NODE_CHANGED, {type: 'deleted', node});
                return true;
            }
            return false;
        },

        updateNode: (nodeId, updates) => {
            const node = state.nodes.find(n => n.id === nodeId);
            if (node) {
                Object.assign(node, updates);
                eventBus.emit(EVENTS.NODE_CHANGED, {type: 'updated', node, updates});
                return true;
            }
            return false;
        },

        // Batch update nodes (for layout)
        batchUpdateNodes: (updates) => {
            const updatedIds = [];

            updates.forEach(update => {
                const node = state.nodes.find(n => n.id === update.id);
                if (node) {
                    Object.assign(node, update);
                    updatedIds.push(node.id);
                }
            });

            if (updatedIds.length > 0) {
                eventBus.emit(EVENTS.NODE_CHANGED, {
                    type: 'batch-updated',
                    nodeIds: updatedIds
                });
            }

            return updatedIds.length > 0;
        },

        // Connections
        addConnection: (connection) => {
            state.connections.push(connection);
            eventBus.emit(EVENTS.CONNECTION_CHANGED, {
                type: 'created',
                connection
            });
            return connection.id;
        },

        removeConnection: (connectionId) => {
            const index = state.connections.findIndex(c => c.id === connectionId);
            if (index !== -1) {
                const connection = state.connections[index];
                state.connections.splice(index, 1);

                // Clear selected connection if this one was selected
                if (state.selectedConnection === connectionId) {
                    state.selectedConnection = null;
                }

                eventBus.emit(EVENTS.CONNECTION_CHANGED, {
                    type: 'deleted',
                    connection
                });
                return true;
            }
            return false;
        },

        // Selection
        clearSelection: () => {
            if (state.selectedNodes.length > 0) {
                state.selectedNodes = [];
                eventBus.emit(EVENTS.SELECTION_CHANGED, {nodes: []});
            }
        },

        selectNode: (nodeId, addToSelection = false) => {
            if (!addToSelection) {
                state.selectedNodes = [nodeId];
            } else if (!state.selectedNodes.includes(nodeId)) {
                state.selectedNodes.push(nodeId);
            }

            eventBus.emit(EVENTS.SELECTION_CHANGED, {nodes: state.selectedNodes});
        },

        deselectNode: (nodeId) => {
            const index = state.selectedNodes.indexOf(nodeId);
            if (index !== -1) {
                state.selectedNodes.splice(index, 1);
                eventBus.emit(EVENTS.SELECTION_CHANGED, {nodes: state.selectedNodes});
            }
        },

        selectNodes: (nodeIds) => {
            state.selectedNodes = [...nodeIds];
            eventBus.emit(EVENTS.SELECTION_CHANGED, {nodes: state.selectedNodes});
        },

        selectConnection: (connectionId) => {
            state.selectedConnection = connectionId;
            eventBus.emit(EVENTS.CONNECTION_CHANGED, {
                type: 'selected',
                connectionId
            });
        },

        // Generation of IDs
        generateNodeId: () => `node_${state.idCounters.nodes++}`,
        generateConnectionId: () => `conn_${state.idCounters.connections++}`,

        // Pending connection
        startPendingConnection: (sourceId, sourcePort) => {
            state.pendingConnection = {sourceId, sourcePort};
        },

        clearPendingConnection: () => {
            state.pendingConnection = null;
        },

        // Selection box
        startSelectionBox: (x, y) => {
            state.selectionBox = {
                active: true,
                startX: x,
                startY: y,
                endX: x,
                endY: y
            };
        },

        updateSelectionBox: (x, y) => {
            if (state.selectionBox.active) {
                state.selectionBox.endX = x;
                state.selectionBox.endY = y;
            }
        },

        endSelectionBox: () => {
            state.selectionBox.active = false;
        },

        // Drag operations
        startDragging: (x, y, isDraggingCanvas = false) => {
            state.dragging = {
                active: true,
                startX: x,
                startY: y,
                currentX: x,
                currentY: y,
                nodes: [],
                isDraggingCanvas
            };

            if (!isDraggingCanvas) {
                // Store positions of selected nodes
                state.dragging.nodes = state.selectedNodes.map(nodeId => {
                    const node = state.nodes.find(n => n.id === nodeId);
                    return {
                        id: nodeId,
                        offsetX: node.x,
                        offsetY: node.y
                    };
                });
            }
        },

        updateDragging: (x, y) => {
            if (state.dragging.active) {
                state.dragging.currentX = x;
                state.dragging.currentY = y;
            }
        },

        endDragging: () => {
            state.dragging.active = false;
            state.dragging.nodes = [];
        },

        // Cleanup from layout operations
        cleanupAfterLayout: () => {
            if (state.selectionBox.active) {
                state.selectionBox.active = false;
            }

            if (state.dragging.active) {
                state.dragging.active = false;
                state.dragging.nodes = [];
            }
        },

        // Grid settings
        updateGridSettings: (updates) => {
            Object.assign(state.grid, updates);
            eventBus.emit(EVENTS.GRID_CHANGED, state.grid);
        },

        // Layout settings
        updateLayoutSettings: (updates) => {
            Object.assign(state.layout, updates);
        },

        // Viewport
        updateViewport: (updates) => {
            Object.assign(state.viewport, updates);

            // Clamp scale to min/max
            state.viewport.scale = Math.min(
                Math.max(state.viewport.scale, state.viewport.minScale),
                state.viewport.maxScale
            );

            eventBus.emit(EVENTS.VIEWPORT_CHANGED, {
                type: 'updated',
                viewport: state.viewport
            });
        },

        updateVisibleArea: (updates) => {
            Object.assign(state.visibleArea, updates);
        },

        // Custom node types
        addCustomNodeType: (nodeType) => {
            state.customNodeTypes.push(nodeType);
            eventBus.emit(EVENTS.NODE_CHANGED, {type: 'type-added', nodeType});
        },

        removeCustomNodeType: (type) => {
            const index = state.customNodeTypes.findIndex(nt => nt.type === type);
            if (index !== -1) {
                const nodeType = state.customNodeTypes[index];
                state.customNodeTypes.splice(index, 1);
                eventBus.emit(EVENTS.NODE_CHANGED, {type: 'type-removed', nodeType});
                return true;
            }
            return false;
        },

        // Category collapse state
        toggleCategoryCollapse: (category) => {
            state.collapsedCategories[category] = !state.collapsedCategories[category];
        },

        // State management
        resetState: () => {
            // Preserve some settings like grid and viewport
            const {grid, viewport, layout, customNodeTypes, collapsedCategories} = state;

            // Reset to initial state
            state = structuredClone(initialState);

            // Restore preserved settings
            state.grid = grid;
            state.viewport = viewport;
            state.layout = layout;
            state.customNodeTypes = customNodeTypes;
            state.collapsedCategories = collapsedCategories;
            state.idCounters = {nodes: 0, connections: 0};

            eventBus.emit(EVENTS.STATE_RESET);
        },

        loadState: (newState) => {
            // 创建一个基于初始状态的新对象
            const baseState = structuredClone(initialState);

            // 只覆盖我们想要从加载的数据中更新的属性
            if (newState.nodes) baseState.nodes = newState.nodes;
            if (newState.connections) baseState.connections = newState.connections;
            if (newState.customNodeTypes) baseState.customNodeTypes = newState.customNodeTypes;
            if (newState.collapsedCategories) baseState.collapsedCategories = newState.collapsedCategories;
            if (newState.grid) baseState.grid = newState.grid;

            // 保留当前视口设置
            baseState.viewport = state.viewport;

            // 设置ID计数器
            if (newState.idCounters) baseState.idCounters = newState.idCounters;

            // 更新状态
            state = baseState;

            eventBus.emit(EVENTS.STATE_LOADED);
        },

        // Monitor state
        updateMonitorState: (updates) => {
            Object.assign(state.monitor, updates);

            eventBus.emit(EVENTS.MONITOR_CHANGED, {
                type: state.monitor.active ? 'updated' : 'stopped',
                monitor: state.monitor
            });
        },

        updateNodeMonitorState: (nodeId, status) => {
            state.monitor.nodeStates[nodeId] = status;
        }
    };
}