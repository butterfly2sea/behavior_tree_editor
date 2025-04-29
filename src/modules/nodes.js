/**
 * Nodes Module - Manages node operations
 */
import {eventBus, EVENTS} from '../core/events.js';
import {logger} from '../utils/logger.js';
import {config} from '../core/config.js';
import {setupNodeDragAndDrop} from '../utils/drag.js';
import {NODE_TYPES} from "../data/node-types.js";

export function initNodes(elements, state, renderer) {
    const stateManager = state;

    /**
     * Create a new node
     */
    function createNode(type, category, x, y) {
        logger.debug(`Creating node: ${type} (${category}) at (${x}, ${y})`);

        try {
            // Generate unique ID
            const id = stateManager.generateNodeId();

            // Get node type definition
            const nodeTypeDef = getNodeTypeDefinition(type, category);

            // Default node properties
            const node = {
                id,
                type,
                name: nodeTypeDef ? nodeTypeDef.name || type : type,
                category,
                x,
                y,
                properties: {}
            };

            // Add default properties if defined
            if (nodeTypeDef && nodeTypeDef.properties) {
                nodeTypeDef.properties.forEach(prop => {
                    node.properties[prop.name] = prop.default || '';
                });
            }

            // Add to state
            stateManager.addNode(node);

            return id;
        } catch (error) {
            logger.error('Error creating node:', error);
            return null;
        }
    }

    /**
     * Delete a node
     */
    function deleteNode(nodeId) {
        logger.debug(`Deleting node: ${nodeId}`);
        stateManager.removeNode(nodeId);
    }

    /**
     * Delete multiple nodes
     */
    function deleteNodes(nodeIds) {
        logger.debug(`Deleting multiple nodes: ${nodeIds.length}`);

        // Remove each node (connections will be removed by event handlers)
        nodeIds.forEach(nodeId => {
            stateManager.removeNode(nodeId);
        });
    }

    /**
     * Delete selected nodes
     */
    function deleteSelectedNodes() {
        // 获取选择的节点ID并创建副本，避免在删除过程中数组被修改
        const selectedNodes = [...stateManager.getSelectedNodes()];

        if (selectedNodes.length === 0) return;

        // 记录日志
        logger.debug(`删除选中的节点: ${selectedNodes.length}个`);

        // 首先清除选择，避免删除过程中的状态不一致
        stateManager.clearSelection();

        // 删除节点
        selectedNodes.forEach(nodeId => {
            stateManager.removeNode(nodeId);
        });

        // 请求完全重新渲染
        renderer.requestFullRender();
    }

    /**
     * Update node properties
     */
    function updateNodeProperties(nodeId, properties) {
        const node = stateManager.getNodes().find(n => n.id === nodeId);

        if (!node) {
            logger.warn(`Node not found: ${nodeId}`);
            return false;
        }

        // Create copy of properties and update
        const updatedProperties = {...node.properties, ...properties};
        stateManager.updateNode(nodeId, {properties: updatedProperties});

        return true;
    }

    /**
     * Clone a node
     */
    function cloneNode(nodeId, offsetX = 50, offsetY = 50) {
        const nodes = stateManager.getNodes();
        const originalNode = nodes.find(n => n.id === nodeId);

        if (!originalNode) {
            logger.warn(`Node not found for cloning: ${nodeId}`);
            return null;
        }

        logger.debug(`Cloning node: ${nodeId}`);

        // Create a new node with same properties
        const newId = createNode(
            originalNode.type,
            originalNode.category,
            originalNode.x + offsetX,
            originalNode.y + offsetY
        );

        if (!newId) return null;

        // Copy properties and rename
        stateManager.updateNode(newId, {
            name: `${originalNode.name} (copy)`,
            properties: {...originalNode.properties}
        });

        return newId;
    }

    /**
     * Clone selected nodes
     */
    function cloneSelectedNodes(offsetX = 50, offsetY = 50) {
        const selectedNodes = stateManager.getSelectedNodes();
        if (selectedNodes.length === 0) return [];

        return selectedNodes.map(nodeId => cloneNode(nodeId, offsetX, offsetY));
    }

    /**
     * Align selected nodes
     */
    function alignNodes(alignType) {
        const selectedNodes = stateManager.getSelectedNodes();

        if (selectedNodes.length <= 1) {
            logger.debug('Not enough nodes selected for alignment');
            return;
        }

        // Get the actual node objects
        const nodes = selectedNodes.map(id =>
            stateManager.getNodes().find(node => node.id === id)
        ).filter(Boolean);

        // Determine alignment target position
        let targetValue;

        switch (alignType) {
            case 'left':
                targetValue = Math.min(...nodes.map(node => node.x));
                nodes.forEach(node => {
                    stateManager.updateNode(node.id, {x: targetValue});
                });
                break;

            case 'center':
                targetValue = nodes.reduce((sum, node) => sum + node.x + config.nodeWidth / 2, 0) / nodes.length;
                nodes.forEach(node => {
                    stateManager.updateNode(node.id, {x: targetValue - config.nodeWidth / 2});
                });
                break;

            case 'right':
                targetValue = Math.max(...nodes.map(node => node.x + config.nodeWidth));
                nodes.forEach(node => {
                    stateManager.updateNode(node.id, {x: targetValue - config.nodeWidth});
                });
                break;

            case 'top':
                targetValue = Math.min(...nodes.map(node => node.y));
                nodes.forEach(node => {
                    stateManager.updateNode(node.id, {y: targetValue});
                });
                break;

            case 'middle':
                targetValue = nodes.reduce((sum, node) => sum + node.y + config.nodeHeight / 2, 0) / nodes.length;
                nodes.forEach(node => {
                    stateManager.updateNode(node.id, {y: targetValue - config.nodeHeight / 2});
                });
                break;

            case 'bottom':
                targetValue = Math.max(...nodes.map(node => node.y + config.nodeHeight));
                nodes.forEach(node => {
                    stateManager.updateNode(node.id, {y: targetValue - config.nodeHeight});
                });
                break;
        }

        // Apply grid snapping if enabled
        if (stateManager.getGrid().snap) {
            applyGridSnapping(selectedNodes);
        }

        // Request render update
        renderer.requestRender();
    }

    /**
     * Apply grid snapping to nodes
     */
    function applyGridSnapping(nodeIds) {
        const grid = stateManager.getGrid();
        if (!grid.snap) return;

        nodeIds.forEach(nodeId => {
            const node = stateManager.getNodes().find(n => n.id === nodeId);
            if (node) {
                const snappedX = Math.round(node.x / grid.size) * grid.size;
                const snappedY = Math.round(node.y / grid.size) * grid.size;

                stateManager.updateNode(nodeId, {
                    x: snappedX,
                    y: snappedY
                });
            }
        });
    }

    /**
     * Get node type definition
     */
    function getNodeTypeDefinition(type, category) {
        // Check in NODE_TYPES (from node-types.js)
        if (NODE_TYPES && NODE_TYPES[category]) {
            const builtInType = NODE_TYPES[category].find(nt => nt.type === type);
            if (builtInType) return builtInType;
        }

        // Check custom types
        return stateManager.getCustomNodeTypes().find(nt => nt.type === type);
    }

    /**
     * Set up event listeners
     */
    function setupEventListeners() {
        // Canvas drop event
        elements.canvas.addEventListener('drop', handleCanvasDrop);
        elements.canvas.addEventListener('dragover', e => e.preventDefault());

        // Selection box events
        elements.canvas.addEventListener('mousedown', handleCanvasMouseDown);
        document.addEventListener('mousemove', handleDocumentMouseMove);
        document.addEventListener('mouseup', handleDocumentMouseUp);

        // Delete key handler (event is in keyboard shortcuts)
        eventBus.on(EVENTS.TOOLBAR_ACTION, data => {
            if (data.action === 'delete-selected') {
                deleteSelectedNodes();
            }
        });

        // Align buttons
        const alignButtons = {
            'align-left-btn': 'left',
            'align-center-btn': 'center',
            'align-right-btn': 'right',
            'align-top-btn': 'top',
            'align-middle-btn': 'middle',
            'align-bottom-btn': 'bottom'
        };

        Object.entries(alignButtons).forEach(([btnId, alignType]) => {
            const button = document.getElementById(btnId);
            if (button) {
                button.addEventListener('click', () => alignNodes(alignType));
            }
        });
    }

    /**
     * 处理画布拖放事件
     */
    function handleCanvasDrop(e) {
        e.preventDefault();

        // 获取相对于画布的放置位置
        const rect = elements.canvas.getBoundingClientRect();
        const clientX = e.clientX - rect.left;
        const clientY = e.clientY - rect.top;

        // 转换为世界坐标 - 使用渲染器的变换函数
        const worldPos = renderer.screenToWorld(clientX, clientY);

        // 获取拖拽数据
        const nodeId = e.dataTransfer.getData('application/node-id');
        const nodeType = e.dataTransfer.getData('application/node-type');
        const nodeCategory = e.dataTransfer.getData('application/node-category');
        const {offsetX, offsetY} = stateManager.getViewport();

        if (nodeId) {
            const selectedNodes = stateManager.getSelectedNodes();

            if (selectedNodes.includes(nodeId)) {
                // 获取主拖拽节点
                const mainNode = stateManager.getNodes().find(n => n.id === nodeId);

                // 直接计算世界坐标 - 暂不减去节点宽高的一半
                const newX = worldPos.x;
                const newY = worldPos.y;

                // 计算相对于节点中心的偏移量，以实现更自然的拖拽
                const screenOffsetX = newX - mainNode.x - config.nodeWidth / 2;
                const screenOffsetY = newY - mainNode.y - config.nodeHeight / 2;

                // 对所有选中节点应用相同的偏移量
                selectedNodes.forEach(selId => {
                    const node = stateManager.getNodes().find(n => n.id === selId);
                    if (node) {
                        stateManager.updateNode(selId, {
                            x: node.x + offsetX + screenOffsetX,
                            y: node.y + offsetY + screenOffsetY
                        });
                    }
                });
            }

            // 如果启用了网格对齐
            if (stateManager.getGrid().snap) {
                applyGridSnapping(selectedNodes.length > 0 ? selectedNodes : [nodeId]);
            }

            // 确保连接线正确重绘
            renderer.requestFullRender();
        } else if (nodeType && nodeCategory) {
            // 在世界坐标位置创建新节点
            createNode(
                nodeType,
                nodeCategory,
                worldPos.x - config.nodeWidth / 2,
                worldPos.y - config.nodeHeight / 2
            );
        }
    }

    /**
     * Handle canvas mousedown event
     */
    function handleCanvasMouseDown(e) {
        // Skip if clicking on a node or port
        if (e.target.closest('.tree-node') || e.target.closest('.port')) {
            return;
        }

        // Skip if using middle button or alt key (pan instead)
        if (e.button === 1 || e.altKey) {
            return;
        }

        // Get canvas-relative coordinates
        const rect = elements.canvas.getBoundingClientRect();
        const clientX = e.clientX - rect.left;
        const clientY = e.clientY - rect.top;

        // Convert to world coordinates
        const worldPos = renderer.screenToWorld(clientX, clientY);

        // Clear selection if not holding shift
        if (!e.shiftKey) {
            stateManager.clearSelection();
        }

        // Start selection box
        stateManager.startSelectionBox(worldPos.x, worldPos.y);

        // Create visual selection box
        createSelectionBoxElement(clientX, clientY);
    }

    /**
     * Create selection box element
     */
    function createSelectionBoxElement(startX, startY) {
        // Remove existing selection box if any
        const existingBox = document.getElementById('selection-box');
        if (existingBox) existingBox.remove();

        // Create selection box element
        const selectionBox = document.createElement('div');
        selectionBox.id = 'selection-box';
        selectionBox.className = 'selection-box';
        selectionBox.style.left = `${startX}px`;
        selectionBox.style.top = `${startY}px`;
        selectionBox.style.width = '0';
        selectionBox.style.height = '0';

        elements.canvas.appendChild(selectionBox);
    }

    /**
     * Handle document mousemove event
     */
    function handleDocumentMouseMove(e) {
        if (!stateManager.getState().selectionBox.active) return;

        const rect = elements.canvas.getBoundingClientRect();
        const clientX = e.clientX - rect.left;
        const clientY = e.clientY - rect.top;

        // Convert to world coordinates
        const worldPos = renderer.screenToWorld(clientX, clientY);

        // Update selection box
        stateManager.updateSelectionBox(worldPos.x, worldPos.y);

        // Update visual selection box
        updateSelectionBoxVisual();
    }

    /**
     * Update visual selection box
     */
    function updateSelectionBoxVisual() {
        const selectionBox = document.getElementById('selection-box');
        if (!selectionBox) return;

        const boxState = stateManager.getState().selectionBox;
        const viewport = stateManager.getViewport();

        // Convert world coordinates to screen coordinates
        const startScreen = renderer.worldToScreen(boxState.startX, boxState.startY);
        const endScreen = renderer.worldToScreen(boxState.endX, boxState.endY);

        // Calculate box dimensions
        const left = Math.min(startScreen.x, endScreen.x);
        const top = Math.min(startScreen.y, endScreen.y);
        const width = Math.abs(endScreen.x - startScreen.x);
        const height = Math.abs(endScreen.y - startScreen.y);

        // Update element style
        selectionBox.style.left = `${left}px`;
        selectionBox.style.top = `${top}px`;
        selectionBox.style.width = `${width}px`;
        selectionBox.style.height = `${height}px`;
    }

    /**
     * Handle document mouseup event
     */
    function handleDocumentMouseUp(e) {
        if (!stateManager.getState().selectionBox.active) return;

        // Select nodes within the box
        selectNodesInBox();

        // End selection box
        stateManager.endSelectionBox();

        // Remove visual selection box
        const selectionBox = document.getElementById('selection-box');
        if (selectionBox) selectionBox.remove();
    }

    /**
     * Select nodes within the selection box
     */
    function selectNodesInBox() {
        const boxState = stateManager.getState().selectionBox;
        const nodes = stateManager.getNodes();

        // Calculate box boundaries
        const left = Math.min(boxState.startX, boxState.endX);
        const top = Math.min(boxState.startY, boxState.endY);
        const right = Math.max(boxState.startX, boxState.endX);
        const bottom = Math.max(boxState.startY, boxState.endY);

        // Find nodes within the box
        const nodesInBox = [];

        nodes.forEach(node => {
            const nodeRight = node.x + config.nodeWidth;
            const nodeBottom = node.y + config.nodeHeight;

            // Check if node is within box (even partially)
            if (nodeRight >= left && node.x <= right && nodeBottom >= top && node.y <= bottom) {
                nodesInBox.push(node.id);
            }
        });

        // Add to existing selection or create new selection
        if (nodesInBox.length > 0) {
            const existingSelection = stateManager.getSelectedNodes();
            const combinedSelection = [...new Set([...existingSelection, ...nodesInBox])];
            stateManager.selectNodes(combinedSelection);
        }
    }

    // Initialize
    setupEventListeners();

    // Return public API
    return {
        createNode,
        deleteNode,
        deleteNodes,
        deleteSelectedNodes,
        updateNodeProperties,
        cloneNode,
        cloneSelectedNodes,
        alignNodes,
        applyGridSnapping,
        getNodeTypeDefinition
    };
}