/**
 * BehaviorTree.CPP Editor
 * Main JavaScript file implementing the behavior tree editor functionality.
 */

// State
const state = {
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
        nodes: []
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
    alignmentGuides: []
};

// DOM Elements
const canvas = document.getElementById('canvas');
const gridCanvas = document.getElementById('grid-canvas');
const connectionsLayer = document.getElementById('connections-layer');
const activeConnectionLayer = document.getElementById('active-connection-layer');
const propertiesPanel = document.getElementById('properties-panel');
const propertiesContent = document.getElementById('properties-content');
const nodeTreeView = document.getElementById('node-tree-view');
const connectionContextMenu = document.getElementById('connection-context-menu');
const nodeTypeContextMenu = document.getElementById('node-type-context-menu');
const dockPanel = document.getElementById('dock-panel');

// Toolbar buttons
const saveBtn = document.getElementById('save-btn');
const loadBtn = document.getElementById('load-btn');
const clearBtn = document.getElementById('clear-btn');
const exportXmlBtn = document.getElementById('export-xml-btn');
const addNodeBtn = document.getElementById('add-node-btn');
const toggleGridBtn = document.getElementById('toggle-grid-btn');
const toggleSnapBtn = document.getElementById('toggle-snap-btn');
const toggleDockBtn = document.getElementById('toggle-dock-btn');

// Alignment buttons
const alignLeftBtn = document.getElementById('align-left-btn');
const alignCenterBtn = document.getElementById('align-center-btn');
const alignRightBtn = document.getElementById('align-right-btn');
const alignTopBtn = document.getElementById('align-top-btn');
const alignMiddleBtn = document.getElementById('align-middle-btn');
const alignBottomBtn = document.getElementById('align-bottom-btn');

// Monitoring elements
const sseUrlInput = document.getElementById('sse-url');
const startMonitorBtn = document.getElementById('start-monitor-btn');
const stopMonitorBtn = document.getElementById('stop-monitor-btn');
const monitorStatusIndicator = document.getElementById('monitor-status-indicator');
const monitorStatusText = document.getElementById('monitor-status-text');

// Modal elements
const createNodeModal = document.getElementById('create-node-modal');
const closeCreateModal = document.getElementById('close-create-modal');
const createNodeForm = document.getElementById('create-node-form');
const cancelCreateNodeBtn = document.getElementById('cancel-create-node');
const xmlModal = document.getElementById('xml-modal');
const xmlContent = document.getElementById('xml-content');
const closeXmlModal = document.getElementById('close-xml-modal');
const copyXmlBtn = document.getElementById('copy-xml-btn');
const deleteConnectionBtn = document.getElementById('delete-connection');
const deleteNodeTypeBtn = document.getElementById('delete-node-type');

// Utility functions
function escapeHTML(str) {
    if (str === undefined || str === null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function snapToGrid(value) {
    if (!state.grid.snap) return value;
    return Math.round(value / state.grid.size) * state.grid.size;
}

// Initialize node tree view
function initNodeTreeView() {
    // Create category elements
    Object.keys(NODE_TYPES).forEach(category => {
        createCategoryInTreeView(category);
    });
}

function createCategoryInTreeView(category) {
    const categoryEl = document.createElement('div');
    categoryEl.className = 'tree-category';
    categoryEl.id = `category-${category}`;

    // Format category name for display
    const categoryName = category.charAt(0).toUpperCase() + category.slice(1);

    // Create header
    const headerEl = document.createElement('div');
    headerEl.className = 'category-header';
    if (state.collapsedCategories[category]) {
        headerEl.classList.add('collapsed');
    }

    const toggleIcon = document.createElement('span');
    toggleIcon.className = 'toggle-icon fa fa-chevron-down';
    headerEl.appendChild(toggleIcon);

    const titleEl = document.createElement('span');
    titleEl.textContent = categoryName;
    headerEl.appendChild(titleEl);

    // Add click handler to toggle collapse
    headerEl.addEventListener('click', () => {
        headerEl.classList.toggle('collapsed');
        const items = categoryEl.querySelector('.category-items');
        items.classList.toggle('collapsed');
        state.collapsedCategories[category] = headerEl.classList.contains('collapsed');
    });

    categoryEl.appendChild(headerEl);

    // Create items container
    const itemsEl = document.createElement('div');
    itemsEl.className = 'category-items';
    if (state.collapsedCategories[category]) {
        itemsEl.classList.add('collapsed');
    }

    // Add node types to this category
    NODE_TYPES[category].forEach(nodeType => {
        const nodeEl = document.createElement('div');
        nodeEl.className = `node-item ${category}`;
        nodeEl.setAttribute('data-type', nodeType.type);
        nodeEl.setAttribute('data-category', category);

        // Main content with drag functionality
        const contentEl = document.createElement('div');
        contentEl.textContent = nodeType.name;
        contentEl.draggable = true;
        contentEl.style.flex = '1';

        // Set both type and category in the dragstart event
        contentEl.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('nodeType', nodeType.type);
            e.dataTransfer.setData('nodeCategory', category);
        });

        nodeEl.appendChild(contentEl);

        // Built-in nodes don't get a delete button
        if (!nodeType.builtin) {
            const actionsEl = document.createElement('div');
            actionsEl.className = 'node-item-actions';

            const deleteEl = document.createElement('span');
            deleteEl.className = 'node-item-delete fa fa-trash';
            deleteEl.title = 'Delete custom node type';
            deleteEl.addEventListener('click', (e) => {
                e.stopPropagation();
                handleNodeTypeContextMenu(e, nodeType.type);
            });

            actionsEl.appendChild(deleteEl);
            nodeEl.appendChild(actionsEl);
        }

        itemsEl.appendChild(nodeEl);
    });

    // Add all custom nodes that belong to this category
    state.customNodeTypes.forEach(nodeType => {
        if (nodeType.category === category) {
            const nodeEl = document.createElement('div');
            nodeEl.className = `node-item ${category}`;
            nodeEl.setAttribute('data-type', nodeType.type);
            nodeEl.setAttribute('data-category', category);

            // Main content with drag functionality
            const contentEl = document.createElement('div');
            contentEl.textContent = nodeType.name;
            contentEl.draggable = true;
            contentEl.style.flex = '1';

            // Set both type and category in the dragstart event
            contentEl.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('nodeType', nodeType.type);
                e.dataTransfer.setData('nodeCategory', category);
            });

            nodeEl.appendChild(contentEl);

            // Custom nodes always get a delete button
            const actionsEl = document.createElement('div');
            actionsEl.className = 'node-item-actions';

            const deleteEl = document.createElement('span');
            deleteEl.className = 'node-item-delete fa fa-trash';
            deleteEl.title = 'Delete custom node type';
            deleteEl.addEventListener('click', (e) => {
                e.stopPropagation();
                handleNodeTypeContextMenu(e, nodeType.type);
            });

            actionsEl.appendChild(deleteEl);
            nodeEl.appendChild(actionsEl);

            itemsEl.appendChild(nodeEl);
        }
    });

    categoryEl.appendChild(itemsEl);
    nodeTreeView.appendChild(categoryEl);
}

function updateNodeTreeView() {
    // Clear existing tree view
    nodeTreeView.innerHTML = '';

    // Recreate all categories
    Object.keys(NODE_TYPES).forEach(category => {
        createCategoryInTreeView(category);
    });
}

// Draw grid on canvas
function drawGrid() {
    const ctx = gridCanvas.getContext('2d');
    const width = gridCanvas.width;
    const height = gridCanvas.height;

    ctx.clearRect(0, 0, width, height);

    if (!state.grid.enabled) return;

    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;

    // Draw vertical lines
    for (let x = 0; x <= width; x += state.grid.size) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, height);
        ctx.stroke();
    }

    // Draw horizontal lines
    for (let y = 0; y <= height; y += state.grid.size) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(width, y + 0.5);
        ctx.stroke();
    }
}

// Initialize canvas
function initCanvas() {
    // Set up canvas for drag and drop
    canvas.addEventListener('dragover', (e) => e.preventDefault());
    canvas.addEventListener('drop', onDrop);

    // Mouse event handlers for canvas
    canvas.addEventListener('mousedown', onCanvasMouseDown);
    canvas.addEventListener('mousemove', onCanvasMouseMove);
    canvas.addEventListener('mouseup', onCanvasMouseUp);

    // Prevent context menu on right-click
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Set initial canvas dimensions
    updateCanvasDimensions();

    // Listen for window resize
    window.addEventListener('resize', updateCanvasDimensions);
}

function updateCanvasDimensions() {
    // Update grid canvas size
    gridCanvas.width = canvas.clientWidth;
    gridCanvas.height = canvas.clientHeight;

    // Update SVG layers sizes
    connectionsLayer.setAttribute('width', canvas.clientWidth);
    connectionsLayer.setAttribute('height', canvas.clientHeight);
    activeConnectionLayer.setAttribute('width', canvas.clientWidth);
    activeConnectionLayer.setAttribute('height', canvas.clientHeight);

    // Redraw the grid
    drawGrid();
}

// Canvas mouse event handlers
function onCanvasMouseDown(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Handle right-click
    if (e.button === 2) {
        return; // Right click handled separately
    }

    // Regular click - check if clicking on a node
    const node = findNodeAt(x, y);

    // If not clicking on a node, start selection box
    if (!node) {
        // Clear selection if not holding shift
        if (!e.shiftKey) {
            clearNodeSelection();
        }

        // Start selection box
        state.selectionBox.active = true;
        state.selectionBox.startX = x;
        state.selectionBox.startY = y;
        state.selectionBox.endX = x;
        state.selectionBox.endY = y;

        // Create selection box element
        const selectionBoxEl = document.createElement('div');
        selectionBoxEl.className = 'selection-box';
        selectionBoxEl.id = 'selection-box';
        canvas.appendChild(selectionBoxEl);

        updateSelectionBox();
    }
    // Clicking on a node - start dragging or add/remove from selection
    else {
        // If holding shift, toggle node selection
        if (e.shiftKey) {
            toggleNodeSelection(node.id);
        }
        // If node is not in selection, select only this node
        else if (!isNodeSelected(node.id)) {
            clearNodeSelection();
            addNodeToSelection(node.id);
        }

        // Start dragging selected nodes
        startNodeDrag(x, y);
    }
}

function onCanvasMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Update mouse position (used for various operations)
    state.mousePosition.x = x;
    state.mousePosition.y = y;

    // If drawing a selection box
    if (state.selectionBox.active) {
        state.selectionBox.endX = x;
        state.selectionBox.endY = y;
        updateSelectionBox();
    }

    // If there's a pending connection being drawn
    if (state.pendingConnection) {
        drawPendingConnection();
    }
}

function onCanvasMouseUp(e) {
    // 如果绘制选择框，完成它
    if (state.selectionBox.active) {
        state.selectionBox.active = false;
        selectNodesInBox();

        // 移除选择框元素
        const selectionBoxEl = document.getElementById('selection-box');
        if (selectionBoxEl) {
            selectionBoxEl.remove();
        }
    }

    // 确保在画布mouseup事件中也正确处理拖拽结束
    if (state.dragging.active) {
        // state.dragging.active = false;
        state.dragging.nodes = [];
        clearAlignmentGuides();

        // 移除document级别的事件监听器
        document.removeEventListener('mousemove', onDocumentMouseMove);
        document.removeEventListener('mouseup', onDocumentMouseUp);
    }

    // 更新面板
    updatePropertiesPanel();
}

// Selection box methods
function updateSelectionBox() {
    const selectionBoxEl = document.getElementById('selection-box');
    if (!selectionBoxEl) return;

    const {startX, startY, endX, endY} = state.selectionBox;

    // Calculate box dimensions
    const left = Math.min(startX, endX);
    const top = Math.min(startY, endY);
    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);

    // Update element style
    selectionBoxEl.style.left = `${left}px`;
    selectionBoxEl.style.top = `${top}px`;
    selectionBoxEl.style.width = `${width}px`;
    selectionBoxEl.style.height = `${height}px`;
}

function selectNodesInBox() {
    const {startX, startY, endX, endY} = state.selectionBox;

    // Calculate box boundaries
    const left = Math.min(startX, endX);
    const top = Math.min(startY, endY);
    const right = Math.max(startX, endX);
    const bottom = Math.max(startY, endY);

    // Find nodes within the box
    state.nodes.forEach(node => {
        const nodeLeft = node.x;
        const nodeTop = node.y;
        const nodeRight = node.x + 150; // Node width
        const nodeBottom = node.y + 40; // Node height

        // Check if node is within box (even partially)
        if (nodeRight >= left && nodeLeft <= right && nodeBottom >= top && nodeTop <= bottom) {
            addNodeToSelection(node.id);
        }
    });

    // Update visual appearance of nodes
    renderNodes();
}

// Node selection methods
function addNodeToSelection(nodeId) {
    if (!isNodeSelected(nodeId)) {
        state.selectedNodes.push(nodeId);
    }
}

function removeNodeFromSelection(nodeId) {
    state.selectedNodes = state.selectedNodes.filter(id => id !== nodeId);
}

function toggleNodeSelection(nodeId) {
    if (isNodeSelected(nodeId)) {
        removeNodeFromSelection(nodeId);
    } else {
        addNodeToSelection(nodeId);
    }
}

function isNodeSelected(nodeId) {
    return state.selectedNodes.includes(nodeId);
}

function clearNodeSelection() {
    state.selectedNodes = [];
}

function selectAllNodes() {
    clearNodeSelection();
    state.nodes.forEach(node => {
        addNodeToSelection(node.id);
    });
    renderNodes();
    updatePropertiesPanel();
}

// Dragging multiple nodes
function startNodeDrag(x, y) {
    state.dragging.active = true;
    state.dragging.startX = x;
    state.dragging.startY = y;
    state.dragging.currentX = x;
    state.dragging.currentY = y;

    // 存储每个选中节点的相对位置
    state.dragging.nodes = state.selectedNodes.map(nodeId => {
        const node = state.nodes.find(n => n.id === nodeId);
        return {
            id: nodeId,
            offsetX: node.x - x,
            offsetY: node.y - y
        };
    });

    // 添加document级别的事件监听器
    document.addEventListener('mousemove', onDocumentMouseMove);
    document.addEventListener('mouseup', onDocumentMouseUp);
}

function onDocumentMouseMove(e) {
    if (!state.dragging.active) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Update mouse position
    state.mousePosition.x = x;
    state.mousePosition.y = y;

    const deltaX = x - state.dragging.currentX;
    const deltaY = y - state.dragging.currentY;

    state.dragging.currentX = x;
    state.dragging.currentY = y;

    // Check if we should show alignment guides
    const alignmentInfo = calculateAlignment(state.dragging.nodes);
    updateAlignmentGuides(alignmentInfo);

    // Move all selected nodes
    state.dragging.nodes.forEach(nodeInfo => {
        const node = state.nodes.find(n => n.id === nodeInfo.id);
        if (node) {
            // Apply movement with snapping if enabled
            let newX = node.x + deltaX;
            let newY = node.y + deltaY;

            // Check if we should snap to an alignment guide
            if (alignmentInfo.horizontal.active) {
                newY = alignmentInfo.horizontal.position - nodeInfo.offsetY;
            }
            if (alignmentInfo.vertical.active) {
                newX = alignmentInfo.vertical.position - nodeInfo.offsetX;
            }

            // Apply grid snapping if enabled
            node.x = state.grid.snap ? snapToGrid(newX) : newX;
            node.y = state.grid.snap ? snapToGrid(newY) : newY;
        }
    });

    // Update the rendering
    renderNodes();
    renderConnections();
}

function onDocumentMouseUp(e) {
    if (state.dragging.active) {
        state.dragging.active = false;
        state.dragging.nodes = [];

        // 清除对齐辅助线
        clearAlignmentGuides();

        // 移除事件监听器
        document.removeEventListener('mousemove', onDocumentMouseMove);
        document.removeEventListener('mouseup', onDocumentMouseUp);

        // 确保渲染更新
        renderNodes();
        renderConnections();
    }
}

// Alignment functions
function calculateAlignment(nodeInfos) {
    // Check if we should perform alignment
    if (nodeInfos.length <= 1) {
        return {
            horizontal: {active: false},
            vertical: {active: false}
        };
    }

    // Get all nodes (both selected and unselected)
    const selectedNodeIds = nodeInfos.map(info => info.id);

    // For each dragging node, check alignment with other nodes
    let horizontalGuide = {active: false, position: 0, similarity: Number.MAX_VALUE};
    let verticalGuide = {active: false, position: 0, similarity: Number.MAX_VALUE};

    // Threshold for snapping (in pixels)
    const snapThreshold = 10;

    // First, calculate positions of the dragging nodes
    const draggingNodes = [];
    nodeInfos.forEach(info => {
        const node = state.nodes.find(n => n.id === info.id);
        if (node) {
            draggingNodes.push({
                id: node.id,
                left: node.x,
                right: node.x + 150,
                top: node.y,
                bottom: node.y + 40,
                centerX: node.x + 75,
                centerY: node.y + 20
            });
        }
    });

    // Get position data for all non-selected nodes
    const staticNodes = state.nodes
        .filter(n => !selectedNodeIds.includes(n.id))
        .map(node => ({
            id: node.id,
            left: node.x,
            right: node.x + 150,
            top: node.y,
            bottom: node.y + 40,
            centerX: node.x + 75,
            centerY: node.y + 20
        }));

    // Check for each dragging node against each static node
    draggingNodes.forEach(movingNode => {
        staticNodes.forEach(staticNode => {
            // Check horizontal alignment (top, center, bottom)
            const topDiff = Math.abs(movingNode.top - staticNode.top);
            const centerYDiff = Math.abs(movingNode.centerY - staticNode.centerY);
            const bottomDiff = Math.abs(movingNode.bottom - staticNode.bottom);

            // Find best horizontal alignment
            if (topDiff < snapThreshold && topDiff < horizontalGuide.similarity) {
                horizontalGuide = {active: true, position: staticNode.top, similarity: topDiff};
            }
            if (centerYDiff < snapThreshold && centerYDiff < horizontalGuide.similarity) {
                horizontalGuide = {active: true, position: staticNode.centerY, similarity: centerYDiff};
            }
            if (bottomDiff < snapThreshold && bottomDiff < horizontalGuide.similarity) {
                horizontalGuide = {active: true, position: staticNode.bottom, similarity: bottomDiff};
            }

            // Check vertical alignment (left, center, right)
            const leftDiff = Math.abs(movingNode.left - staticNode.left);
            const centerXDiff = Math.abs(movingNode.centerX - staticNode.centerX);
            const rightDiff = Math.abs(movingNode.right - staticNode.right);

            // Find best vertical alignment
            if (leftDiff < snapThreshold && leftDiff < verticalGuide.similarity) {
                verticalGuide = {active: true, position: staticNode.left, similarity: leftDiff};
            }
            if (centerXDiff < snapThreshold && centerXDiff < verticalGuide.similarity) {
                verticalGuide = {active: true, position: staticNode.centerX, similarity: centerXDiff};
            }
            if (rightDiff < snapThreshold && rightDiff < verticalGuide.similarity) {
                verticalGuide = {active: true, position: staticNode.right, similarity: rightDiff};
            }
        });
    });

    return {
        horizontal: horizontalGuide,
        vertical: verticalGuide
    };
}

function updateAlignmentGuides(alignmentInfo) {
    // First, clear existing guides
    clearAlignmentGuides();

    // Create horizontal guide if needed
    if (alignmentInfo.horizontal.active) {
        const guide = document.createElement('div');
        guide.className = 'alignment-guide horizontal';
        guide.style.top = `${alignmentInfo.horizontal.position}px`;
        canvas.appendChild(guide);

        state.alignmentGuides.push(guide);
    }

    // Create vertical guide if needed
    if (alignmentInfo.vertical.active) {
        const guide = document.createElement('div');
        guide.className = 'alignment-guide vertical';
        guide.style.left = `${alignmentInfo.vertical.position}px`;
        canvas.appendChild(guide);

        state.alignmentGuides.push(guide);
    }
}

function clearAlignmentGuides() {
    state.alignmentGuides.forEach(guide => {
        if (guide.parentNode) {
            guide.parentNode.removeChild(guide);
        }
    });
    state.alignmentGuides = [];
}

// Explicit alignment actions
function alignSelectedNodes(alignType) {
    if (state.selectedNodes.length <= 1) return;

    // Convert selected node IDs to node objects
    const selectedNodes = state.selectedNodes.map(id =>
        state.nodes.find(node => node.id === id)
    ).filter(Boolean);

    // Calculate target position based on alignment type
    let targetValue;

    switch (alignType) {
        case 'left':
            // Align to leftmost node
            targetValue = Math.min(...selectedNodes.map(node => node.x));
            // Apply to all selected nodes
            selectedNodes.forEach(node => {
                node.x = targetValue;
            });
            break;

        case 'center':
            // Find average center position
            targetValue = selectedNodes.reduce((sum, node) => sum + (node.x + 75), 0) / selectedNodes.length;
            // Apply to all selected nodes
            selectedNodes.forEach(node => {
                node.x = targetValue - 75; // Adjust for node center
            });
            break;

        case 'right':
            // Align to rightmost node
            targetValue = Math.max(...selectedNodes.map(node => node.x + 150));
            // Apply to all selected nodes
            selectedNodes.forEach(node => {
                node.x = targetValue - 150; // Adjust for node width
            });
            break;

        case 'top':
            // Align to topmost node
            targetValue = Math.min(...selectedNodes.map(node => node.y));
            // Apply to all selected nodes
            selectedNodes.forEach(node => {
                node.y = targetValue;
            });
            break;

        case 'middle':
            // Find average middle position
            targetValue = selectedNodes.reduce((sum, node) => sum + (node.y + 20), 0) / selectedNodes.length;
            // Apply to all selected nodes
            selectedNodes.forEach(node => {
                node.y = targetValue - 20; // Adjust for node middle
            });
            break;

        case 'bottom':
            // Align to bottommost node
            targetValue = Math.max(...selectedNodes.map(node => node.y + 40));
            // Apply to all selected nodes
            selectedNodes.forEach(node => {
                node.y = targetValue - 40; // Adjust for node height
            });
            break;
    }

    // Apply grid snapping if enabled
    if (state.grid.snap) {
        selectedNodes.forEach(node => {
            node.x = snapToGrid(node.x);
            node.y = snapToGrid(node.y);
        });
    }

    // Update rendering
    renderNodes();
    renderConnections();
}

// Find a node at a specific point on the canvas
function findNodeAt(x, y) {
    // Search in reverse order (top-most node first)
    for (let i = state.nodes.length - 1; i >= 0; i--) {
        const node = state.nodes[i];
        if (x >= node.x && x <= node.x + 150 && y >= node.y && y <= node.y + 40) {
            return node;
        }
    }
    return null;
}

// Drag and drop
function onDrop(e) {
    e.preventDefault();
    const nodeType = e.dataTransfer.getData('nodeType');
    const nodeCategory = e.dataTransfer.getData('nodeCategory');
    const nodeId = e.dataTransfer.getData('nodeId');

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (nodeId) {
        // Moving existing node(s)
        if (isNodeSelected(nodeId)) {
            // Move all selected nodes
            const selectedNode = state.nodes.find(n => n.id === nodeId);
            if (selectedNode) {
                const deltaX = x - selectedNode.x - 75; // Center the node horizontally
                const deltaY = y - selectedNode.y - 20; // Adjust for node height

                // Move all selected nodes
                state.selectedNodes.forEach(id => {
                    const node = state.nodes.find(n => n.id === id);
                    if (node) {
                        node.x = state.grid.snap ? snapToGrid(node.x + deltaX) : node.x + deltaX;
                        node.y = state.grid.snap ? snapToGrid(node.y + deltaY) : node.y + deltaY;
                    }
                });
            }
        } else {
            // Move just the dragged node
            const node = state.nodes.find(n => n.id === nodeId);
            if (node) {
                node.x = state.grid.snap ? snapToGrid(x - 75) : x - 75; // Center the node horizontally
                node.y = state.grid.snap ? snapToGrid(y - 20) : y - 20; // Adjust for node height
            }
        }

        renderNodes();
        renderConnections();
    } else if (nodeType && nodeCategory) {
        // Creating new node from type
        const newX = state.grid.snap ? snapToGrid(x - 75) : x - 75;
        const newY = state.grid.snap ? snapToGrid(y - 20) : y - 20;

        const newNodeId = createNode(nodeType, nodeCategory, newX, newY);

        // Select the new node
        clearNodeSelection();
        addNodeToSelection(newNodeId);
        renderNodes();
        updatePropertiesPanel();
    }
}

// Node operations
function createNode(typeStr, category, x, y) {
    const id = `node_${state.nodeCounter++}`;

    // Find node type definition
    let nodeTypeDef = null;

    // First check built-in types
    if (NODE_TYPES[category]) {
        nodeTypeDef = NODE_TYPES[category].find(nt => nt.type === typeStr);
    }

    // Then check custom types
    if (!nodeTypeDef) {
        nodeTypeDef = state.customNodeTypes.find(nt => nt.type === typeStr);
    }

    if (!nodeTypeDef) {
        console.error(`Node type ${typeStr} not found in category ${category}`);
        return null;
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
        type: nodeTypeDef.type,
        name: nodeTypeDef.name,
        category,
        x,
        y,
        properties
    };

    state.nodes.push(node);
    renderNodes();
    return id;
}

function deleteSelectedNodes() {
    // All nodes in the canvas can be deleted, regardless of type
    if (state.selectedNodes.length === 0) return;

    // Remove connections related to these nodes
    state.connections = state.connections.filter(conn =>
        !state.selectedNodes.includes(conn.source) && !state.selectedNodes.includes(conn.target)
    );

    // Remove the nodes
    state.nodes = state.nodes.filter(node => !state.selectedNodes.includes(node.id));

    // Clear selection
    clearNodeSelection();

    // Update rendering
    renderNodes();
    renderConnections();
    updatePropertiesPanel();
}

// Custom node operations
function addCustomNode() {
    createNodeModal.style.display = 'block';
}

function handleCreateNodeSubmit(e) {
    e.preventDefault();

    const name = document.getElementById('custom-node-name').value;
    const category = document.getElementById('custom-node-category').value;

    if (!name) return;

    // Create new node type
    const type = `Custom_${name.replace(/\s+/g, '')}`;

    // Get default properties and constraints for this category
    const properties = getDefaultPropertiesForCategory(category);
    const constraints = getDefaultConstraintsForCategory(category);

    const newNodeType = {
        type,
        name,
        category,
        builtin: false,
        description: 'Custom node',
        properties,
        maxChildren: constraints.maxChildren,
        canBeChildless: constraints.canBeChildless
    };

    // Add to custom node types
    state.customNodeTypes.push(newNodeType);

    // Reset form and close modal
    document.getElementById('custom-node-name').value = '';
    createNodeModal.style.display = 'none';

    // Refresh node tree view
    updateNodeTreeView();
}

function deleteNodeType(nodeType) {
    // Remove the node type from custom node types
    state.customNodeTypes = state.customNodeTypes.filter(nt => nt.type !== nodeType);

    // Remove all nodes of this type from the canvas
    const nodesToRemove = state.nodes.filter(node => node.type === nodeType);
    const nodeIdsToRemove = nodesToRemove.map(node => node.id);

    // Remove connections related to these nodes
    state.connections = state.connections.filter(conn =>
        !nodeIdsToRemove.includes(conn.source) && !nodeIdsToRemove.includes(conn.target)
    );

    // Remove the nodes
    state.nodes = state.nodes.filter(node => !nodeIdsToRemove.includes(node.id));

    // Update rendering
    updateNodeTreeView();
    renderNodes();
    renderConnections();
}

// Handle context menu for node types in palette
function handleNodeTypeContextMenu(e, nodeType) {
    e.preventDefault();

    // Position the context menu
    nodeTypeContextMenu.style.display = 'block';
    nodeTypeContextMenu.style.left = `${e.clientX}px`;
    nodeTypeContextMenu.style.top = `${e.clientY}px`;

    // Store the current node type
    nodeTypeContextMenu.setAttribute('data-node-type', nodeType);

    // Add one-time event listener to hide menu when clicking elsewhere
    setTimeout(() => {
        window.addEventListener('click', hideNodeTypeContextMenu, {once: true});
    }, 0);
}

function hideNodeTypeContextMenu() {
    nodeTypeContextMenu.style.display = 'none';
}

// Connection handling (two-click system)
function handlePortClick(nodeId, portType, event) {
    // First check if the port is disabled by looking at the element's class
    if (event.target.classList.contains('disabled')) {
        // Do nothing if the port is disabled
        return;
    }

    const node = state.nodes.find(n => n.id === nodeId);
    if (!node) return;

    // If there's no pending connection, start one
    if (!state.pendingConnection) {
        // Check if this port can have connections (leaf nodes can't have children)
        if (portType === 'child') {
            const nodeDef = getNodeDefinition(node.type, node.category);
            if (nodeDef && nodeDef.maxChildren === 0) {
                showInvalidConnectionFeedback(nodeId);
                return; // Leaf nodes can't have children
            }
        }

        state.pendingConnection = {
            sourceId: nodeId,
            sourcePort: portType
        };

        activeConnectionLayer.style.display = 'block';
        drawPendingConnection();

        // Highlight the port
        const port = document.querySelector(`.tree-node[data-id="${nodeId}"] .port-${portType}`);
        if (port) {
            port.classList.add('active');
        }
    }
    // If there is a pending connection, try to complete it
    else {
        // Don't connect to self
        if (nodeId === state.pendingConnection.sourceId) {
            return;
        }

        // Check connection type - we need to have one parent port and one child port
        if (state.pendingConnection.sourcePort === portType) {
            // Can't connect same port types
            showInvalidConnectionFeedback(nodeId);
            return;
        }

        // Create the connection objects for validation
        let sourceNode, targetNode;
        if (state.pendingConnection.sourcePort === 'child') {
            // Source child port to target parent port
            sourceNode = state.nodes.find(n => n.id === state.pendingConnection.sourceId);
            targetNode = node;
        } else {
            // Source parent port to target child port
            sourceNode = node;
            targetNode = state.nodes.find(n => n.id === state.pendingConnection.sourceId);
        }

        // Validate the connection
        const validationResult = isConnectionValid(sourceNode, targetNode, state.connections);
        if (!validationResult.valid) {
            showInvalidConnectionFeedback(nodeId, validationResult.message);
            return;
        }

        // Create the connection
        if (state.pendingConnection.sourcePort === 'child' && portType === 'parent') {
            // Source child port to target parent port
            state.connections.push({
                source: state.pendingConnection.sourceId,
                target: nodeId,
                id: `conn_${Date.now()}`
            });
        } else if (state.pendingConnection.sourcePort === 'parent' && portType === 'child') {
            // Source parent port to target child port
            state.connections.push({
                source: nodeId,
                target: state.pendingConnection.sourceId,
                id: `conn_${Date.now()}`
            });
        }

        // Reset pending connection state
        resetPendingConnection();
        renderConnections();

        // Update ports visibility after new connection
        renderNodes();
    }
}

function showInvalidConnectionFeedback(nodeId, message) {
    // Show invalid connection feedback
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

function resetPendingConnection() {
    if (state.pendingConnection) {
        // Remove highlight from the source port
        const port = document.querySelector(`.tree-node[data-id="${state.pendingConnection.sourceId}"] .port-${state.pendingConnection.sourcePort}`);
        if (port) {
            port.classList.remove('active');
        }
    }

    state.pendingConnection = null;
    activeConnectionLayer.style.display = 'none';
    activeConnectionLayer.innerHTML = '';
}

function drawPendingConnection() {
    if (!state.pendingConnection) return;

    const sourceNode = state.nodes.find(node => node.id === state.pendingConnection.sourceId);
    if (!sourceNode) return;

    // Get start point based on port type
    let startX, startY;

    if (state.pendingConnection.sourcePort === 'parent') {
        startX = sourceNode.x + 75; // middle top of node
        startY = sourceNode.y;
    } else {
        startX = sourceNode.x + 75; // middle bottom of node
        startY = sourceNode.y + 40;
    }

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#0066cc');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-dasharray', '5,5');

    const controlY = (startY + state.mousePosition.y) / 2;
    const d = `M ${startX} ${startY} C ${startX} ${controlY}, ${state.mousePosition.x} ${controlY}, ${state.mousePosition.x} ${state.mousePosition.y}`;
    path.setAttribute('d', d);

    // Clear and add the new path
    activeConnectionLayer.innerHTML = '';
    activeConnectionLayer.appendChild(path);
}

function generatePathD(connection) {
    const sourceNode = state.nodes.find(node => node.id === connection.source);
    const targetNode = state.nodes.find(node => node.id === connection.target);

    if (!sourceNode || !targetNode) return '';

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

function handleConnectionRightClick(e, connectionId) {
    e.preventDefault();

    state.selectedConnection = connectionId;

    // Position and show context menu
    connectionContextMenu.style.display = 'block';
    connectionContextMenu.style.left = `${e.clientX}px`;
    connectionContextMenu.style.top = `${e.clientY}px`;

    // Add one-time event listener to hide menu when clicking elsewhere
    setTimeout(() => {
        window.addEventListener('click', hideConnectionContextMenu, {once: true});
    }, 0);
}

function hideConnectionContextMenu() {
    connectionContextMenu.style.display = 'none';
}

function deleteConnection() {
    if (!state.selectedConnection) return;

    state.connections = state.connections.filter(conn => conn.id !== state.selectedConnection);
    state.selectedConnection = null;

    renderConnections();
    hideConnectionContextMenu();
}

// Update port visibility based on node constraints
function updatePortVisibility(nodeEl, node) {
    const nodeDef = getNodeDefinition(node.type, node.category);
    if (!nodeDef) return;

    // Check if this node can have children
    const childPort = nodeEl.querySelector('.port-child');
    if (childPort) {
        if (nodeDef.maxChildren === 0) {
            childPort.classList.add('disabled');
            childPort.title = 'This node cannot have children';
        } else {
            // Check if this node already has max children
            const childCount = state.connections.filter(conn => conn.source === node.id).length;
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
        const hasParent = state.connections.some(conn => conn.target === node.id);
        if (hasParent) {
            parentPort.classList.add('disabled');
            parentPort.title = 'This node already has a parent';
        } else {
            parentPort.classList.remove('disabled');
            parentPort.title = '';
        }
    }
}

// Rendering
function renderNodes() {
    // Remove existing nodes
    const existingNodes = document.querySelectorAll('.tree-node');
    existingNodes.forEach(node => node.remove());

    // Create nodes
    state.nodes.forEach(node => {
        const nodeEl = document.createElement('div');
        nodeEl.className = `tree-node ${node.type}`;
        nodeEl.setAttribute('data-id', node.id);

        // Add monitoring state class if available
        if (state.monitor.active && state.monitor.nodeStates[node.id]) {
            nodeEl.classList.add(state.monitor.nodeStates[node.id]);
        }

        // Add selected class if node is in selection
        if (isNodeSelected(node.id)) {
            nodeEl.classList.add('selected');
        }

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
        parentPortEl.addEventListener('click', (e) => {
            e.stopPropagation();
            handlePortClick(node.id, 'parent', e);
        });
        portsEl.appendChild(parentPortEl);

        const childPortEl = document.createElement('div');
        childPortEl.className = 'port port-child';
        childPortEl.addEventListener('click', (e) => {
            e.stopPropagation();
            handlePortClick(node.id, 'child', e);
        });
        portsEl.appendChild(childPortEl);

        nodeEl.appendChild(portsEl);

        // Event listeners
        nodeEl.addEventListener('click', (e) => {
            // Don't select node if clicking on a port
            if (!e.target.classList.contains('port')) {
                e.stopPropagation();

                // Shift+click to toggle selection
                if (e.shiftKey) {
                    toggleNodeSelection(node.id);
                } else {
                    // Normal click selects only this node
                    clearNodeSelection();
                    addNodeToSelection(node.id);
                }

                renderNodes();
                updatePropertiesPanel();
            }
        });

        nodeEl.draggable = true;
        nodeEl.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('port')) {
                e.preventDefault();
                return false;
            }

            e.stopPropagation();
            e.dataTransfer.setData('nodeId', node.id);

            // If the node isn't selected, select only this node
            if (!isNodeSelected(node.id)) {
                clearNodeSelection();
                addNodeToSelection(node.id);
                renderNodes();
            }
        });

        canvas.appendChild(nodeEl);

        // Update port visibility based on node constraints
        updatePortVisibility(nodeEl, node);
    });
}

function renderConnections() {
    // Clear existing connections
    while (connectionsLayer.firstChild) {
        connectionsLayer.removeChild(connectionsLayer.firstChild);
    }

    // Create connections
    state.connections.forEach(connection => {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', 'connection-path');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', '#666');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('d', generatePathD(connection));
        path.setAttribute('data-id', connection.id);

        // Add right-click handler for context menu
        path.addEventListener('contextmenu', (e) => handleConnectionRightClick(e, connection.id));

        connectionsLayer.appendChild(path);
    });
}

function updatePropertiesPanel() {
    // Show properties panel only if exactly one node is selected
    if (state.selectedNodes.length === 1) {
        const nodeId = state.selectedNodes[0];
        const node = state.nodes.find(n => n.id === nodeId);

        if (!node) {
            propertiesPanel.style.display = 'none';
            return;
        }

        propertiesPanel.style.display = 'block';

        // Get node definition for properties and descriptions
        const nodeDef = getNodeDefinition(node.type, node.category);

        let html = `
            <div class="form-group">
                <label>Name</label>
                <input type="text" id="node-name" value="${escapeHTML(node.name)}" />
            </div>
            <div class="form-group">
                <label>Type</label>
                <input type="text" value="${escapeHTML(node.type)}" readonly />
            </div>
            <div class="form-group">
                <label>Category</label>
                <input type="text" value="${escapeHTML(node.category)}" readonly />
            </div>
        `;

        // Add description if available
        if (nodeDef && nodeDef.description) {
            html += `
                <div class="form-group">
                    <label>Description</label>
                    <textarea readonly>${escapeHTML(nodeDef.description)}</textarea>
                </div>
            `;
        }

        // Add type-specific properties
        html += `<div class="form-group"><label>Properties</label>`;

        if (nodeDef && nodeDef.properties && nodeDef.properties.length > 0) {
            nodeDef.properties.forEach(prop => {
                const value = node.properties[prop.name] !== undefined ?
                    node.properties[prop.name] :
                    (prop.default || '');

                html += `
                    <div class="parameter-row">
                        <input type="text" value="${escapeHTML(prop.name)}" readonly />
                        <input type="text" class="property-value" data-name="${escapeHTML(prop.name)}" value="${escapeHTML(value)}" />
                    </div>
                    <div style="margin-bottom: 8px; font-size: 11px; color: #666;">${escapeHTML(prop.description || '')}</div>
                `;
            });
        } else {
            html += `<p style="font-size: 12px; color: #666;">No properties available for this node type.</p>`;
        }

        html += `</div>`;

        // Add delete button - all nodes can be deleted from canvas
        html += `
            <button id="delete-node-btn" class="delete-button">Delete Node</button>
        `;

        propertiesContent.innerHTML = html;

        // Add event listeners for properties changes
        document.getElementById('node-name').addEventListener('change', e => {
            node.name = e.target.value;
            renderNodes();
        });

        const deleteBtn = document.getElementById('delete-node-btn');
        deleteBtn.addEventListener('click', deleteSelectedNodes);

        // Property value change listeners
        document.querySelectorAll('.property-value').forEach(input => {
            input.addEventListener('change', e => {
                const propName = e.target.getAttribute('data-name');
                node.properties[propName] = e.target.value;
            });
        });
    }
    // If multiple nodes are selected, show a simpler panel
    else if (state.selectedNodes.length > 1) {
        propertiesPanel.style.display = 'block';

        let html = `
            <div class="form-group">
                <label>Multiple Selection</label>
                <p>${state.selectedNodes.length} nodes selected</p>
            </div>
            <button id="delete-selected-nodes-btn" class="delete-button">
                Delete ${state.selectedNodes.length} Node${state.selectedNodes.length > 1 ? 's' : ''}
            </button>
        `;

        propertiesContent.innerHTML = html;

        // Add event listener for delete button
        const deleteBtn = document.getElementById('delete-selected-nodes-btn');
        deleteBtn.addEventListener('click', deleteSelectedNodes);
    } else {
        propertiesPanel.style.display = 'none';
    }
}

// Collapsible dock panel
function toggleDockPanel() {
    dockPanel.classList.toggle('collapsed');

    // Update the toggle button icon
    const icon = toggleDockBtn.querySelector('i');
    if (dockPanel.classList.contains('collapsed')) {
        icon.style.transform = 'rotate(180deg)';
    } else {
        icon.style.transform = '';
    }
}

// Root node validation
function countRootNodes() {
    // Root nodes are nodes that have no parent (no incoming connections)
    const targetIds = state.connections.map(c => c.target);
    const rootNodes = state.nodes.filter(node => !targetIds.includes(node.id));

    return {
        count: rootNodes.length,
        rootNodes: rootNodes
    };
}

function validateRootNodes() {
    const result = countRootNodes();

    if (result.count === 0) {
        return {
            isValid: false,
            message: "Error: No root node found. Every behavior tree must have exactly one root node."
        };
    } else if (result.count > 1) {
        return {
            isValid: false,
            message: `Error: Multiple root nodes found (${result.count}). A behavior tree must have exactly one root node.`
        };
    }

    return {isValid: true, message: ""};
}

// Server-Sent Events for Monitoring
function startMonitoring() {
    if (state.monitor.active) return;

    const url = document.getElementById('sse-url').value;
    if (!url) {
        alert('Please enter a valid monitoring URL');
        return;
    }

    try {
        const eventSource = new EventSource(url);

        // Update UI
        monitorStatusIndicator.classList.remove('disconnected');
        monitorStatusIndicator.classList.add('connected');
        monitorStatusText.textContent = 'Connected';
        startMonitorBtn.style.display = 'none';
        stopMonitorBtn.style.display = 'block';

        // Set up event handlers
        eventSource.onopen = function () {
            console.log('Monitoring connection established');
        };

        eventSource.onmessage = function (event) {
            try {
                const data = JSON.parse(event.data);
                processMonitoringData(data);
            } catch (e) {
                console.error('Error parsing monitoring data:', e);
            }
        };

        eventSource.onerror = function (error) {
            console.error('Monitoring connection error:', error);
            stopMonitoring();

            monitorStatusText.textContent = 'Connection Error';
        };

        // Store the event source
        state.monitor.active = true;
        state.monitor.eventSource = eventSource;
    } catch (error) {
        console.error('Failed to start monitoring:', error);
        alert('Failed to connect to the monitoring server');
    }
}

function stopMonitoring() {
    if (!state.monitor.active) return;

    // Close the event source
    if (state.monitor.eventSource) {
        state.monitor.eventSource.close();
        state.monitor.eventSource = null;
    }

    // Update UI
    monitorStatusIndicator.classList.remove('connected');
    monitorStatusIndicator.classList.add('disconnected');
    monitorStatusText.textContent = 'Disconnected';
    startMonitorBtn.style.display = 'block';
    stopMonitorBtn.style.display = 'none';

    // Clear node states
    state.monitor.nodeStates = {};
    state.monitor.active = false;

    // Update node rendering
    renderNodes();
}

function processMonitoringData(data) {
    if (!data || !Array.isArray(data.nodes)) return;

    // Clear previous states
    state.monitor.nodeStates = {};

    // Process each node update
    data.nodes.forEach(nodeUpdate => {
        // Find the corresponding node in our editor by name
        const editorNode = state.nodes.find(n => n.name === nodeUpdate.name);
        if (editorNode) {
            // Map status from the server to our status classes
            let statusClass = 'idle';

            switch (nodeUpdate.status.toLowerCase()) {
                case 'running':
                case 'active':
                    statusClass = 'running';
                    break;
                case 'success':
                    statusClass = 'success';
                    break;
                case 'failure':
                    statusClass = 'failure';
                    break;
                default:
                    statusClass = 'idle';
            }

            // Store the status
            state.monitor.nodeStates[editorNode.id] = statusClass;
        }
    });

    // Update node rendering to show the new states
    renderNodes();
}

// File operations
function saveTree() {
    // Validate the tree has exactly one root node
    const validation = validateRootNodes();
    if (!validation.isValid) {
        alert(validation.message);
        return;
    }

    const treeData = {
        nodes: state.nodes,
        connections: state.connections,
        customNodeTypes: state.customNodeTypes,
        collapsedCategories: state.collapsedCategories,
        grid: state.grid
    };

    const blob = new Blob([JSON.stringify(treeData, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'behavior_tree.json';
    a.click();

    URL.revokeObjectURL(url);
}

function loadTree() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);

                // Load custom node types
                if (data.customNodeTypes && Array.isArray(data.customNodeTypes)) {
                    state.customNodeTypes = data.customNodeTypes;
                }

                // Load collapsed categories state
                if (data.collapsedCategories) {
                    state.collapsedCategories = data.collapsedCategories;
                }

                // Load grid settings
                if (data.grid) {
                    state.grid = data.grid;

                    // Update grid-related UI
                    toggleGridBtn.classList.toggle('active', state.grid.enabled);
                    toggleSnapBtn.classList.toggle('active', state.grid.snap);

                    // Update grid display
                    drawGrid();
                }

                // Load nodes and connections
                state.nodes = data.nodes || [];
                state.connections = data.connections || [];

                // Update node counter to avoid ID collisions
                const highestId = state.nodes.reduce((max, node) => {
                    const idNum = parseInt(node.id.replace('node_', ''));
                    return isNaN(idNum) ? max : Math.max(max, idNum);
                }, -1);

                state.nodeCounter = highestId + 1;

                // Clear selection
                clearNodeSelection();

                // Update rendering
                updateNodeTreeView();
                renderNodes();
                renderConnections();
                updatePropertiesPanel();

                alert('Behavior tree loaded successfully');
            } catch (error) {
                console.error('Error loading tree:', error);
                alert('Invalid file format');
            }
        };
        reader.readAsText(file);
    };

    input.click();
}

function clearTree() {
    if (confirm('Are you sure you want to clear the tree? This will remove all nodes and connections.')) {
        state.nodes = [];
        state.connections = [];
        clearNodeSelection();
        state.nodeCounter = 0;

        // Keep custom node types

        renderNodes();
        renderConnections();
        updatePropertiesPanel();
    }
}

// XML Export
function exportXml() {
    // Validate the tree has exactly one root node
    const validation = validateRootNodes();
    if (!validation.isValid) {
        alert(validation.message);
        return;
    }

    const xmlStr = generateBehaviorTreeXml();
    xmlContent.textContent = xmlStr;
    xmlModal.style.display = 'block';
}

function buildTreeHierarchy() {
    // Use our root node validation
    const rootNodeResult = countRootNodes();

    if (rootNodeResult.count === 0) {
        return null;
    }

    // Select the first root as the main root
    const root = rootNodeResult.rootNodes[0];

    // Recursively build the tree
    return buildNodeHierarchy(root.id);
}

function buildNodeHierarchy(nodeId) {
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node) return null;

    // Find child connections
    const childConnections = state.connections.filter(c => c.source === nodeId);

    // Build child hierarchies
    const children = childConnections.map(conn => buildNodeHierarchy(conn.target)).filter(Boolean);

    return {
        ...node,
        children
    };
}

function generateBehaviorTreeXml() {
    const treeHierarchy = buildTreeHierarchy();

    if (!treeHierarchy) {
        return '<root BTCPP_format="4">\n  <!-- No valid tree structure found -->\n</root>';
    }

    let xml = '<?xml version="1.0"?>\n';
    xml += '<root BTCPP_format="4">\n';
    xml += '  <BehaviorTree ID="MainTree">\n';

    // Recursively add nodes
    xml += generateNodeXml(treeHierarchy, 4);

    xml += '  </BehaviorTree>\n';

    // Add TreeNodesModel section with custom node definitions
    const customNodes = state.customNodeTypes;
    if (customNodes.length > 0) {
        xml += '  <TreeNodesModel>\n';

        customNodes.forEach(nodeType => {
            xml += `    <Node ID="${escapeHTML(nodeType.type)}" `;

            // Add category
            switch (nodeType.category) {
                case 'control':
                    xml += 'NodeType="Control"';
                    break;
                case 'decorator':
                    xml += 'NodeType="Decorator"';
                    break;
                case 'action':
                    xml += 'NodeType="Action"';
                    break;
                case 'condition':
                    xml += 'NodeType="Condition"';
                    break;
                default:
                    xml += 'NodeType="SubTree"';
            }

            xml += '/>\n';
        });

        xml += '  </TreeNodesModel>\n';
    }

    xml += '</root>';

    return xml;
}

function generateNodeXml(node, indent) {
    const spaces = ' '.repeat(indent);
    const hasChildren = node.children && node.children.length > 0;

    let params = '';
    for (const [key, value] of Object.entries(node.properties)) {
        if (value) {
            params += ` ${key}="${escapeHTML(value)}"`;
        }
    }

    if (!hasChildren) {
        // Leaf node (Action or Condition typically)
        return `${spaces}<${escapeHTML(node.type)} name="${escapeHTML(node.name)}"${params}/>\n`;
    } else {
        // Node with children
        let xml = `${spaces}<${escapeHTML(node.type)} name="${escapeHTML(node.name)}"${params}>\n`;

        // Add children
        for (const child of node.children) {
            xml += generateNodeXml(child, indent + 2);
        }

        xml += `${spaces}</${escapeHTML(node.type)}>\n`;
        return xml;
    }
}

// Copy XML to clipboard
function copyXmlToClipboard() {
    const textToCopy = xmlContent.textContent;

    navigator.clipboard.writeText(textToCopy).then(() => {
        const originalText = copyXmlBtn.textContent;
        copyXmlBtn.textContent = 'Copied!';
        setTimeout(() => {
            copyXmlBtn.textContent = originalText;
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
    });
}

// Grid and snapping
function toggleGrid() {
    state.grid.enabled = !state.grid.enabled;
    toggleGridBtn.classList.toggle('active', state.grid.enabled);
    drawGrid();
}

function toggleSnap() {
    state.grid.snap = !state.grid.snap;
    toggleSnapBtn.classList.toggle('active', state.grid.snap);
}

// Initialize everything
function init() {
    // Expose state globally for node-types.js to access
    window.state = state;

    // Set up tree view
    initNodeTreeView();

    // Initialize canvas
    initCanvas();

    // Set up event listeners
    setupEventListeners();
}

function setupEventListeners() {
    // File operations
    saveBtn.addEventListener('click', saveTree);
    loadBtn.addEventListener('click', loadTree);
    clearBtn.addEventListener('click', clearTree);
    exportXmlBtn.addEventListener('click', exportXml);

    // Node management
    addNodeBtn.addEventListener('click', addCustomNode);

    // Connection management
    deleteConnectionBtn.addEventListener('click', deleteConnection);
    deleteNodeTypeBtn.addEventListener('click', () => {
        const nodeType = nodeTypeContextMenu.getAttribute('data-node-type');
        if (nodeType) {
            deleteNodeType(nodeType);
        }
        hideNodeTypeContextMenu();
    });

    // Grid and snap
    toggleGridBtn.addEventListener('click', toggleGrid);
    toggleSnapBtn.addEventListener('click', toggleSnap);

    // Dock panel toggle
    toggleDockBtn.addEventListener('click', toggleDockPanel);

    // Alignment buttons
    alignLeftBtn.addEventListener('click', () => alignSelectedNodes('left'));
    alignCenterBtn.addEventListener('click', () => alignSelectedNodes('center'));
    alignRightBtn.addEventListener('click', () => alignSelectedNodes('right'));
    alignTopBtn.addEventListener('click', () => alignSelectedNodes('top'));
    alignMiddleBtn.addEventListener('click', () => alignSelectedNodes('middle'));
    alignBottomBtn.addEventListener('click', () => alignSelectedNodes('bottom'));

    // Monitoring
    startMonitorBtn.addEventListener('click', startMonitoring);
    stopMonitorBtn.addEventListener('click', stopMonitoring);

    // Modal events
    closeCreateModal.addEventListener('click', () => createNodeModal.style.display = 'none');
    cancelCreateNodeBtn.addEventListener('click', () => createNodeModal.style.display = 'none');
    createNodeForm.addEventListener('submit', handleCreateNodeSubmit);

    closeXmlModal.addEventListener('click', () => xmlModal.style.display = 'none');
    copyXmlBtn.addEventListener('click', copyXmlToClipboard);

    // Keyboard events
    document.addEventListener('keydown', (e) => {
        // Cancel pending connection on escape key
        if (e.key === 'Escape' && state.pendingConnection) {
            resetPendingConnection();
        }

        // Delete key to delete selected nodes
        if (e.key === 'Delete' && state.selectedNodes.length > 0) {
            deleteSelectedNodes();
        }

        // Ctrl+A to select all nodes
        if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            selectAllNodes();
        }
    });

    // Close modals if clicked outside
    window.addEventListener('click', (e) => {
        if (e.target === xmlModal) {
            xmlModal.style.display = 'none';
        }
        if (e.target === createNodeModal) {
            createNodeModal.style.display = 'none';
        }
    });
}

// Start the application
document.addEventListener('DOMContentLoaded', init);