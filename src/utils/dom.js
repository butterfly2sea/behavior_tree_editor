/**
 * DOM Utilities - Modern DOM API implementations
 */

/**
 * Create an HTML element with attributes and properties
 * @param {string} tagName - HTML tag name
 * @param {Object} attributes - Element attributes and properties
 * @param {Array|Node|string} children - Child elements or text content
 * @returns {HTMLElement} - Created element
 */
export function createElement(tagName, attributes = {}, children = []) {
    const element = document.createElement(tagName);

    // Add attributes and properties
    Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'className') {
            element.className = value;
        } else if (key === 'style' && typeof value === 'object') {
            Object.assign(element.style, value);
        } else if (key.startsWith('on') && typeof value === 'function') {
            const eventName = key.slice(2).toLowerCase();
            element.addEventListener(eventName, value);
        } else if (key === 'dataset' && typeof value === 'object') {
            Object.entries(value).forEach(([dataKey, dataValue]) => {
                element.dataset[dataKey] = dataValue;
            });
        } else {
            element.setAttribute(key, value);
        }
    });

    // Add children
    if (Array.isArray(children)) {
        children.forEach(child => {
            if (child instanceof Node) {
                element.appendChild(child);
            } else if (child != null) {
                element.appendChild(document.createTextNode(String(child)));
            }
        });
    } else if (children instanceof Node) {
        element.appendChild(children);
    } else if (children != null) {
        element.textContent = String(children);
    }

    return element;
}

/**
 * Create an SVG element with namespace
 * @param {string} tagName - SVG tag name
 * @param {Object} attributes - Element attributes
 * @returns {SVGElement} - Created SVG element
 */
export function createSvgElement(tagName, attributes = {}) {
    const element = document.createElementNS('http://www.w3.org/2000/svg', tagName);

    // Add attributes
    Object.entries(attributes).forEach(([key, value]) => {
        element.setAttribute(key, value);
    });

    return element;
}

/**
 * Clear all children from an element
 * @param {HTMLElement} element - Element to clear
 */
export function clearElement(element) {
    element.innerHTML = '';
}

/**
 * Get element position relative to the document
 * @param {HTMLElement} element - Element to get position for
 * @returns {Object} - Position object {x, y, width, height}
 */
export function getElementPosition(element) {
    const rect = element.getBoundingClientRect();
    const scrollLeft = window.scrollX || document.documentElement.scrollLeft;
    const scrollTop = window.scrollY || document.documentElement.scrollTop;

    return {
        x: rect.left + scrollLeft,
        y: rect.top + scrollTop,
        width: rect.width,
        height: rect.height
    };
}

/**
 * Check if point is inside element
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {HTMLElement} element - Element to check
 * @returns {boolean} - True if point is inside element
 */
export function isPointInElement(x, y, element) {
    const rect = element.getBoundingClientRect();
    return (
        x >= rect.left &&
        x <= rect.right &&
        y >= rect.top &&
        y <= rect.bottom
    );
}

/**
 * Create a tooltip on an element using the title attribute
 * @param {HTMLElement} element - Element to add tooltip to
 * @param {string} text - Tooltip text
 */
export function createTooltip(element, text) {
    element.setAttribute('title', text);
}

/**
 * Escape HTML special characters
 * @param {string} str - String to escape
 * @returns {string} - Escaped string
 */
export function escapeHtml(str) {
    if (str === undefined || str === null) return '';

    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Add multiple event listeners to an element
 * @param {HTMLElement} element - Element to add listeners to
 * @param {Object} events - Object with event names as keys and handlers as values
 * @returns {Function} - Function to remove all listeners
 */
export function addEventListeners(element, events) {
    const handlers = [];

    Object.entries(events).forEach(([event, handler]) => {
        element.addEventListener(event, handler);
        handlers.push({event, handler});
    });

    // Return function to remove all listeners
    return () => {
        handlers.forEach(({event, handler}) => {
            element.removeEventListener(event, handler);
        });
    };
}