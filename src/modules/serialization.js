/**
 * Serialization module
 * Handles saving, loading, and exporting behavior trees
 */

import { editorEvents, EDITOR_EVENTS } from './events.js';
import { logger } from '../index.js';
import { showErrorToUser } from '../index.js';

export function initSerialization(elements, state) {
    const stateManager = state;

    logger.debug('Initializing serialization module');

    // Set up event listeners
    setupEventListeners();

    /**
     * Save the current tree to a JSON file
     */
    function saveTree() {
        logger.debug('Saving behavior tree');

        // Validate the tree has exactly one root node
        const validation = validateRootNodes();
        if (!validation.isValid) {
            showErrorToUser(validation.message);
            return;
        }

        try {
            // Prepare data for export
            const treeData = {
                nodes: stateManager.getNodes(),
                connections: stateManager.getConnections(),
                customNodeTypes: stateManager.getCustomNodeTypes(),
                collapsedCategories: stateManager.getState().collapsedCategories,
                grid: stateManager.getGrid()
            };

            // Create a Blob from the JSON data
            const blob = new Blob([JSON.stringify(treeData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            // Create a download link
            const a = document.createElement('a');
            a.href = url;
            a.download = 'behavior_tree.json';
            a.click();

            // Clean up
            URL.revokeObjectURL(url);

            logger.info('Behavior tree saved successfully');
        } catch (error) {
            logger.error('Error saving tree:', error);
            showErrorToUser('Failed to save tree: ' + error.message);
        }
    }

    /**
     * Load a tree from a JSON file
     */
    function loadTree() {
        logger.debug('Loading behavior tree');

        try {
            // Create a file input element
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';

            input.onchange = (event) => {
                const file = event.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const data = JSON.parse(e.target.result);

                        // Validate the imported data
                        if (!isValidTreeData(data)) {
                            throw new Error('Invalid behavior tree file format');
                        }

                        // Load custom node types
                        let customNodeTypes = [];
                        if (data.customNodeTypes && Array.isArray(data.customNodeTypes)) {
                            customNodeTypes = data.customNodeTypes;
                        }

                        // Load collapsed categories state
                        let collapsedCategories = {};
                        if (data.collapsedCategories) {
                            collapsedCategories = data.collapsedCategories;
                        }

                        // Load grid settings
                        let grid = stateManager.getGrid();
                        if (data.grid) {
                            grid = data.grid;
                        }

                        // Prepare new state
                        const newState = {
                            ...stateManager.getState(),
                            nodes: data.nodes || [],
                            connections: data.connections || [],
                            customNodeTypes,
                            collapsedCategories,
                            grid,
                            selectedNodes: [],
                            activeConnection: null,
                            pendingConnection: null,
                            selectedConnection: null
                        };

                        // Update node counter to avoid ID collisions
                        const highestId = newState.nodes.reduce((max, node) => {
                            const idNum = parseInt(node.id.replace('node_', ''));
                            return isNaN(idNum) ? max : Math.max(max, idNum);
                        }, -1);

                        newState.nodeCounter = highestId + 1;

                        // Load the new state
                        stateManager.loadState(newState);

                        logger.info('Behavior tree loaded successfully');
                    } catch (error) {
                        logger.error('Error parsing tree file:', error);
                        showErrorToUser('Error parsing tree file: ' + error.message);
                    }
                };

                reader.readAsText(file);
            };

            // Trigger file selection dialog
            input.click();
        } catch (error) {
            logger.error('Error loading tree:', error);
            showErrorToUser('Failed to load tree: ' + error.message);
        }
    }

    /**
     * Clear the current tree
     */
    function clearTree() {
        if (confirm('Are you sure you want to clear the tree? This will remove all nodes and connections.')) {
            stateManager.resetState();
            logger.info('Behavior tree cleared');
        }
    }

    /**
     * Export the behavior tree to XML format
     */
    function exportXml() {
        logger.debug('Exporting behavior tree to XML');

        // Validate the tree has exactly one root node
        const validation = validateRootNodes();
        if (!validation.isValid) {
            showErrorToUser(validation.message);
            return;
        }

        try {
            // Generate XML
            const xmlStr = generateBehaviorTreeXml();

            // Show in XML modal
            const { xmlModal, xmlContent } = elements;

            if (xmlContent) {
                xmlContent.textContent = xmlStr;
            }

            if (xmlModal) {
                xmlModal.style.display = 'block';
            }

            logger.info('Behavior tree exported to XML');
        } catch (error) {
            logger.error('Error exporting XML:', error);
            showErrorToUser('Failed to export XML: ' + error.message);
        }
    }

    /**
     * Copy XML content to clipboard
     */
    function copyXmlToClipboard() {
        const { xmlContent } = elements;

        if (!xmlContent) return;

        const textToCopy = xmlContent.textContent;

        navigator.clipboard.writeText(textToCopy)
            .then(() => {
                // Success feedback
                const copyXmlBtn = document.getElementById('copy-xml-btn');
                if (copyXmlBtn) {
                    const originalText = copyXmlBtn.textContent;
                    copyXmlBtn.textContent = 'Copied!';
                    setTimeout(() => {
                        copyXmlBtn.textContent = originalText;
                    }, 2000);
                }
            })
            .catch(err => {
                logger.error('Failed to copy text:', err);
                showErrorToUser('Failed to copy XML to clipboard');
            });
    }

    /**
     * Validate that the tree has exactly one root node
     * @returns {Object} - Validation result {isValid, message}
     */
    function validateRootNodes() {
        const nodes = stateManager.getNodes();
        const connections = stateManager.getConnections();

        if (nodes.length === 0) {
            return {
                isValid: false,
                message: "Error: No nodes found in the tree."
            };
        }

        // Find root nodes (nodes that have no parent)
        const targetIds = connections.map(c => c.target);
        const rootNodes = nodes.filter(node => !targetIds.includes(node.id));

        if (rootNodes.length === 0) {
            return {
                isValid: false,
                message: "Error: No root node found. Every behavior tree must have exactly one root node."
            };
        } else if (rootNodes.length > 1) {
            return {
                isValid: false,
                message: `Error: Multiple root nodes found (${rootNodes.length}). A behavior tree must have exactly one root node.`
            };
        }

        return { isValid: true, message: "" };
    }

    /**
     * Build tree hierarchy for XML export
     * @returns {Object|null} - Tree hierarchy or null if invalid
     */
    function buildTreeHierarchy() {
        const nodes = stateManager.getNodes();
        const connections = stateManager.getConnections();

        // Find root node
        const targetIds = connections.map(c => c.target);
        const rootNodes = nodes.filter(node => !targetIds.includes(node.id));

        if (rootNodes.length === 0) {
            return null;
        }

        // Select the first root as the main root
        const root = rootNodes[0];

        // Recursively build the tree
        return buildNodeHierarchy(root.id);
    }

    /**
     * Build hierarchy for a specific node
     * @param {string} nodeId - Node ID
     * @returns {Object|null} - Node hierarchy or null if invalid
     */
    function buildNodeHierarchy(nodeId) {
        const nodes = stateManager.getNodes();
        const connections = stateManager.getConnections();

        const node = nodes.find(n => n.id === nodeId);
        if (!node) return null;

        // Find child connections
        const childConnections = connections.filter(c => c.source === nodeId);

        // Build child hierarchies
        const children = childConnections
            .map(conn => buildNodeHierarchy(conn.target))
            .filter(Boolean);

        return {
            ...node,
            children
        };
    }

    /**
     * Generate BehaviorTree.CPP compatible XML
     * @returns {string} - XML string
     */
    function generateBehaviorTreeXml() {
        const treeHierarchy = buildTreeHierarchy();
        const customNodes = stateManager.getCustomNodeTypes();

        if (!treeHierarchy) {
            return '<root BTCPP_format="4">\n  <!-- No valid tree structure found -->\n</root>';
        }

        let xml = '<?xml version="1.0"?>\n';
        xml += '<root BTCPP_format="4">\n';
        xml += '  <BehaviorTree ID="MainTree">\n';

        // Recursively add nodes
        xml += generateNodeXml(treeHierarchy, 4);

        xml += '  </BehaviorTree>\n';

        // Add TreeNodesModel section with custom node definitions
        if (customNodes.length > 0) {
            xml += '  <TreeNodesModel>\n';

            customNodes.forEach(nodeType => {
                xml += `    <Node ID="${escapeXml(nodeType.type)}" `;

                // Add category
                switch (nodeType.category) {
                    case 'control':
                        xml += 'NodeType="Control"';
                        break;
                    case 'decorator':
                        xml += 'NodeType="Decorator"';
                        break;
                    case 'action':
                        xml += 'NodeType="Action"';
                        break;
                    case 'condition':
                        xml += 'NodeType="Condition"';
                        break;
                    default:
                        xml += 'NodeType="SubTree"';
                }

                xml += '/>\n';
            });

            xml += '  </TreeNodesModel>\n';
        }

        xml += '</root>';

        return xml;
    }

    /**
     * Generate XML for a node and its children
     * @param {Object} node - Node hierarchy
     * @param {number} indent - Indentation level
     * @returns {string} - XML string
     */
    function generateNodeXml(node, indent) {
        const spaces = ' '.repeat(indent);
        const hasChildren = node.children && node.children.length > 0;

        let params = '';
        for (const [key, value] of Object.entries(node.properties)) {
            if (value) {
                params += ` ${key}="${escapeXml(value)}"`;
            }
        }

        if (!hasChildren) {
            // Leaf node (Action or Condition typically)
            return `${spaces}<${escapeXml(node.type)} name="${escapeXml(node.name)}"${params}/>\n`;
        } else {
            // Node with children
            let xml = `${spaces}<${escapeXml(node.type)} name="${escapeXml(node.name)}"${params}>\n`;

            // Add children
            for (const child of node.children) {
                xml += generateNodeXml(child, indent + 2);
            }

            xml += `${spaces}</${escapeXml(node.type)}>\n`;
            return xml;
        }
    }

    /**
     * Escape XML special characters
     * @param {string} str - String to escape
     * @returns {string} - Escaped string
     */
    function escapeXml(str) {
        if (str === undefined || str === null) return '';

        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Validate imported tree data
     * @param {Object} data - Imported data
     * @returns {boolean} - Whether data is valid
     */
    function isValidTreeData(data) {
        // Basic validation
        if (!data || typeof data !== 'object') return false;

        // Check required properties
        if (!Array.isArray(data.nodes)) return false;
        if (!Array.isArray(data.connections)) return false;

        // Check node format
        for (const node of data.nodes) {
            if (typeof node !== 'object') return false;
            if (typeof node.id !== 'string') return false;
            if (typeof node.type !== 'string') return false;
            if (typeof node.category !== 'string') return false;
            if (typeof node.x !== 'number') return false;
            if (typeof node.y !== 'number') return false;
            if (typeof node.properties !== 'object') return false;
        }

        // Check connection format
        for (const conn of data.connections) {
            if (typeof conn !== 'object') return false;
            if (typeof conn.id !== 'string') return false;
            if (typeof conn.source !== 'string') return false;
            if (typeof conn.target !== 'string') return false;
        }

        return true;
    }

    /**
     * Set up event listeners
     */
    function setupEventListeners() {
        // Listen for save/load/export events
        editorEvents.on(EDITOR_EVENTS.SAVE_REQUESTED, saveTree);
        editorEvents.on(EDITOR_EVENTS.LOAD_REQUESTED, loadTree);
        editorEvents.on(EDITOR_EVENTS.EXPORT_XML_REQUESTED, exportXml);
        editorEvents.on(EDITOR_EVENTS.CLEAR_REQUESTED, clearTree);

        // Add buttons event listeners
        const saveBtn = document.getElementById('save-btn');
        const loadBtn = document.getElementById('load-btn');
        const clearBtn = document.getElementById('clear-btn');
        const exportXmlBtn = document.getElementById('export-xml-btn');
        const copyXmlBtn = document.getElementById('copy-xml-btn');
        const closeXmlModal = document.getElementById('close-xml-modal');

        if (saveBtn) {
            saveBtn.addEventListener('click', saveTree);
        }

        if (loadBtn) {
            loadBtn.addEventListener('click', loadTree);
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', clearTree);
        }

        if (exportXmlBtn) {
            exportXmlBtn.addEventListener('click', exportXml);
        }

        if (copyXmlBtn) {
            copyXmlBtn.addEventListener('click', copyXmlToClipboard);
        }

        if (closeXmlModal) {
            closeXmlModal.addEventListener('click', () => {
                const { xmlModal } = elements;
                if (xmlModal) {
                    xmlModal.style.display = 'none';
                }
            });
        }

        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            const { xmlModal } = elements;
            if (xmlModal && e.target === xmlModal) {
                xmlModal.style.display = 'none';
            }
        });
    }

    // Return public API
    return {
        saveTree,
        loadTree,
        clearTree,
        exportXml,
        copyXmlToClipboard,
        validateRootNodes
    };
}