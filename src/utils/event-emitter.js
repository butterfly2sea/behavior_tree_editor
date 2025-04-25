/**
 * Custom Event Emitter
 * Provides a simple pub/sub mechanism for the application
 */

export class EventEmitter {
    constructor() {
        this.events = {};
    }

    /**
     * Subscribe to an event
     * @param {string} event - Event name
     * @param {Function} listener - Callback function
     * @returns {EventEmitter} - For method chaining
     */
    on(event, listener) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(listener);
        return this;
    }

    /**
     * Unsubscribe from an event
     * @param {string} event - Event name
     * @param {Function} listener - Callback function
     * @returns {EventEmitter} - For method chaining
     */
    off(event, listener) {
        if (!this.events[event]) return this;

        this.events[event] = this.events[event].filter(l => l !== listener);
        return this;
    }

    /**
     * Emit an event
     * @param {string} event - Event name
     * @param {...any} args - Arguments to pass to listeners
     * @returns {boolean} - True if event had listeners
     */
    emit(event, ...args) {
        if (!this.events[event]) return false;

        this.events[event].forEach(listener => {
            listener.apply(this, args);
        });
        return true;
    }

    /**
     * Subscribe to an event for one-time execution
     * @param {string} event - Event name
     * @param {Function} listener - Callback function
     * @returns {EventEmitter} - For method chaining
     */
    once(event, listener) {
        const onceWrapper = (...args) => {
            listener.apply(this, args);
            this.off(event, onceWrapper);
        };
        return this.on(event, onceWrapper);
    }

    /**
     * Remove all listeners for an event
     * @param {string} event - Event name (optional, if not provided removes all events)
     * @returns {EventEmitter} - For method chaining
     */
    removeAllListeners(event) {
        if (event) {
            delete this.events[event];
        } else {
            this.events = {};
        }
        return this;
    }
}