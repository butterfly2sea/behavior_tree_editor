/**
 * Dock Panel component
 * Manages the left sidebar with node palette and monitoring controls
 */

import {NODE_TYPES, getDefaultPropertiesForCategory, getDefaultConstraintsForCategory} from '../data/node-types.js';
import {editorEvents, EDITOR_EVENTS} from '../modules/events.js';
import {logger} from '../index.js';
import {clearElement} from '../utils/dom-utils.js';

export function initDockPanel(elements, state, renderer) {
    const stateManager = state;

    logger.debug('Initializing dock panel');

    // Initialize dock panel
    initNodeTreeView();
    initMonitorPanel();

    // Set up event listeners
    setupEventListeners();

    /**
     * Initialize the node tree view with categories and node types
     */
    function initNodeTreeView() {
        const {nodeTreeView} = elements;
        if (!nodeTreeView) return;

        // Clear existing tree view
        clearElement(nodeTreeView);

        // Get node types from the global NODE_TYPES object
        // This should be loaded from node-types.js
        if (!NODE_TYPES) {
            logger.error('NODE_TYPES not found. Make sure node-types.js is loaded.');
            return;
        }

        // Create category elements
        Object.keys(NODE_TYPES).forEach(category => {
            createCategoryInTreeView(category, nodeTreeView);
        });
    }

    /**
     * Create a category in the node tree view
     * @param {string} category - Category name
     * @param {HTMLElement} treeView - Tree view element
     */
    function createCategoryInTreeView(category, treeView) {
        const collapsedCategories = stateManager.getState().collapsedCategories;

        // Create category element
        const categoryEl = document.createElement('div');
        categoryEl.className = 'tree-category';
        categoryEl.id = `category-${category}`;

        // Format category name for display
        const categoryName = category.charAt(0).toUpperCase() + category.slice(1);

        // Create header
        const headerEl = document.createElement('div');
        headerEl.className = 'category-header';
        if (collapsedCategories[category]) {
            headerEl.classList.add('collapsed');
        }

        const toggleIcon = document.createElement('span');
        toggleIcon.className = 'toggle-icon fa fa-chevron-down';
        headerEl.appendChild(toggleIcon);

        const titleEl = document.createElement('span');
        titleEl.textContent = categoryName;
        headerEl.appendChild(titleEl);

        // Add click handler to toggle collapse
        headerEl.addEventListener('click', () => {
            headerEl.classList.toggle('collapsed');
            const items = categoryEl.querySelector('.category-items');
            items.classList.toggle('collapsed');

            // Update collapsed state in state
            stateManager.getState().collapsedCategories[category] =
                headerEl.classList.contains('collapsed');
        });

        categoryEl.appendChild(headerEl);

        // Create items container
        const itemsEl = document.createElement('div');
        itemsEl.className = 'category-items';
        if (collapsedCategories[category]) {
            itemsEl.classList.add('collapsed');
        }

        // Add built-in node types to this category
        if (NODE_TYPES[category]) {
            NODE_TYPES[category].forEach(nodeType => {
                createNodeItemElement(nodeType, category, itemsEl);
            });
        }

        // Add custom node types that belong to this category
        stateManager.getCustomNodeTypes().forEach(nodeType => {
            if (nodeType.category === category) {
                createNodeItemElement(nodeType, category, itemsEl);
            }
        });

        categoryEl.appendChild(itemsEl);
        treeView.appendChild(categoryEl);
    }

    /**
     * Create a node item element in the tree view
     * @param {Object} nodeType - Node type definition
     * @param {string} category - Category name
     * @param {HTMLElement} container - Container element
     */
    function createNodeItemElement(nodeType, category, container) {
        const nodeEl = document.createElement('div');
        nodeEl.className = `node-item ${category}`;
        nodeEl.setAttribute('data-type', nodeType.type);
        nodeEl.setAttribute('data-category', category);

        // Main content with drag functionality
        const contentEl = document.createElement('div');
        contentEl.textContent = nodeType.name;
        contentEl.draggable = true;
        contentEl.style.flex = '1';

        // Set both type and category in the dragstart event
        contentEl.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('nodeType', nodeType.type);
            e.dataTransfer.setData('nodeCategory', category);
        });

        nodeEl.appendChild(contentEl);

        // Add delete button for custom node types
        if (!nodeType.builtin) {
            const actionsEl = document.createElement('div');
            actionsEl.className = 'node-item-actions';

            const deleteEl = document.createElement('span');
            deleteEl.className = 'node-item-delete fa fa-trash';
            deleteEl.title = 'Delete custom node type';
            deleteEl.addEventListener('click', (e) => {
                e.stopPropagation();
                openNodeTypeContextMenu(e, nodeType.type);
            });

            actionsEl.appendChild(deleteEl);
            nodeEl.appendChild(actionsEl);
        }

        container.appendChild(nodeEl);
    }

    /**
     * Update the node tree view (e.g., after adding/removing custom node types)
     */
    function updateNodeTreeView() {
        initNodeTreeView();
    }

    /**
     * Initialize the monitor panel
     */
    function initMonitorPanel() {
        const {sseUrlInput, startMonitorBtn, stopMonitorBtn} = elements;

        // Set up monitoring buttons
        if (startMonitorBtn) {
            startMonitorBtn.addEventListener('click', startMonitoring);
        }

        if (stopMonitorBtn) {
            stopMonitorBtn.addEventListener('click', stopMonitoring);
        }
    }

    /**
     * Start monitoring the behavior tree execution
     */
    function startMonitoring() {
        const {sseUrlInput, monitorStatusIndicator, monitorStatusText, startMonitorBtn, stopMonitorBtn} = elements;

        if (stateManager.getState().monitor.active) return;

        const url = sseUrlInput ? sseUrlInput.value : '';
        if (!url) {
            logger.warn('No monitoring URL provided');
            alert('Please enter a valid monitoring URL');
            return;
        }

        try {
            const eventSource = new EventSource(url);

            // Update UI
            if (monitorStatusIndicator) {
                monitorStatusIndicator.classList.remove('disconnected');
                monitorStatusIndicator.classList.add('connected');
            }

            if (monitorStatusText) {
                monitorStatusText.textContent = 'Connected';
            }

            if (startMonitorBtn) startMonitorBtn.style.display = 'none';
            if (stopMonitorBtn) stopMonitorBtn.style.display = 'block';

            // Set up event handlers
            eventSource.onopen = function () {
                logger.info('Monitoring connection established');
            };

            eventSource.onmessage = function (event) {
                try {
                    const data = JSON.parse(event.data);
                    processMonitoringData(data);
                } catch (e) {
                    logger.error('Error parsing monitoring data:', e);
                }
            };

            eventSource.onerror = function (error) {
                logger.error('Monitoring connection error:', error);
                stopMonitoring();

                if (monitorStatusText) {
                    monitorStatusText.textContent = 'Connection Error';
                }
            };

            // Store the event source
            stateManager.getState().monitor.active = true;
            stateManager.getState().monitor.eventSource = eventSource;

            // Notify about monitoring start
            editorEvents.emit(EDITOR_EVENTS.MONITORING_STARTED);
        } catch (error) {
            logger.error('Failed to start monitoring:', error);
            alert('Failed to connect to the monitoring server');
        }
    }

    /**
     * Stop monitoring
     */
    function stopMonitoring() {
        const {monitorStatusIndicator, monitorStatusText, startMonitorBtn, stopMonitorBtn} = elements;

        if (!stateManager.getState().monitor.active) return;

        // Close the event source
        if (stateManager.getState().monitor.eventSource) {
            stateManager.getState().monitor.eventSource.close();
            stateManager.getState().monitor.eventSource = null;
        }

        // Update UI
        if (monitorStatusIndicator) {
            monitorStatusIndicator.classList.remove('connected');
            monitorStatusIndicator.classList.add('disconnected');
        }

        if (monitorStatusText) {
            monitorStatusText.textContent = 'Disconnected';
        }

        if (startMonitorBtn) startMonitorBtn.style.display = 'block';
        if (stopMonitorBtn) stopMonitorBtn.style.display = 'none';

        // Clear node states
        stateManager.getState().monitor.nodeStates = {};
        stateManager.getState().monitor.active = false;

        // Notify about monitoring stop
        editorEvents.emit(EDITOR_EVENTS.MONITORING_STOPPED);

        // Re-render nodes to clear status indicators
        renderer.requestRender(true);
    }

    /**
     * Process monitoring data received from the server
     * @param {Object} data - Monitoring data from server
     */
    function processMonitoringData(data) {
        if (!data || !Array.isArray(data.nodes)) return;

        // Clear previous states
        const nodeStates = {};

        // Process each node update
        data.nodes.forEach(nodeUpdate => {
            // Find the corresponding node in our editor by name
            const editorNode = stateManager.getNodes().find(n => n.name === nodeUpdate.name);
            if (editorNode) {
                // Map status from the server to our status classes
                let statusClass = 'idle';

                switch (nodeUpdate.status.toLowerCase()) {
                    case 'running':
                    case 'active':
                        statusClass = 'running';
                        break;
                    case 'success':
                        statusClass = 'success';
                        break;
                    case 'failure':
                        statusClass = 'failure';
                        break;
                    default:
                        statusClass = 'idle';
                }

                // Store the status
                nodeStates[editorNode.id] = statusClass;
            }
        });

        // Update the state
        stateManager.getState().monitor.nodeStates = nodeStates;

        // Request render update
        renderer.requestRender(true);
    }

    /**
     * Toggle the dock panel collapsed state
     */
    function toggleDockPanel() {
        const {dockPanel} = elements;
        if (!dockPanel) return;

        dockPanel.classList.toggle('collapsed');

        // Update the toggle button icon
        const toggleBtn = document.getElementById('toggle-dock-btn');
        if (toggleBtn) {
            const icon = toggleBtn.querySelector('i');
            if (icon) {
                if (dockPanel.classList.contains('collapsed')) {
                    icon.style.transform = 'rotate(180deg)';
                } else {
                    icon.style.transform = '';
                }
            }
        }
    }

    /**
     * Open context menu for a node type
     * @param {Event} e - Mouse event
     * @param {string} nodeType - Node type identifier
     */
    function openNodeTypeContextMenu(e, nodeType) {
        const {nodeTypeContextMenu} = elements;
        if (!nodeTypeContextMenu) return;

        e.preventDefault();

        // Position the context menu
        nodeTypeContextMenu.style.display = 'block';
        nodeTypeContextMenu.style.left = `${e.clientX}px`;
        nodeTypeContextMenu.style.top = `${e.clientY}px`;

        // Store the current node type
        nodeTypeContextMenu.setAttribute('data-node-type', nodeType);

        // Add one-time event listener to hide menu when clicking elsewhere
        setTimeout(() => {
            window.addEventListener('click', hideNodeTypeContextMenu, {once: true});
        }, 0);
    }

    /**
     * Hide the node type context menu
     */
    function hideNodeTypeContextMenu() {
        const {nodeTypeContextMenu} = elements;
        if (!nodeTypeContextMenu) return;

        nodeTypeContextMenu.style.display = 'none';
    }

    /**
     * Show the create node modal
     */
    function showCreateNodeModal() {
        const {createNodeModal} = elements;
        if (!createNodeModal) return;

        createNodeModal.style.display = 'block';
    }

    /**
     * Set up event listeners
     */
    function setupEventListeners() {
        // Toggle dock panel button
        const toggleDockBtn = document.getElementById('toggle-dock-btn');
        if (toggleDockBtn) {
            toggleDockBtn.addEventListener('click', toggleDockPanel);
        }

        // Add custom node button
        const addNodeBtn = document.getElementById('add-node-btn');
        if (addNodeBtn) {
            addNodeBtn.addEventListener('click', showCreateNodeModal);
        }

        // Create node form
        const createNodeForm = document.getElementById('create-node-form');
        if (createNodeForm) {
            createNodeForm.addEventListener('submit', handleCreateNodeSubmit);
        }

        // Modal close buttons
        const closeCreateModal = document.getElementById('close-create-modal');
        const cancelCreateNodeBtn = document.getElementById('cancel-create-node');

        if (closeCreateModal) {
            closeCreateModal.addEventListener('click', () => {
                const {createNodeModal} = elements;
                if (createNodeModal) createNodeModal.style.display = 'none';
            });
        }

        if (cancelCreateNodeBtn) {
            cancelCreateNodeBtn.addEventListener('click', () => {
                const {createNodeModal} = elements;
                if (createNodeModal) createNodeModal.style.display = 'none';
            });
        }

        // Listen for custom node type changes
        editorEvents.on(EDITOR_EVENTS.NODE_TYPE_ADDED, updateNodeTreeView);
        editorEvents.on(EDITOR_EVENTS.NODE_TYPE_REMOVED, updateNodeTreeView);

        // Listen for state loading
        editorEvents.on(EDITOR_EVENTS.STATE_LOADED, () => {
            updateNodeTreeView();

            // Stop monitoring if active
            if (stateManager.getState().monitor.active) {
                stopMonitoring();
            }
        });
    }

    /**
     * Handle the create node form submission
     * @param {Event} e - Form submit event
     */
    function handleCreateNodeSubmit(e) {
        e.preventDefault();

        const nameInput = document.getElementById('custom-node-name');
        const categorySelect = document.getElementById('custom-node-category');

        if (!nameInput || !categorySelect) return;

        const name = nameInput.value;
        const category = categorySelect.value;

        if (!name || !category) {
            alert('Name and category are required');
            return;
        }

        // Create a unique type identifier
        const type = `Custom_${name.replace(/\s+/g, '')}`;

        // Get default properties and constraints for the category
        const properties = window.getDefaultPropertiesForCategory ?
            window.getDefaultPropertiesForCategory(category) : [];

        const constraints = window.getDefaultConstraintsForCategory ?
            window.getDefaultConstraintsForCategory(category) : {
                maxChildren: null,
                canBeChildless: true
            };

        // Create new node type
        const newNodeType = {
            type,
            name,
            category,
            builtin: false,
            description: `Custom ${category} node`,
            properties,
            maxChildren: constraints.maxChildren,
            canBeChildless: constraints.canBeChildless
        };

        // Add to custom node types
        stateManager.addCustomNodeType(newNodeType);

        // Reset form and close modal
        nameInput.value = '';

        const {createNodeModal} = elements;
        if (createNodeModal) createNodeModal.style.display = 'none';

        logger.info(`Created custom node type: ${name} (${category})`);
    }

    // Return public API
    return {
        updateNodeTreeView,
        toggleDockPanel,
        startMonitoring,
        stopMonitoring,
        validateNodeProperty
    };
}

/**
 * Validate a node property value based on its type and constraints
 * @param {string|number|boolean} value - Property value to validate
 * @param {string} type - Property type (string, number, boolean, integer, etc)
 * @param {Object} constraints - Optional validation constraints
 * @returns {Object} - Validation result {valid: boolean, message: string}
 */
export function validateNodeProperty(value, type, constraints = {}) {
    // Handle empty values based on required constraint
    if ((value === undefined || value === null || value === '') && constraints.required) {
        return {
            valid: false,
            message: 'This field is required'
        };
    }

    // Empty non-required values are valid
    if (value === undefined || value === null || value === '') {
        return {valid: true, message: ''};
    }

    // Validate based on type
    switch (type) {
        case 'string':
            // Apply string validation
            if (typeof value !== 'string') {
                value = String(value);
            }

            // Check min length
            if (constraints.minLength !== undefined && value.length < constraints.minLength) {
                return {
                    valid: false,
                    message: `Must be at least ${constraints.minLength} characters`
                };
            }

            // Check max length
            if (constraints.maxLength !== undefined && value.length > constraints.maxLength) {
                return {
                    valid: false,
                    message: `Must be at most ${constraints.maxLength} characters`
                };
            }

            // Check pattern
            if (constraints.pattern && !new RegExp(constraints.pattern).test(value)) {
                return {
                    valid: false,
                    message: constraints.patternMessage || 'Invalid format'
                };
            }

            return {valid: true, message: ''};

        case 'number':
        case 'float':
            // Convert to number and check if valid
            const numValue = Number(value);
            if (isNaN(numValue) || !isFinite(numValue)) {
                return {
                    valid: false,
                    message: 'Must be a valid number'
                };
            }

            // Check min value
            if (constraints.min !== undefined && numValue < constraints.min) {
                return {
                    valid: false,
                    message: `Must be at least ${constraints.min}`
                };
            }

            // Check max value
            if (constraints.max !== undefined && numValue > constraints.max) {
                return {
                    valid: false,
                    message: `Must be at most ${constraints.max}`
                };
            }

            return {valid: true, message: ''};

        case 'integer':
            // Convert to number and check if integer
            const intValue = Number(value);
            if (isNaN(intValue) || !Number.isInteger(intValue)) {
                return {
                    valid: false,
                    message: 'Must be a valid integer'
                };
            }

            // Check min value
            if (constraints.min !== undefined && intValue < constraints.min) {
                return {
                    valid: false,
                    message: `Must be at least ${constraints.min}`
                };
            }

            // Check max value
            if (constraints.max !== undefined && intValue > constraints.max) {
                return {
                    valid: false,
                    message: `Must be at most ${constraints.max}`
                };
            }

            return {valid: true, message: ''};

        case 'boolean':
            // Check if value is a valid boolean
            if (value === true || value === false) {
                return {valid: true, message: ''};
            }

            if (value === 'true' || value === 'false') {
                return {valid: true, message: ''};
            }

            return {
                valid: false,
                message: 'Must be true or false'
            };

        case 'enum':
            // Check if value is in allowed values
            if (constraints.values && !constraints.values.includes(value)) {
                return {
                    valid: false,
                    message: `Must be one of: ${constraints.values.join(', ')}`
                };
            }

            return {valid: true, message: ''};

        default:
            // For unknown types, assume it's valid
            return {valid: true, message: ''};
    }
}