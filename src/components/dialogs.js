/**
 * Dialogs Component
 */
import {eventBus, EVENTS} from '../core/events.js';
import {logger} from '../utils/logger.js';

export function initDialogs(elements, state) {
    const stateManager = state;

    /**
     * Initialize modals and dialogs
     */
    function init() {
        setupModalClosers();
        setupContextMenus();
    }

    /**
     * Set up modal close buttons
     */
    function setupModalClosers() {
        // Setup generic close button functionality
        document.querySelectorAll('.modal .close').forEach(closeBtn => {
            const modal = closeBtn.closest('.modal');
            closeBtn.addEventListener('click', () => {
                if (modal) modal.style.display = 'none';
            });
        });

        // Close modals when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });
    }

    /**
     * Set up context menus
     */
    function setupContextMenus() {
        const {connectionContextMenu, nodeContextMenu} = elements;

        // Connection context menu
        if (connectionContextMenu) {
            setupConnectionContextMenu(connectionContextMenu);
        }

        // Node context menu
        if (nodeContextMenu) {
            setupNodeContextMenu(nodeContextMenu);
        }
    }

    /**
     * Set up the connection context menu
     */
    function setupConnectionContextMenu(menu) {
        const deleteConnectionBtn = menu.querySelector('#delete-connection');
        if (deleteConnectionBtn) {
            deleteConnectionBtn.addEventListener('click', () => {
                const connectionId = stateManager.getSelectedConnection();
                if (connectionId) {
                    stateManager.removeConnection(connectionId);
                    menu.style.display = 'none';
                }
            });
        }

        // Listen for connection selection
        eventBus.on(EVENTS.CONNECTION_CHANGED, (data) => {
            if (data.type === 'selected' && data.connectionId) {
                // Position and show menu
                const path = document.querySelector(`path[data-id="${data.connectionId}"]`);
                if (path) {
                    const rect = path.getBoundingClientRect();

                    menu.style.left = `${rect.left + rect.width / 2}px`;
                    menu.style.top = `${rect.top + rect.height / 2}px`;
                    menu.style.display = 'block';
                }
            }
        });
    }

    /**
     * Set up the node context menu
     */
    function setupNodeContextMenu(menu) {
        // Delete node option
        const deleteNodeBtn = menu.querySelector('#delete-node');
        if (deleteNodeBtn) {
            deleteNodeBtn.addEventListener('click', () => {
                eventBus.emit(EVENTS.TOOLBAR_ACTION, {action: 'delete-selected'});
                menu.style.display = 'none';
            });
        }

        // Duplicate node option
        const duplicateNodeBtn = menu.querySelector('#duplicate-node');
        if (duplicateNodeBtn) {
            duplicateNodeBtn.addEventListener('click', () => {
                const selectedNodes = stateManager.getSelectedNodes();

                if (selectedNodes.length > 0) {
                    eventBus.emit(EVENTS.TOOLBAR_ACTION, {
                        action: 'duplicate-selected',
                        nodeIds: selectedNodes
                    });
                }

                menu.style.display = 'none';
            });
        }

        // Show menu on node right-click
        document.addEventListener('contextmenu', (e) => {
            const nodeElement = e.target.closest('.tree-node');
            if (nodeElement) {
                e.preventDefault();

                const nodeId = nodeElement.getAttribute('data-id');

                // Select the node if not already selected
                if (!stateManager.getSelectedNodes().includes(nodeId)) {
                    stateManager.clearSelection();
                    stateManager.selectNode(nodeId);
                }

                // Position and show menu
                menu.style.left = `${e.clientX}px`;
                menu.style.top = `${e.clientY}px`;
                menu.style.display = 'block';
            }
        });

        // Hide menu when clicking elsewhere
        document.addEventListener('click', () => {
            menu.style.display = 'none';
        });
    }

    // Initialize
    init();

    // Return public API
    return {
        showModal: (modalId) => {
            const modal = document.getElementById(modalId);
            if (modal) modal.style.display = 'block';
        },

        hideModal: (modalId) => {
            const modal = document.getElementById(modalId);
            if (modal) modal.style.display = 'none';
        }
    };
}