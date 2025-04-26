/**
 * Event handling module
 * Manages all DOM events and custom event system
 */

import {EventEmitter} from '../utils/event-emitter.js';
import {logger} from '../index.js';

// Create global event emitter
export const editorEvents = new EventEmitter();

// Define event types
export const EDITOR_EVENTS = {
    // Node events
    NODE_CREATION_REQUESTED: 'node:creation-requested',
    NODE_CREATED: 'node:created',
    NODE_UPDATED: 'node:updated',
    NODE_DELETED: 'node:deleted',
    NODE_MOVED: 'node:moved',
    NODE_SELECTED: 'node:selected',
    NODE_DRAGGED: 'node:dragged',
    NODE_TYPE_ADDED: 'node-type:added',
    NODE_TYPE_REMOVED: 'node-type:removed',

    // Connection events
    CONNECTION_CREATED: 'connection:created',
    CONNECTION_DELETED: 'connection:deleted',
    CONNECTION_SELECTED: 'connection:selected',

    // Selection events
    SELECTION_CHANGED: 'selection:changed',
    SELECTION_BOX_STARTED: 'selection-box:started',
    SELECTION_BOX_UPDATED: 'selection-box:updated',
    SELECTION_BOX_ENDED: 'selection-box:ended',
    SELECT_ALL_REQUESTED: 'selection:select-all-requested',

    // Viewport events
    VIEWPORT_CHANGED: 'viewport:changed',
    VIEWPORT_DRAGGED: 'viewport:dragged',
    ZOOM_CHANGED: 'zoom:changed',

    // Toolbar actions
    SAVE_REQUESTED: 'toolbar:save-requested',
    LOAD_REQUESTED: 'toolbar:load-requested',
    EXPORT_XML_REQUESTED: 'toolbar:export-xml-requested',
    CLEAR_REQUESTED: 'toolbar:clear-requested',
    GRID_TOGGLE_REQUESTED: 'toolbar:grid-toggle-requested',
    SNAP_TOGGLE_REQUESTED: 'toolbar:snap-toggle-requested',
    GRID_SETTINGS_CHANGED: 'grid:settings-changed',

    // Alignment events
    ALIGN_REQUESTED: 'align:requested',

    // Layout events
    LAYOUT_REQUESTED: 'layout:requested',
    LAYOUT_SETTINGS_CHANGED: 'layout:settings-changed',

    // Window events
    WINDOW_RESIZED: 'window:resized',

    // Keyboard events
    ESCAPE_PRESSED: 'keyboard:escape-pressed',
    DELETE_SELECTED_REQUESTED: 'keyboard:delete-selected-requested',

    // Global events
    STATE_RESET: 'state:reset',
    STATE_LOADED: 'state:loaded',

    // Error events
    ERROR_OCCURRED: 'error:occurred'
};

// Initialize event handlers
export function initEvents(elements, state, renderer) {
    logger.debug('Initializing event handlers');

    // Canvas events
    initCanvasEvents(elements, state, renderer);

    // Minimap events
    initMinimapEvents(elements, state, renderer);

    // Zoom control events
    initZoomControlEvents(elements, state, renderer);

    // Context menu events
    initContextMenuEvents(elements, state, renderer);

    return {
        // Event helpers
        emit: (event, ...args) => editorEvents.emit(event, ...args),
        on: (event, listener) => editorEvents.on(event, listener),
        off: (event, listener) => editorEvents.off(event, listener)
    };
}

// Initialize canvas-related events
function initCanvasEvents(elements, state, renderer) {
    const {canvas} = elements;
    const stateManager = state;

    // Setup canvas drag and drop
    canvas.addEventListener('dragover', (e) => e.preventDefault());
    canvas.addEventListener('drop', (e) => handleCanvasDrop(e, elements, state, renderer));

    // Canvas mouse events with delegation
    canvas.addEventListener('mousedown', (e) => handleCanvasMouseDown(e, elements, state, renderer));
    canvas.addEventListener('mousemove', (e) => handleCanvasMouseMove(e, elements, state, renderer));
    canvas.addEventListener('mouseup', (e) => handleCanvasMouseUp(e, elements, state, renderer));
    canvas.addEventListener('wheel', (e) => handleCanvasWheel(e, elements, state, renderer));

    // Prevent default context menu
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Events for specific elements via delegation
    canvas.addEventListener('click', (e) => {
        // Handle port clicks
        if (e.target.classList.contains('port')) {
            const nodeElement = e.target.closest('.tree-node');
            if (nodeElement) {
                const nodeId = nodeElement.getAttribute('data-id');
                const portType = e.target.classList.contains('port-parent') ? 'parent' : 'child';
                handlePortClick(nodeId, portType, e, elements, state, renderer);
            }
        }
        // Handle node clicks
        else if (e.target.closest('.tree-node') && !e.target.classList.contains('port')) {
            const nodeElement = e.target.closest('.tree-node');
            const nodeId = nodeElement.getAttribute('data-id');
            handleNodeClick(nodeId, e, elements, state, renderer);
        }
    });
}

// Handle mouse down on canvas
function handleCanvasMouseDown(e, elements, state, renderer) {
    const {canvas} = elements;
    const stateManager = state;

    // Get canvas-relative coordinates
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    // Convert to world coordinates
    const {x, y} = screenToWorldCoordinates(clientX, clientY, stateManager.getViewport());

    // Right-click is not handled here (context menu)
    if (e.button === 2) return;

    // Check if we're clicking on a node
    const hitNode = findNodeAt(x, y, stateManager.getNodes());

    // If not clicking on a node, start selection box or canvas drag
    if (!hitNode) {
        if (e.altKey || e.button === 1) {
            // Alt+click or middle button initiates canvas dragging
            stateManager.startDragging(clientX, clientY, true);
            canvas.style.cursor = 'grabbing';
        } else {
            // Clear selection if not holding shift
            if (!e.shiftKey) {
                stateManager.clearSelection();
            }

            // Start selection box
            stateManager.startSelectionBox(x, y);
            editorEvents.emit(EDITOR_EVENTS.SELECTION_BOX_STARTED, {x, y});

            // Create visual selection box
            createSelectionBoxElement(elements, state);
        }
    }
    // Clicking on a node - handle selection and dragging
    else {
        // If holding shift, toggle node selection
        if (e.shiftKey) {
            if (stateManager.getSelectedNodes().includes(hitNode.id)) {
                stateManager.deselectNode(hitNode.id);
            } else {
                stateManager.selectNode(hitNode.id, true);
            }
        }
        // If node not already selected, select only this node
        else if (!stateManager.getSelectedNodes().includes(hitNode.id)) {
            stateManager.clearSelection();
            stateManager.selectNode(hitNode.id);
        }

        // Start dragging selected nodes
        stateManager.startDragging(clientX, clientY);
        editorEvents.emit(EDITOR_EVENTS.NODE_DRAGGED, {
            nodeIds: stateManager.getSelectedNodes(),
            startX: x,
            startY: y
        });
    }

    // Request render update
    renderer.requestRender();
}

// Handle mouse move on canvas
function handleCanvasMouseMove(e, elements, state, renderer) {
    const {canvas} = elements;
    const stateManager = state;

    // Get canvas-relative coordinates
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    // Convert to world coordinates
    const {x, y} = screenToWorldCoordinates(clientX, clientY, stateManager.getViewport());

    // Update mouse position in state
    stateManager.setMousePosition(x, y);

    // Handle selection box dragging
    if (stateManager.getState().selectionBox.active) {
        stateManager.updateSelectionBox(x, y);
        updateSelectionBoxElement(elements, state, renderer);
        editorEvents.emit(EDITOR_EVENTS.SELECTION_BOX_UPDATED, stateManager.getState().selectionBox);
    }

    // Handle node or canvas dragging
    if (stateManager.getState().dragging.active) {
        const dragState = stateManager.getState().dragging;

        if (dragState.isDraggingCanvas) {
            // Canvas dragging - pan the viewport
            const deltaX = (clientX - dragState.currentX) / stateManager.getViewport().scale;
            const deltaY = (clientY - dragState.currentY) / stateManager.getViewport().scale;

            stateManager.updateViewport({
                offsetX: stateManager.getViewport().offsetX + deltaX,
                offsetY: stateManager.getViewport().offsetY + deltaY
            });

            stateManager.updateDragging(clientX, clientY);
            editorEvents.emit(EDITOR_EVENTS.VIEWPORT_DRAGGED);
        } else {
            // Node dragging
            const deltaX = x - (dragState.currentX !== undefined ? dragState.currentX : dragState.startX);
            const deltaY = y - (dragState.currentY !== undefined ? dragState.currentY : dragState.startY);

            // Move selected nodes
            dragState.nodes.forEach(nodeInfo => {
                const node = stateManager.getNodes().find(n => n.id === nodeInfo.id);
                if (node) {
                    let newX = node.x + deltaX;
                    let newY = node.y + deltaY;

                    // Apply grid snapping if enabled
                    if (stateManager.getGrid().snap) {
                        newX = Math.round(newX / stateManager.getGrid().size) * stateManager.getGrid().size;
                        newY = Math.round(newY / stateManager.getGrid().size) * stateManager.getGrid().size;
                    }

                    stateManager.updateNode(node.id, {x: newX, y: newY});
                }
            });

            stateManager.updateDragging(x, y);
            editorEvents.emit(EDITOR_EVENTS.NODE_MOVED, stateManager.getSelectedNodes());
        }

        // Request render update
        renderer.requestRender();
    }

    // Handle pending connection
    if (stateManager.getState().pendingConnection) {
        renderer.renderPendingConnection();
    }
}

// Handle mouse up on canvas
function handleCanvasMouseUp(e, elements, state, renderer) {
    const {canvas} = elements;
    const stateManager = state;

    // Get canvas-relative coordinates
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    // Convert to world coordinates
    const {x, y} = screenToWorldCoordinates(clientX, clientY, stateManager.getViewport());

    // Handle selection box completion
    if (stateManager.getState().selectionBox.active) {
        selectNodesInBox(elements, state, renderer);
        stateManager.endSelectionBox();
        editorEvents.emit(EDITOR_EVENTS.SELECTION_BOX_ENDED);

        // Remove selection box element
        removeSelectionBoxElement(elements);
    }

    // Handle end of drag operations
    if (stateManager.getState().dragging.active) {
        if (stateManager.getState().dragging.isDraggingCanvas) {
            canvas.style.cursor = 'default';
        } else {
            editorEvents.emit(EDITOR_EVENTS.NODE_MOVED, stateManager.getSelectedNodes());
        }

        stateManager.endDragging();
    }

    // Request render update
    renderer.requestRender();
}

// Handle mouse wheel on canvas
function handleCanvasWheel(e, elements, state, renderer) {
    e.preventDefault();

    const {canvas} = elements;
    const stateManager = state;

    // Get canvas-relative coordinates
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    // Get mouse position in world coordinates before zoom
    const mouseWorldPosBeforeZoom = screenToWorldCoordinates(
        clientX,
        clientY,
        stateManager.getViewport()
    );

    // Calculate new scale
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = stateManager.getViewport().scale * zoomFactor;

    // Update scale
    stateManager.updateViewport({scale: newScale});

    // Get mouse position in world coordinates after zoom
    const mouseWorldPosAfterZoom = screenToWorldCoordinates(
        clientX,
        clientY,
        stateManager.getViewport()
    );

    // Adjust offset to zoom toward/from mouse position
    stateManager.updateViewport({
        offsetX: stateManager.getViewport().offsetX +
            (mouseWorldPosBeforeZoom.x - mouseWorldPosAfterZoom.x),
        offsetY: stateManager.getViewport().offsetY +
            (mouseWorldPosBeforeZoom.y - mouseWorldPosAfterZoom.y)
    });

    // Emit zoom changed event
    editorEvents.emit(EDITOR_EVENTS.ZOOM_CHANGED, stateManager.getViewport().scale);

    // Request render update
    renderer.requestRender(true);
}

// Initialize minimap events
function initMinimapEvents(elements, state, renderer) {
    const {minimap} = elements;
    if (!minimap) return;

    minimap.addEventListener('mousedown', (e) => {
        const rect = minimap.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        handleMinimapClick(x, y, elements, state, renderer);

        // Add drag event
        const onMouseMove = (moveEvent) => {
            const moveX = moveEvent.clientX - rect.left;
            const moveY = moveEvent.clientY - rect.top;
            handleMinimapClick(moveX, moveY, elements, state, renderer);
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
}

// Initialize zoom control events
function initZoomControlEvents(elements, state, renderer) {
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const zoomResetBtn = document.getElementById('zoom-reset-btn');

    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', () => {
            const stateManager = state;
            const newScale = stateManager.getViewport().scale * 1.2;
            stateManager.updateViewport({scale: newScale});
            editorEvents.emit(EDITOR_EVENTS.ZOOM_CHANGED, newScale);
            renderer.requestRender(true);
        });
    }

    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', () => {
            const stateManager = state;
            const newScale = stateManager.getViewport().scale * 0.8;
            stateManager.updateViewport({scale: newScale});
            editorEvents.emit(EDITOR_EVENTS.ZOOM_CHANGED, newScale);
            renderer.requestRender(true);
        });
    }

    if (zoomResetBtn) {
        zoomResetBtn.addEventListener('click', () => {
            const stateManager = state;
            stateManager.updateViewport({scale: 1.0});
            editorEvents.emit(EDITOR_EVENTS.ZOOM_CHANGED, 1.0);
            renderer.requestRender(true);
        });
    }
}

// Initialize context menu events
function initContextMenuEvents(elements, state, renderer) {
    const {connectionContextMenu, nodeTypeContextMenu} = elements;
    const stateManager = state;

    // Handle connection context menu
    if (connectionContextMenu) {
        const deleteConnectionBtn = connectionContextMenu.querySelector('#delete-connection');
        if (deleteConnectionBtn) {
            deleteConnectionBtn.addEventListener('click', () => {
                const connectionId = stateManager.getState().selectedConnection;
                if (connectionId) {
                    stateManager.removeConnection(connectionId);
                    stateManager.getState().selectedConnection = null;
                    connectionContextMenu.style.display = 'none';
                    renderer.requestRender();
                }
            });
        }
    }

    // Handle node type context menu
    if (nodeTypeContextMenu) {
        const deleteNodeTypeBtn = nodeTypeContextMenu.querySelector('#delete-node-type');
        if (deleteNodeTypeBtn) {
            deleteNodeTypeBtn.addEventListener('click', () => {
                const nodeType = nodeTypeContextMenu.getAttribute('data-node-type');
                if (nodeType) {
                    stateManager.removeCustomNodeType(nodeType);
                    nodeTypeContextMenu.style.display = 'none';
                    // This should trigger a node tree view update
                    editorEvents.emit(EDITOR_EVENTS.NODE_TYPE_REMOVED, {type: nodeType});
                }
            });
        }
    }

    // Hide menus when clicking elsewhere
    document.addEventListener('click', (e) => {
        if (connectionContextMenu &&
            !connectionContextMenu.contains(e.target) &&
            !e.target.classList.contains('connection-path')) {
            connectionContextMenu.style.display = 'none';
        }

        if (nodeTypeContextMenu &&
            !nodeTypeContextMenu.contains(e.target) &&
            !e.target.classList.contains('node-item-delete')) {
            nodeTypeContextMenu.style.display = 'none';
        }
    });
}

// Handle click on the minimap
function handleMinimapClick(x, y, elements, state, renderer) {
    const {minimap} = elements;
    const stateManager = state;

    // Calculate bounds of all nodes
    const bounds = calculateNodesBounds(stateManager.getNodes());

    // Calculate minimap scale and padding
    const padding = 10;
    const scaleX = (stateManager.getMinimap().width - padding * 2) / bounds.width;
    const scaleY = (stateManager.getMinimap().height - padding * 2) / bounds.height;
    const scale = Math.min(scaleX, scaleY);

    // Convert minimap coordinates to world coordinates
    const worldX = (x - padding) / scale + bounds.minX;
    const worldY = (y - padding) / scale + bounds.minY;

    // Center viewport on this point
    const canvas = elements.canvas;
    stateManager.updateViewport({
        offsetX: -worldX + canvas.clientWidth / (2 * stateManager.getViewport().scale),
        offsetY: -worldY + canvas.clientHeight / (2 * stateManager.getViewport().scale)
    });

    // Request render update
    renderer.requestRender(true);
}

// Handle node click
function handleNodeClick(nodeId, e, elements, state, renderer) {
    const stateManager = state;

    e.stopPropagation();

    // Shift+click to toggle selection
    if (e.shiftKey) {
        if (stateManager.getSelectedNodes().includes(nodeId)) {
            stateManager.deselectNode(nodeId);
        } else {
            stateManager.selectNode(nodeId, true);
        }
    } else {
        // Normal click selects only this node
        stateManager.clearSelection();
        stateManager.selectNode(nodeId);
    }

    // Emit node selected event
    editorEvents.emit(EDITOR_EVENTS.NODE_SELECTED, nodeId);

    // Request render update
    renderer.requestRender();
}

// Handle port click for connections
function handlePortClick(nodeId, portType, e, elements, state, renderer) {
    const stateManager = state;

    e.stopPropagation();

    // If port is disabled, do nothing
    if (e.target.classList.contains('disabled')) {
        return;
    }

    const pendingConnection = stateManager.getState().pendingConnection;

    // If no pending connection, start one
    if (!pendingConnection) {
        stateManager.startPendingConnection(nodeId, portType);

        // Show active connection layer
        elements.activeConnectionLayer.style.display = 'block';

        // Highlight the port
        e.target.classList.add('active');

        // Render the pending connection
        renderer.renderPendingConnection();
    }
    // If there is a pending connection, try to complete it
    else {
        completeConnection(nodeId, portType, elements, state, renderer);
    }
}

// Complete a connection between nodes
function completeConnection(targetNodeId, targetPortType, elements, state, renderer) {
    const stateManager = state;
    const pendingConnection = stateManager.getState().pendingConnection;

    // Don't connect to self
    if (targetNodeId === pendingConnection.sourceId) {
        resetPendingConnection(elements, state);
        return;
    }

    // Check connection type - we need to have one parent port and one child port
    if (pendingConnection.sourcePort === targetPortType) {
        // Can't connect same port types
        showInvalidConnectionFeedback(targetNodeId, 'Cannot connect same port types', elements);
        resetPendingConnection(elements, state);
        return;
    }

    // Determine source and target nodes based on port types
    let sourceNodeId, targetId;

    if (pendingConnection.sourcePort === 'child') {
        // Source child port to target parent port
        sourceNodeId = pendingConnection.sourceId;
        targetId = targetNodeId;
    } else {
        // Source parent port to target child port
        sourceNodeId = targetNodeId;
        targetId = pendingConnection.sourceId;
    }

    // Validate the connection
    const sourceNode = stateManager.getNodes().find(n => n.id === sourceNodeId);
    const targetNode = stateManager.getNodes().find(n => n.id === targetId);

    if (!sourceNode || !targetNode) {
        showInvalidConnectionFeedback(targetNodeId, 'Invalid nodes', elements);
        resetPendingConnection(elements, state);
        return;
    }

    // Create the connection
    const connectionId = stateManager.generateConnectionId();
    const connection = {
        id: connectionId,
        source: sourceNodeId,
        target: targetId
    };

    stateManager.addConnection(connection);

    // Reset pending connection state
    resetPendingConnection(elements, state);

    // Request render update
    renderer.requestRender();
}

// Reset pending connection state
function resetPendingConnection(elements, state) {
    const stateManager = state;
    const pendingConnection = stateManager.getState().pendingConnection;

    if (pendingConnection) {
        // Remove highlight from the source port
        const sourceNode = document.querySelector(`.tree-node[data-id="${pendingConnection.sourceId}"]`);
        if (sourceNode) {
            const port = sourceNode.querySelector(`.port-${pendingConnection.sourcePort}`);
            if (port) {
                port.classList.remove('active');
            }
        }
    }

    stateManager.clearPendingConnection();
    elements.activeConnectionLayer.style.display = 'none';
    elements.activeConnectionLayer.innerHTML = '';
}

// Show invalid connection feedback
function showInvalidConnectionFeedback(nodeId, message, elements) {
    const nodeEl = document.querySelector(`.tree-node[data-id="${nodeId}"]`);
    if (nodeEl) {
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
}

// Create visual selection box element
function createSelectionBoxElement(elements, state) {
    const {canvas} = elements;
    const selectionBoxEl = document.createElement('div');
    selectionBoxEl.className = 'selection-box';
    selectionBoxEl.id = 'selection-box';
    canvas.appendChild(selectionBoxEl);

    updateSelectionBoxElement(elements, state);
}

// Update selection box position and size
function updateSelectionBoxElement(elements, state, renderer) {
    const selectionBoxEl = document.getElementById('selection-box');
    if (!selectionBoxEl) return;

    const stateManager = state;
    const selectionBox = stateManager.getState().selectionBox;
    const viewport = stateManager.getViewport();

    // Calculate box dimensions in world coordinates
    const left = Math.min(selectionBox.startX, selectionBox.endX);
    const top = Math.min(selectionBox.startY, selectionBox.endY);
    const width = Math.abs(selectionBox.endX - selectionBox.startX);
    const height = Math.abs(selectionBox.endY - selectionBox.startY);

    // Convert to screen coordinates
    const screenLeft = (left + viewport.offsetX) * viewport.scale;
    const screenTop = (top + viewport.offsetY) * viewport.scale;
    const screenWidth = width * viewport.scale;
    const screenHeight = height * viewport.scale;

    // Update element style
    selectionBoxEl.style.left = `${screenLeft}px`;
    selectionBoxEl.style.top = `${screenTop}px`;
    selectionBoxEl.style.width = `${screenWidth}px`;
    selectionBoxEl.style.height = `${screenHeight}px`;
}

// Remove selection box element
function removeSelectionBoxElement(elements) {
    const selectionBoxEl = document.getElementById('selection-box');
    if (selectionBoxEl) {
        selectionBoxEl.remove();
    }
}

// Select nodes within the selection box
function selectNodesInBox(elements, state, renderer) {
    const stateManager = state;
    const selectionBox = stateManager.getState().selectionBox;

    // Calculate box boundaries in world coordinates
    const left = Math.min(selectionBox.startX, selectionBox.endX);
    const top = Math.min(selectionBox.startY, selectionBox.endY);
    const right = Math.max(selectionBox.startX, selectionBox.endX);
    const bottom = Math.max(selectionBox.startY, selectionBox.endY);

    // Find nodes within the box
    const nodesInBox = [];

    stateManager.getNodes().forEach(node => {
        const nodeRight = node.x + 150; // Node width
        const nodeBottom = node.y + 40; // Node height

        // Check if node is within box (even partially)
        if (nodeRight >= left && node.x <= right && nodeBottom >= top && node.y <= bottom) {
            nodesInBox.push(node.id);
        }
    });

    // If shift key is held, add to existing selection
    if (nodesInBox.length > 0) {
        // Add new nodes to selection
        const existingSelection = stateManager.getSelectedNodes();
        const combinedSelection = [...new Set([...existingSelection, ...nodesInBox])];
        stateManager.selectNodes(combinedSelection);
    }
}

// Handle canvas drop event (for drag & drop)
function handleCanvasDrop(e, elements, state, renderer) {
    e.preventDefault();

    const {canvas} = elements;
    const stateManager = state;

    // 获取鼠标坐标
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    // 转换为世界坐标
    const {x, y} = screenToWorldCoordinates(clientX, clientY, stateManager.getViewport());

    // 从拖拽数据中获取信息
    const nodeType = e.dataTransfer.getData('nodeType');
    const nodeCategory = e.dataTransfer.getData('nodeCategory');
    const nodeId = e.dataTransfer.getData('nodeId');

    if (nodeId) {
        // 移动现有节点
        const selectedNodes = stateManager.getSelectedNodes();

        if (selectedNodes.includes(nodeId)) {
            // 移动所有选中的节点
            const selectedNode = stateManager.getNodes().find(n => n.id === nodeId);
            if (selectedNode) {
                const deltaX = x - selectedNode.x - 75; // 水平居中
                const deltaY = y - selectedNode.y - 20; // 调整节点高度

                // 移动所有选中的节点
                selectedNodes.forEach(id => {
                    const node = stateManager.getNodes().find(n => n.id === id);
                    if (node) {
                        let newX = node.x + deltaX;
                        let newY = node.y + deltaY;

                        // 应用网格对齐
                        if (stateManager.getGrid().snap) {
                            newX = Math.round(newX / stateManager.getGrid().size) * stateManager.getGrid().size;
                            newY = Math.round(newY / stateManager.getGrid().size) * stateManager.getGrid().size;
                        }

                        stateManager.updateNode(id, {x: newX, y: newY});
                    }
                });

                editorEvents.emit(EDITOR_EVENTS.NODE_MOVED, selectedNodes);
            }
        } else {
            // 仅移动拖拽的节点
            const node = stateManager.getNodes().find(n => n.id === nodeId);
            if (node) {
                let newX = x - 75; // 水平居中
                let newY = y - 20; // 调整节点高度

                // 应用网格对齐
                if (stateManager.getGrid().snap) {
                    newX = Math.round(newX / stateManager.getGrid().size) * stateManager.getGrid().size;
                    newY = Math.round(newY / stateManager.getGrid().size) * stateManager.getGrid().size;
                }

                stateManager.updateNode(nodeId, {x: newX, y: newY});
                editorEvents.emit(EDITOR_EVENTS.NODE_MOVED, [nodeId]);
            }
        }
    } else if (nodeType && nodeCategory) {
        // 创建新节点
        const newNodeX = x - 75; // 水平居中
        const newNodeY = y - 20; // 调整节点高度

        // 应用网格对齐
        const snappedX = stateManager.getGrid().snap
            ? Math.round(newNodeX / stateManager.getGrid().size) * stateManager.getGrid().size
            : newNodeX;
        const snappedY = stateManager.getGrid().snap
            ? Math.round(newNodeY / stateManager.getGrid().size) * stateManager.getGrid().size
            : newNodeY;

        // 发出创建节点事件
        editorEvents.emit(EDITOR_EVENTS.NODE_CREATION_REQUESTED, {
            type: nodeType,
            category: nodeCategory,
            x: snappedX,
            y: snappedY
        });
    }

    renderer.requestRender();
    // 添加这一行确保请求重新渲染
}

// Find a node at a specific point in world coordinates
function findNodeAt(x, y, nodes) {
    // Search in reverse order (top-most node first)
    for (let i = nodes.length - 1; i >= 0; i--) {
        const node = nodes[i];
        if (x >= node.x && x <= node.x + 150 && y >= node.y && y <= node.y + 40) {
            return node;
        }
    }
    return null;
}

// Convert screen coordinates to world coordinates
function screenToWorldCoordinates(x, y, viewport) {
    return {
        x: x / viewport.scale - viewport.offsetX,
        y: y / viewport.scale - viewport.offsetY
    };
}

// Convert world coordinates to screen coordinates
function worldToScreenCoordinates(x, y, viewport) {
    return {
        x: (x + viewport.offsetX) * viewport.scale,
        y: (y + viewport.offsetY) * viewport.scale
    };
}

// Calculate bounds of all nodes for minimap
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