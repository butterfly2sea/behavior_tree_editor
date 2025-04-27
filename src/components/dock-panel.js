/**
 * Dock Panel Component - Manages the node palette and tree view
 */
import {eventBus, EVENTS} from '../core/events.js';
import {logger} from '../utils/logger.js';
import {setupNodeItemDraggable} from '../utils/drag.js';
import {createElement, clearElement} from '../utils/dom.js';
import {
    NODE_TYPES,
    getDefaultPropertiesForCategory,
    getDefaultConstraintsForCategory
} from "../data/node-types.js";

export function initDockPanel(elements, state, nodesModule) {
    const stateManager = state;
    let currentNodeProperties = [];

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
                className: 'node-item-actions',
                style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                }
            });

            // 创建删除按钮 - 添加更多视觉反馈和确认
            const deleteEl = createElement('button', {
                className: 'node-delete-btn',
                title: '删除自定义节点类型',
                style: {
                    background: 'transparent',
                    border: 'none',
                    color: 'red',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                },
                onclick: (e) => {
                    e.stopPropagation(); // 阻止事件冒泡

                    // 显示自定义确认对话框而不是使用原生confirm
                    const confirmDialog = document.createElement('div');
                    confirmDialog.className = 'confirm-dialog';
                    confirmDialog.style = `
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: white;
          padding: 20px;
          border-radius: 5px;
          box-shadow: 0 0 10px rgba(0,0,0,0.3);
          z-index: 1000;
        `;

                    confirmDialog.innerHTML = `
          <h3>确认删除</h3>
          <p>确定要删除自定义节点类型 "${nodeType.name}" 吗？</p>
          <div class="confirm-buttons" style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 15px;">
            <button id="cancel-delete">取消</button>
            <button id="confirm-delete" style="background: #f44336; color: white; border: none; padding: 5px 10px;">删除</button>
          </div>
        `;

                    document.body.appendChild(confirmDialog);

                    // 绑定确认对话框按钮事件
                    document.getElementById('cancel-delete').addEventListener('click', () => {
                        document.body.removeChild(confirmDialog);
                    });

                    document.getElementById('confirm-delete').addEventListener('click', () => {
                        // 执行删除操作
                        stateManager.removeCustomNodeType(nodeType.type);
                        document.body.removeChild(confirmDialog);
                    });
                }
            });

            // 添加删除图标到按钮
            const iconSpan = createElement('span', {
                className: 'icon-trash',
                style: {
                    width: '16px',
                    height: '16px'
                }
            });
            deleteEl.appendChild(iconSpan);

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

        const properties = getDefaultPropertiesForCategory(category);

        const constraints = getDefaultConstraintsForCategory(category);

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
     * 设置事件监听器
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
        // 添加属性相关的事件处理
        const closePropertyModal = document.getElementById('close-property-modal');
        const cancelAddProperty = document.getElementById('cancel-add-property');

        if (closePropertyModal) {
            closePropertyModal.addEventListener('click', () => {
                const modal = document.getElementById('add-property-modal');
                if (modal) modal.style.display = 'none';
            });
        }

        if (cancelAddProperty) {
            cancelAddProperty.addEventListener('click', () => {
                const modal = document.getElementById('add-property-modal');
                if (modal) modal.style.display = 'none';
            });
        }
    }

    /**
     * 初始化创建节点模态框
     */
    function initCreateNodeModal() {
        const createNodeForm = document.getElementById('create-node-form');
        const categorySelect = document.getElementById('custom-node-category');
        const propertiesContainer = document.getElementById('node-properties-container');
        const addPropertyBtn = document.getElementById('add-property-btn');

        // 当类别变化时，显示默认属性
        if (categorySelect) {
            categorySelect.addEventListener('change', () => {
                const category = categorySelect.value;
                loadDefaultProperties(category);
            });
        }

        // 添加属性按钮
        if (addPropertyBtn) {
            addPropertyBtn.addEventListener('click', showAddPropertyModal);
        }

        // 创建节点表单提交
        if (createNodeForm) {
            createNodeForm.addEventListener('submit', (e) => {
                e.preventDefault();

                const nameInput = document.getElementById('custom-node-name');
                const categorySelect = document.getElementById('custom-node-category');
                const descriptionInput = document.getElementById('custom-node-description');

                if (!nameInput || !categorySelect) return;

                const name = nameInput.value.trim();
                const category = categorySelect.value;
                const description = descriptionInput ? descriptionInput.value.trim() : '';

                if (!name || !category) {
                    alert('名称和类别是必填项');
                    return;
                }

                // 创建唯一类型标识符
                const type = `Custom_${name.replace(/\s+/g, '')}`;

                // 获取约束
                const constraints = getDefaultConstraintsForCategory(category);

                // 创建新的节点类型
                const newNodeType = {
                    type,
                    name,
                    category,
                    builtin: false,
                    description: description || `自定义${category}节点`,
                    properties: currentNodeProperties,
                    maxChildren: constraints.maxChildren,
                    canBeChildless: constraints.canBeChildless
                };

                // 添加到自定义节点类型
                stateManager.addCustomNodeType(newNodeType);

                // 重置表单并关闭模态框
                nameInput.value = '';
                if (descriptionInput) descriptionInput.value = '';
                currentNodeProperties = [];
                updatePropertiesList();

                const {createNodeModal} = elements;
                if (createNodeModal) createNodeModal.style.display = 'none';

                logger.info(`创建了自定义节点类型: ${name} (${category})`);
            });
        }

        // 初始加载默认属性
        if (categorySelect) {
            loadDefaultProperties(categorySelect.value);
        }
    }

    /**
     * 加载分类的默认属性
     */
    function loadDefaultProperties(category) {
        currentNodeProperties = [];

        // 根据类别获取默认属性
        const defaultProperties = getDefaultPropertiesForCategory(category);
        if (defaultProperties && defaultProperties.length > 0) {
            currentNodeProperties = [...defaultProperties];
        }

        // 更新属性列表UI
        updatePropertiesList();
    }

    /**
     * 更新属性列表显示
     */
    function updatePropertiesList() {
        const container = document.getElementById('node-properties-container');
        if (!container) return;

        // 清空容器
        container.innerHTML = '';

        if (currentNodeProperties.length === 0) {
            container.innerHTML = '<p>没有属性。点击"添加属性"按钮添加。</p>';
            return;
        }

        // 创建属性列表
        const table = document.createElement('table');
        table.className = 'properties-table';
        table.innerHTML = `
      <thead>
        <tr>
          <th>名称</th>
          <th>类型</th>
          <th>默认值</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

        const tbody = table.querySelector('tbody');

        // 添加每个属性
        currentNodeProperties.forEach((prop, index) => {
            const row = document.createElement('tr');

            row.innerHTML = `
        <td>${prop.name}</td>
        <td>${prop.type}</td>
        <td>${prop.default || ''}</td>
        <td>
          <button type="button" class="edit-prop-btn" data-index="${index}">编辑</button>
          <button type="button" class="delete-prop-btn" data-index="${index}">删除</button>
        </td>
      `;

            tbody.appendChild(row);
        });

        container.appendChild(table);

        // 绑定编辑和删除按钮事件
        container.querySelectorAll('.edit-prop-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                editProperty(index);
            });
        });

        container.querySelectorAll('.delete-prop-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                deleteProperty(index);
            });
        });
    }

    /**
     * 显示添加属性模态框
     */
    function showAddPropertyModal() {
        const modal = document.getElementById('add-property-modal');
        if (modal) {
            // 重置表单
            const form = document.getElementById('add-property-form');
            if (form) form.reset();

            modal.style.display = 'block';

            // 设置表单提交事件
            form.onsubmit = (e) => {
                e.preventDefault();

                const name = document.getElementById('property-name').value.trim();
                const type = document.getElementById('property-type').value;
                const defaultValue = document.getElementById('property-default').value.trim();
                const description = document.getElementById('property-description').value.trim();

                if (!name) {
                    alert('属性名是必填项');
                    return;
                }

                // 添加新属性
                currentNodeProperties.push({
                    name,
                    type,
                    default: defaultValue,
                    description
                });

                // 更新列表并关闭模态框
                updatePropertiesList();
                modal.style.display = 'none';
            };
        }
    }

    /**
     * 编辑属性
     */
    function editProperty(index) {
        const property = currentNodeProperties[index];
        if (!property) return;

        const modal = document.getElementById('add-property-modal');
        if (modal) {
            // 填充表单
            document.getElementById('property-name').value = property.name;
            document.getElementById('property-type').value = property.type;
            document.getElementById('property-default').value = property.default || '';
            document.getElementById('property-description').value = property.description || '';

            modal.style.display = 'block';

            // 设置表单提交事件
            document.getElementById('add-property-form').onsubmit = (e) => {
                e.preventDefault();

                const name = document.getElementById('property-name').value.trim();
                const type = document.getElementById('property-type').value;
                const defaultValue = document.getElementById('property-default').value.trim();
                const description = document.getElementById('property-description').value.trim();

                if (!name) {
                    alert('属性名是必填项');
                    return;
                }

                // 更新属性
                currentNodeProperties[index] = {
                    name,
                    type,
                    default: defaultValue,
                    description
                };

                // 更新列表并关闭模态框
                updatePropertiesList();
                modal.style.display = 'none';
            };
        }
    }

    /**
     * 删除属性
     */
    function deleteProperty(index) {
        if (confirm('确定要删除此属性吗？')) {
            currentNodeProperties.splice(index, 1);
            updatePropertiesList();
        }
    }


    // Initialize
    initNodeTreeView();
    initCreateNodeModal();
    setupEventListeners();

    // Return public API
    return {
        initNodeTreeView,
        toggleDockPanel
    };
}