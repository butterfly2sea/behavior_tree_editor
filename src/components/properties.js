/**
 * Properties Panel Component
 */
import {eventBus, EVENTS} from '../core/events.js';
import {logger} from '../utils/logger.js';

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

        const node = stateManager.getNodes().find(n => n.id === nodeId);
        if (!node) {
            propertiesContent.innerHTML = '<p>Selected node not found</p>';
            return;
        }

        // Get node type definition
        const {getNodeTypeDefinition} = window; // From node-types.js
        const nodeDef = getNodeTypeDefinition ?
            getNodeTypeDefinition(node.type, node.category) : null;

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
            <label>${escapeHtml(prop.name)}</label>
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
     */
    function renderMultiNodeProperties(nodeIds) {
        const {propertiesContent} = elements;

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
            <i class="icon-align-left"></i>
          </button>
          <button id="prop-align-center-btn" title="Align Center">
            <i class="icon-align-center"></i>
          </button>
          <button id="prop-align-right-btn" title="Align Right">
            <i class="icon-align-right"></i>
          </button>
          <button id="prop-align-top-btn" title="Align Top">
            <i class="icon-align-top"></i>
          </button>
          <button id="prop-align-middle-btn" title="Align Middle">
            <i class="icon-align-center"></i>
          </button>
          <button id="prop-align-bottom-btn" title="Align Bottom">
            <i class="icon-align-bottom"></i>
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
     */
    function attachSingleNodeEventListeners(nodeId) {
        // Node name change
        const nameInput = document.getElementById('node-name');
        if (nameInput) {
            nameInput.addEventListener('change', e => {
                updateNodeInfo(nodeId, {name: e.target.value});
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
                const {validateNodeProperty} = window; // From validation.js
                if (!validateNodeProperty || validateNodeProperty(value, propType)) {
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
                eventBus.emit(EVENTS.TOOLBAR_ACTION, {action: 'delete-selected'});
            });
        }
    }

    /**
     * Attach event listeners for multiple node properties
     */
    function attachMultiNodeEventListeners() {
        // Alignment buttons
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
                    eventBus.emit(EVENTS.TOOLBAR_ACTION, {
                        action: 'align',
                        alignType
                    });
                });
            }
        });

        // Delete button
        const deleteBtn = document.getElementById('delete-selected-nodes-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                eventBus.emit(EVENTS.TOOLBAR_ACTION, {action: 'delete-selected'});
            });
        }
    }

    /**
     * Update node basic information
     */
    function updateNodeInfo(nodeId, updates) {
        stateManager.updateNode(nodeId, updates);
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
     * Update a node property
     */
    function updateNodeProperty(nodeId, propName, value) {
        const node = stateManager.getNodes().find(n => n.id === nodeId);
        if (!node) return;

        // Create copy of properties and update
        const properties = {...node.properties};
        properties[propName] = value;

        stateManager.updateNode(nodeId, {properties});
    }

    /**
     * Set up event listeners
     */
    function setupEventListeners() {
        // Listen for selection changes
        eventBus.on(EVENTS.SELECTION_CHANGED, () => {
            updatePropertiesPanel();
        });

        // Listen for node updates
        eventBus.on(EVENTS.NODE_CHANGED, () => {
            updatePropertiesPanel();
        });
    }

    // Initialize
    setupEventListeners();

    // Return public API
    return {
        updatePropertiesPanel
    };
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str) {
    if (str === undefined || str === null) return '';

    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}