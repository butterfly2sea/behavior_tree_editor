/**
 * 渲染器 - 管理高效渲染
 */
import {eventBus, EVENTS} from './events.js';
import {config} from './config.js';
import {createSvgElement} from '../utils/dom.js';
import {getNodeDefinition} from "../data/node-types.js";
import {setupNodeDragAndDrop} from "../utils/drag.js";

export function initRenderer(elements, state) {
    const stateManager = state;

    // 渲染状态
    let renderRequested = false;
    let needsFullRender = false;
    let updatedNodeIds = new Set();
    let updatedConnectionIds = new Set();

    // 设置事件监听器
    setupEventListeners();

    /**
     * 请求在下一个动画帧进行渲染
     */
    function requestRender(fullUpdate = false) {
        if (fullUpdate) {
            needsFullRender = true;
        }

        if (!renderRequested) {
            renderRequested = true;
            window.requestAnimationFrame(performRender);
        }
    }

    /**
     * 请求完全重新渲染所有元素
     */
    function requestFullRender() {
        requestRender(true);
    }

    /**
     * 请求渲染更新特定节点
     */
    function requestNodeUpdate(nodeId) {
        updatedNodeIds.add(nodeId);
        requestRender();
    }

    /**
     * 请求渲染更新特定连接
     */
    function requestConnectionUpdate(connectionId) {
        updatedConnectionIds.add(connectionId);
        requestRender();
    }

    /**
     * 执行实际渲染
     */
    function performRender() {
        renderRequested = false;

        // 应用视口变换
        applyViewportTransform();

        // 更新可见区域用于裁剪
        updateVisibleArea();

        // 如果需要，更新网格
        if (needsFullRender) {
            renderGrid();
        }

        // 渲染节点和连接
        if (needsFullRender) {
            renderAllNodes();
            renderAllConnections();
        } else {
            if (updatedNodeIds.size > 0) {
                renderUpdatedNodes();
            }

            if (updatedConnectionIds.size > 0) {
                renderUpdatedConnections();
            }
        }

        // 如果可见，渲染Minimap
        if (stateManager.getMinimap().isVisible) {
            renderMinimap();
        }

        // 清除更新标志和集合
        needsFullRender = false;
        updatedNodeIds.clear();
        updatedConnectionIds.clear();
    }

    /**
     * 向画布应用视口变换
     * 这是关键函数，确保正确应用视口变换
     */
    function applyViewportTransform() {
        const {scale, offsetX, offsetY} = stateManager.getViewport();
        const {canvas} = elements;

        // 使用硬件加速进行变换
        // 注意：这只应用于整个画布的变换，不改变节点的绝对坐标
        canvas.style.transform = `translate(${offsetX * scale}px, ${offsetY * scale}px) scale(${scale})`;
        canvas.style.transformOrigin = '0 0';
    }

    /**
     * 更新裁剪的可见区域
     */
    function updateVisibleArea() {
        const {canvas} = elements;
        const {scale, offsetX, offsetY} = stateManager.getViewport();

        // 用世界坐标计算可见区域（带边距）
        const canvasRect = canvas.getBoundingClientRect();
        const width = canvasRect.width / scale;
        const height = canvasRect.height / scale;

        // 添加边距避免突然出现（视口的50%）
        const padding = {
            x: width * 0.5,
            y: height * 0.5
        };

        stateManager.updateVisibleArea({
            minX: -offsetX / scale - padding.x,
            minY: -offsetY / scale - padding.y,
            maxX: -offsetX / scale + width + padding.x,
            maxY: -offsetY / scale + height + padding.y
        });
    }

    /**
     * 渲染网格
     */
    function renderGrid() {
        const {gridCanvas} = elements;
        const grid = stateManager.getGrid();
        const viewport = stateManager.getViewport();

        if (!gridCanvas) return;

        // 调整网格画布大小以匹配容器
        const container = gridCanvas.parentElement;
        gridCanvas.width = container.clientWidth;
        gridCanvas.height = container.clientHeight;

        const ctx = gridCanvas.getContext('2d');
        ctx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);

        // 如果网格被禁用，跳过
        if (!grid.enabled) return;

        const {scale} = viewport;
        const offsetX = (viewport.offsetX * scale) % (grid.size * scale);
        const offsetY = (viewport.offsetY * scale) % (grid.size * scale);
        const scaledGridSize = grid.size * scale;

        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1;

        // 绘制垂直线
        for (let x = offsetX; x <= gridCanvas.width; x += scaledGridSize) {
            const roundedX = Math.round(x) + 0.5;
            ctx.beginPath();
            ctx.moveTo(roundedX, 0);
            ctx.lineTo(roundedX, gridCanvas.height);
            ctx.stroke();
        }

        // 绘制水平线
        for (let y = offsetY; y <= gridCanvas.height; y += scaledGridSize) {
            const roundedY = Math.round(y) + 0.5;
            ctx.beginPath();
            ctx.moveTo(0, roundedY);
            ctx.lineTo(gridCanvas.width, roundedY);
            ctx.stroke();
        }
    }

    /**
     * 渲染所有节点
     * 修改为只渲染那些在可见区域内的节点，并正确应用视口变换
     */
    function renderAllNodes() {
        const nodes = stateManager.getNodes();
        const visibleArea = stateManager.getVisibleArea();

        // 移除现有节点
        const existingNodes = document.querySelectorAll('.tree-node');
        existingNodes.forEach(node => node.remove());

        // 创建仅在可视区域内的节点
        nodes.forEach(node => {
            if (isNodeVisible(node, visibleArea)) {
                createNodeElement(node);
            }
        });

        // 创建完所有节点后，更新所有端口状态
        setTimeout(() => {
            nodes.forEach(node => {
                const nodeEl = document.querySelector(`.tree-node[data-id="${node.id}"]`);
                if (nodeEl) {
                    updateNodePortVisibility(nodeEl, node);
                }
            });
        }, 0);
    }

    /**
     * 检查节点是否在当前视口中可见
     */
    function isNodeVisible(node, visibleArea) {
        return (
            node.x < visibleArea.maxX &&
            node.x + config.nodeWidth > visibleArea.minX &&
            node.y < visibleArea.maxY &&
            node.y + config.nodeHeight > visibleArea.minY
        );
    }

    /**
     * 只渲染已更新的节点
     */
    function renderUpdatedNodes() {
        const nodes = stateManager.getNodes();
        const visibleArea = stateManager.getVisibleArea();

        // 处理需要更新的节点
        for (const nodeId of updatedNodeIds) {
            const node = nodes.find(n => n.id === nodeId);
            if (!node) continue;

            // 检查节点是否可见
            if (isNodeVisible(node, visibleArea)) {
                // 如果存在，移除现有节点元素
                const existingNode = document.querySelector(`.tree-node[data-id="${nodeId}"]`);
                if (existingNode) {
                    existingNode.remove();
                }

                // 创建新节点元素
                createNodeElement(node);
            } else {
                // 节点不可见，如果存在则移除
                const existingNode = document.querySelector(`.tree-node[data-id="${nodeId}"]`);
                if (existingNode) {
                    existingNode.remove();
                }
            }
        }

        // 检查现有节点是否现在在可见区域外
        const existingNodes = document.querySelectorAll('.tree-node');
        existingNodes.forEach(nodeElement => {
            const nodeId = nodeElement.getAttribute('data-id');
            const node = nodes.find(n => n.id === nodeId);

            if (node && !isNodeVisible(node, visibleArea)) {
                nodeElement.remove();
            }
        });

        // 检查应该可见但未渲染的节点
        nodes.forEach(node => {
            if (isNodeVisible(node, visibleArea)) {
                const existingNode = document.querySelector(`.tree-node[data-id="${node.id}"]`);
                if (!existingNode) {
                    createNodeElement(node);
                }
            }
        });
    }

    /**
     * 为节点创建DOM元素
     */
    function createNodeElement(node) {
        const {canvas} = elements;
        const selectedNodes = stateManager.getSelectedNodes();
        const monitorNodeStates = stateManager.getMonitor().nodeStates;

        // 创建节点元素
        const nodeEl = document.createElement('div');
        nodeEl.className = `tree-node ${node.type}`;
        nodeEl.setAttribute('data-id', node.id);
        nodeEl.draggable = true;

        // 如果有监视状态，添加监视状态类
        if (stateManager.getMonitor().active && monitorNodeStates[node.id]) {
            nodeEl.classList.add(monitorNodeStates[node.id]);
        }

        // 如果节点在选择中，添加选中类
        if (selectedNodes.includes(node.id)) {
            nodeEl.classList.add('selected');
        }

        // 定位节点
        nodeEl.style.left = `${node.x}px`;
        nodeEl.style.top = `${node.y}px`;

        // 节点内容
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

        // 节点端口
        const portsEl = document.createElement('div');
        portsEl.className = 'node-ports';

        const parentPortEl = document.createElement('div');
        parentPortEl.className = 'port port-parent';
        portsEl.appendChild(parentPortEl);

        const childPortEl = document.createElement('div');
        childPortEl.className = 'port port-child';
        portsEl.appendChild(childPortEl);

        nodeEl.appendChild(portsEl);

        // 添加到画布
        canvas.appendChild(nodeEl);

        setupNodeDragAndDrop(nodeEl, {state: stateManager});

        // 根据约束更新端口可见性
        updateNodePortVisibility(nodeEl, node);

        nodeEl.addEventListener('click', (e) => {
            // 如果点击的是端口，不处理选择操作
            if (e.target.classList.contains('port')) {
                return;
            }

            // 阻止事件冒泡到画布
            e.stopPropagation();

            // 如果按住shift，添加到选择；否则清除其他选择
            if (!e.shiftKey) {
                stateManager.clearSelection();
            }

            // 选择节点
            stateManager.selectNode(node.id, e.shiftKey);
        });
        return nodeEl;
    }

    /**
     * 更新端口可见性基于节点约束
     */
    function updateNodePortVisibility(nodeEl, node, getNodeDefFunc = null) {
        const connections = stateManager.getConnections();
        const nodeDef = getNodeDefinition(node.type, node.category, stateManager);

        if (!nodeDef) return;

        // 子端口可见性与禁用状态
        const childPort = nodeEl.querySelector('.port-child');
        if (childPort) {
            // 基于节点类别的规则
            if (node.category === 'action' || node.category === 'condition' || node.category === 'subtree') {
                // 动作、条件和子树节点不能有子节点
                childPort.classList.add('disabled');
                childPort.title = `${node.category.charAt(0).toUpperCase() + node.category.slice(1)}节点不能有子节点`;
            } else if (node.category === 'decorator') {
                // 装饰器节点只能有一个子节点
                const childCount = connections.filter(conn => conn.source === node.id).length;
                if (childCount >= 1) {
                    childPort.classList.add('disabled');
                    childPort.title = '装饰器节点只能有一个子节点';
                } else {
                    childPort.classList.remove('disabled');
                    childPort.title = '';
                }
            } else if (node.category === 'control') {
                // 控制节点规则
                if (nodeDef.maxChildren !== null) {
                    const childCount = connections.filter(conn => conn.source === node.id).length;
                    if (childCount >= nodeDef.maxChildren) {
                        childPort.classList.add('disabled');
                        childPort.title = `最多允许${nodeDef.maxChildren}个子节点`;
                    } else {
                        childPort.classList.remove('disabled');
                        childPort.title = '';
                    }
                } else {
                    childPort.classList.remove('disabled');
                    childPort.title = '';
                }

                // IfThenElse和WhileDoElse的特殊规则
                if ((node.type === 'IfThenElse' || node.type === 'WhileDoElse') && childPort) {
                    const children = connections.filter(conn => conn.source === node.id);
                    if (children.length >= 3) {
                        childPort.classList.add('disabled');
                        childPort.title = `${node.type}最多只能有3个子节点`;
                    }
                }
            }
        }

        // 父端口可见性
        const parentPort = nodeEl.querySelector('.port-parent');
        if (parentPort) {
            // 检查节点是否已有父节点
            const hasParent = connections.some(conn => conn.target === node.id);
            if (hasParent) {
                parentPort.classList.add('disabled');
                parentPort.title = '此节点已有父节点';
            } else {
                parentPort.classList.remove('disabled');
                parentPort.title = '';
            }
        }
    }

    /**
     * 渲染所有连接线
     */
    function renderAllConnections() {
        const {connectionsLayer} = elements;
        const connections = stateManager.getConnections();

        // 清除现有连接
        connectionsLayer.innerHTML = '';

        // 创建新连接
        connections.forEach(connection => {
            createConnectionElement(connection);
        });
    }

    /**
     * 只渲染已更新的连接
     */
    function renderUpdatedConnections() {
        const connections = stateManager.getConnections();

        // 处理需要更新的连接
        for (const connectionId of updatedConnectionIds) {
            const connection = connections.find(c => c.id === connectionId);
            if (!connection) continue;

            // 如果存在，移除现有连接元素
            const existingConnection = document.querySelector(`path[data-id="${connectionId}"]`);
            if (existingConnection) {
                existingConnection.remove();
            }

            // 创建新连接元素
            createConnectionElement(connection);
        }
    }

    /**
     * 为连接创建SVG元素
     */
    function createConnectionElement(connection) {
        const {connectionsLayer} = elements;
        const nodes = stateManager.getNodes();
        const selectedConnection = stateManager.getSelectedConnection();

        // 查找源和目标节点
        const sourceNode = nodes.find(node => node.id === connection.source);
        const targetNode = nodes.find(node => node.id === connection.target);

        if (!sourceNode || !targetNode) return null;

        // 创建路径元素
        const path = createSvgElement('path', {
            'class': 'connection-path',
            'fill': 'none',
            'stroke': connection.id === selectedConnection ?
                config.connection.selectedColor :
                config.connection.normalColor,
            'stroke-width': config.connection.strokeWidth,
            'data-id': connection.id
        });

        // 生成路径数据
        const pathData = generateConnectionPath(sourceNode, targetNode);
        path.setAttribute('d', pathData);

        // 添加到连接层
        connectionsLayer.appendChild(path);

        return path;
    }

    /**
     * 为连接生成SVG路径
     */
    function generateConnectionPath(sourceNode, targetNode) {
        // 起点（源节点的底部中心）
        const startX = sourceNode.x + config.nodeWidth / 2;
        const startY = sourceNode.y + config.nodeHeight;

        // 终点（目标节点的顶部中心）
        const endX = targetNode.x + config.nodeWidth / 2;
        const endY = targetNode.y;

        // 计算控制点以绘制漂亮的曲线
        const deltaY = endY - startY;
        const controlY1 = startY + Math.min(Math.abs(deltaY) * 0.3, 40);
        const controlY2 = endY - Math.min(Math.abs(deltaY) * 0.3, 40);

        // 返回三次贝塞尔曲线的路径数据
        return `M ${startX} ${startY} C ${startX} ${controlY1}, ${endX} ${controlY2}, ${endX} ${endY}`;
    }

    /**
     * 在创建过程中渲染待处理的连接
     */
    function renderPendingConnection() {
        const {activeConnectionLayer} = elements;
        const pendingConnection = stateManager.getState().pendingConnection;
        const nodes = stateManager.getNodes();
        const mousePos = stateManager.getState().mousePosition;

        if (!pendingConnection) {
            activeConnectionLayer.innerHTML = '';
            return;
        }

        // 找到源节点
        const sourceNode = nodes.find(n => n.id === pendingConnection.sourceId);
        if (!sourceNode) return;

        // 根据端口类型获取源坐标
        let startX, startY;
        if (pendingConnection.sourcePort === 'parent') {
            startX = sourceNode.x + config.nodeWidth / 2;
            startY = sourceNode.y;
        } else {
            startX = sourceNode.x + config.nodeWidth / 2;
            startY = sourceNode.y + config.nodeHeight;
        }

        // 确保连线跟随鼠标
        const path = createSvgElement('path', {
            'fill': 'none',
            'stroke': config.connection.pendingColor,
            'stroke-width': config.connection.strokeWidth,
            'stroke-dasharray': '5,5'
        });

        // 生成曲线
        const deltaY = mousePos.y - startY;
        const controlY1 = startY + Math.min(Math.abs(deltaY) * 0.3, 40);
        const controlY2 = mousePos.y - Math.min(Math.abs(deltaY) * 0.3, 40);
        const pathData = `M ${startX} ${startY} C ${startX} ${controlY1}, ${mousePos.x} ${controlY2}, ${mousePos.x} ${mousePos.y}`;

        path.setAttribute('d', pathData);

        // 清理并添加新路径
        activeConnectionLayer.innerHTML = '';
        activeConnectionLayer.appendChild(path);
        activeConnectionLayer.style.display = 'block';
    }

    /**
     * 渲染Minimap
     */
    function renderMinimap() {
        const {minimap} = elements;
        if (!minimap) return;

        const nodes = stateManager.getNodes();
        const connections = stateManager.getConnections();
        const viewport = stateManager.getViewport();
        const minimapState = stateManager.getMinimap();

        const ctx = minimap.getContext('2d');
        ctx.clearRect(0, 0, minimapState.width, minimapState.height);

        // 计算所有节点的边界
        const bounds = calculateNodesBounds(nodes);

        // 计算缩放比例以适应Minimap中的所有节点
        const padding = 10;
        const scaleX = (minimapState.width - padding * 2) / bounds.width;
        const scaleY = (minimapState.height - padding * 2) / bounds.height;
        const scale = Math.min(scaleX, scaleY);

        // 绘制连接
        ctx.strokeStyle = '#999';
        ctx.lineWidth = 1;

        connections.forEach(conn => {
            const sourceNode = nodes.find(n => n.id === conn.source);
            const targetNode = nodes.find(n => n.id === conn.target);

            if (sourceNode && targetNode) {
                const sourceX = padding + (sourceNode.x + config.nodeWidth / 2 - bounds.minX) * scale;
                const sourceY = padding + (sourceNode.y + config.nodeHeight - bounds.minY) * scale;
                const targetX = padding + (targetNode.x + config.nodeWidth / 2 - bounds.minX) * scale;
                const targetY = padding + (targetNode.y - bounds.minY) * scale;

                ctx.beginPath();
                ctx.moveTo(sourceX, sourceY);
                ctx.lineTo(targetX, targetY);
                ctx.stroke();
            }
        });

        // 绘制节点
        ctx.fillStyle = '#ddd';

        nodes.forEach(node => {
            const x = padding + (node.x - bounds.minX) * scale;
            const y = padding + (node.y - bounds.minY) * scale;
            const width = config.nodeWidth * scale;
            const height = config.nodeHeight * scale;

            ctx.fillRect(x, y, width, height);
        });

        // 绘制视口矩形
        const viewportMinX = -viewport.offsetX / viewport.scale;
        const viewportMinY = -viewport.offsetY / viewport.scale;
        const container = minimap.parentElement.parentElement;
        const viewportWidth = container.clientWidth / viewport.scale;
        const viewportHeight = container.clientHeight / viewport.scale;

        const viewportX = padding + (viewportMinX - bounds.minX) * scale;
        const viewportY = padding + (viewportMinY - bounds.minY) * scale;
        const viewportScaledWidth = viewportWidth * scale;
        const viewportScaledHeight = viewportHeight * scale;

        ctx.strokeStyle = '#f00';
        ctx.lineWidth = 2;
        ctx.strokeRect(viewportX, viewportY, viewportScaledWidth, viewportScaledHeight);
    }

    /**
     * 计算所有节点的边界
     */
    function calculateNodesBounds(nodes) {
        if (nodes.length === 0) {
            return {
                minX: -500, minY: -500,
                maxX: 500, maxY: 500,
                width: 1000, height: 1000
            };
        }

        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        nodes.forEach(node => {
            minX = Math.min(minX, node.x);
            minY = Math.min(minY, node.y);
            maxX = Math.max(maxX, node.x + config.nodeWidth);
            maxY = Math.max(maxY, node.y + config.nodeHeight);
        });

        // 添加边距
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

    /**
     * 设置事件监听器
     */
    function setupEventListeners() {
        // 节点事件
        eventBus.on(EVENTS.NODE_CHANGED, (data) => {
            if (data.type === 'created' || data.type === 'deleted') {
                requestFullRender();
            } else if (data.type === 'updated') {
                requestNodeUpdate(data.node.id);
            } else if (data.type === 'batch-updated') {
                data.nodeIds.forEach(id => requestNodeUpdate(id));
            } else if (data.type === 'moved') {
                data.nodeIds.forEach(id => requestNodeUpdate(id));
            }
        });

        // 连接事件
        eventBus.on(EVENTS.CONNECTION_CHANGED, (data) => {
            if (data.type === 'created' || data.type === 'deleted') {
                requestConnectionUpdate(data.connection.id);
            } else if (data.type === 'selected') {
                requestFullRender();
            }
        });

        // 视口事件
        eventBus.on(EVENTS.VIEWPORT_CHANGED, () => {
            requestFullRender();
        });

        // 网格事件
        eventBus.on(EVENTS.GRID_CHANGED, () => {
            requestFullRender();
        });

        // 选择事件
        eventBus.on(EVENTS.SELECTION_CHANGED, () => {
            requestFullRender();
        });

        // 监视器事件
        eventBus.on(EVENTS.MONITOR_CHANGED, () => {
            requestFullRender();
        });

        // 状态重置/加载
        eventBus.on(EVENTS.STATE_RESET, () => {
            requestFullRender();
        });

        eventBus.on(EVENTS.STATE_LOADED, () => {
            requestFullRender();
        });

        // 窗口大小变化
        window.addEventListener('resize', () => {
            updateCanvasDimensions();
            requestFullRender();
        });
    }

    /**
     * 窗口大小变化时更新画布尺寸
     */
    function updateCanvasDimensions() {
        const {canvas, gridCanvas, connectionsLayer, activeConnectionLayer} = elements;

        const container = canvas.parentElement;
        const width = container.clientWidth;
        const height = container.clientHeight;

        if (gridCanvas) {
            gridCanvas.width = width;
            gridCanvas.height = height;
        }

        if (connectionsLayer) {
            connectionsLayer.setAttribute('width', width);
            connectionsLayer.setAttribute('height', height);
        }

        if (activeConnectionLayer) {
            activeConnectionLayer.setAttribute('width', width);
            activeConnectionLayer.setAttribute('height', height);
        }
    }

    // 返回公共API
    return {
        requestRender,
        requestFullRender,
        requestNodeUpdate,
        requestConnectionUpdate,
        renderPendingConnection,
        renderGrid,
        renderMinimap,
        updateCanvasDimensions,
        calculateNodesBounds,
        updateNodePortVisibility,

        // 坐标转换工具
        screenToWorld: (x, y) => {
            const {scale, offsetX, offsetY} = stateManager.getViewport();
            return {
                x: x / scale - offsetX,
                y: y / scale - offsetY
            };
        },

        worldToScreen: (x, y) => {
            const {scale, offsetX, offsetY} = stateManager.getViewport();
            return {
                x: (x + offsetX) * scale,
                y: (y + offsetY) * scale
            };
        }
    };
}