/**
 * Minimap module
 * Provides a minimap navigation for the behavior tree editor
 */

import {editorEvents, EDITOR_EVENTS} from './events.js';
import {logger} from '../index.js';

export function initMinimap(elements, state, renderer) {
    const stateManager = state;

    logger.debug('Initializing minimap');

    // Initialize minimap
    setupMinimap();

    // Set up event listeners
    setupEventListeners();

    /**
     * Set up the minimap container and canvas
     */
    function setupMinimap() {
        const {minimap, minimapContainer} = elements;

        if (!minimap || !minimapContainer) return;

        // Set initial dimensions
        const minimapState = stateManager.getMinimap();
        minimap.width = minimapState.width;
        minimap.height = minimapState.height;

        // Add resize handle to the minimap
        addResizeHandle();
    }

    /**
     * Add a resize handle to the minimap
     */
    function addResizeHandle() {
        const {minimapContainer} = elements;
        if (!minimapContainer) return;

        // Create resize handle
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'minimap-resize-handle';
        minimapContainer.appendChild(resizeHandle);

        // Add event listeners for resize
        resizeHandle.addEventListener('mousedown', handleResizeStart);
    }

    /**
     * Handle minimap resize start
     * @param {MouseEvent} e - Mouse event
     */
    function handleResizeStart(e) {
        e.preventDefault();
        const {minimap, minimapContainer} = elements;

        // Get initial size and mouse position
        const initialWidth = minimapContainer.clientWidth;
        const initialHeight = minimapContainer.clientHeight;
        const initialX = e.clientX;
        const initialY = e.clientY;

        // Add document-level event listeners for resize
        function handleResizeMove(moveEvent) {
            moveEvent.preventDefault();

            // Calculate new size
            const deltaX = moveEvent.clientX - initialX;
            const deltaY = moveEvent.clientY - initialY;

            // Update container size
            minimapContainer.style.width = `${initialWidth + deltaX}px`;
            minimapContainer.style.height = `${initialHeight + deltaY}px`;

            // Update minimap state
            stateManager.getState().minimap.width = initialWidth + deltaX;
            stateManager.getState().minimap.height = initialHeight + deltaY;

            // Update canvas size
            minimap.width = initialWidth + deltaX;
            minimap.height = initialHeight + deltaY;

            // Re-render minimap
            renderer.renderMinimap();
        }

        function handleResizeEnd() {
            document.removeEventListener('mousemove', handleResizeMove);
            document.removeEventListener('mouseup', handleResizeEnd);
        }

        document.addEventListener('mousemove', handleResizeMove);
        document.addEventListener('mouseup', handleResizeEnd);
    }

    /**
     * Toggle minimap visibility
     */
    function toggleMinimap() {
        const {minimapContainer} = elements;
        const minimapState = stateManager.getMinimap();

        if (!minimapContainer) return;

        minimapState.isVisible = !minimapState.isVisible;
        minimapContainer.style.display = minimapState.isVisible ? 'block' : 'none';

        // Re-render if becoming visible
        if (minimapState.isVisible) {
            renderer.renderMinimap();
        }
    }

    /**
     * Set minimap size
     * @param {number} width - New width
     * @param {number} height - New height
     */
    function setMinimapSize(width, height) {
        const {minimap, minimapContainer} = elements;
        const minimapState = stateManager.getMinimap();

        if (!minimap || !minimapContainer) return;

        minimapState.width = width;
        minimapState.height = height;

        minimapContainer.style.width = `${width}px`;
        minimapContainer.style.height = `${height}px`;
        minimap.width = width;
        minimap.height = height;

        renderer.renderMinimap();
    }

    /**
     * Calculate the bounds of all nodes
     * @returns {Object} - Bounds with minX, minY, maxX, maxY, width, height
     */
    function calculateNodesBounds() {
        const nodes = stateManager.getNodes();

        if (nodes.length === 0) {
            return {minX: -500, minY: -500, maxX: 500, maxY: 500, width: 1000, height: 1000};
        }

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        nodes.forEach(node => {
            minX = Math.min(minX, node.x);
            minY = Math.min(minY, node.y);
            maxX = Math.max(maxX, node.x + 150); // Node width
            maxY = Math.max(maxY, node.y + 40);  // Node height
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

    /**
     * Convert minimap coordinates to world coordinates
     * @param {number} x - X-coordinate on minimap
     * @param {number} y - Y-coordinate on minimap
     * @returns {Object} - World coordinates {x, y}
     */
    function minimapToWorld(x, y) {
        const bounds = calculateNodesBounds();
        const minimapState = stateManager.getMinimap();

        // Calculate minimap scale and padding
        const padding = 10;
        const scaleX = (minimapState.width - padding * 2) / bounds.width;
        const scaleY = (minimapState.height - padding * 2) / bounds.height;
        const scale = Math.min(scaleX, scaleY);

        // Convert minimap coordinates to world coordinates
        return {
            x: (x - padding) / scale + bounds.minX,
            y: (y - padding) / scale + bounds.minY
        };
    }

    /**
     * Handle click on the minimap
     * @param {number} x - X-coordinate on minimap
     * @param {number} y - Y-coordinate on minimap
     */
    function handleMinimapClick(x, y) {
        const worldPos = minimapToWorld(x, y);

        // Center viewport on this point
        const {canvas} = elements;
        const viewport = stateManager.getViewport();

        stateManager.updateViewport({
            offsetX: -worldPos.x + canvas.clientWidth / (2 * viewport.scale),
            offsetY: -worldPos.y + canvas.clientHeight / (2 * viewport.scale)
        });

        // Request render update
        renderer.requestRender(true);
    }

    /**
     * Set up event listeners for minimap
     */
    function setupEventListeners() {
        const {minimap, minimapContainer} = elements;

        if (!minimap) return;

        // Toggle minimap button
        const toggleMinimapBtn = document.getElementById('toggle-minimap-btn');
        if (toggleMinimapBtn) {
            toggleMinimapBtn.addEventListener('click', toggleMinimap);
        }

        // Click/drag on minimap is handled in events.js

        // Listen for changes that require minimap update
        editorEvents.on(EDITOR_EVENTS.NODE_CREATED, () => renderer.renderMinimap());
        editorEvents.on(EDITOR_EVENTS.NODE_DELETED, () => renderer.renderMinimap());
        editorEvents.on(EDITOR_EVENTS.NODE_MOVED, () => renderer.renderMinimap());
        editorEvents.on(EDITOR_EVENTS.CONNECTION_CREATED, () => renderer.renderMinimap());
        editorEvents.on(EDITOR_EVENTS.CONNECTION_DELETED, () => renderer.renderMinimap());
        editorEvents.on(EDITOR_EVENTS.VIEWPORT_CHANGED, () => renderer.renderMinimap());
        editorEvents.on(EDITOR_EVENTS.STATE_RESET, () => renderer.renderMinimap());
        editorEvents.on(EDITOR_EVENTS.STATE_LOADED, () => renderer.renderMinimap());
    }

    // Return public API
    return {
        toggleMinimap,
        setMinimapSize,
        handleMinimapClick,
        calculateNodesBounds,
        minimapToWorld
    };
}