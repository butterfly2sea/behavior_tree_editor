/**
 * Helper Utilities
 */
import {eventBus, EVENTS} from '../core/events.js';

/**
 * Set up keyboard shortcuts
 */
export function setupKeyboardShortcuts(state) {
    document.addEventListener('keydown', (e) => {
        // Ignore shortcuts when typing in input fields
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }

        // Delete to remove selected nodes
        if (e.key === 'Delete') {
            eventBus.emit(EVENTS.TOOLBAR_ACTION, {action: 'delete-selected'});
        }

        // Ctrl+S to save
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            eventBus.emit(EVENTS.TOOLBAR_ACTION, {action: 'save'});
        }

        // Ctrl+O to load
        if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
            e.preventDefault();
            eventBus.emit(EVENTS.TOOLBAR_ACTION, {action: 'load'});
        }

        // Ctrl+A to select all
        if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
            e.preventDefault();
            selectAllNodes(state);
        }

        // Escape to cancel pending operations
        if (e.key === 'Escape') {
            cancelPendingOperations(state);
        }
    });
}

/**
 * Select all nodes
 */
function selectAllNodes(state) {
    const nodeIds = state.getNodes().map(node => node.id);
    state.selectNodes(nodeIds);
}

/**
 * Cancel any pending operations
 */
function cancelPendingOperations(state) {
    // Cancel pending connection
    if (state.getState().pendingConnection) {
        eventBus.emit(EVENTS.CONNECTION_CHANGED, {type: 'canceled'});
    }

    // Cancel selection box
    if (state.getState().selectionBox.active) {
        state.endSelectionBox();
        const box = document.getElementById('selection-box');
        if (box) box.remove();
    }

    // Cancel dragging
    if (state.getState().dragging.active) {
        state.endDragging();
    }

    // Hide any context menus
    const menus = document.querySelectorAll('.context-menu');
    menus.forEach(menu => {
        menu.style.display = 'none';
    });
}

/**
 * Generate a unique ID
 */
export function generateId(prefix = 'id_') {
    return `${prefix}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Delay execution
 */
export function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}