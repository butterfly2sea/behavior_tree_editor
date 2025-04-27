/**
 * Dock Panel Component
 */
import {eventBus, EVENTS} from '../core/events.js';
import {logger} from '../utils/logger.js';
import {setupNodeItemDraggable} from '../utils/drag.js';

export function initDockPanel(elements, state, nodesModule) {
    const stateManager = state;

    /**
     * Initialize the node tree view
     */
    function initNodeTreeView() {
        const {nodeTreeView} = elements;
        if (!nodeTreeView) return;

        // Clear existing tree view
        nodeTreeView.innerHTML = '';

        // Get node types from the global NODE_TYPES object
        if (!window.NODE_TYPES) {
            logger.error('NODE_TYPES not found');
            return;
        }

        // Create category sections
        Object.keys(window.NODE_TYPES).forEach(category => {
            createCategoryInTreeView(category, nodeTreeView);
        });
    }

    /**
     * Create a category in the node tree view
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
        toggleIcon.className = 'toggle-icon icon-chevron-down';
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
            stateManager.toggleCategoryCollapse(category);
        });

        categoryEl.appendChild(headerEl);

        // Create items container
        const itemsEl = document.createElement('div');
        itemsEl.className = 'category-items';
        if (collapsedCategories[category]) {
            itemsEl.classList.add('collapsed');
        }

        // Add node types to this category
        if (window.NODE_TYPES[category]) {
            window.NODE_TYPES[category].forEach(nodeType => {
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
     */
    function createNodeItemElement(nodeType, category, container) {
        const nodeEl = document.createElement('div');
        nodeEl.className = `node-item ${category}`;
        nodeEl.setAttribute('data-type', nodeType.type);
        nodeEl.setAttribute('data-category', category);

        // Main content
        const contentEl = document.createElement('div');
        contentEl.textContent = nodeType.name;
        contentEl.style.flex = '1';
        nodeEl.appendChild(contentEl);

        // Add delete button for custom node types
        if (!nodeType.builtin) {
            const actionsEl = document.createElement('div');
            actionsEl.className = 'node-item-actions';

            const deleteEl = document.createElement('span');
            deleteEl.className = 'node-item-delete icon-trash';
            deleteEl.title = 'Delete custom node type';
            deleteEl.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`Delete custom node type "${nodeType.name}"?`)) {
                    stateManager.removeCustomNodeType(nodeType.type);
                }
            });

            actionsEl.appendChild(deleteEl);
            nodeEl.appendChild(actionsEl);
        }

        // Set up drag and drop
        setupNodeItemDraggable(nodeEl);

        container.appendChild(nodeEl);
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

    // Initialize
    initNodeTreeView();
    setupEventListeners();

    // Return public API
    return {
        initNodeTreeView,
        toggleDockPanel
    };
}