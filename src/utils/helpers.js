/**
 * Helper Utilities
 */
import {eventBus, EVENTS} from '../core/events.js';

/**
 * Set up keyboard shortcuts
 * @param {Object} state - State manager
 */
export function setupKeyboardShortcuts(state) {
    document.addEventListener('keydown', (e) => {
        // Ignore shortcuts when typing in input fields
        if (e.target.matches('input, textarea, [contenteditable="true"]')) {
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
 * @param {Object} state - State manager
 */
function selectAllNodes(state) {
    const nodeIds = state.getNodes().map(node => node.id);
    state.selectNodes(nodeIds);
}

/**
 * Cancel any pending operations
 * @param {Object} state - State manager
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
    document.querySelectorAll('.context-menu').forEach(menu => {
        menu.style.display = 'none';
    });
}

/**
 * Generate a unique ID
 * @param {string} prefix - ID prefix
 * @returns {string} - Unique ID
 */
export function generateId(prefix = 'id_') {
    return `${prefix}${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Delay execution
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise} - Promise that resolves after delay
 */
export function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Debounce a function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Milliseconds to wait
 * @returns {Function} - Debounced function
 */
export function debounce(func, wait) {
    let timeout;

    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };

        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Check if two objects have the same structure and values
 * @param {Object} a - First object
 * @param {Object} b - Second object
 * @returns {boolean} - True if objects are equal
 */
export function objectsEqual(a, b) {
    if (a === b) return true;

    if (!(a instanceof Object) || !(b instanceof Object)) return false;

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    return keysA.every(key => {
        if (!b.hasOwnProperty(key)) return false;

        if (a[key] instanceof Object && b[key] instanceof Object) {
            return objectsEqual(a[key], b[key]);
        }

        return a[key] === b[key];
    });
}