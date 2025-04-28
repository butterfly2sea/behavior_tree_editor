/**
 * Properties Panel Component - Manages node properties editing
 */
import {eventBus, EVENTS} from '../core/events.js';
import {logger} from '../utils/logger.js';
import {createElement, clearElement, escapeHtml} from '../utils/dom.js';
import {getNodeDefinition} from "../data/node-types.js";

export function initPropertiesPanel(elements, state, renderer) {
    const stateManager = state;

    /**
     * Update the properties panel based on selected nodes
     */
    function updatePropertiesPanel() {
        const {propertiesPanel, propertiesContent} = elements;

        if (!propertiesPanel || !propertiesContent) {
            logger.warn('Properties panel elements not found');
            return;
        }

        const selectedNodes = stateManager.getSelectedNodes();

        // Show properties panel only if nodes are selected
        if (selectedNodes.length === 0) {
            propertiesPanel.style.display = 'none';
            return;
        }

        propertiesPanel.style.display = 'block';

        // Single node selection - show detailed properties
        if (selectedNodes.length === 1) {
            renderSingleNodeProperties(selectedNodes[0]);
        }
        // Multiple node selection - show multi-select panel
        else {
            renderMultiNodeProperties(selectedNodes);
        }
    }

    /**
     * Render properties for a single selected node
     */
    function renderSingleNodeProperties(nodeId) {
        const {propertiesContent} = elements;

        // Clear panel
        clearElement(propertiesContent);

        const node = stateManager.getNodes().find(n => n.id === nodeId);
        if (!node) {
            propertiesContent.innerHTML = '<p>Selected node not found</p>';
            return;
        }

        // Get node type definition
        let nodeTypeDef = getNodeDefinition(node.type, node.category);

        // 特别处理：如果找不到节点定义，尝试从NODE_TYPES和自定义节点类型中查找
        if (!nodeTypeDef) {
            // 从NODE_TYPES查找
            if (window.NODE_TYPES && window.NODE_TYPES[node.category]) {
                nodeTypeDef = window.NODE_TYPES[node.category].find(nt => nt.type === node.type);
            }

            // 如果还找不到，从自定义节点类型查找
            if (!nodeTypeDef) {
                nodeTypeDef = stateManager.getCustomNodeTypes().find(nt => nt.type === node.type);
            }
        }

        // 创建基本信息部分
        const basicInfoSection = createElement('div', {className: 'form-group'});
        basicInfoSection.appendChild(createElement('h3', {}, '基本信息'));

        // 创建节点名称字段
        const nameField = createPropertyField('名称', 'text', node.name, (value) => {
            stateManager.updateNode(nodeId, {name: value});
        });
        basicInfoSection.appendChild(nameField);

        // 创建只读类型字段
        const typeField = createPropertyField('类型', 'text', node.type, null, true);
        basicInfoSection.appendChild(typeField);

        // 创建只读类别字段
        const categoryField = createPropertyField('类别', 'text', node.category, null, true);
        basicInfoSection.appendChild(categoryField);

        propertiesContent.appendChild(basicInfoSection);

        // 添加描述（如果有）
        if (nodeTypeDef && nodeTypeDef.description) {
            const descSection = createElement('div', {className: 'form-group'});
            descSection.appendChild(createElement('h3', {}, '描述'));

            const descField = createElement('div', {
                className: 'node-description',
                style: {
                    padding: '10px',
                    background: '#f9f9f9',
                    borderRadius: '4px',
                    border: '1px solid #ddd',
                    fontSize: '13px',
                    lineHeight: '1.5'
                }
            }, nodeTypeDef.description);

            descSection.appendChild(descField);
            propertiesContent.appendChild(descSection);
        }

        // 创建节点属性部分
        if (nodeTypeDef && nodeTypeDef.properties && nodeTypeDef.properties.length > 0) {
            const propsSection = createElement('div', {className: 'form-group'});
            propsSection.appendChild(createElement('h3', {}, '节点属性'));

            // 添加各个属性字段
            nodeTypeDef.properties.forEach(prop => {
                // 确保属性存在于节点对象中
                if (!node.properties) {
                    node.properties = {};
                }

                // 获取当前值或默认值
                const value = node.properties[prop.name] !== undefined ?
                    node.properties[prop.name] : (prop.default || '');

                // 创建适当类型的输入控件
                let propField;

                switch (prop.type) {
                    case 'boolean':
                        // 为布尔类型创建复选框
                        propField = createBooleanField(
                            prop.name,
                            value === 'true' || value === true,
                            (newValue) => {
                                updateProperty(nodeId, prop.name, newValue);
                            }
                        );
                        break;

                    case 'number':
                        // 为数字类型创建数字输入框
                        propField = createNumberField(
                            prop.name,
                            value,
                            (newValue) => {
                                updateProperty(nodeId, prop.name, newValue);
                            }
                        );
                        break;

                    case 'select':
                        // 为选择类型创建下拉框
                        propField = createSelectField(
                            prop.name,
                            value,
                            prop.options || [],
                            (newValue) => {
                                updateProperty(nodeId, prop.name, newValue);
                            }
                        );
                        break;

                    default:
                        // 默认为文本类型
                        propField = createPropertyField(
                            prop.name,
                            'text',
                            value,
                            (newValue) => {
                                updateProperty(nodeId, prop.name, newValue);
                            }
                        );
                }

                propsSection.appendChild(propField);

                // 添加属性描述
                if (prop.description) {
                    const helpText = createElement('div', {
                        className: 'property-help',
                        style: {
                            fontSize: '11px',
                            color: '#666',
                            marginBottom: '10px',
                            marginTop: '-5px',
                            paddingLeft: '10px'
                        }
                    }, prop.description);

                    propsSection.appendChild(helpText);
                }
            });

            propertiesContent.appendChild(propsSection);
        } else {
            // 没有属性时显示提示
            const noPropsMsg = createElement('div', {
                className: 'form-group',
                style: {
                    padding: '10px',
                    background: '#f9f9f9',
                    borderRadius: '4px',
                    textAlign: 'center',
                    color: '#666'
                }
            }, '此节点类型没有可编辑的属性');

            propertiesContent.appendChild(noPropsMsg);
        }

        // 添加位置控件
        const positionSection = createElement('div', {className: 'form-group'});
        positionSection.appendChild(createElement('h3', {}, '位置'));

        // X位置
        const xField = createNumberField('X', node.x, (value) => {
            updateNodePosition(nodeId, parseInt(value), null);
        });
        positionSection.appendChild(xField);

        // Y位置
        const yField = createNumberField('Y', node.y, (value) => {
            updateNodePosition(nodeId, null, parseInt(value));
        });
        positionSection.appendChild(yField);

        propertiesContent.appendChild(positionSection);

        // 添加删除按钮
        const deleteButton = createElement('button', {
            id: 'delete-node-btn',
            className: 'delete-button',
            style: {
                width: '100%',
                padding: '10px',
                margin: '20px 0 0 0',
                background: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
            },
            onclick: () => {
                if (confirm('确定要删除此节点吗？')) {
                    eventBus.emit(EVENTS.TOOLBAR_ACTION, {action: 'delete-selected'});
                }
            }
        }, '删除节点');

        propertiesContent.appendChild(deleteButton);
    }

    /**
     * 创建布尔值字段
     */
    function createBooleanField(label, value, onChange) {
        const container = createElement('div', {className: 'parameter-row'});

        container.appendChild(createElement('label', {
            style: {
                flex: '1'
            }
        }, label));

        const input = createElement('input', {
            type: 'checkbox',
            checked: value,
            onchange: onChange ? (e) => onChange(e.target.checked) : null
        });

        container.appendChild(input);
        return container;
    }

    /**
     * 创建数字字段
     */
    function createNumberField(label, value, onChange) {
        const container = createElement('div', {className: 'parameter-row'});

        container.appendChild(createElement('label', {
            style: {
                flex: '1'
            }
        }, label));

        const input = createElement('input', {
            type: 'number',
            value: value,
            onchange: onChange ? (e) => onChange(e.target.value) : null,
            style: {
                width: '120px'
            }
        });

        container.appendChild(input);
        return container;
    }

    /**
     * 创建选择字段
     */
    function createSelectField(label, value, options, onChange) {
        const container = createElement('div', {className: 'parameter-row'});

        container.appendChild(createElement('label', {
            style: {
                flex: '1'
            }
        }, label));

        const select = createElement('select', {
            onchange: onChange ? (e) => onChange(e.target.value) : null,
            style: {
                width: '120px'
            }
        });

        // 添加选项
        options.forEach(opt => {
            const option = createElement('option', {
                value: opt.value || opt,
                selected: (opt.value || opt) === value
            }, opt.label || opt);

            select.appendChild(option);
        });

        container.appendChild(select);
        return container;
    }

    /**
     * 更新节点属性
     */
    function updateProperty(nodeId, propName, value) {
        const node = stateManager.getNodes().find(n => n.id === nodeId);
        if (!node) return;

        // 复制属性对象并更新
        const updatedProps = {...node.properties};
        updatedProps[propName] = value;

        // 更新节点
        stateManager.updateNode(nodeId, {properties: updatedProps});
    }

    /**
     * Render properties for multiple selected nodes
     */
    function renderMultiNodeProperties(nodeIds) {
        const {propertiesContent} = elements;

        // Clear panel
        clearElement(propertiesContent);

        // Selection info
        const selectionInfo = createElement('div', {className: 'form-group'}, [
            createElement('label', {}, 'Multiple Selection'),
            createElement('p', {}, `${nodeIds.length} nodes selected`)
        ]);

        propertiesContent.appendChild(selectionInfo);

        // Alignment buttons
        const alignmentGroup = createElement('div', {className: 'form-group'});
        alignmentGroup.appendChild(createElement('label', {}, 'Alignment'));

        const buttonsContainer = createElement('div', {
            className: 'alignment-buttons', style: {
                display: 'flex',
                flexWrap: 'wrap',
                gap: '5px',
                marginTop: '8px'
            }
        });

        // Align buttons
        const alignActions = [
            {id: 'prop-align-left-btn', title: 'Align Left', action: 'left', icon: 'icon-align-left'},
            {id: 'prop-align-center-btn', title: 'Align Center', action: 'center', icon: 'icon-align-center'},
            {id: 'prop-align-right-btn', title: 'Align Right', action: 'right', icon: 'icon-align-right'},
            {id: 'prop-align-top-btn', title: 'Align Top', action: 'top', icon: 'icon-align-top'},
            {id: 'prop-align-middle-btn', title: 'Align Middle', action: 'middle', icon: 'icon-align-middle'},
            {id: 'prop-align-bottom-btn', title: 'Align Bottom', action: 'bottom', icon: 'icon-align-bottom'}
        ];

        alignActions.forEach(({id, title, action, icon}) => {
            const button = createElement('button', {
                id,
                title,
                onclick: () => {
                    eventBus.emit(EVENTS.TOOLBAR_ACTION, {
                        action: 'align',
                        alignType: action
                    });
                },
                style: {
                    flex: '1',
                    minWidth: '70px',
                    margin: '0 2px'
                }
            }, [
                createElement('i', {className: icon})
            ]);

            buttonsContainer.appendChild(button);
        });

        alignmentGroup.appendChild(buttonsContainer);
        propertiesContent.appendChild(alignmentGroup);

        // Delete selected nodes button
        const deleteButton = createElement('button', {
            id: 'delete-selected-nodes-btn',
            className: 'delete-button',
            onclick: () => {
                eventBus.emit(EVENTS.TOOLBAR_ACTION, {action: 'delete-selected'});
            }
        }, `Delete ${nodeIds.length} Node${nodeIds.length > 1 ? 's' : ''}`);

        propertiesContent.appendChild(deleteButton);
    }

    /**
     * Create a property field with label and input
     */
    function createPropertyField(label, type, value, onChange, readonly = false) {
        const container = createElement('div', {className: 'parameter-row'});

        container.appendChild(createElement('label', {}, label));

        const input = createElement('input', {
            type: type,
            className: 'property-value',
            value: value,
            readonly: readonly,
            onchange: onChange ? (e) => onChange(e.target.value) : null
        });

        container.appendChild(input);
        return container;
    }

    /**
     * Get HTML input type based on property type
     */
    function getInputTypeForPropertyType(propType) {
        switch (propType) {
            case 'boolean':
                return 'checkbox';
            case 'number':
            case 'integer':
                return 'number';
            default:
                return 'text';
        }
    }

    /**
     * Update node position
     */
    function updateNodePosition(nodeId, x, y) {
        const node = stateManager.getNodes().find(n => n.id === nodeId);
        if (!node) return;

        const updates = {};
        if (x !== null) updates.x = x;
        if (y !== null) updates.y = y;

        // Apply grid snapping if enabled
        if (stateManager.getGrid().snap) {
            const gridSize = stateManager.getGrid().size;
            if (x !== null) updates.x = Math.round(x / gridSize) * gridSize;
            if (y !== null) updates.y = Math.round(y / gridSize) * gridSize;
        }

        stateManager.updateNode(nodeId, updates);
    }

    /**
     * Set up event listeners
     */
    function setupEventListeners() {
        // Listen for selection changes
        eventBus.on(EVENTS.SELECTION_CHANGED, updatePropertiesPanel);

        // Listen for node updates
        eventBus.on(EVENTS.NODE_CHANGED, updatePropertiesPanel);
    }

    // Initialize
    setupEventListeners();

    // Return public API
    return {
        updatePropertiesPanel
    };
}