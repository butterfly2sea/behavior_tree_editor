/**
 * Properties Panel Component - Manages node properties editing
 */
import {eventBus, EVENTS} from '../core/events.js';
import {logger} from '../utils/logger.js';
import {createElement, clearElement, escapeHtml} from '../utils/dom.js';

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
        const nodeTypeDef = window.getNodeTypeDefinition ?
            window.getNodeTypeDefinition(node.type, node.category) : null;

        // Create node name field
        const nameField = createPropertyField('Name', 'text', node.name, (value) => {
            stateManager.updateNode(nodeId, {name: value});
        });
        propertiesContent.appendChild(nameField);

        // Create read-only type field
        const typeField = createPropertyField('Type', 'text', node.type, null, true);
        propertiesContent.appendChild(typeField);

        // Create read-only category field
        const categoryField = createPropertyField('Category', 'text', node.category, null, true);
        propertiesContent.appendChild(categoryField);

        // Add description if available
        if (nodeTypeDef && nodeTypeDef.description) {
            const descField = createPropertyArea('Description', nodeTypeDef.description, null, true);
            propertiesContent.appendChild(descField);
        }

        // Create properties section
        const propertiesSection = createElement('div', {className: 'form-group'});
        propertiesSection.appendChild(createElement('label', {}, 'Properties'));

        // Add node-specific properties
        if (nodeTypeDef && nodeTypeDef.properties && nodeTypeDef.properties.length > 0) {
            nodeTypeDef.properties.forEach(prop => {
                const value = node.properties[prop.name] !== undefined ?
                    node.properties[prop.name] : (prop.default || '');

                const propField = createPropertyField(
                    prop.name,
                    getInputTypeForPropertyType(prop.type),
                    value,
                    (newValue) => {
                        // Update property
                        const updatedProps = {...node.properties};
                        updatedProps[prop.name] = newValue;
                        stateManager.updateNode(nodeId, {properties: updatedProps});
                    }
                );

                propertiesSection.appendChild(propField);

                // Add description if available
                if (prop.description) {
                    const descriptionEl = createElement('div', {
                        style: {
                            marginBottom: '8px',
                            fontSize: '11px',
                            color: '#666'
                        }
                    }, prop.description);
                    propertiesSection.appendChild(descriptionEl);
                }
            });
        } else {
            propertiesSection.appendChild(createElement('p', {
                style: {
                    fontSize: '12px',
                    color: '#666'
                }
            }, 'No properties available for this node type.'));
        }

        propertiesContent.appendChild(propertiesSection);

        // Add position controls
        const positionSection = createElement('div', {className: 'form-group'});
        positionSection.appendChild(createElement('label', {}, 'Position'));

        const positionControls = createElement('div', {className: 'position-controls'});

        // X position
        const xRow = createElement('div', {className: 'position-row'});
        xRow.appendChild(createElement('label', {for: 'node-pos-x'}, 'X:'));
        const xInput = createElement('input', {
            type: 'number',
            id: 'node-pos-x',
            value: node.x,
            onchange: (e) => {
                const value = parseInt(e.target.value);
                if (!isNaN(value)) {
                    updateNodePosition(nodeId, value, null);
                }
            }
        });
        xRow.appendChild(xInput);
        positionControls.appendChild(xRow);

        // Y position
        const yRow = createElement('div', {className: 'position-row'});
        yRow.appendChild(createElement('label', {for: 'node-pos-y'}, 'Y:'));
        const yInput = createElement('input', {
            type: 'number',
            id: 'node-pos-y',
            value: node.y,
            onchange: (e) => {
                const value = parseInt(e.target.value);
                if (!isNaN(value)) {
                    updateNodePosition(nodeId, null, value);
                }
            }
        });
        yRow.appendChild(yInput);
        positionControls.appendChild(yRow);

        positionSection.appendChild(positionControls);
        propertiesContent.appendChild(positionSection);

        // Add delete button
        const deleteButton = createElement('button', {
            id: 'delete-node-btn',
            className: 'delete-button',
            onclick: () => {
                eventBus.emit(EVENTS.TOOLBAR_ACTION, {action: 'delete-selected'});
            }
        }, 'Delete Node');

        propertiesContent.appendChild(deleteButton);
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
     * Create a property textarea with label
     */
    function createPropertyArea(label, value, onChange, readonly = false) {
        const container = createElement('div', {className: 'form-group'});

        container.appendChild(createElement('label', {}, label));

        const textarea = createElement('textarea', {
            readonly: readonly,
            onchange: onChange ? (e) => onChange(e.target.value) : null
        }, value);

        container.appendChild(textarea);
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