/**
 * DOM Utilities
 * Helper functions for DOM manipulation
 */

import {logger} from '../index.js';

/**
 * Create an HTML element with attributes, properties, and children
 * @param {string} tagName - HTML tag name
 * @param {Object} options - Element options (attributes, properties, event handlers)
 * @param {Array|string} children - Child elements or text content
 * @returns {HTMLElement} - Created element
 */
export function createElement(tagName, options = {}, children = []) {
    const element = document.createElement(tagName);

    // Set attributes and properties
    Object.entries(options).forEach(([key, value]) => {
        if (key.startsWith('on') && typeof value === 'function') {
            // Event handler
            const eventName = key.slice(2).toLowerCase();
            element.addEventListener(eventName, value);
        } else if (key === 'style' && typeof value === 'object') {
            // Style object
            Object.assign(element.style, value);
        } else if (key === 'className') {
            // Class name(s)
            element.className = value;
        } else if (key === 'dataset' && typeof value === 'object') {
            // Data attributes
            Object.entries(value).forEach(([dataKey, dataValue]) => {
                element.dataset[dataKey] = dataValue;
            });
        } else {
            // Regular attribute
            element.setAttribute(key, value);
        }
    });

    // Add children
    if (Array.isArray(children)) {
        children.forEach(child => {
            if (child instanceof Node) {
                element.appendChild(child);
            } else if (child !== null && child !== undefined) {
                element.appendChild(document.createTextNode(String(child)));
            }
        });
    } else if (children !== null && children !== undefined) {
        element.textContent = String(children);
    }

    return element;
}

/**
 * Create an SVG element with attributes
 * @param {string} tagName - SVG tag name
 * @param {Object} attributes - Element attributes
 * @returns {SVGElement} - Created SVG element
 */
export function createSvgElement(tagName, attributes = {}) {
    const element = document.createElementNS('http://www.w3.org/2000/svg', tagName);

    // Set attributes
    Object.entries(attributes).forEach(([key, value]) => {
        element.setAttribute(key, value);
    });

    return element;
}

/**
 * Remove all children from an element
 * @param {HTMLElement} element - Element to clear
 */
export function clearElement(element) {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
}

/**
 * Show a modal dialog
 * @param {string} modalId - ID of the modal element
 */
export function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';
    } else {
        logger.warn(`Modal not found: ${modalId}`);
    }
}

/**
 * Hide a modal dialog
 * @param {string} modalId - ID of the modal element
 */
export function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

/**
 * Create a button element
 * @param {string} text - Button text
 * @param {Function} onClick - Click handler
 * @param {Object} options - Additional options
 * @returns {HTMLButtonElement} - Created button
 */
export function createButton(text, onClick, options = {}) {
    return createElement('button', {
        ...options,
        onClick
    }, text);
}

/**
 * Create a tooltip element
 * @param {HTMLElement} targetElement - Element to attach tooltip to
 * @param {string} text - Tooltip text
 * @param {Object} options - Additional options
 * @returns {HTMLElement} - Created tooltip element
 */
export function createTooltip(targetElement, text, options = {}) {
    const position = options.position || 'bottom';
    const className = options.className || '';

    // Create tooltip element
    const tooltip = createElement('div', {
        className: `tooltip tooltip-${position} ${className}`,
        style: {
            position: 'absolute',
            display: 'none',
            zIndex: '1000',
            padding: '5px 10px',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: '#fff',
            borderRadius: '4px',
            fontSize: '12px',
            pointerEvents: 'none'
        }
    }, text);

    document.body.appendChild(tooltip);

    // Position the tooltip
    function positionTooltip() {
        const targetRect = targetElement.getBoundingClientRect();

        switch (position) {
            case 'top':
                tooltip.style.left = `${targetRect.left + targetRect.width / 2 - tooltip.offsetWidth / 2}px`;
                tooltip.style.top = `${targetRect.top - tooltip.offsetHeight - 5}px`;
                break;

            case 'bottom':
                tooltip.style.left = `${targetRect.left + targetRect.width / 2 - tooltip.offsetWidth / 2}px`;
                tooltip.style.top = `${targetRect.bottom + 5}px`;
                break;

            case 'left':
                tooltip.style.left = `${targetRect.left - tooltip.offsetWidth - 5}px`;
                tooltip.style.top = `${targetRect.top + targetRect.height / 2 - tooltip.offsetHeight / 2}px`;
                break;

            case 'right':
                tooltip.style.left = `${targetRect.right + 5}px`;
                tooltip.style.top = `${targetRect.top + targetRect.height / 2 - tooltip.offsetHeight / 2}px`;
                break;
        }
    }

    // Show/hide tooltip on hover
    targetElement.addEventListener('mouseenter', () => {
        tooltip.style.display = 'block';
        positionTooltip();
    });

    targetElement.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
    });

    // Update position on window resize
    window.addEventListener('resize', () => {
        if (tooltip.style.display === 'block') {
            positionTooltip();
        }
    });

    return tooltip;
}

/**
 * Create a notification toast
 * @param {string} message - Notification message
 * @param {string} type - Notification type ('info', 'success', 'warning', 'error')
 * @param {number} duration - Duration in milliseconds
 * @returns {HTMLElement} - Created notification element
 */
export function createNotification(message, type = 'info', duration = 3000) {
    // Create notification container if it doesn't exist
    let container = document.getElementById('notification-container');
    if (!container) {
        container = createElement('div', {
            id: 'notification-container',
            style: {
                position: 'fixed',
                top: '20px',
                right: '20px',
                zIndex: '9999'
            }
        });
        document.body.appendChild(container);
    }

    // Icon based on type
    let icon;
    switch (type) {
        case 'success':
            icon = '✓';
            break;
        case 'warning':
            icon = '⚠';
            break;
        case 'error':
            icon = '✗';
            break;
        default:
            icon = 'ℹ';
    }

    // Create notification element
    const notification = createElement('div', {
        className: `notification notification-${type}`,
        style: {
            display: 'flex',
            alignItems: 'center',
            padding: '12px 15px',
            marginBottom: '10px',
            backgroundColor: 'white',
            borderLeft: type === 'info' ? '4px solid #2196F3' :
                type === 'success' ? '4px solid #4CAF50' :
                    type === 'warning' ? '4px solid #FF9800' : '4px solid #F44336',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            borderRadius: '4px',
            opacity: '0',
            transition: 'opacity 0.3s ease',
            maxWidth: '300px'
        }
    }, [
        createElement('div', {
            className: 'notification-icon',
            style: {
                marginRight: '10px',
                fontSize: '20px'
            }
        }, icon),
        createElement('div', {
            className: 'notification-message',
            style: {
                flex: '1'
            }
        }, message),
        createElement('div', {
            className: 'notification-close',
            style: {
                marginLeft: '10px',
                cursor: 'pointer',
                opacity: '0.5'
            },
            onClick: () => closeNotification(notification)
        }, '×')
    ]);

    // Add to container
    container.appendChild(notification);

    // Animate in
    setTimeout(() => {
        notification.style.opacity = '1';
    }, 10);

    // Auto-close after duration
    if (duration > 0) {
        setTimeout(() => {
            closeNotification(notification);
        }, duration);
    }

    return notification;
}

/**
 * Close a notification
 * @param {HTMLElement} notification - Notification element
 */
function closeNotification(notification) {
    notification.style.opacity = '0';

    setTimeout(() => {
        notification.remove();
    }, 300);
}

/**
 * Create a confirmation dialog
 * @param {string} message - Confirmation message
 * @param {Object} options - Dialog options
 * @returns {Promise} - Resolves with boolean (true if confirmed)
 */
export function confirm(message, options = {}) {
    return new Promise(resolve => {
        const confirmTitle = options.title || 'Confirm';
        const confirmText = options.confirmText || 'OK';
        const cancelText = options.cancelText || 'Cancel';
        const confirmClass = options.confirmClass || 'primary';

        // Create modal background
        const modal = createElement('div', {
            className: 'confirm-modal',
            style: {
                position: 'fixed',
                top: '0',
                left: '0',
                width: '100%',
                height: '100%',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: '10000'
            }
        });

        // Create dialog
        const dialog = createElement('div', {
            className: 'confirm-dialog',
            style: {
                backgroundColor: 'white',
                borderRadius: '4px',
                maxWidth: '400px',
                width: '100%',
                padding: '20px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)'
            }
        });

        // Title
        const titleEl = createElement('h3', {
            style: {
                margin: '0 0 15px 0',
                fontSize: '18px'
            }
        }, confirmTitle);

        // Message
        const messageEl = createElement('p', {
            style: {
                margin: '0 0 20px 0',
                fontSize: '14px'
            }
        }, message);

        // Buttons
        const buttonsContainer = createElement('div', {
            style: {
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px'
            }
        });

        // Cancel button
        const cancelBtn = createElement('button', {
            className: 'confirm-cancel',
            style: {
                padding: '8px 12px',
                backgroundColor: '#f5f5f5',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer'
            },
            onClick: () => {
                modal.remove();
                resolve(false);
            }
        }, cancelText);

        // Confirm button
        const confirmBtn = createElement('button', {
            className: `confirm-ok confirm-${confirmClass}`,
            style: {
                padding: '8px 12px',
                backgroundColor: confirmClass === 'danger' ? '#f44336' : '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
            },
            onClick: () => {
                modal.remove();
                resolve(true);
            }
        }, confirmText);

        // Add to DOM
        buttonsContainer.appendChild(cancelBtn);
        buttonsContainer.appendChild(confirmBtn);

        dialog.appendChild(titleEl);
        dialog.appendChild(messageEl);
        dialog.appendChild(buttonsContainer);

        modal.appendChild(dialog);
        document.body.appendChild(modal);

        // Focus confirm button
        confirmBtn.focus();

        // Close on ESC key
        document.addEventListener('keydown', function closeOnEsc(e) {
            if (e.key === 'Escape') {
                document.removeEventListener('keydown', closeOnEsc);
                modal.remove();
                resolve(false);
            }
        });
    });
}

/**
 * Create a context menu
 * @param {HTMLElement} targetElement - Element to attach menu to
 * @param {Array} items - Menu items {label, action, disabled, separator}
 * @returns {Object} - Context menu controller
 */
export function createContextMenu(targetElement, items) {
    let menu = null;

    // Event listener for showing the menu
    targetElement.addEventListener('contextmenu', (e) => {
        e.preventDefault();

        // Remove existing menu if any
        if (menu) {
            menu.remove();
        }

        // Create menu element
        menu = createElement('div', {
            className: 'context-menu',
            style: {
                position: 'absolute',
                left: `${e.clientX}px`,
                top: `${e.clientY}px`,
                backgroundColor: 'white',
                border: '1px solid #ddd',
                borderRadius: '4px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                zIndex: '10000',
                minWidth: '150px'
            }
        });

        // Create menu list
        const menuList = createElement('ul', {
            style: {
                listStyle: 'none',
                margin: '0',
                padding: '0'
            }
        });

        // Add items
        items.forEach(item => {
            if (item.separator) {
                // Add separator
                const separator = createElement('li', {
                    className: 'context-menu-separator',
                    style: {
                        height: '1px',
                        backgroundColor: '#ddd',
                        margin: '5px 0'
                    }
                });
                menuList.appendChild(separator);
            } else {
                // Add menu item
                const menuItem = createElement('li', {
                    className: `context-menu-item ${item.disabled ? 'disabled' : ''}`,
                    style: {
                        padding: '8px 12px',
                        cursor: item.disabled ? 'default' : 'pointer',
                        opacity: item.disabled ? '0.5' : '1'
                    }
                }, item.label);

                // Add click handler
                if (!item.disabled && item.action) {
                    menuItem.addEventListener('click', () => {
                        menu.remove();
                        item.action();
                    });

                    // Hover effect
                    menuItem.addEventListener('mouseenter', () => {
                        menuItem.style.backgroundColor = '#f5f5f5';
                    });

                    menuItem.addEventListener('mouseleave', () => {
                        menuItem.style.backgroundColor = '';
                    });
                }

                menuList.appendChild(menuItem);
            }
        });

        menu.appendChild(menuList);
        document.body.appendChild(menu);

        // Close menu when clicking outside
        setTimeout(() => {
            document.addEventListener('click', documentClickHandler);
        }, 0);

        // Adjust menu position if it goes outside viewport
        adjustMenuPosition(menu);
    });

    // Document click handler for closing menu
    function documentClickHandler() {
        if (menu) {
            menu.remove();
            menu = null;
        }
        document.removeEventListener('click', documentClickHandler);
    }

    // Adjust menu position to keep it in viewport
    function adjustMenuPosition(menuElement) {
        const rect = menuElement.getBoundingClientRect();

        // Check right edge
        if (rect.right > window.innerWidth) {
            menuElement.style.left = `${window.innerWidth - rect.width - 10}px`;
        }

        // Check bottom edge
        if (rect.bottom > window.innerHeight) {
            menuElement.style.top = `${window.innerHeight - rect.height - 10}px`;
        }
    }

    // Return controller
    return {
        updateItems(newItems) {
            items = newItems;
        }
    };
}

/**
 * Escape HTML special characters
 * @param {string} str - String to escape
 * @returns {string} - Escaped string
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