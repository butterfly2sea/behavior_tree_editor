/**
 * Simplified Event System
 */

// Event types
export const EVENTS = {
    // State events
    STATE_CHANGED: 'state:changed',
    STATE_RESET: 'state:reset',
    STATE_LOADED: 'state:loaded',

    // Node events
    NODE_CHANGED: 'node:changed', // type: created, updated, deleted, moved

    // Connection events
    CONNECTION_CHANGED: 'connection:changed', // type: created, deleted, selected

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

// Simple event bus
class EventBus {
    constructor() {
        this.listeners = new Map();
        this.history = []; // Keep track of recent events for debugging
        this.maxHistory = 10;
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
        return () => this.off(event, callback); // Return unsubscribe function
    }

    off(event, callback) {
        if (!this.listeners.has(event)) return;

        const callbacks = this.listeners.get(event);
        const index = callbacks.indexOf(callback);
        if (index !== -1) {
            callbacks.splice(index, 1);
        }
    }

    emit(event, data = {}) {
        // Record event for debugging
        this.history.unshift({event, data, time: new Date()});
        if (this.history.length > this.maxHistory) {
            this.history.pop();
        }

        if (!this.listeners.has(event)) return;

        // Call all registered listeners
        this.listeners.get(event).forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in event listener for ${event}:`, error);
            }
        });
    }

    // For debugging
    getRecentEvents() {
        return [...this.history];
    }
}

// Export singleton event bus
export const eventBus = new EventBus();