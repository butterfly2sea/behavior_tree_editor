/**
 * Layout module
 * Provides algorithms for automatic layout of behavior trees
 */

import { editorEvents, EDITOR_EVENTS } from './events.js';
import { logger } from '../index.js';

export function initLayout(elements, state, renderer) {
    const stateManager = state;

    logger.debug('Initializing layout module');

    // Set up event listeners
    setupEventListeners();

    /**
     * Apply layout based on the current layout settings
     */
    function applyLayout() {
        logger.debug('Applying layout');

        const layoutSettings = stateManager.getLayout();

        switch (layoutSettings.type) {
            case 'hierarchical':
                applyHierarchicalLayout();
                break;

            case 'forcedirected':
                applyForceDirectedLayout();
                break;

            default:
                logger.warn(`Unknown layout type: ${layoutSettings.type}`);
        }
    }

    /**
     * Apply hierarchical (tree-like) layout
     */
    function applyHierarchicalLayout() {
        logger.debug('Applying hierarchical layout');

        // Build tree hierarchy
        const rootNodes = findRootNodes();
        if (rootNodes.length === 0) {
            logger.warn('No root nodes found for layout');
            return;
        }

        // Use the first root node if multiple roots exist
        const rootNode = rootNodes[0];
        const treeHierarchy = buildTreeHierarchy(rootNode.id);

        if (!treeHierarchy) {
            logger.warn('Failed to build tree hierarchy');
            return;
        }

        // Store original positions for animation
        const originalPositions = stateManager.getNodes().map(node => ({
            id: node.id,
            x: node.x,
            y: node.y
        }));

        // Calculate new positions
        const newPositions = calculateHierarchicalPositions(treeHierarchy);

        if (stateManager.getLayout().options.animation) {
            // Animate to new positions
            animateNodePositions(originalPositions, newPositions);
        } else {
            // Apply new positions immediately
            applyNewPositions(newPositions);
        }

        logger.debug('Hierarchical layout applied');
    }

    /**
     * Apply force-directed layout
     */
    function applyForceDirectedLayout() {
        logger.debug('Applying force-directed layout');

        const nodes = stateManager.getNodes();
        const connections = stateManager.getConnections();
        const layoutOptions = stateManager.getLayout().options;

        if (nodes.length === 0) {
            logger.warn('No nodes found for layout');
            return;
        }

        // Store original positions for animation
        const originalPositions = nodes.map(node => ({
            id: node.id,
            x: node.x,
            y: node.y
        }));

        // Calculate force-directed layout
        const newPositions = calculateForceDirectedPositions(nodes, connections, layoutOptions);

        if (layoutOptions.animation) {
            // Animate to new positions
            animateNodePositions(originalPositions, newPositions);
        } else {
            // Apply new positions immediately
            applyNewPositions(newPositions);
        }

        logger.debug('Force-directed layout applied');
    }

    /**
     * Find root nodes in the tree
     * @returns {Array} - Array of root nodes
     */
    function findRootNodes() {
        const nodes = stateManager.getNodes();
        const connections = stateManager.getConnections();

        // Root nodes are nodes that have no parent (no incoming connections)
        const targetIds = connections.map(c => c.target);
        return nodes.filter(node => !targetIds.includes(node.id));
    }

    /**
     * Build tree hierarchy from a root node
     * @param {string} rootId - ID of the root node
     * @returns {Object} - Tree hierarchy object
     */
    function buildTreeHierarchy(rootId) {
        const node = stateManager.getNodes().find(n => n.id === rootId);
        if (!node) return null;

        // Find child connections
        const childConnections = stateManager.getConnections().filter(c => c.source === rootId);

        // Build child hierarchies
        const children = childConnections
            .map(conn => buildTreeHierarchy(conn.target))
            .filter(Boolean);

        return {
            ...node,
            children
        };
    }

    /**
     * Calculate positions for hierarchical layout
     * @param {Object} rootNode - Root node of the hierarchy
     * @returns {Array} - Array of position objects {id, x, y}
     */
    function calculateHierarchicalPositions(rootNode) {
        const positions = [];
        const levelWidths = [];
        const nodesByLevel = [];
        const layoutOptions = stateManager.getLayout().options;

        // First pass: calculate width and collect nodes for each level
        function calculateLevelData(node, level) {
            if (!nodesByLevel[level]) {
                nodesByLevel[level] = [];
                levelWidths[level] = 0;
            }

            nodesByLevel[level].push(node);
            levelWidths[level] += 1;

            if (node.children && node.children.length > 0) {
                node.children.forEach(child => {
                    calculateLevelData(child, level + 1);
                });
            }
        }

        calculateLevelData(rootNode, 0);

        // Second pass: position nodes
        for (let level = 0; level < nodesByLevel.length; level++) {
            const nodesInLevel = nodesByLevel[level];
            const levelWidth = levelWidths[level];
            const spacing = layoutOptions.nodeSpacingX;
            const totalWidth = (levelWidth - 1) * spacing;
            const startX = -totalWidth / 2;

            for (let i = 0; i < nodesInLevel.length; i++) {
                const node = nodesInLevel[i];

                // Calculate position
                const x = startX + i * spacing;
                const y = level * layoutOptions.nodeSpacingY;

                positions.push({
                    id: node.id,
                    x: x,
                    y: y
                });
            }
        }

        return positions;
    }

    /**
     * Calculate positions for force-directed layout
     * @param {Array} nodes - Array of nodes
     * @param {Array} connections - Array of connections
     * @param {Object} options - Layout options
     * @returns {Array} - Array of position objects {id, x, y}
     */
    function calculateForceDirectedPositions(nodes, connections, options) {
        // This is a simplified force-directed layout implementation
        // A real implementation would use more sophisticated physics simulation

        // Create a copy of node positions for manipulation
        const positions = nodes.map(node => ({
            id: node.id,
            x: node.x,
            y: node.y,
            vx: 0,
            vy: 0
        }));

        // Parameters
        const repulsionForce = options.repulsionForce || 500;
        const attractionForce = options.attractionForce || 0.1;
        const iterations = options.iterations || 100;
        const nodeDistance = options.nodeSpacingX || 200;

        // Run simulation
        for (let i = 0; i < iterations; i++) {
            // Apply repulsion forces between all nodes
            for (let a = 0; a < positions.length; a++) {
                for (let b = a + 1; b < positions.length; b++) {
                    const nodeA = positions[a];
                    const nodeB = positions[b];

                    const dx = nodeB.x - nodeA.x;
                    const dy = nodeB.y - nodeA.y;
                    const distance = Math.sqrt(dx * dx + dy * dy) || 1;

                    // Apply repulsion force (inverse square law)
                    const force = repulsionForce / (distance * distance);
                    const forceX = (dx / distance) * force;
                    const forceY = (dy / distance) * force;

                    nodeA.vx -= forceX;
                    nodeA.vy -= forceY;
                    nodeB.vx += forceX;
                    nodeB.vy += forceY;
                }
            }

            // Apply attraction forces along connections
            for (const connection of connections) {
                const source = positions.find(p => p.id === connection.source);
                const target = positions.find(p => p.id === connection.target);

                if (source && target) {
                    const dx = target.x - source.x;
                    const dy = target.y - source.y;
                    const distance = Math.sqrt(dx * dx + dy * dy) || 1;

                    // Apply spring force (proportional to distance)
                    const force = (distance - nodeDistance) * attractionForce;
                    const forceX = (dx / distance) * force;
                    const forceY = (dy / distance) * force;

                    source.vx += forceX;
                    source.vy += forceY;
                    target.vx -= forceX;
                    target.vy -= forceY;
                }
            }

            // Update positions with velocity
            for (const node of positions) {
                // Apply damping
                node.vx *= 0.9;
                node.vy *= 0.9;

                // Update position
                node.x += node.vx;
                node.y += node.vy;
            }
        }

        // Return final positions (without velocity data)
        return positions.map(({ id, x, y }) => ({ id, x, y }));
    }

    /**
     * Apply new positions to nodes
     * @param {Array} positions - Array of position objects {id, x, y}
     */
    function applyNewPositions(positions) {
        // Update node positions in state
        positions.forEach(pos => {
            stateManager.updateNode(pos.id, { x: pos.x, y: pos.y });
        });

        // Notify about node movement
        editorEvents.emit(EDITOR_EVENTS.NODE_MOVED, positions.map(pos => pos.id));

        // Request render update
        renderer.requestRender();
    }

    /**
     * Animate nodes to new positions
     * @param {Array} originalPositions - Original positions {id, x, y}
     * @param {Array} newPositions - Target positions {id, x, y}
     */
    function animateNodePositions(originalPositions, newPositions) {
        const layoutOptions = stateManager.getLayout().options;
        const duration = layoutOptions.animationDuration || 500;
        const startTime = Date.now();

        // Create a map of positions by ID for faster lookup
        const posMap = {};
        newPositions.forEach(pos => {
            posMap[pos.id] = pos;
        });

        function animate() {
            const now = Date.now();
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Apply interpolated positions
            originalPositions.forEach(origPos => {
                const newPos = posMap[origPos.id];
                if (newPos) {
                    const x = origPos.x + (newPos.x - origPos.x) * progress;
                    const y = origPos.y + (newPos.y - origPos.y) * progress;

                    stateManager.updateNode(origPos.id, { x, y });
                }
            });

            // Request render update
            renderer.requestRender();

            // Continue animation if not complete
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Notify about node movement at the end of animation
                editorEvents.emit(EDITOR_EVENTS.NODE_MOVED, originalPositions.map(pos => pos.id));
            }
        }

        // Start animation
        requestAnimationFrame(animate);
    }

    /**
     * Update layout settings
     * @param {Object} updates - Updates to layout settings
     */
    function updateLayoutSettings(updates) {
        stateManager.updateLayoutSettings(updates);
    }

    /**
     * Set up event listeners
     */
    function setupEventListeners() {
        // Listen for auto-layout button click
        const autoLayoutBtn = document.getElementById('auto-layout-btn');
        if (autoLayoutBtn) {
            autoLayoutBtn.addEventListener('click', applyLayout);
        }

        // Listen for layout type selection
        const layoutTypeSelect = document.getElementById('layout-type');
        if (layoutTypeSelect) {
            layoutTypeSelect.addEventListener('change', e => {
                updateLayoutSettings({ type: e.target.value });
            });
        }

        // Listen for layout requests from other modules
        editorEvents.on(EDITOR_EVENTS.LAYOUT_REQUESTED, applyLayout);
    }

    // Return public API
    return {
        applyLayout,
        applyHierarchicalLayout,
        applyForceDirectedLayout,
        updateLayoutSettings
    };
}