/**
 * Properties Panel component
 * Manages the right panel for editing node properties
 */

import { editorEvents, EDITOR_EVENTS } from '../modules/events.js';
import { logger } from '../index.js';
import { clearElement, escapeHtml } from '../utils/dom-utils.js';
import { validateNodeProperty } from '../utils/validation.js';

export function initPropertiesPanel(elements, state, renderer) {
    const stateManager = state;

    logger.debug('Initializing properties panel');

    // Set up event listeners
    setupEventListeners();

    /**
     * Update the properties panel based on selected nodes
     */
    function updatePropertiesPanel() {
        const { propertiesPanel, propertiesContent } = elements;

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
     * @param {string} nodeId - ID of the selected node
     */
    function renderSingleNodeProperties(nodeId) {
        const { propertiesContent } = elements;

        const node = stateManager.getNodes().find(n => n.id === nodeId);
        if (!node) {
            propertiesContent.innerHTML = '<p>Selected node not found</p>';
            return;
        }

        // Get node type definition
        const nodeDef = getNodeTypeDefinition(node.type, node.category);

        // Start building HTML content
        let html = `
            <div class="form-group">
                <label for="node-name">Name</label>
                <input type="text" id="node-name" value="${escapeHtml(node.name)}" />
            </div>
            <div class="form-group">
                <label>Type</label>
                <input type="text" value="${escapeHtml(node.type)}" readonly />
            </div>
            <div class="form-group">
                <label>Category</label>
                <input type="text" value="${escapeHtml(node.category)}" readonly />
            </div>
        `;

        // Add description if available
        if (nodeDef && nodeDef.description) {
            html += `
                <div class="form-group">
                    <label>Description</label>
                    <textarea readonly>${escapeHtml(nodeDef.description)}</textarea>
                </div>
            `;
        }

        // Add type-specific properties
        html += `<div class="form-group"><label>Properties</label>`;

        if (nodeDef && nodeDef.properties && nodeDef.properties.length > 0) {
            nodeDef.properties.forEach(prop => {
                const value = node.properties[prop.name] !== undefined ?
                    node.properties[prop.name] : (prop.default || '');

                html += `
                    <div class="parameter-row">
                        <input type="text" value="${escapeHtml(prop.name)}" readonly />
                        <input type="text" class="property-value" data-name="${escapeHtml(prop.name)}" 
                               data-type="${escapeHtml(prop.type || 'string')}" 
                               value="${escapeHtml(value)}" />
                    </div>
                    <div style="margin-bottom: 8px; font-size: 11px; color: #666;">
                        ${escapeHtml(prop.description || '')}
                    </div>
                `;
            });
        } else {
            html += `<p style="font-size: 12px; color: #666;">No properties available for this node type.</p>`;
        }

        html += `</div>`;

        // Add position information
        html += `
            <div class="form-group">
                <label>Position</label>
                <div class="position-controls">
                    <div class="position-row">
                        <label for="node-pos-x">X:</label>
                        <input type="number" id="node-pos-x" value="${node.x}" />
                    </div>
                    <div class="position-row">
                        <label for="node-pos-y">Y:</label>
                        <input type="number" id="node-pos-y" value="${node.y}" />
                    </div>
                </div>
            </div>
        `;

        // Add delete button
        html += `
            <button id="delete-node-btn" class="delete-button">Delete Node</button>
        `;

        // Set HTML content
        propertiesContent.innerHTML = html;

        // Add event listeners for property changes
        attachSingleNodeEventListeners(nodeId);
    }

    /**
     * Render properties for multiple selected nodes
     * @param {Array} nodeIds - Array of selected node IDs
     */
    function renderMultiNodeProperties(nodeIds) {
        const { propertiesContent } = elements;

        // Build HTML content for multi-selection
        let html = `
            <div class="form-group">
                <label>Multiple Selection</label>
                <p>${nodeIds.length} nodes selected</p>
            </div>
            
            <div class="form-group">
                <label>Alignment</label>
                <div class="alignment-buttons">
                    <button id="prop-align-left-btn" title="Align Left">
                        <i class="fa fa-align-left"></i>
                    </button>
                    <button id="prop-align-center-btn" title="Align Center">
                        <i class="fa fa-align-center"></i>
                    </button>
                    <button id="prop-align-right-btn" title="Align Right">
                        <i class="fa fa-align-right"></i>
                    </button>
                    <button id="prop-align-top-btn" title="Align Top">
                        <i class="fa fa-align-top"></i>
                    </button>
                    <button id="prop-align-middle-btn" title="Align Middle">
                        <i class="fa fa-align-center"></i>
                    </button>
                    <button id="prop-align-bottom-btn" title="Align Bottom">
                        <i class="fa fa-align-bottom"></i>
                    </button>
                </div>
            </div>
            
            <div class="form-group">
                <label>Distribution</label>
                <div class="distribution-buttons">
                    <button id="prop-distribute-h-btn" title="Distribute Horizontally">
                        <i class="fa fa-arrows-alt-h"></i> Horizontal
                    </button>
                    <button id="prop-distribute-v-btn" title="Distribute Vertically">
                        <i class="fa fa-arrows-alt-v"></i> Vertical
                    </button>
                </div>
            </div>
            
            <button id="delete-selected-nodes-btn" class="delete-button">
                Delete ${nodeIds.length} Node${nodeIds.length > 1 ? 's' : ''}
            </button>
        `;

        // Set HTML content
        propertiesContent.innerHTML = html;

        // Add event listeners for multi-selection
        attachMultiNodeEventListeners();
    }

    /**
     * Attach event listeners for single node properties
     * @param {string} nodeId - ID of the selected node
     */
    function attachSingleNodeEventListeners(nodeId) {
        // Node name change
        const nameInput = document.getElementById('node-name');
        if (nameInput) {
            nameInput.addEventListener('change', e => {
                updateNodeInfo(nodeId, { name: e.target.value });
            });
        }

        // Position changes
        const posXInput = document.getElementById('node-pos-x');
        const posYInput = document.getElementById('node-pos-y');

        if (posXInput) {
            posXInput.addEventListener('change', e => {
                const value = parseInt(e.target.value);
                if (!isNaN(value)) {
                    updateNodePosition(nodeId, value, null);
                }
            });
        }

        if (posYInput) {
            posYInput.addEventListener('change', e => {
                const value = parseInt(e.target.value);
                if (!isNaN(value)) {
                    updateNodePosition(nodeId, null, value);
                }
            });
        }

        // Property value changes
        document.querySelectorAll('.property-value').forEach(input => {
            input.addEventListener('change', e => {
                const propName = e.target.getAttribute('data-name');
                const propType = e.target.getAttribute('data-type');
                const value = e.target.value;

                // Validate property value based on type
                if (validateNodeProperty(value, propType)) {
                    updateNodeProperty(nodeId, propName, value);
                } else {
                    // Revert to previous value if invalid
                    const node = stateManager.getNodes().find(n => n.id === nodeId);
                    if (node) {
                        e.target.value = node.properties[propName] || '';
                    }

                    alert(`Invalid value for ${propType} property: ${propName}`);
                }
            });
        });

        // Delete button
        const deleteBtn = document.getElementById('delete-node-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                editorEvents.emit(EDITOR_EVENTS.DELETE_SELECTED_REQUESTED);
            });
        }
    }

    /**
     * Attach event listeners for multiple node properties
     */
    function attachMultiNodeEventListeners() {
        // Alignment buttons
        attachAlignmentButtonListeners();

        // Distribution buttons
        const distributeHBtn = document.getElementById('prop-distribute-h-btn');
        const distributeVBtn = document.getElementById('prop-distribute-v-btn');

        if (distributeHBtn) {
            distributeHBtn.addEventListener('click', () => {
                editorEvents.emit(EDITOR_EVENTS.DISTRIBUTE_REQUESTED, 'horizontal');
            });
        }

        if (distributeVBtn) {
            distributeVBtn.addEventListener('click', () => {
                editorEvents.emit(EDITOR_EVENTS.DISTRIBUTE_REQUESTED, 'vertical');
            });
        }

        // Delete button
        const deleteBtn = document.getElementById('delete-selected-nodes-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                editorEvents.emit(EDITOR_EVENTS.DELETE_SELECTED_REQUESTED);
            });
        }
    }

    /**
     * Attach event listeners for alignment buttons
     */
    function attachAlignmentButtonListeners() {
        const alignButtons = {
            'prop-align-left-btn': 'left',
            'prop-align-center-btn': 'center',
            'prop-align-right-btn': 'right',
            'prop-align-top-btn': 'top',
            'prop-align-middle-btn': 'middle',
            'prop-align-bottom-btn': 'bottom'
        };

        Object.entries(alignButtons).forEach(([btnId, alignType]) => {
            const button = document.getElementById(btnId);
            if (button) {
                button.addEventListener('click', () => {
                    editorEvents.emit(EDITOR_EVENTS.ALIGN_REQUESTED, alignType);
                });
            }
        });
    }

    /**
     * Update node basic information
     * @param {string} nodeId - Node ID
     * @param {Object} updates - Updates to apply
     */
    function updateNodeInfo(nodeId, updates) {
        stateManager.updateNode(nodeId, updates);

        // Notify about update
        editorEvents.emit(EDITOR_EVENTS.NODE_UPDATED, { id: nodeId, ...updates });

        // Update render
        renderer.requestNodeUpdate(nodeId);
    }

    /**
     * Update node position
     * @param {string} nodeId - Node ID
     * @param {number|null} x - New X coordinate (null to keep current)
     * @param {number|null} y - New Y coordinate (null to keep current)
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

        // Notify about movement
        editorEvents.emit(EDITOR_EVENTS.NODE_MOVED, [nodeId]);

        // Update render
        renderer.requestNodeUpdate(nodeId);
    }

    /**
     * Update a node property
     * @param {string} nodeId - Node ID
     * @param {string} propName - Property name
     * @param {string} value - Property value
     */
    function updateNodeProperty(nodeId, propName, value) {
        const node = stateManager.getNodes().find(n => n.id === nodeId);
        if (!node) return;

        // Create copy of properties and update
        const properties = { ...node.properties };
        properties[propName] = value;

        stateManager.updateNode(nodeId, { properties });

        // Notify about update
        editorEvents.emit(EDITOR_EVENTS.NODE_UPDATED, {
            id: nodeId,
            properties: { [propName]: value }
        });
    }

    /**
     * Get node type definition
     * @param {string} type - Node type
     * @param {string} category - Node category
     * @returns {Object|null} - Node type definition or null
     */
    function getNodeTypeDefinition(type, category) {
        // Check built-in types first (from the external node-types.js)
        if (window.NODE_TYPES && window.NODE_TYPES[category]) {
            const builtInType = window.NODE_TYPES[category].find(nt => nt.type === type);
            if (builtInType) return builtInType;
        }

        // Then check custom types
        return stateManager.getCustomNodeTypes().find(nt => nt.type === type);
    }

    /**
     * Set up event listeners
     */
    function setupEventListeners() {
        // Listen for selection changes
        editorEvents.on(EDITOR_EVENTS.SELECTION_CHANGED, () => {
            updatePropertiesPanel();
        });

        // Listen for node updates
        editorEvents.on(EDITOR_EVENTS.NODE_UPDATED, () => {
            updatePropertiesPanel();
        });

        // Listen for node movement
        editorEvents.on(EDITOR_EVENTS.NODE_MOVED, () => {
            updatePropertiesPanel();
        });
    }

    // Return public API
    return {
        updatePropertiesPanel
    };
}