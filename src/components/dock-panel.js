/**
 * Dock Panel Component - Manages the node palette and tree view
 */
import {eventBus, EVENTS} from '../core/events.js';
import {logger} from '../utils/logger.js';
import {setupNodeItemDraggable} from '../utils/drag.js';
import {createElement, clearElement} from '../utils/dom.js';
import {NODE_TYPES, getNodeDefinition} from "../data/node-types.js";

export function initDockPanel(elements, state, nodesModule) {
    const stateManager = state;

    /**
     * Initialize the node tree view with categories and node types
     */
    function initNodeTreeView() {
        const {nodeTreeView} = elements;
        if (!nodeTreeView) return;

        // Clear existing tree view
        clearElement(nodeTreeView);

        // Get node types from the global NODE_TYPES object
        if (!NODE_TYPES) {
            logger.error('NODE_TYPES not found');
            return;
        }

        // Create category sections
        Object.keys(NODE_TYPES).forEach(category => {
            createCategoryInTreeView(category, nodeTreeView);
        });
    }

    /**
     * Create a category section in the tree view
     */
    function createCategoryInTreeView(category, treeView) {
        const collapsedCategories = stateManager.getState().collapsedCategories;
        const isCollapsed = collapsedCategories[category] || false;

        // Format category name for display
        const categoryName = category.charAt(0).toUpperCase() + category.slice(1);

        // Create category container
        const categoryEl = createElement('div', {
            className: 'tree-category',
            id: `category-${category}`
        });

        // Create header with toggle
        const headerEl = createElement('div', {
            className: `category-header ${isCollapsed ? 'collapsed' : ''}`,
            onclick: () => toggleCategory(category, headerEl, itemsEl)
        }, [
            createElement('span', {className: 'toggle-icon icon-chevron-down'}),
            createElement('span', {}, categoryName)
        ]);

        // Create items container
        const itemsEl = createElement('div', {
            className: `category-items ${isCollapsed ? 'collapsed' : ''}`
        });

        // Add built-in node types
        if (NODE_TYPES[category]) {
            NODE_TYPES[category].forEach(nodeType => {
                createNodeItemElement(nodeType, category, itemsEl);
            });
        }

        // Add custom node types for this category
        stateManager.getCustomNodeTypes().forEach(nodeType => {
            if (nodeType.category === category) {
                createNodeItemElement(nodeType, category, itemsEl);
            }
        });

        // Assemble category
        categoryEl.appendChild(headerEl);
        categoryEl.appendChild(itemsEl);
        treeView.appendChild(categoryEl);
    }

    /**
     * Toggle category collapse state
     */
    function toggleCategory(category, headerEl, itemsEl) {
        headerEl.classList.toggle('collapsed');
        itemsEl.classList.toggle('collapsed');

        // Update state
        stateManager.toggleCategoryCollapse(category);
    }

    /**
     * Create a node item element in the tree view
     */
    function createNodeItemElement(nodeType, category, container) {
        // Create node item element
        const nodeEl = createElement('div', {
            className: `node-item ${category}`,
            dataset: {
                type: nodeType.type,
                category: category
            }
        });

        // Add node name
        const contentEl = createElement('div', {
            style: {flex: '1'}
        }, nodeType.name);
        nodeEl.appendChild(contentEl);

        // Add delete button for custom nodes
        if (!nodeType.builtin) {
            const actionsEl = createElement('div', {
                className: 'node-item-actions'
            });

            const deleteEl = createElement('span', {
                className: 'node-item-delete icon-trash',
                title: 'Delete custom node type',
                onclick: (e) => {
                    e.stopPropagation();
                    if (confirm(`Delete custom node type "${nodeType.name}"?`)) {
                        stateManager.removeCustomNodeType(nodeType.type);
                    }
                }
            });

            actionsEl.appendChild(deleteEl);
            nodeEl.appendChild(actionsEl);
        }

        // Set up draggable behavior
        setupNodeItemDraggable(nodeEl);

        // Add to container
        container.appendChild(nodeEl);
    }

    /**
     * Toggle the dock panel collapsed state
     */
    function toggleDockPanel() {
        const {dockPanel} = elements;
        if (!dockPanel) return;

        dockPanel.classList.toggle('collapsed');

        // Update toggle button icon
        const toggleBtn = document.getElementById('toggle-dock-btn');
        if (toggleBtn) {
            const icon = toggleBtn.querySelector('i');
            if (icon) {
                icon.style.transform = dockPanel.classList.contains('collapsed') ? 'rotate(180deg)' : '';
            }
        }
    }

    /**
     * Show the create node modal
     */
    function showCreateNodeModal() {
        const {createNodeModal} = elements;
        if (createNodeModal) {
            createNodeModal.style.display = 'block';
        }
    }

    /**
     * Handle the create node form submission
     */
    function handleCreateNodeSubmit(e) {
        e.preventDefault();

        const nameInput = document.getElementById('custom-node-name');
        const categorySelect = document.getElementById('custom-node-category');

        if (!nameInput || !categorySelect) return;

        const name = nameInput.value.trim();
        const category = categorySelect.value;

        if (!name || !category) {
            alert('Name and category are required');
            return;
        }

        // Create a unique type identifier
        const type = `Custom_${name.replace(/\s+/g, '')}`;

        // Get default properties and constraints
        const {getDefaultPropertiesForCategory, getDefaultConstraintsForCategory} = window;

        const properties = getDefaultPropertiesForCategory ?
            getDefaultPropertiesForCategory(category) : [];

        const constraints = getDefaultConstraintsForCategory ?
            getDefaultConstraintsForCategory(category) : {
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

        // Listen for node type events
        eventBus.on(EVENTS.NODE_CHANGED, (data) => {
            if (data.type === 'type-added' || data.type === 'type-removed') {
                initNodeTreeView();
            }
        });

        // Listen for state loading
        eventBus.on(EVENTS.STATE_LOADED, () => {
            initNodeTreeView();
        });
    }

    // Initialize
    initNodeTreeView();
    setupEventListeners();

    // Return public API
    return {
        initNodeTreeView,
        toggleDockPanel
    };
}