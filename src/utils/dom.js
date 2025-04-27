/**
 * DOM Utilities
 */

/**
 * Create an HTML element with attributes and properties
 * @param {string} tagName - HTML tag name
 * @param {Object} attributes - Element attributes and properties
 * @param {Array|string} children - Child elements or text content
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
    } else if (children != null) {
        element.textContent = String(children);
    }

    return element;
}

/**
 * Create an SVG element
 * @param {string} tagName - SVG tag name
 * @param {Object} attributes - Element attributes
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
 */
export function clearElement(element) {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
}

/**
 * Get element position relative to the document
 */
export function getElementPosition(element) {
    const rect = element.getBoundingClientRect();
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    return {
        x: rect.left + scrollLeft,
        y: rect.top + scrollTop,
        width: rect.width,
        height: rect.height
    };
}

/**
 * Check if point is inside element
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
 * Create a tooltip on an element
 */
export function createTooltip(element, text) {
    element.setAttribute('title', text);

    // Could be enhanced with custom tooltip implementation
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(str) {
    if (str === undefined || str === null) return '';

    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}