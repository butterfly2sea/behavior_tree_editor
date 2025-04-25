/**
 * Toolbar component
 * Handles the toolbar UI and actions
 */

import { editorEvents, EDITOR_EVENTS } from '../modules/events.js';
import { logger } from '../index.js';

export function initToolbar(elements, state, renderer) {
    const stateManager = state;

    logger.debug('Initializing toolbar');

    // Set up toolbar buttons
    setupToolbarButtons();

    /**
     * Set up toolbar buttons and their event handlers
     */
    function setupToolbarButtons() {
        // File operations
        setupButton('save-btn', () => editorEvents.emit(EDITOR_EVENTS.SAVE_REQUESTED));
        setupButton('load-btn', () => editorEvents.emit(EDITOR_EVENTS.LOAD_REQUESTED));
        setupButton('clear-btn', () => editorEvents.emit(EDITOR_EVENTS.CLEAR_REQUESTED));
        setupButton('export-xml-btn', () => editorEvents.emit(EDITOR_EVENTS.EXPORT_XML_REQUESTED));

        // Grid and snap settings
        setupButton('toggle-grid-btn', () => editorEvents.emit(EDITOR_EVENTS.GRID_TOGGLE_REQUESTED));
        setupButton('toggle-snap-btn', () => editorEvents.emit(EDITOR_EVENTS.SNAP_TOGGLE_REQUESTED));

        // Alignment buttons
        setupButton('align-left-btn', () => editorEvents.emit(EDITOR_EVENTS.ALIGN_REQUESTED, 'left'));
        setupButton('align-center-btn', () => editorEvents.emit(EDITOR_EVENTS.ALIGN_REQUESTED, 'center'));
        setupButton('align-right-btn', () => editorEvents.emit(EDITOR_EVENTS.ALIGN_REQUESTED, 'right'));
        setupButton('align-top-btn', () => editorEvents.emit(EDITOR_EVENTS.ALIGN_REQUESTED, 'top'));
        setupButton('align-middle-btn', () => editorEvents.emit(EDITOR_EVENTS.ALIGN_REQUESTED, 'middle'));
        setupButton('align-bottom-btn', () => editorEvents.emit(EDITOR_EVENTS.ALIGN_REQUESTED, 'bottom'));

        // Auto layout
        setupButton('auto-layout-btn', () => editorEvents.emit(EDITOR_EVENTS.LAYOUT_REQUESTED));

        // Layout type selector
        const layoutTypeSelect = document.getElementById('layout-type');
        if (layoutTypeSelect) {
            // Set initial value
            layoutTypeSelect.value = stateManager.getLayout().type;

            // Handle change
            layoutTypeSelect.addEventListener('change', (e) => {
                editorEvents.emit(EDITOR_EVENTS.LAYOUT_SETTINGS_CHANGED, {
                    type: e.target.value
                });
            });
        }

        // Keyboard shortcuts tooltip
        createKeyboardShortcutsTooltip();
    }

    /**
     * Set up a toolbar button
     * @param {string} id - Button ID
     * @param {Function} clickHandler - Click event handler
     */
    function setupButton(id, clickHandler) {
        const button = document.getElementById(id);
        if (button) {
            button.addEventListener('click', clickHandler);
        }
    }

    /**
     * Create tooltip showing keyboard shortcuts
     */
    function createKeyboardShortcutsTooltip() {
        // Create a tooltip container
        const tooltip = document.createElement('div');
        tooltip.className = 'keyboard-shortcuts-tooltip';
        tooltip.innerHTML = `
            <h3>Keyboard Shortcuts</h3>
            <ul>
                <li><kbd>Delete</kbd> - Delete selected node(s)</li>
                <li><kbd>Ctrl</kbd>+<kbd>S</kbd> - Save tree</li>
                <li><kbd>Ctrl</kbd>+<kbd>O</kbd> - Load tree</li>
                <li><kbd>Ctrl</kbd>+<kbd>A</kbd> - Select all nodes</li>
                <li><kbd>Esc</kbd> - Cancel pending operation</li>
                <li><kbd>Shift</kbd>+Click - Add to selection</li>
                <li><kbd>Alt</kbd>+Drag - Pan canvas</li>
                <li>Mouse wheel - Zoom in/out</li>
            </ul>
            <div class="tooltip-close">×</div>
        `;

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .keyboard-shortcuts-tooltip {
                position: absolute;
                top: 40px;
                right: 10px;
                background: white;
                border: 1px solid #ccc;
                border-radius: 4px;
                padding: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                z-index: 1000;
                font-size: 12px;
                display: none;
            }
            
            .keyboard-shortcuts-tooltip h3 {
                margin-top: 0;
                margin-bottom: 8px;
                font-size: 14px;
            }
            
            .keyboard-shortcuts-tooltip ul {
                list-style: none;
                padding: 0;
                margin: 0;
            }
            
            .keyboard-shortcuts-tooltip li {
                margin-bottom: 4px;
            }
            
            .keyboard-shortcuts-tooltip kbd {
                background-color: #f7f7f7;
                border: 1px solid #ccc;
                border-radius: 3px;
                box-shadow: 0 1px 0 rgba(0,0,0,0.2);
                color: #333;
                display: inline-block;
                font-size: 0.85em;
                font-weight: 700;
                line-height: 1;
                padding: 2px 4px;
                white-space: nowrap;
            }
            
            .tooltip-close {
                position: absolute;
                top: 5px;
                right: 5px;
                cursor: pointer;
                font-size: 16px;
                color: #999;
            }
            
            .tooltip-close:hover {
                color: #333;
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(tooltip);

        // Create help button in toolbar
        const toolbar = document.getElementById('main-toolbar');
        if (toolbar) {
            const helpBtn = document.createElement('button');
            helpBtn.id = 'keyboard-shortcuts-btn';
            helpBtn.title = 'Keyboard Shortcuts';
            helpBtn.innerHTML = '<i class="fa fa-keyboard"></i>';

            // Add to a new toolbar group
            const helpGroup = document.createElement('div');
            helpGroup.className = 'toolbar-group';
            helpGroup.appendChild(helpBtn);

            toolbar.appendChild(helpGroup);

            // Toggle tooltip on click
            helpBtn.addEventListener('click', () => {
                if (tooltip.style.display === 'block') {
                    tooltip.style.display = 'none';
                } else {
                    tooltip.style.display = 'block';
                }
            });

            // Close tooltip when clicking the close button
            const closeBtn = tooltip.querySelector('.tooltip-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    tooltip.style.display = 'none';
                });
            }

            // Close tooltip when clicking outside
            document.addEventListener('click', (e) => {
                if (e.target !== helpBtn && !tooltip.contains(e.target)) {
                    tooltip.style.display = 'none';
                }
            });
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
     * Enable or disable toolbar buttons based on editor state
     * @param {Array} enabledButtons - IDs of buttons to enable
     */
    function setEnabledButtons(enabledButtons) {
        // Get all toolbar buttons
        const toolbar = document.getElementById('main-toolbar');
        if (!toolbar) return;

        const buttons = toolbar.querySelectorAll('button');

        // Disable all buttons first
        buttons.forEach(button => {
            if (button.id) {
                button.disabled = !enabledButtons.includes(button.id);
            }
        });
    }

    // Set up event listeners
    function setupEventListeners() {
        // Listen for state changes that affect the toolbar
        editorEvents.on(EDITOR_EVENTS.GRID_SETTINGS_CHANGED, updateToolbarButtonStates);
        editorEvents.on(EDITOR_EVENTS.LAYOUT_SETTINGS_CHANGED, updateToolbarButtonStates);
        editorEvents.on(EDITOR_EVENTS.STATE_LOADED, updateToolbarButtonStates);
    }

    // Initialize event listeners
    setupEventListeners();

    // Return public API
    return {
        updateToolbarButtonStates,
        setEnabledButtons
    };
}