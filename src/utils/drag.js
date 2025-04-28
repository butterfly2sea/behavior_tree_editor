/**
 * Drag and Drop Utilities
 * Implements HTML5 Drag and Drop API for nodes
 */
import {logger} from './logger.js';

/**
 * Set up drag and drop for a node element
 * @param {HTMLElement} nodeElement - The node element to make draggable
 * @param {Object} options - Configuration options
 */
export function setupNodeDragAndDrop(nodeElement, options = {}) {
    const {
        onDragStart,
        onDrag,
        onDragEnd,
        renderer,
        state
    } = options;

    // Make element draggable
    nodeElement.draggable = true;

    // Drag start - set data and create drag image
    nodeElement.addEventListener('dragstart', (e) => {
        // Skip if dragging from a port
        if (e.target.classList.contains('port')) {
            e.preventDefault();
            return false;
        }

        const nodeId = nodeElement.getAttribute('data-id');

        // Set node ID as data
        e.dataTransfer.setData('application/node-id', nodeId);
        e.dataTransfer.effectAllowed = 'move';

        // Select node if not already selected
        if (state) {
            const selectedNodes = state.getSelectedNodes();
            if (!selectedNodes.includes(nodeId)) {
                if (!e.shiftKey) {
                    state.clearSelection();
                }
                state.selectNode(nodeId);
            }
        }

        // Create drag image
        createDragImage(e, nodeElement);

        // Call callback
        if (onDragStart) onDragStart(e, nodeId);
    });

    // Drag operation
    nodeElement.addEventListener('drag', (e) => {
        if (onDrag) onDrag(e);
    });

    // Drag end
    nodeElement.addEventListener('dragend', (e) => {
        if (onDragEnd) onDragEnd(e);
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