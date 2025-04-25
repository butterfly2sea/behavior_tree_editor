/**
 * Grid module
 * Manages grid rendering and grid-related settings
 */

import {editorEvents, EDITOR_EVENTS} from './events.js';
import {logger} from '../index.js';

export function initGrid(elements, state, renderer) {
    const stateManager = state;

    logger.debug('Initializing grid module');

    // Set up event listeners
    setupEventListeners();

    /**
     * Toggle grid visibility
     */
    function toggleGrid() {
        const currentState = stateManager.getGrid().enabled;
        stateManager.updateGridSettings({
            enabled: !currentState
        });

        // Update UI
        const toggleBtn = document.getElementById('toggle-grid-btn');
        if (toggleBtn) {
            toggleBtn.classList.toggle('active', !currentState);
        }

        // Request render update
        renderer.requestRender(true);
    }

    /**
     * Toggle grid snapping
     */
    function toggleSnap() {
        const currentState = stateManager.getGrid().snap;
        stateManager.updateGridSettings({
            snap: !currentState
        });

        // Update UI
        const toggleBtn = document.getElementById('toggle-snap-btn');
        if (toggleBtn) {
            toggleBtn.classList.toggle('active', !currentState);
        }
    }

    /**
     * Set grid size
     * @param {number} size - New grid size
     */
    function setGridSize(size) {
        if (size < 5 || size > 100) {
            logger.warn(`Invalid grid size: ${size}`);
            return;
        }

        stateManager.updateGridSettings({size});

        // Request render update
        renderer.requestRender(true);
    }

    /**
     * Render the grid
     */
    function renderGrid() {
        const {gridCanvas} = elements;
        const grid = stateManager.getGrid();
        const viewport = stateManager.getViewport();

        if (!gridCanvas) {
            logger.warn('Grid canvas not found');
            return;
        }

        // Resize grid canvas to match container
        const container = gridCanvas.parentElement;
        gridCanvas.width = container.clientWidth;
        gridCanvas.height = container.clientHeight;

        const ctx = gridCanvas.getContext('2d');
        ctx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);

        if (!grid.enabled) return;

        // Draw grid lines
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1;

        // Calculate grid offset based on viewport
        const offsetX = (viewport.offsetX * viewport.scale) % (grid.size * viewport.scale);
        const offsetY = (viewport.offsetY * viewport.scale) % (grid.size * viewport.scale);

        // Calculate scaled grid size
        const scaledGridSize = grid.size * viewport.scale;

        // Draw vertical lines
        for (let x = offsetX; x <= gridCanvas.width; x += scaledGridSize) {
            // Only draw at integer positions to avoid blurry lines
            const roundedX = Math.round(x) + 0.5;

            ctx.beginPath();
            ctx.moveTo(roundedX, 0);
            ctx.lineTo(roundedX, gridCanvas.height);
            ctx.stroke();
        }

        // Draw horizontal lines
        for (let y = offsetY; y <= gridCanvas.height; y += scaledGridSize) {
            // Only draw at integer positions to avoid blurry lines
            const roundedY = Math.round(y) + 0.5;

            ctx.beginPath();
            ctx.moveTo(0, roundedY);
            ctx.lineTo(gridCanvas.width, roundedY);
            ctx.stroke();
        }
    }

    /**
     * Snap a value to the grid
     * @param {number} value - Value to snap
     * @returns {number} - Snapped value
     */
    function snapToGrid(value) {
        const grid = stateManager.getGrid();

        if (!grid.snap) return value;

        return Math.round(value / grid.size) * grid.size;
    }

    /**
     * Set up event listeners for grid-related events
     */
    function setupEventListeners() {
        // Add event listeners for grid buttons
        const toggleGridBtn = document.getElementById('toggle-grid-btn');
        const toggleSnapBtn = document.getElementById('toggle-snap-btn');

        if (toggleGridBtn) {
            toggleGridBtn.addEventListener('click', toggleGrid);

            // Set initial state
            const gridEnabled = stateManager.getGrid().enabled;
            toggleGridBtn.classList.toggle('active', gridEnabled);
        }

        if (toggleSnapBtn) {
            toggleSnapBtn.addEventListener('click', toggleSnap);

            // Set initial state
            const snapEnabled = stateManager.getGrid().snap;
            toggleSnapBtn.classList.toggle('active', snapEnabled);
        }

        // Listen for grid settings changes
        editorEvents.on(EDITOR_EVENTS.GRID_SETTINGS_CHANGED, (gridSettings) => {
            // Update button states
            if (toggleGridBtn) {
                toggleGridBtn.classList.toggle('active', gridSettings.enabled);
            }

            if (toggleSnapBtn) {
                toggleSnapBtn.classList.toggle('active', gridSettings.snap);
            }

            // Re-render grid
            renderGrid();
        });

        // Listen for viewport changes
        editorEvents.on(EDITOR_EVENTS.VIEWPORT_CHANGED, () => {
            renderGrid();
        });

        // Listen for window resize
        editorEvents.on(EDITOR_EVENTS.WINDOW_RESIZED, () => {
            renderGrid();
        });
    }

    // Return public API
    return {
        toggleGrid,
        toggleSnap,
        setGridSize,
        renderGrid,
        snapToGrid
    };
}