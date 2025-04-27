/**
 * Serialization Module - Handles saving, loading, and exporting
 */
import {eventBus, EVENTS} from '../core/events.js';
import {logger} from '../utils/logger.js';
import {showErrorToast} from '../index.js';

export function initSerialization(elements, state) {
    const stateManager = state;

    /**
     * Save the current tree to a JSON file
     */
    function saveTree() {
        // Validate tree structure
        const validation = validateRootNodes();
        if (!validation.isValid) {
            showErrorToast(validation.message);
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

            // Create a Blob and download using modern File API
            const blob = new Blob([JSON.stringify(treeData, null, 2)], {type: 'application/json'});
            const url = URL.createObjectURL(blob);

            // Create download link
            const a = document.createElement('a');
            a.href = url;
            a.download = 'behavior_tree.json';
            a.click();

            // Clean up
            URL.revokeObjectURL(url);

            logger.info('Behavior tree saved successfully');
        } catch (error) {
            logger.error('Error saving tree:', error);
            showErrorToast('Failed to save tree: ' + error.message);
        }
    }

    /**
     * Load a tree from a JSON file
     */
    function loadTree() {
        try {
            // Create file input programmatically
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';

            input.onchange = async (event) => {
                const file = event.target.files[0];
                if (!file) return;

                try {
                    // Read file using modern File API
                    const content = await file.text();
                    const data = JSON.parse(content);

                    // Validate data
                    if (!isValidTreeData(data)) {
                        throw new Error('Invalid behavior tree file format');
                    }

                    // Prepare the state to load
                    const newState = {
                        nodes: data.nodes || [],
                        connections: data.connections || [],
                        customNodeTypes: data.customNodeTypes || [],
                        collapsedCategories: data.collapsedCategories || {},
                        grid: data.grid || stateManager.getGrid(),

                        // Reset these values
                        selectedNodes: [],
                        selectedConnection: null,
                        pendingConnection: null,

                        // Keep current viewport
                        viewport: stateManager.getViewport(),

                        // ID counters
                        idCounters: {
                            nodes: calculateNextNodeId(data.nodes),
                            connections: calculateNextConnectionId(data.connections)
                        }
                    };

                    // Load state
                    stateManager.loadState(newState);

                    logger.info('Behavior tree loaded successfully');
                } catch (error) {
                    logger.error('Error parsing tree file:', error);
                    showErrorToast('Error parsing tree file: ' + error.message);
                }
            };

            // Trigger file selection
            input.click();
        } catch (error) {
            logger.error('Error loading tree:', error);
            showErrorToast('Failed to load tree: ' + error.message);
        }
    }

    /**
     * Calculate next node ID counter
     */
    function calculateNextNodeId(nodes) {
        if (!nodes || nodes.length === 0) return 0;

        return nodes.reduce((max, node) => {
            const idNum = parseInt(node.id.replace('node_', ''));
            return isNaN(idNum) ? max : Math.max(max, idNum + 1);
        }, 0);
    }

    /**
     * Calculate next connection ID counter
     */
    function calculateNextConnectionId(connections) {
        if (!connections || connections.length === 0) return 0;

        return connections.reduce((max, conn) => {
            const idNum = parseInt(conn.id.replace('conn_', ''));
            return isNaN(idNum) ? max : Math.max(max, idNum + 1);
        }, 0);
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
        // Validate the tree
        const validation = validateRootNodes();
        if (!validation.isValid) {
            showErrorToast(validation.message);
            return;
        }

        try {
            // Generate XML
            const xmlStr = generateBehaviorTreeXml();

            // Show in XML modal
            const {xmlModal, xmlContent} = elements;

            if (xmlContent) {
                xmlContent.textContent = xmlStr;
            }

            if (xmlModal) {
                xmlModal.style.display = 'block';
            }

            logger.info('Behavior tree exported to XML');
        } catch (error) {
            logger.error('Error exporting XML:', error);
            showErrorToast('Failed to export XML: ' + error.message);
        }
    }

    /**
     * Validate that the tree has exactly one root node
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

        return {isValid: true, message: ""};
    }

    /**
     * Build tree hierarchy for XML export
     */
    function buildTreeHierarchy() {
        const nodes = stateManager.getNodes();
        const connections = stateManager.getConnections();

        // Find root node
        const targetIds = connections.map(c => c.target);
        const rootNodes = nodes.filter(node => !targetIds.includes(node.id));

        if (rootNodes.length === 0) return null;

        // Select the first root as the main root
        const root = rootNodes[0];

        // Build hierarchy recursively
        function buildNodeHierarchy(nodeId) {
            const node = nodes.find(n => n.id === nodeId);
            if (!node) return null;

            // 找到子节点连接
            const childConnections = connections.filter(c => c.source === nodeId);

            // 获取子节点并排序
            const children = childConnections
                .map(conn => {
                    const childNode = nodes.find(n => n.id === conn.target);
                    return childNode ? buildNodeHierarchy(conn.target) : null;
                })
                .filter(Boolean)
                .sort((a, b) => a.x - b.x); // 按X坐标排序

            return {
                ...node,
                children
            };
        }

        return buildNodeHierarchy(root.id);
    }

    /**
     * Generate XML for BehaviorTree.CPP
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
     */
    function generateNodeXml(node, indent) {
        const spaces = ' '.repeat(indent);
        const hasChildren = node.children && node.children.length > 0;

        // Generate parameters string
        let params = '';
        for (const [key, value] of Object.entries(node.properties)) {
            if (value) {
                params += ` ${key}="${escapeXml(value)}"`;
            }
        }

        if (!hasChildren) {
            // Leaf node
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
     */
    function escapeXml(str) {
        if (str === undefined || str === null) return '';

        // Use safe replacement with character references
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Copy XML content to clipboard
     */
    function copyXmlToClipboard() {
        const {xmlContent} = elements;
        if (!xmlContent) return;

        const textToCopy = xmlContent.textContent;

        // Use modern Clipboard API
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
                showErrorToast('Failed to copy XML to clipboard');
            });
    }

    /**
     * Validate imported tree data
     */
    function isValidTreeData(data) {
        // Basic validation
        if (!data || typeof data !== 'object') return false;
        if (!Array.isArray(data.nodes)) return false;
        if (!Array.isArray(data.connections)) return false;

        // Basic format checks
        try {
            for (const node of data.nodes) {
                if (typeof node !== 'object') return false;
                if (typeof node.id !== 'string') return false;
                if (typeof node.type !== 'string') return false;
                if (typeof node.category !== 'string') return false;
                if (typeof node.x !== 'number') return false;
                if (typeof node.y !== 'number') return false;
                if (typeof node.properties !== 'object') return false;
            }

            for (const conn of data.connections) {
                if (typeof conn !== 'object') return false;
                if (typeof conn.id !== 'string') return false;
                if (typeof conn.source !== 'string') return false;
                if (typeof conn.target !== 'string') return false;
            }
        } catch (e) {
            return false;
        }

        return true;
    }

    /**
     * Set up event listeners
     */
    function setupEventListeners() {
        // Listen for toolbar actions
        eventBus.on(EVENTS.TOOLBAR_ACTION, (data) => {
            switch (data.action) {
                case 'save':
                    saveTree();
                    break;
                case 'load':
                    loadTree();
                    break;
                case 'export-xml':
                    exportXml();
                    break;
                case 'clear':
                    clearTree();
                    break;
            }
        });

        // Copy XML button
        const copyXmlBtn = document.getElementById('copy-xml-btn');
        if (copyXmlBtn) {
            copyXmlBtn.addEventListener('click', copyXmlToClipboard);
        }

        // Close XML modal
        const closeXmlModal = document.getElementById('close-xml-modal');
        if (closeXmlModal) {
            closeXmlModal.addEventListener('click', () => {
                elements.xmlModal.style.display = 'none';
            });
        }

        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === elements.xmlModal) {
                elements.xmlModal.style.display = 'none';
            }
        });
    }

    // Initialize
    setupEventListeners();

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