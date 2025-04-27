/**
 * Minimap Module - Provides a minimap navigation
 */
import {eventBus, EVENTS} from '../core/events.js';
import {logger} from '../utils/logger.js';

export function initMinimap(elements, state, renderer) {
    const stateManager = state;

    /**
     * Toggle minimap visibility
     */
    function toggleMinimap() {
        const {minimapContainer} = elements;
        const minimapState = stateManager.getMinimap();

        if (!minimapContainer) return;

        minimapState.isVisible = !minimapState.isVisible;
        minimapContainer.style.display = minimapState.isVisible ? 'block' : 'none';

        if (minimapState.isVisible) {
            renderer.renderMinimap();
        }
    }

    /**
     * Set minimap size
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

        renderer.renderMinimap();
    }

    /**
     * Handle click on the minimap
     */
    function handleMinimapClick(x, y) {
        const {minimap} = elements;
        if (!minimap) return;

        const bounds = renderer.calculateNodesBounds(stateManager.getNodes());
        const minimapState = stateManager.getMinimap();

        // Calculate minimap scale and padding
        const padding = 10;
        const scaleX = (minimapState.width - padding * 2) / bounds.width;
        const scaleY = (minimapState.height - padding * 2) / bounds.height;
        const scale = Math.min(scaleX, scaleY);

        // Convert minimap coordinates to world coordinates
        const worldX = (x - padding) / scale + bounds.minX;
        const worldY = (y - padding) / scale + bounds.minY;

        // Center viewport on this point
        const {canvas} = elements;
        const viewport = stateManager.getViewport();

        stateManager.updateViewport({
            offsetX: -worldX + canvas.clientWidth / (2 * viewport.scale),
            offsetY: -worldY + canvas.clientHeight / (2 * viewport.scale)
        });

        renderer.requestRender(true);
    }

    /**
     * Set up event listeners
     */
    function setupEventListeners() {
        const {minimap} = elements;

        if (!minimap) return;

        // Handle minimap clicks
        minimap.addEventListener('mousedown', (e) => {
            const rect = minimap.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            handleMinimapClick(x, y);

            // Add drag event
            function onMouseMove(moveEvent) {
                const moveX = moveEvent.clientX - rect.left;
                const moveY = moveEvent.clientY - rect.top;
                handleMinimapClick(moveX, moveY);
            }

            function onMouseUp() {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            }

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }

    // Initialize
    setupEventListeners();

    // Return public API
    return {
        toggleMinimap,
        setMinimapSize,
        handleMinimapClick
    };
}