/**
 * Minimap 模块 - 提供图形概览和导航功能
 */
import {eventBus, EVENTS} from '../core/events.js';
import {logger} from '../utils/logger.js';
import {config} from '../core/config.js';

export function initMinimap(elements, state, renderer) {
    const stateManager = state;

    // Minimap状态
    let isDragging = false;
    let lastMousePosition = {x: 0, y: 0};
    let minimapScale = 1;

    /**
     * 切换Minimap可见性
     */
    function toggleMinimap() {
        const {minimapContainer} = elements;
        const minimapState = stateManager.getMinimap();

        if (!minimapContainer) return;

        minimapState.isVisible = !minimapState.isVisible;
        minimapContainer.style.display = minimapState.isVisible ? 'block' : 'none';

        if (minimapState.isVisible) {
            renderMinimap();
        }
    }

    /**
     * 设置Minimap大小
     */
    function setMinimapSize(width, height) {
        const {minimap, minimapContainer} = elements;

        if (!minimap || !minimapContainer) return;

        stateManager.getMinimap().width = width;
        stateManager.getMinimap().height = height;

        minimapContainer.style.width = `${width}px`;
        minimapContainer.style.height = `${height}px`;
        minimap.width = width;
        minimap.height = height;

        renderMinimap();
    }

    /**
     * 计算适配所有节点的Minimap缩放比例
     */
    function calculateMinimapScale(bounds) {
        const minimapState = stateManager.getMinimap();
        const padding = 10; // 内容周围的边距

        // 计算适配所有节点的缩放比例
        const scaleX = (minimapState.width - padding * 2) / bounds.width;
        const scaleY = (minimapState.height - padding * 2) / bounds.height;

        // 使用较小的缩放比例以确保所有内容可见
        return Math.min(scaleX, scaleY);
    }

    /**
     * 获取所有节点的边界
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
     * 渲染小地图 - 主要实现
     * 这是小地图渲染的单一真实来源
     */
    function renderMinimap() {
        const {minimap} = elements;
        if (!minimap) return;

        const nodes = stateManager.getNodes();
        const connections = stateManager.getConnections();
        const viewport = stateManager.getViewport();
        const minimapState = stateManager.getMinimap();

        const ctx = minimap.getContext('2d');
        if (!ctx) return;

        // 清除画布
        ctx.clearRect(0, 0, minimapState.width, minimapState.height);

        // 计算所有节点的边界
        const bounds = calculateNodesBounds(nodes);

        // 计算缩放比例
        minimapScale = calculateMinimapScale(bounds);
        const padding = 10;

        // 绘制背景 - 使用明确的背景色
        ctx.fillStyle = '#f9f9f9';
        ctx.fillRect(0, 0, minimapState.width, minimapState.height);

        // 绘制连接
        ctx.strokeStyle = '#999';
        ctx.lineWidth = 1;

        connections.forEach(conn => {
            const sourceNode = nodes.find(n => n.id === conn.source);
            const targetNode = nodes.find(n => n.id === conn.target);

            if (sourceNode && targetNode) {
                const sourceX = padding + (sourceNode.x + config.nodeWidth / 2 - bounds.minX) * minimapScale;
                const sourceY = padding + (sourceNode.y + config.nodeHeight / 2 - bounds.minY) * minimapScale;
                const targetX = padding + (targetNode.x + config.nodeWidth / 2 - bounds.minX) * minimapScale;
                const targetY = padding + (targetNode.y + config.nodeHeight / 2 - bounds.minY) * minimapScale;

                ctx.beginPath();
                ctx.moveTo(sourceX, sourceY);
                ctx.lineTo(targetX, targetY)
                ctx.stroke();
            }
        });

        // 保存绘图上下文状态
        ctx.save();

        // 绘制节点 - 确保明确设置颜色
        nodes.forEach(node => {
            const x = padding + (node.x - bounds.minX) * minimapScale;
            const y = padding + (node.y - bounds.minY) * minimapScale;
            const width = config.nodeWidth * minimapScale;
            const height = config.nodeHeight * minimapScale;

            // 强制基于类别设置明确的颜色
            let fillColor;
            switch (node.category) {
                case 'composite':
                    fillColor = '#6ab8f1'; // 亮蓝色
                    break;
                case 'decorator':
                    fillColor = '#7ff888'; // 亮绿色
                    break;
                case 'action':
                    fillColor = '#f4c780'; // 亮橙色
                    break;
                case 'condition':
                    fillColor = '#e27cf1'; // 亮紫色
                    break;
                default:
                    fillColor = '#e3e3e3'; // 默认白色
            }

            // 直接使用类别颜色，确保正确渲染
            ctx.fillStyle = fillColor;
            ctx.strokeStyle = '#666';
            ctx.lineWidth = 0.5;

            // 绘制圆角矩形
            const radius = 3;
            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + width - radius, y);
            ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
            ctx.lineTo(x + width, y + height - radius);
            ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
            ctx.lineTo(x + radius, y + height);
            ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
            ctx.lineTo(x, y + radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        });

        // 恢复绘图上下文状态
        ctx.restore();

        // 绘制视口矩形
        const viewportMinX = -viewport.offsetX / viewport.scale;
        const viewportMinY = -viewport.offsetY / viewport.scale;
        const container = minimap.parentElement.parentElement;
        const viewportWidth = container.clientWidth / viewport.scale;
        const viewportHeight = container.clientHeight / viewport.scale;

        const viewportX = padding + (viewportMinX - bounds.minX) * minimapScale;
        const viewportY = padding + (viewportMinY - bounds.minY) * minimapScale;
        const viewportScaledWidth = viewportWidth * minimapScale;
        const viewportScaledHeight = viewportHeight * minimapScale;

        ctx.strokeStyle = '#2196f3'; // 主色调
        ctx.lineWidth = 2;
        ctx.strokeRect(viewportX, viewportY, viewportScaledWidth, viewportScaledHeight);

        // 填充半透明矩形
        ctx.fillStyle = 'rgba(33, 150, 243, 0.1)';
        ctx.fillRect(viewportX, viewportY, viewportScaledWidth, viewportScaledHeight);
    }

    /**
     * 将Minimap坐标转换为世界坐标
     * 这是关键函数，修复坐标系统问题
     */
    function minimapToWorld(x, y) {
        const {minimap} = elements;
        if (!minimap) return {x: 0, y: 0};

        const minimapState = stateManager.getMinimap();
        const padding = 10;
        const nodes = stateManager.getNodes();
        const bounds = calculateNodesBounds(nodes);

        // 计算世界坐标
        const worldX = bounds.minX + (x - padding) / minimapScale;
        const worldY = bounds.minY + (y - padding) / minimapScale;

        return {x: worldX, y: worldY};
    }

    /**
     * 处理Minimap点击 - 将视口中心定位到点击位置
     */
    function handleMinimapClick(x, y) {
        const worldPos = minimapToWorld(x, y);

        // 将视口中心定位到该点
        const {canvas} = elements;
        const viewport = stateManager.getViewport();

        stateManager.updateViewport({
            offsetX: -worldPos.x + canvas.clientWidth / (2 * viewport.scale),
            offsetY: -worldPos.y + canvas.clientHeight / (2 * viewport.scale)
        });

        renderer.requestRender(true);
    }

    /**
     * 开始在Minimap上拖动视口
     * 这里是解决问题的关键部分
     */
    function startViewportDrag(e) {
        const rect = elements.minimap.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // 检查点击是否在视口矩形内
        const viewport = stateManager.getViewport();
        const nodes = stateManager.getNodes();
        const bounds = calculateNodesBounds(nodes);
        const padding = 10;

        const viewportMinX = -viewport.offsetX / viewport.scale;
        const viewportMinY = -viewport.offsetY / viewport.scale;
        const container = elements.minimap.parentElement.parentElement;
        const viewportWidth = container.clientWidth / viewport.scale;
        const viewportHeight = container.clientHeight / viewport.scale;

        const viewportX = padding + (viewportMinX - bounds.minX) * minimapScale;
        const viewportY = padding + (viewportMinY - bounds.minY) * minimapScale;
        const viewportScaledWidth = viewportWidth * minimapScale;
        const viewportScaledHeight = viewportHeight * minimapScale;

        if (
            x >= viewportX &&
            x <= viewportX + viewportScaledWidth &&
            y >= viewportY &&
            y <= viewportY + viewportScaledHeight
        ) {
            isDragging = true;
            lastMousePosition = {x, y};

            // 添加拖动事件监听器
            document.addEventListener('mousemove', onMinimapDrag);
            document.addEventListener('mouseup', stopViewportDrag);
        } else {
            // 如果点击在视口外，将视口中心定位到该点
            handleMinimapClick(x, y);
        }
    }

    /**
     * 处理在Minimap上拖动视口
     * 修改为只改变视口变换，不改变节点坐标
     */
    function onMinimapDrag(e) {
        if (!isDragging) return;

        const rect = elements.minimap.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // 计算在Minimap坐标系中的增量
        const dx = x - lastMousePosition.x;
        const dy = y - lastMousePosition.y;

        // 转换为世界坐标增量
        const worldDx = dx / minimapScale;
        const worldDy = dy / minimapScale;

        // 更新视口位置
        const viewport = stateManager.getViewport();
        stateManager.updateViewport({
            offsetX: viewport.offsetX - worldDx * viewport.scale,
            offsetY: viewport.offsetY - worldDy * viewport.scale
        });

        lastMousePosition = {x, y};
        renderer.requestRender(true);
    }

    /**
     * 停止拖动视口
     */
    function stopViewportDrag() {
        isDragging = false;
        document.removeEventListener('mousemove', onMinimapDrag);
        document.removeEventListener('mouseup', stopViewportDrag);
    }

    /**
     * 设置事件监听器
     */
    function setupEventListeners() {
        const {minimap} = elements;

        if (!minimap) return;

        // 处理Minimap点击
        minimap.addEventListener('mousedown', (e) => {
            const rect = minimap.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            startViewportDrag(e);
        });

        // 视口变化时更新Minimap
        eventBus.on(EVENTS.VIEWPORT_CHANGED, renderMinimap);

        // 节点变化时更新Minimap
        eventBus.on(EVENTS.NODE_CHANGED, renderMinimap);
        eventBus.on(EVENTS.CONNECTION_CHANGED, renderMinimap);

        // 窗口大小变化时更新Minimap
        window.addEventListener('resize', renderMinimap);
    }

    // 初始化
    setupEventListeners();

    // 返回公共API
    return {
        toggleMinimap,
        setMinimapSize,
        renderMinimap,
        handleMinimapClick
    };
}