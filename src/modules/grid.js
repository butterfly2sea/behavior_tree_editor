/**
 * Grid Module - Manages grid rendering and snapping
 */
import {eventBus, EVENTS} from '../core/events.js';
import {logger} from '../utils/logger.js';

export function initGrid(elements, state, renderer) {
    const stateManager = state;

    /**
     * Toggle grid visibility
     */
    function toggleGrid() {
        const currentState = stateManager.getGrid().enabled;
        stateManager.updateGridSettings({enabled: !currentState});

        // Update UI
        const toggleBtn = document.getElementById('toggle-grid-btn');
        if (toggleBtn) {
            toggleBtn.classList.toggle('active', !currentState);
        }
    }

    /**
     * Toggle grid snapping
     */
    function toggleSnap() {
        const currentState = stateManager.getGrid().snap;
        stateManager.updateGridSettings({snap: !currentState});

        // Update UI
        const toggleBtn = document.getElementById('toggle-snap-btn');
        if (toggleBtn) {
            toggleBtn.classList.toggle('active', !currentState);
        }
    }

    /**
     * Set grid size
     */
    function setGridSize(size) {
        if (size < 5 || size > 100) {
            logger.warn(`Invalid grid size: ${size}`);
            return;
        }

        stateManager.updateGridSettings({size});
    }

    /**
     * Snap a value to the grid
     */
    function snapToGrid(value) {
        const grid = stateManager.getGrid();

        if (!grid.snap) return value;

        return Math.round(value / grid.size) * grid.size;
    }

    /**
     * Set up event listeners
     */
    function setupEventListeners() {
        // Grid and snap toggle buttons
        const toggleGridBtn = document.getElementById('toggle-grid-btn');
        const toggleSnapBtn = document.getElementById('toggle-snap-btn');

        if (toggleGridBtn) {
            toggleGridBtn.addEventListener('click', toggleGrid);
            toggleGridBtn.classList.toggle('active', stateManager.getGrid().enabled);
        }

        if (toggleSnapBtn) {
            toggleSnapBtn.addEventListener('click', toggleSnap);
            toggleSnapBtn.classList.toggle('active', stateManager.getGrid().snap);
        }
    }

    // Initialize
    setupEventListeners();

    // Return public API
    return {
        toggleGrid,
        toggleSnap,
        setGridSize,
        snapToGrid
    };
}