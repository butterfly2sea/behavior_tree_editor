/**
 * Drag and Drop Utilities
 * Implements HTML5 Drag and Drop API for nodes
 */
import {logger} from '../utils/logger.js';

/**
 * Set up drag and drop for a node element
 */
export function setupNodeDragAndDrop(nodeElement, options) {
    const {
        onDragStart,
        onDrag,
        onDragEnd,
        renderer,
        state
    } = options;

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
        const selectedNodes = state.getSelectedNodes();
        if (!selectedNodes.includes(nodeId)) {
            if (!e.shiftKey) {
                state.clearSelection();
            }
            state.selectNode(nodeId);
        }

        // Create drag image
        const dragImage = nodeElement.cloneNode(true);
        dragImage.style.opacity = '0.7';
        document.body.appendChild(dragImage);

        e.dataTransfer.setDragImage(dragImage, 75, 20);

        // Clean up after dragstart
        setTimeout(() => {
            document.body.removeChild(dragImage);
        }, 0);

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
 * Set up node item draggable (from the palette)
 */
export function setupNodeItemDraggable(nodeItemElement) {
    nodeItemElement.draggable = true;

    nodeItemElement.addEventListener('dragstart', (e) => {
        const type = nodeItemElement.getAttribute('data-type');
        const category = nodeItemElement.getAttribute('data-category');

        // Set drag data
        e.dataTransfer.setData('application/node-type', type);
        e.dataTransfer.setData('application/node-category', category);
        e.dataTransfer.effectAllowed = 'copy';

        // Set drag image
        const dragImage = nodeItemElement.cloneNode(true);
        dragImage.style.opacity = '0.7';
        document.body.appendChild(dragImage);

        e.dataTransfer.setDragImage(dragImage, dragImage.offsetWidth / 2, dragImage.offsetHeight / 2);

        // Clean up after dragstart
        setTimeout(() => {
            document.body.removeChild(dragImage);
        }, 0);
    });
}

/**
 * Set up canvas as a drop zone
 */
export function setupCanvasDropZone(canvasElement, options) {
    const {
        onDrop,
        renderer,
        state
    } = options;

    // Handle drag over
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