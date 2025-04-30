/**
 * Event System using standard EventTarget API
 */

// Event types constants
export const EVENTS = {
    // State events
    STATE_CHANGED: 'state:changed',
    STATE_RESET: 'state:reset',
    STATE_LOADED: 'state:loaded',

    // Node events
    NODE_CHANGED: 'node:changed', // type: created, updated, deleted, moved

    // Connection events
    CONNECTION_CHANGED: 'connection:changed', // type: created, deleted, selected, unselected

    // Selection events
    SELECTION_CHANGED: 'selection:changed',

    // Viewport events
    VIEWPORT_CHANGED: 'viewport:changed', // type: scaled, moved, resized

    // Tool events
    GRID_CHANGED: 'grid:changed',
    LAYOUT_CHANGED: 'layout:changed',

    // Monitor events
    MONITOR_CHANGED: 'monitor:changed', // type: started, stopped, updated

    // UI events
    TOOLBAR_ACTION: 'toolbar:action', // action: save, load, export, etc.
    CONTEXT_MENU: 'ui:context-menu'
};

// Custom event bus using standard EventTarget
class EventBus extends EventTarget {
    constructor() {
        super();
        this.history = []; // Keep track of recent events for debugging
        this.maxHistory = 10;
    }

    /**
     * Subscribe to an event
     * @param {string} eventName - Name of the event
     * @param {Function} callback - Event handler function
     * @returns {Function} - Unsubscribe function
     */
    on(eventName, callback) {
        const handler = (event) => callback(event.detail);
        this.addEventListener(eventName, handler);

        // Return unsubscribe function
        return () => this.off(eventName, handler);
    }

    /**
     * Unsubscribe from an event
     * @param {string} eventName - Name of the event
     * @param {Function} handler - Event handler function
     */
    off(eventName, handler) {
        this.removeEventListener(eventName, handler);
    }

    /**
     * Emit an event
     * @param {string} eventName - Name of the event
     * @param {any} data - Event data
     */
    emit(eventName, data = {}) {
        // Record event for debugging
        this.history.unshift({event: eventName, data, time: new Date()});
        if (this.history.length > this.maxHistory) {
            this.history.pop();
        }

        const event = new CustomEvent(eventName, {detail: data});
        this.dispatchEvent(event);
    }

    /**
     * Get recent events for debugging
     * @returns {Array} - Array of recent events
     */
    getRecentEvents() {
        return [...this.history];
    }
}

// Export singleton event bus
export const eventBus = new EventBus();