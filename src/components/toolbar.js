/**
 * Toolbar Component - Manages toolbar actions and buttons
 */
import {eventBus, EVENTS} from '../core/events.js';
import {logger} from '../utils/logger.js';
import {addEventListeners} from '../utils/dom.js';

export function initToolbar(elements, state) {
    const stateManager = state;

    /**
     * Initialize toolbar buttons and their actions
     */
    function init() {
        setupToolbarButtons();
        updateButtonStates();
    }

    /**
     * Set up toolbar buttons with event listeners
     */
    function setupToolbarButtons() {
        // File operations
        const buttons = {
            'save-btn': () => eventBus.emit(EVENTS.TOOLBAR_ACTION, {action: 'save'}),
            'load-btn': () => eventBus.emit(EVENTS.TOOLBAR_ACTION, {action: 'load'}),
            'clear-btn': () => eventBus.emit(EVENTS.TOOLBAR_ACTION, {action: 'clear'}),
            'export-xml-btn': () => eventBus.emit(EVENTS.TOOLBAR_ACTION, {action: 'export-xml'})
        };

        // Add event listeners to all buttons
        Object.entries(buttons).forEach(([id, handler]) => {
            const button = document.getElementById(id);
            if (button) {
                button.addEventListener('click', handler);
            }
        });
    }

    /**
     * Update toolbar button states based on current state
     */
    function updateButtonStates() {
        // Grid button state
        const toggleGridBtn = document.getElementById('toggle-grid-btn');
        if (toggleGridBtn) {
            toggleGridBtn.classList.toggle('active', stateManager.getGrid().enabled);
        }

        // Snap button state
        const toggleSnapBtn = document.getElementById('toggle-snap-btn');
        if (toggleSnapBtn) {
            toggleSnapBtn.classList.toggle('active', stateManager.getGrid().snap);
        }

        // Layout type selector
        const layoutTypeSelect = document.getElementById('layout-type');
        if (layoutTypeSelect) {
            layoutTypeSelect.value = stateManager.getLayout().type;
        }
    }

    /**
     * Set up event listeners for state changes
     */
    function setupEventListeners() {
        // Listen for state changes that affect toolbar button states
        eventBus.on(EVENTS.GRID_CHANGED, updateButtonStates);
        eventBus.on(EVENTS.LAYOUT_CHANGED, updateButtonStates);
        eventBus.on(EVENTS.STATE_LOADED, updateButtonStates);
    }

    // Initialize
    init();
    setupEventListeners();

    // Return public API
    return {
        updateButtonStates
    };
}