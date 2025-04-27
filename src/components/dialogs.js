/**
 * Dialogs Component - Manages modal dialogs and context menus
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
        // Close buttons with class 'close'
        document.querySelectorAll('.modal .close').forEach(closeBtn => {
            const modal = closeBtn.closest('.modal');
            closeBtn.addEventListener('click', () => {
                if (modal) modal.style.display = 'none';
            });
        });

        // Close when clicking outside modal content
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });

        // Close when pressing escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal').forEach(modal => {
                    modal.style.display = 'none';
                });
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

        // Hide all context menus when clicking elsewhere
        document.addEventListener('click', hideAllContextMenus);
        document.addEventListener('contextmenu', (e) => {
            // Don't hide if the click is on a node or connection
            if (!e.target.closest('.tree-node') && !e.target.closest('.connection-path')) {
                hideAllContextMenus();
            }
        });
    }

    /**
     * Hide all context menus
     */
    function hideAllContextMenus() {
        document.querySelectorAll('.context-menu').forEach(menu => {
            menu.style.display = 'none';
        });
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

                    // Position in the center of the path
                    const centerX = rect.left + rect.width / 2;
                    const centerY = rect.top + rect.height / 2;

                    // Show the menu
                    showContextMenu(menu, centerX, centerY);
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

                // Show context menu
                showContextMenu(menu, e.clientX, e.clientY);
            }
        });
    }

    /**
     * Show a context menu at specified position
     */
    function showContextMenu(menu, x, y) {
        // Hide all context menus first
        hideAllContextMenus();

        // Position the menu
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;

        // Make it visible
        menu.style.display = 'block';

        // Adjust position if menu goes off-screen
        const rect = menu.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        if (rect.right > windowWidth) {
            menu.style.left = `${windowWidth - rect.width}px`;
        }

        if (rect.bottom > windowHeight) {
            menu.style.top = `${windowHeight - rect.height}px`;
        }
    }

    /**
     * Show a modal by ID
     */
    function showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.style.display = 'block';
    }

    /**
     * Hide a modal by ID
     */
    function hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.style.display = 'none';
    }

    // Initialize
    init();

    // Return public API
    return {
        showModal,
        hideModal,
        hideAllContextMenus
    };
}