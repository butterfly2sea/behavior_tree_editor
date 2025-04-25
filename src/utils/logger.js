/**
 * Logger utility
 * Provides consistent logging with levels and formatting
 */

// Define log levels
export const LogLevel = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    NONE: 4
};

export class Logger {
    /**
     * Create a new logger
     * @param {number} level - Minimum log level (default: INFO)
     * @param {boolean} enableTimestamp - Whether to include timestamps (default: true)
     */
    constructor(level = LogLevel.INFO, enableTimestamp = true) {
        this.level = level;
        this.enableTimestamp = enableTimestamp;
    }

    /**
     * Set the log level
     * @param {number} level - New log level
     */
    setLevel(level) {
        this.level = level;
    }

    /**
     * Format a log message
     * @param {string} level - Log level label
     * @param {string} message - Log message
     * @returns {string} - Formatted message
     * @private
     */
    _formatMessage(level, message) {
        let formattedMessage = `[${level}] ${message}`;

        if (this.enableTimestamp) {
            const now = new Date();
            const timestamp = now.toISOString();
            formattedMessage = `[${timestamp}] ${formattedMessage}`;
        }

        return formattedMessage;
    }

    /**
     * Log a debug message
     * @param {string} message - Message to log
     * @param {...any} args - Additional arguments
     */
    debug(message, ...args) {
        if (this.level <= LogLevel.DEBUG) {
            console.debug(this._formatMessage('DEBUG', message), ...args);
        }
    }

    /**
     * Log an info message
     * @param {string} message - Message to log
     * @param {...any} args - Additional arguments
     */
    info(message, ...args) {
        if (this.level <= LogLevel.INFO) {
            console.info(this._formatMessage('INFO', message), ...args);
        }
    }

    /**
     * Log a warning message
     * @param {string} message - Message to log
     * @param {...any} args - Additional arguments
     */
    warn(message, ...args) {
        if (this.level <= LogLevel.WARN) {
            console.warn(this._formatMessage('WARN', message), ...args);
        }
    }

    /**
     * Log an error message
     * @param {string} message - Message to log
     * @param {...any} args - Additional arguments
     */
    error(message, ...args) {
        if (this.level <= LogLevel.ERROR) {
            console.error(this._formatMessage('ERROR', message), ...args);
        }
    }

    /**
     * Log a group of messages
     * @param {string} label - Group label
     * @param {Function} callback - Callback function to execute inside the group
     * @param {boolean} collapsed - Whether to collapse the group (default: false)
     */
    group(label, callback, collapsed = false) {
        if (this.level === LogLevel.NONE) return;

        if (collapsed) {
            console.groupCollapsed(this._formatMessage('GROUP', label));
        } else {
            console.group(this._formatMessage('GROUP', label));
        }

        callback();
        console.groupEnd();
    }

    /**
     * Log a performance measurement
     * @param {string} label - Measurement label
     * @param {Function} callback - Function to measure
     * @returns {any} - Result of the callback
     */
    time(label, callback) {
        if (this.level === LogLevel.NONE) return callback();

        console.time(this._formatMessage('TIME', label));
        const result = callback();
        console.timeEnd(this._formatMessage('TIME', label));

        return result;
    }
}