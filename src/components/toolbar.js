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
            'export-xml-btn': () => eventBus.emit(EVENTS.TOOLBAR_ACTION, {action: 'export-xml'}),
            'toggle-minimap-btn': () => {
                if (window.editor && window.editor.modules && window.editor.modules.minimap) {
                    window.editor.modules.minimap.toggleMinimap();
                }
            }
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

        // Minimap button state
        const toggleMinimapBtn = document.getElementById('toggle-minimap-btn');
        if (toggleMinimapBtn) {
            toggleMinimapBtn.classList.toggle('active', stateManager.getMinimap().isVisible);
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
        eventBus.on(EVENTS.MINIMAP_CHANGED, updateButtonStates);
    }

    function updateAlignButtonsState() {
        const selectedNodes = stateManager.getSelectedNodes();
        const hasMultipleSelection = selectedNodes.length > 1;

        // 对齐按钮列表
        const alignButtons = [
            'align-left-btn', 'align-center-btn', 'align-right-btn',
            'align-top-btn', 'align-middle-btn', 'align-bottom-btn'
        ];

        // 更新每个按钮的禁用状态
        alignButtons.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.disabled = !hasMultipleSelection;
                if (hasMultipleSelection) {
                    btn.classList.remove('disabled');
                } else {
                    btn.classList.add('disabled');
                }
            }
        });
    }

    // 监听选择变化事件
    eventBus.on(EVENTS.SELECTION_CHANGED, updateAlignButtonsState);


    // Initialize
    init();
    updateAlignButtonsState();
    setupEventListeners();

    // Return public API
    return {
        updateButtonStates
    };
}