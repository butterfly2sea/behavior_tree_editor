/**
 * Properties Panel Component - Manages node properties editing
 */
import {eventBus, EVENTS} from '../core/events.js';
import {logger} from '../utils/logger.js';
import {createElement, clearElement, escapeHtml} from '../utils/dom.js';
import {getNodeDefinition} from "../data/node-types.js";

export function initPropertiesPanel(elements, state) {
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

        // 清除面板
        clearElement(propertiesContent);

        const node = stateManager.getNodes().find(n => n.id === nodeId);
        if (!node) {
            propertiesContent.innerHTML = '<p>Selected node not found</p>';
            return;
        }

        // 获取节点类型定义
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
                        propField = createPropertyFieldWithPort(
                            prop.name,
                            'checkbox',
                            isPortFormat(value) ? value : value === true || (typeof value === 'string' && value.toLowerCase() === 'true'),
                            (newValue) => {
                                updateProperty(nodeId, prop.name, newValue);
                            }
                        );
                        break;

                    case 'number':
                        // 为数字类型创建数字输入框
                        propField = createPropertyFieldWithPort(
                            prop.name,
                            'number',
                            value,
                            (newValue) => {
                                updateProperty(nodeId, prop.name, newValue);
                            }
                        );
                        break;

                    case 'select':
                        // 为选择类型创建下拉框，传入选项
                        propField = createPropertyFieldWithPort(
                            prop.name,
                            'select',
                            value,
                            (newValue) => {
                                updateProperty(nodeId, prop.name, newValue);
                            },
                            prop.options || []
                        );
                        break;

                    default:
                        // 默认为文本类型
                        propField = createPropertyFieldWithPort(
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
                if (node.type === 'SubTree' && prop.name === 'port_mappings') {
                    // 创建端口映射管理UI
                    const mappingsSection = createElement('div', {
                        className: 'port-mappings-section',
                        style: {marginTop: '10px'}
                    });

                    // 显示现有映射
                    const mappings = node.properties.port_mappings || {};

                    // 映射列表容器
                    const mappingsList = createElement('div', {
                        className: 'mappings-list',
                        style: {marginBottom: '10px'}
                    });

                    // 渲染每个映射
                    Object.entries(mappings).forEach(([internal, external]) => {
                        const mappingRow = createElement('div', {
                            className: 'mapping-row',
                            style: {display: 'flex', alignItems: 'center', marginBottom: '5px', gap: '5px'}
                        });

                        // 内部端口输入
                        const internalInput = createElement('input', {
                            type: 'text',
                            value: internal,
                            placeholder: '内部端口',
                            style: {width: '35%'},
                            onchange: (e) => updateMappingKey(nodeId, internal, e.target.value, external)
                        });

                        // 箭头符号
                        const arrow = createElement('span', {}, '←');

                        // 外部端口/值输入
                        const externalInput = createElement('input', {
                            type: 'text',
                            value: external,
                            placeholder: '外部端口或值',
                            style: {width: '45%'},
                            onchange: (e) => updateMappingValue(nodeId, internal, e.target.value)
                        });

                        // 删除按钮
                        const deleteBtn = createElement('button', {
                            style: {
                                padding: '2px 5px',
                                background: '#f44336',
                                color: 'white',
                                border: 'none',
                                borderRadius: '3px',
                                cursor: 'pointer'
                            },
                            onclick: () => removeMapping(nodeId, internal)
                        }, '×');

                        mappingRow.appendChild(internalInput);
                        mappingRow.appendChild(arrow);
                        mappingRow.appendChild(externalInput);
                        mappingRow.appendChild(deleteBtn);
                        mappingsList.appendChild(mappingRow);
                    });

                    // 添加新映射按钮
                    const addMappingBtn = createElement('button', {
                        style: {
                            padding: '5px 10px',
                            background: '#4CAF50',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer'
                        },
                        onclick: () => addMapping(nodeId)
                    }, '+ 添加端口映射');

                    // 帮助文字
                    const helpText = createElement('div', {
                        style: {
                            fontSize: '11px',
                            color: '#666',
                            marginTop: '5px'
                        }
                    }, '提示：外部值可以是端口名（用{}包裹）或直接值');

                    mappingsSection.appendChild(mappingsList);
                    mappingsSection.appendChild(addMappingBtn);
                    mappingsSection.appendChild(helpText);
                    propsSection.appendChild(mappingsSection);
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
        const xField = createPropertyField('X', 'text', node.x, (value) => {
            updateNodePosition(nodeId, parseInt(value), null);
        });
        positionSection.appendChild(xField);

        // Y位置
        const yField = createPropertyField('Y', 'text', node.y, (value) => {
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

    // 辅助函数
    function updateMappingKey(nodeId, oldKey, newKey, value) {
        const node = stateManager.getNodes().find(n => n.id === nodeId);
        if (!node) return;

        const mappings = {...(node.properties.port_mappings || {})};
        delete mappings[oldKey];
        mappings[newKey] = value;

        updateProperty(nodeId, 'port_mappings', mappings);
    }

    function updateMappingValue(nodeId, key, value) {
        const node = stateManager.getNodes().find(n => n.id === nodeId);
        if (!node) return;

        const mappings = {...(node.properties.port_mappings || {})};
        mappings[key] = value;

        updateProperty(nodeId, 'port_mappings', mappings);
    }

    function addMapping(nodeId) {
        const node = stateManager.getNodes().find(n => n.id === nodeId);
        if (!node) return;

        const mappings = {...(node.properties.port_mappings || {})};
        let count = 1;
        let newKey = `port${count}`;

        // 找到不冲突的键名
        while (mappings[newKey]) {
            count++;
            newKey = `port${count}`;
        }

        mappings[newKey] = '';

        updateProperty(nodeId, 'port_mappings', mappings);
    }

    function removeMapping(nodeId, key) {
        const node = stateManager.getNodes().find(n => n.id === nodeId);
        if (!node) return;

        const mappings = {...(node.properties.port_mappings || {})};
        delete mappings[key];

        updateProperty(nodeId, 'port_mappings', mappings);
    }

    /**
     * 工具函数：检查值是否是端口格式
     */
    function isPortFormat(value) {
        return value && typeof value === 'string' && /^\{.*\}$/.test(value);
    }


    function createPropertyFieldWithPort(label, type, value, onChange, options = null) {
        const container = createElement('div', {className: 'parameter-row'});
        container.appendChild(createElement('label', {style: {flex: '1'}}, label));
        const isPort = isPortFormat(value);
        if (type === 'checkbox' || type === 'number' || type === 'text') {
            const input = createElement('input', {
                type: isPort ? 'text' : type,
                checked: value,
                value: isPort ? value.slice(1, -1) : value,
                onchange: onChange ? (e) => {
                    if (input.classList.contains("port-property-input")) {
                        onChange(`{${e.target.value}}`)
                    } else {
                        onChange(type === 'checkbox' ? e.target.checked : e.target.value)
                    }
                } : null
            });
            const checkbox = createElement('input', {
                type: 'checkbox',
                checked: isPort,
                className: 'port-property-input',
                onchange: (e) => {
                    let checked = e.target.checked;
                    if (checked) {
                        input.type = 'text';
                    } else {
                        input.type = type;
                    }
                    input.classList.toggle('port-property-input', checked)
                }
            })

            input.classList.toggle('port-property-input', isPort)
            container.appendChild(input);
            container.appendChild(checkbox);
        } else if (type === 'select') {
            const select = createElement('select', {
                onchange: onChange ? (e) => onChange(e.target.value) : null,
                style: {width: '120px', display: isPort ? 'none' : 'block'}
            });

            const input = createElement('input', {
                className: 'port-property-input',
                value: value.slice(1, -1),
                onchange: onChange ? (e) => onChange(`{${e.target.value}}`) : null,
                style: {display: isPort ? 'block' : 'none'}
            })

            if (options && Array.isArray(options)) {
                // 添加选项
                options.forEach(opt => {
                    // 处理对象形式的选项 {value, label}
                    if (typeof opt === 'object' && opt !== null) {
                        const optValue = opt.value !== undefined ? opt.value : '';
                        const optLabel = opt.label || optValue;

                        const option = createElement('option', {
                            value: optValue,
                            selected: optValue === value
                        }, optLabel);

                        select.appendChild(option);
                    }
                    // 处理简单值形式的选项
                    else {
                        const option = createElement('option', {
                            value: opt,
                            selected: opt === value
                        }, opt);

                        select.appendChild(option);
                    }
                });
            }

            const checkbox = createElement('input', {
                type: 'checkbox',
                checked: isPort,
                onchange: (e) => {
                    let checked = e.target.checked;
                    if (checked) {
                        select.style.display = 'none';
                        input.style.display = 'block'
                    } else {
                        select.style.display = 'block';
                        input.style.display = 'none'
                    }
                }
            })
            container.appendChild(select);
            container.appendChild(input);
            container.appendChild(checkbox);
        }

        return container;

    }

    /**
     * Create a property field with label and input
     */
    function createPropertyField(label, type, value, onChange, readonly = false, options = null) {

        // 针对其他类型的处理保持不变
        const container = createElement('div', {className: 'parameter-row'});

        container.appendChild(createElement('label', {}, label));

        const inputType = getInputTypeForPropertyType(type);
        const input = createElement('input', {
            type: inputType,
            className: 'property-value',
            readonly: readonly,
            value: value,
            onchange: onChange ? (e) => {
                onChange(e.target.value);
            } : null
        });

        container.appendChild(input);
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