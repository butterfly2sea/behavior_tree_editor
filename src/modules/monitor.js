/**
 * Logger Utility
 */

// Log levels
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
     */
    constructor(level = 'info', enableTimestamps = true) {
        // Convert string level to numeric
        if (typeof level === 'string') {
            this.level = LogLevel[level.toUpperCase()] || LogLevel.INFO;
        } else {
            this.level = level;
        }

        this.enableTimestamps = enableTimestamps;
    }

    /**
     * Format a log message
     * @private
     */
    _formatMessage(level, message) {
        let formattedMessage = `[${level}] ${message}`;

        if (this.enableTimestamps) {
            const now = new Date();
            const timestamp = now.toISOString();
            formattedMessage = `[${timestamp}] ${formattedMessage}`;
        }

        return formattedMessage;
    }

    /**
     * Log a debug message
     */
    debug(message, ...args) {
        if (this.level <= LogLevel.DEBUG) {
            console.debug(this._formatMessage('DEBUG', message), ...args);
        }
    }

    /**
     * Log an info message
     */
    info(message, ...args) {
        if (this.level <= LogLevel.INFO) {
            console.info(this._formatMessage('INFO', message), ...args);
        }
    }

    /**
     * Log a warning message
     */
    warn(message, ...args) {
        if (this.level <= LogLevel.WARN) {
            console.warn(this._formatMessage('WARN', message), ...args);
        }
    }

    /**
     * Log an error message
     */
    error(message, ...args) {
        if (this.level <= LogLevel.ERROR) {
            console.error(this._formatMessage('ERROR', message), ...args);
        }
    }
}