/**
 * Drag and Drop Utilities
 * Implements HTML5 Drag and Drop API for nodes
 */
import {logger} from './logger.js';

/**
 * 为节点元素设置拖拽
 * @param {HTMLElement} nodeElement - 要设置拖拽的节点元素
 * @param {Object} options - 配置选项
 */
export function setupNodeDragAndDrop(nodeElement, options = {}) {
    const {
        state
    } = options;

    // 使元素可拖拽
    nodeElement.draggable = true;

    // 拖拽开始
    nodeElement.addEventListener('dragstart', (e) => {
        // 如果从端口拖拽，跳过
        if (e.target.classList.contains('port')) {
            e.preventDefault();
            return false;
        }

        const nodeId = nodeElement.getAttribute('data-id');

        // 设置节点ID为数据
        e.dataTransfer.setData('application/node-id', nodeId);
        e.dataTransfer.effectAllowed = 'move';

        // 如果节点未被选中，选中它
        if (state) {
            const selectedNodes = state.getSelectedNodes();
            if (!selectedNodes.includes(nodeId)) {
                if (!e.shiftKey) {
                    state.clearSelection();
                }
                state.selectNode(nodeId);
            }
        }

        // 创建有适当样式的拖拽图像
        const dragImage = nodeElement.cloneNode(true);
        dragImage.style.opacity = '0.7';
        dragImage.style.position = 'absolute';
        dragImage.style.top = '-1000px';
        dragImage.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
        document.body.appendChild(dragImage);

        // 设置拖拽图像以鼠标为中心
        e.dataTransfer.setDragImage(
            dragImage,
            dragImage.offsetWidth / 2,
            dragImage.offsetHeight / 2
        );

        // 拖拽开始后清理
        setTimeout(() => {
            if (dragImage.parentNode === document.body) {
                document.body.removeChild(dragImage);
            }
        }, 0);
    });
}

/**
 * Create a drag image for the node
 */
function createDragImage(event, nodeElement) {
    // Clone the node for the drag image
    const dragImage = nodeElement.cloneNode(true);

    // Set styles for the drag image
    dragImage.style.opacity = '0.7';
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px'; // Place off-screen
    dragImage.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';

    // Add to document temporarily
    document.body.appendChild(dragImage);

    // Set as drag image
    event.dataTransfer.setDragImage(dragImage, dragImage.offsetWidth / 2, 20);

    // Clean up after dragstart
    setTimeout(() => {
        if (dragImage.parentNode === document.body) {
            document.body.removeChild(dragImage);
        }
    }, 0);
}

/**
 * Set up node item draggable (from the palette)
 */
export function setupNodeItemDraggable(nodeItemElement) {
    nodeItemElement.draggable = true;

    nodeItemElement.addEventListener('dragstart', (e) => {
        const type = nodeItemElement.dataset.type;
        const category = nodeItemElement.dataset.category;

        if (!type || !category) {
            logger.warn('Missing node type or category attributes');
            e.preventDefault();
            return;
        }

        // 设置拖拽数据
        e.dataTransfer.setData('application/node-type', type);
        e.dataTransfer.setData('application/node-category', category);
        e.dataTransfer.effectAllowed = 'copy';

        // 创建拖拽图像 - 保持与原节点一致，只修改透明度
        const dragImage = nodeItemElement.cloneNode(true);
        dragImage.style.opacity = '0.7';
        dragImage.classList.add('drag-image'); // 添加CSS类
        document.body.appendChild(dragImage);

        e.dataTransfer.setDragImage(dragImage, dragImage.offsetWidth / 2, dragImage.offsetHeight / 2);

        // 清理
        setTimeout(() => {
            document.body.removeChild(dragImage);
        }, 0);
    });
}

/**
 * Set up canvas as a drop zone
 */
export function setupCanvasDropZone(canvasElement, options = {}) {
    const {onDrop} = options;

    // Handle drag over (needed to allow drop)
    canvasElement.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    });

    // Handle drop
    canvasElement.addEventListener('drop', (e) => {
        e.preventDefault();
        if (onDrop) onDrop(e);
    });
}