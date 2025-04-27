/**
 * Toolbar Component
 */
import {eventBus, EVENTS} from '../core/events.js';
import {logger} from '../utils/logger.js';

export function initToolbar(elements, state) {
    const stateManager = state;

    /**
     * Set up toolbar buttons
     */
    function setupToolbarButtons() {
        // File operations
        setupButton('save-btn', () => {
            eventBus.emit(EVENTS.TOOLBAR_ACTION, {action: 'save'});
        });

        setupButton('load-btn', () => {
            eventBus.emit(EVENTS.TOOLBAR_ACTION, {action: 'load'});
        });

        setupButton('clear-btn', () => {
            eventBus.emit(EVENTS.TOOLBAR_ACTION, {action: 'clear'});
        });

        setupButton('export-xml-btn', () => {
            eventBus.emit(EVENTS.TOOLBAR_ACTION, {action: 'export-xml'});
        });

        // Grid and snap buttons are handled by the grid module

        // Auto layout button and layout type are handled by the layout module
    }

    /**
     * Set up a toolbar button
     */
    function setupButton(id, clickHandler) {
        const button = document.getElementById(id);
        if (button) {
            button.addEventListener('click', clickHandler);
        }
    }

    /**
     * Update toolbar button states
     */
    function updateToolbarButtonStates() {
        // Update grid button state
        const toggleGridBtn = document.getElementById('toggle-grid-btn');
        if (toggleGridBtn) {
            toggleGridBtn.classList.toggle('active', stateManager.getGrid().enabled);
        }

        // Update snap button state
        const toggleSnapBtn = document.getElementById('toggle-snap-btn');
        if (toggleSnapBtn) {
            toggleSnapBtn.classList.toggle('active', stateManager.getGrid().snap);
        }

        // Update layout type selector
        const layoutTypeSelect = document.getElementById('layout-type');
        if (layoutTypeSelect) {
            layoutTypeSelect.value = stateManager.getLayout().type;
        }
    }

    /**
     * Set up event listeners
     */
    function setupEventListeners() {
        // Listen for state changes that affect the toolbar
        eventBus.on(EVENTS.GRID_CHANGED, updateToolbarButtonStates);
        eventBus.on(EVENTS.LAYOUT_CHANGED, updateToolbarButtonStates);
        eventBus.on(EVENTS.STATE_LOADED, updateToolbarButtonStates);
    }

    // Initialize
    setupToolbarButtons();
    setupEventListeners();

    // Return public API
    return {
        updateToolbarButtonStates
    };
}