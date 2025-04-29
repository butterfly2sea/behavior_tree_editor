/**
 * Viewport Module - 管理画布视口和缩放
 */
import {config} from '../core/config.js';

export function initViewport(elements, state, renderer) {
    const stateManager = state;

    // 平移状态
    let isPanning = false;
    let lastPanPosition = {x: 0, y: 0};

    // 是否按住Alt键（用于替代平移方法）
    let isAltKeyPressed = false;

    /**
     * 设置视口缩放级别
     * @param {number} newScale - 新的缩放级别
     * @param {Object} focusPoint - 缩放中心点（屏幕坐标）
     */
    function setScale(newScale, focusPoint = null) {
        const viewport = stateManager.getViewport();
        const oldScale = viewport.scale;

        // 将缩放限制在最小/最大值范围内
        newScale = Math.min(
            Math.max(newScale, viewport.minScale),
            viewport.maxScale
        );

        // 如果缩放没有变化，不做任何操作
        if (newScale === oldScale) return;

        // 如果提供了焦点，则向该点缩放
        if (focusPoint) {
            const {canvas} = elements;

            // 获取缩放前的世界坐标
            const worldPointBefore = screenToWorld(
                focusPoint.x,
                focusPoint.y
            );

            // 更新缩放比例
            stateManager.updateViewport({scale: newScale});

            // 获取缩放后的世界坐标
            const worldPointAfter = screenToWorld(
                focusPoint.x,
                focusPoint.y
            );

            // 调整偏移量以保持焦点位置不变
            stateManager.updateViewport({
                offsetX: viewport.offsetX + (worldPointBefore.x - worldPointAfter.x),
                offsetY: viewport.offsetY + (worldPointBefore.y - worldPointAfter.y)
            });
        } else {
            // 只更新缩放比例，不调整偏移量
            stateManager.updateViewport({scale: newScale});
        }

        // 请求渲染更新
        renderer.requestRender(true);
    }

    /**
     * 放大指定倍数
     */
    function zoomIn(factor = 1.2, focusPoint = null) {
        const viewport = stateManager.getViewport();
        setScale(viewport.scale * factor, focusPoint);
    }

    /**
     * 缩小指定倍数
     */
    function zoomOut(factor = 1.2, focusPoint = null) {
        const viewport = stateManager.getViewport();
        setScale(viewport.scale / factor, focusPoint);
    }

    /**
     * 重置缩放到100%
     */
    function resetZoom() {
        setScale(1.0);
    }

    /**
     * 将屏幕坐标转换为世界坐标
     * 这是关键函数，确保考虑当前视口变换
     */
    function screenToWorld(x, y) {
        const {scale, offsetX, offsetY} = stateManager.getViewport();
        return {
            x: x / scale - offsetX,
            y: y / scale - offsetY
        };
    }

    /**
     * 将世界坐标转换为屏幕坐标
     * 这也是关键函数，与screenToWorld相反
     */
    function worldToScreen(x, y) {
        const {scale, offsetX, offsetY} = stateManager.getViewport();
        return {
            x: (x + offsetX) * scale,
            y: (y + offsetY) * scale
        };
    }

    /**
     * 移动视口指定增量
     * 注意：这里改变的是视口偏移，而非节点位置
     */
    function pan(deltaX, deltaY) {
        const viewport = stateManager.getViewport();

        stateManager.updateViewport({
            offsetX: viewport.offsetX + deltaX / viewport.scale,
            offsetY: viewport.offsetY + deltaY / viewport.scale
        });

        // 请求渲染更新
        renderer.requestRender(true);
    }

    /**
     * 开始平移视口
     */
    function startPan(e) {
        isPanning = true;
        lastPanPosition = {x: e.clientX, y: e.clientY};

        // 添加平移光标样式到画布
        elements.canvas.classList.add('panning');

        document.addEventListener('mousemove', onPanMove);
        document.addEventListener('mouseup', stopPan);
    }

    /**
     * 处理平移过程中的鼠标移动
     */
    function onPanMove(e) {
        if (!isPanning) return;

        // 计算相对于上次移动的增量
        const deltaX = e.clientX - lastPanPosition.x;
        const deltaY = e.clientY - lastPanPosition.y;

        pan(deltaX, deltaY);

        lastPanPosition = {x: e.clientX, y: e.clientY};
    }

    /**
     * 停止视口平移
     */
    function stopPan() {
        isPanning = false;
        elements.canvas.classList.remove('panning');

        document.removeEventListener('mousemove', onPanMove);
        document.removeEventListener('mouseup', stopPan);
    }

    /**
     * 将视口中心定位到指定点
     * @param {number} x - 世界坐标X
     * @param {number} y - 世界坐标Y
     */
    function centerOn(x, y) {
        const {canvas} = elements;
        const viewport = stateManager.getViewport();

        // 计算居中偏移
        const offsetX = -x + canvas.clientWidth / (2 * viewport.scale);
        const offsetY = -y + canvas.clientHeight / (2 * viewport.scale);

        stateManager.updateViewport({offsetX, offsetY});

        // 请求渲染更新
        renderer.requestRender(true);
    }

    /**
     * 将视图中心定位到特定节点
     */
    function centerOnNode(nodeId) {
        const nodes = stateManager.getNodes();
        const node = nodes.find(n => n.id === nodeId);

        if (node) {
            centerOn(node.x + config.nodeWidth / 2, node.y + config.nodeHeight / 2);
        }
    }

    /**
     * 计算所有节点的边界
     */
    function calculateNodesBounds(padding = 50) {
        const nodes = stateManager.getNodes();

        if (nodes.length === 0) return null;

        // 计算所有节点的边界
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        nodes.forEach(node => {
            minX = Math.min(minX, node.x);
            minY = Math.min(minY, node.y);
            maxX = Math.max(maxX, node.x + config.nodeWidth);
            maxY = Math.max(maxY, node.y + config.nodeHeight);
        });

        // 添加边距
        minX -= padding;
        minY -= padding;
        maxX += padding;
        maxY += padding;

        return {
            minX, minY, maxX, maxY,
            width: maxX - minX,
            height: maxY - minY,
            center: {
                x: (minX + maxX) / 2,
                y: (minY + maxY) / 2
            }
        };
    }

    /**
     * 将所有节点适配到视口
     */
    function fitAllNodes(padding = 50) {
        const nodes = stateManager.getNodes();

        if (nodes.length === 0) return;

        const bounds = calculateNodesBounds(padding);
        if (!bounds) return;

        // 计算需要的缩放比例
        const {canvas} = elements;
        const contentWidth = bounds.width;
        const contentHeight = bounds.height;
        const scaleX = canvas.clientWidth / contentWidth;
        const scaleY = canvas.clientHeight / contentHeight;
        const newScale = Math.min(scaleX, scaleY, config.viewport.maxScale);

        // 更新视口
        stateManager.updateViewport({
            scale: newScale,
            offsetX: -bounds.center.x + canvas.clientWidth / (2 * newScale),
            offsetY: -bounds.center.y + canvas.clientHeight / (2 * newScale)
        });

        // 请求渲染更新
        renderer.requestRender(true);
    }

    /**
     * 设置事件监听并初始化画布拖拽
     */
    function setupEventListeners() {
        // 鼠标滚轮事件用于缩放
        elements.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();

            // 获取鼠标相对于画布的位置
            const rect = elements.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // 根据滚轮方向放大或缩小
            if (e.deltaY < 0) {
                zoomIn(1.1, {x: mouseX, y: mouseY});
            } else {
                zoomOut(1.1, {x: mouseX, y: mouseY});
            }
        });

        // 中键或Alt+左键用于平移
        elements.canvas.addEventListener('mousedown', (e) => {
            // 中键或Alt+左键开始平移
            if (e.button === 1 || (e.button === 0 && e.altKey)) {
                e.preventDefault();
                startPan(e);
            }
        });

        // 跟踪Alt键状态
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Alt') {
                isAltKeyPressed = true;
                elements.canvas.classList.add('alt-key-pressed');
            }
        });

        document.addEventListener('keyup', (e) => {
            if (e.key === 'Alt') {
                isAltKeyPressed = false;
                elements.canvas.classList.remove('alt-key-pressed');
            }
        });

        // 缩放控制按钮
        const zoomInBtn = document.getElementById('zoom-in-btn');
        const zoomOutBtn = document.getElementById('zoom-out-btn');
        const zoomResetBtn = document.getElementById('zoom-reset-btn');

        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', () => zoomIn());
        }

        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', () => zoomOut());
        }

        if (zoomResetBtn) {
            zoomResetBtn.addEventListener('click', () => resetZoom());
        }

        // 适应全部按钮
        const fitAllBtn = document.getElementById('fit-all-btn');
        if (fitAllBtn) {
            fitAllBtn.addEventListener('click', () => fitAllNodes());
        }
    }

    // 初始化
    setupEventListeners();
}