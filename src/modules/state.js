/**
 * State management module
 * Centralizes application state and provides methods for state manipulation
 */

import {editorEvents, EDITOR_EVENTS} from './events.js';
import {logger} from '../index.js';

// Initial state object
const initialState = {
    nodes: [],
    connections: [],
    selectedNodes: [], // Array for multi-selection
    activeConnection: null,
    pendingConnection: null, // For two-click connection system
    selectedConnection: null,
    nodeCounter: 0,
    mousePosition: {x: 0, y: 0},
    customNodeTypes: [],
    collapsedCategories: {},

    // Selection box for multi-select
    selectionBox: {
        active: false,
        startX: 0,
        startY: 0,
        endX: 0,
        endY: 0
    },

    // For dragging multiple nodes
    dragging: {
        active: false,
        startX: 0,
        startY: 0,
        nodes: [],
        isDraggingCanvas: false
    },

    // Grid and snapping settings
    grid: {
        enabled: false,
        size: 20,
        snap: false
    },

    // Monitoring state
    monitor: {
        active: false,
        eventSource: null,
        nodeStates: {} // Map of node IDs to their current states
    },

    // Alignment guides
    alignmentGuides: [],

    // Viewport for infinite canvas
    viewport: {
        scale: 1.0,
        offsetX: 0,
        offsetY: 0,
        minScale: 0.1,
        maxScale: 5.0
    },

    // Visible area for virtual scrolling
    visibleArea: {
        minX: 0,
        minY: 0,
        maxX: 0,
        maxY: 0
    },

    // Rendering state
    rendering: {
        isPending: false,
        needsFullUpdate: false,
        updatedNodeIds: new Set(),
        updatedConnectionIds: new Set()
    },

    // Minimap state
    minimap: {
        width: 150,
        height: 150,
        isVisible: true
    },

    // Layout settings
    layout: {
        type: 'hierarchical',
        options: {
            nodeSpacingX: 200,
            nodeSpacingY: 100,
            animation: true,
            animationDuration: 500
        }
    }
};

// Create a new state object
let state = {...initialState};

// State access and mutation methods
export function initState() {
    logger.debug('Initializing state');

    // Listen for events that change state
    setupEventListeners();

    return {
        // State accessors
        getState: () => state,
        getNodes: () => state.nodes,
        getConnections: () => state.connections,
        getSelectedNodes: () => state.selectedNodes,
        getCustomNodeTypes: () => state.customNodeTypes,
        getViewport: () => state.viewport,
        getGrid: () => state.grid,
        getLayout: () => state.layout,
        getMinimap: () => state.minimap,
        getVisibleArea: () => state.visibleArea,

        // State mutators
        setMousePosition: (x, y) => {
            state.mousePosition.x = x;
            state.mousePosition.y = y;
        },

        addNode: (node) => {
            state.nodes.push(node);
            logger.debug('Node added:', node.id);
            editorEvents.emit(EDITOR_EVENTS.NODE_CREATED, node);
            return node.id;
        },

        removeNode: (nodeId) => {
            const nodeIndex = state.nodes.findIndex(n => n.id === nodeId);
            if (nodeIndex !== -1) {
                const node = state.nodes[nodeIndex];
                state.nodes.splice(nodeIndex, 1);
                logger.debug('Node removed:', nodeId);
                editorEvents.emit(EDITOR_EVENTS.NODE_DELETED, node);
                return true;
            }
            return false;
        },

        updateNode: (nodeId, updates) => {
            const node = state.nodes.find(n => n.id === nodeId);
            if (node) {
                // 应用更新
                Object.assign(node, updates);

                // 添加到更新节点列表
                state.rendering.updatedNodeIds.add(nodeId);

                // 如果更新了位置（x或y），则更新与该节点相连的所有连线
                if (updates.x !== undefined || updates.y !== undefined) {
                    // 找到所有与该节点相连的连接
                    const relatedConnections = state.connections.filter(
                        conn => conn.source === nodeId || conn.target === nodeId
                    );

                    // 将这些连接添加到更新列表
                    relatedConnections.forEach(conn => {
                        state.rendering.updatedConnectionIds.add(conn.id);
                    });
                }

                editorEvents.emit(EDITOR_EVENTS.NODE_UPDATED, node);
                return true;
            }
            return false;
        },

        addConnection: (connection) => {
            state.connections.push(connection);
            logger.debug('Connection added:', connection.id);
            editorEvents.emit(EDITOR_EVENTS.CONNECTION_CREATED, connection);
            return connection.id;
        },

        removeConnection: (connectionId) => {
            const connIndex = state.connections.findIndex(c => c.id === connectionId);
            if (connIndex !== -1) {
                const connection = state.connections[connIndex];
                state.connections.splice(connIndex, 1);
                logger.debug('Connection removed:', connectionId);
                editorEvents.emit(EDITOR_EVENTS.CONNECTION_DELETED, connection);
                return true;
            }
            return false;
        },

        clearSelection: () => {
            if (state.selectedNodes.length > 0) {
                state.selectedNodes = [];
                logger.debug('Selection cleared');
                editorEvents.emit(EDITOR_EVENTS.SELECTION_CHANGED, []);
            }
        },

        selectNode: (nodeId, addToSelection = false) => {
            if (!addToSelection) {
                state.selectedNodes = [nodeId];
            } else if (!state.selectedNodes.includes(nodeId)) {
                state.selectedNodes.push(nodeId);
            }
            logger.debug('Node selected:', nodeId);
            editorEvents.emit(EDITOR_EVENTS.SELECTION_CHANGED, state.selectedNodes);
        },

        deselectNode: (nodeId) => {
            const index = state.selectedNodes.indexOf(nodeId);
            if (index !== -1) {
                state.selectedNodes.splice(index, 1);
                logger.debug('Node deselected:', nodeId);
                editorEvents.emit(EDITOR_EVENTS.SELECTION_CHANGED, state.selectedNodes);
            }
        },

        selectNodes: (nodeIds) => {
            state.selectedNodes = [...nodeIds];
            logger.debug('Multiple nodes selected:', nodeIds.length);
            editorEvents.emit(EDITOR_EVENTS.SELECTION_CHANGED, state.selectedNodes);
        },

        selectAllNodes: () => {
            state.selectedNodes = state.nodes.map(node => node.id);
            logger.debug('All nodes selected:', state.selectedNodes.length);
            editorEvents.emit(EDITOR_EVENTS.SELECTION_CHANGED, state.selectedNodes);
        },

        updateViewport: (updates) => {
            Object.assign(state.viewport, updates);

            // Clamp scale to min/max
            state.viewport.scale = Math.min(
                Math.max(state.viewport.scale, state.viewport.minScale),
                state.viewport.maxScale
            );

            editorEvents.emit(EDITOR_EVENTS.VIEWPORT_CHANGED, state.viewport);
        },

        updateVisibleArea: (updates) => {
            Object.assign(state.visibleArea, updates);
        },

        generateNodeId: () => {
            return `node_${state.nodeCounter++}`;
        },

        generateConnectionId: () => {
            return `conn_${Date.now()}`;
        },

        startPendingConnection: (sourceId, sourcePort) => {
            state.pendingConnection = {sourceId, sourcePort};
            logger.debug('Pending connection started from:', sourceId);
        },

        clearPendingConnection: () => {
            state.pendingConnection = null;
        },

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

            // Store positions of selected nodes
            if (!isDraggingCanvas) {
                state.dragging.nodes = state.selectedNodes.map(nodeId => {
                    const node = state.nodes.find(n => n.id === nodeId);
                    return {
                        id: nodeId,
                        offsetX: node.x - x,
                        offsetY: node.y - y
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

        updateGridSettings: (updates) => {
            Object.assign(state.grid, updates);
            editorEvents.emit(EDITOR_EVENTS.GRID_SETTINGS_CHANGED, state.grid);
        },

        updateLayoutSettings: (updates) => {
            Object.assign(state.layout, updates);
        },

        resetState: () => {
            // Preserve some settings like grid and viewport
            const {grid, viewport, layout, customNodeTypes, collapsedCategories} = state;

            // Reset to initial state
            state = {
                ...initialState,
                grid,
                viewport,
                layout,
                customNodeTypes,
                collapsedCategories,
                nodeCounter: 0
            };

            logger.info('State reset');
            editorEvents.emit(EDITOR_EVENTS.STATE_RESET);
        },

        loadState: (newState) => {
            // Preserve some settings
            const {viewport} = state;

            // Load new state
            state = {
                ...newState,
                viewport,
                rendering: initialState.rendering,
                visibleArea: initialState.visibleArea
            };

            logger.info('State loaded');
            editorEvents.emit(EDITOR_EVENTS.STATE_LOADED);
        },

        addCustomNodeType: (nodeType) => {
            state.customNodeTypes.push(nodeType);
            logger.debug('Custom node type added:', nodeType.type);
            editorEvents.emit(EDITOR_EVENTS.NODE_TYPE_ADDED, nodeType);
        },

        removeCustomNodeType: (type) => {
            const index = state.customNodeTypes.findIndex(nt => nt.type === type);
            if (index !== -1) {
                const nodeType = state.customNodeTypes[index];
                state.customNodeTypes.splice(index, 1);
                logger.debug('Custom node type removed:', type);
                editorEvents.emit(EDITOR_EVENTS.NODE_TYPE_REMOVED, nodeType);
                return true;
            }
            return false;
        },

        toggleCategoryCollapse: (category) => {
            state.collapsedCategories[category] = !state.collapsedCategories[category];
        },

        startMonitoring: (url) => {
            state.monitor.url = url;
            state.monitor.active = true;
            logger.info('Monitoring started');
        },

        stopMonitoring: () => {
            state.monitor.active = false;
            state.monitor.nodeStates = {};
            logger.info('Monitoring stopped');
        },

        updateNodeMonitorState: (nodeId, status) => {
            state.monitor.nodeStates[nodeId] = status;
        }
    };
}

function setupEventListeners() {
    // Listen for events that require state updates

    // Window resize event
    editorEvents.on(EDITOR_EVENTS.WINDOW_RESIZED, () => {
        // Update renderer state
        state.rendering.needsFullUpdate = true;
    });
}

// Export the state accessor
export function getState() {
    return state;
}