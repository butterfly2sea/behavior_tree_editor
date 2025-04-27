/**
 * Layout Module - Handles automatic layout of nodes
 */
import {eventBus, EVENTS} from '../core/events.js';
import {logger} from '../utils/logger.js';
import {config} from '../core/config.js';

export function initLayout(elements, state, renderer) {
    const stateManager = state;

    /**
     * Apply layout based on current settings
     */
    function applyLayout() {
        const layoutSettings = stateManager.getLayout();
        let positions = [];

        logger.debug(`Applying ${layoutSettings.type} layout`);

        // Apply the appropriate layout algorithm
        switch (layoutSettings.type) {
            case 'hierarchical':
                positions = applyHierarchicalLayout();
                break;
            case 'forcedirected':
                positions = applyForceDirectedLayout();
                break;
            default:
                logger.warn(`Unknown layout type: ${layoutSettings.type}`);
                return;
        }

        if (!positions || positions.length === 0) {
            logger.warn('Layout generated no positions');
            return;
        }

        // Store original positions for animation
        const originalPositions = stateManager.getNodes().map(node => ({
            id: node.id,
            x: node.x,
            y: node.y
        }));

        if (layoutSettings.options.animation) {
            // Animate to new positions
            animateNodePositions(originalPositions, positions, () => {
                // Animation complete - ensure state is clean
                updateStateAfterLayout(positions);
            });
        } else {
            // Apply immediately
            updateStateAfterLayout(positions);
        }
    }

    /**
     * Update state after layout is applied
     * This ensures state consistency after layout operations
     */
    function updateStateAfterLayout(positions) {
        // Batch update all nodes
        stateManager.batchUpdateNodes(positions);

        // Clean up any pending operations
        stateManager.cleanupAfterLayout();

        // Notify about layout completion
        eventBus.emit(EVENTS.LAYOUT_CHANGED, {
            type: 'completed',
            affectedNodes: positions.map(pos => pos.id)
        });

        // Force full render
        renderer.requestFullRender();
    }

    /**
     * Apply hierarchical (tree) layout
     */
    function applyHierarchicalLayout() {
        // Find root nodes
        const rootNodes = findRootNodes();
        if (rootNodes.length === 0) return [];

        // Use first root if multiple roots exist
        const rootNode = rootNodes[0];

        // Build tree hierarchy
        const treeHierarchy = buildTreeHierarchy(rootNode);
        if (!treeHierarchy) return [];

        // Calculate positions
        return calculateHierarchicalPositions(treeHierarchy);
    }

    /**
     * Find root nodes (nodes with no parents)
     */
    function findRootNodes() {
        const nodes = stateManager.getNodes();
        const connections = stateManager.getConnections();

        // Collect all target node IDs
        const targetIds = connections.map(conn => conn.target);

        // Nodes that are not targets are roots
        return nodes.filter(node => !targetIds.includes(node.id));
    }

    /**
     * Build tree hierarchy from a root node
     */
    function buildTreeHierarchy(rootNode) {
        if (!rootNode) return null;

        const nodes = stateManager.getNodes();
        const connections = stateManager.getConnections();

        function buildSubtree(nodeId) {
            const node = nodes.find(n => n.id === nodeId);
            if (!node) return null;

            // Find child connections
            const childConnections = connections.filter(conn => conn.source === nodeId);

            // Build child hierarchies recursively
            const children = childConnections
                .map(conn => buildSubtree(conn.target))
                .filter(Boolean);

            return {...node, children};
        }

        return buildSubtree(rootNode.id);
    }

    /**
     * Calculate positions for hierarchical layout
     */
    function calculateHierarchicalPositions(rootHierarchy) {
        const positions = [];
        const levelHeights = []; // Height of each level
        const levelNodesCount = []; // Number of nodes at each level
        const options = stateManager.getLayout().options;

        // First pass: count nodes per level and determine level heights
        function measureLevels(node, level = 0) {
            if (!levelNodesCount[level]) {
                levelNodesCount[level] = 0;
                levelHeights[level] = config.nodeHeight;
            }

            levelNodesCount[level]++;

            if (node.children && node.children.length > 0) {
                node.children.forEach(child => measureLevels(child, level + 1));
            }
        }

        measureLevels(rootHierarchy);

        // Calculate the total width required for each level
        const levelWidths = levelNodesCount.map(count =>
            count * config.nodeWidth + (count - 1) * options.nodeSpacingX);

        // Second pass: position nodes
        function positionNodes(node, level = 0, index = 0, levelStartX = 0) {
            // Calculate horizontal position
            const x = levelStartX + index * (config.nodeWidth + options.nodeSpacingX);

            // Calculate vertical position
            const y = level * (config.nodeHeight + options.nodeSpacingY);

            // Store position
            positions.push({id: node.id, x, y});

            // Position children
            if (node.children && node.children.length > 0) {
                const childLevelWidth = node.children.length * config.nodeWidth +
                    (node.children.length - 1) * options.nodeSpacingX;

                const childStartX = x + (config.nodeWidth - childLevelWidth) / 2;

                node.children.forEach((child, childIndex) => {
                    positionNodes(child, level + 1, childIndex, childStartX);
                });
            }
        }

        // Start positioning from root
        const maxLevelWidth = Math.max(...levelWidths);
        const rootStartX = (maxLevelWidth - levelWidths[0]) / 2;
        positionNodes(rootHierarchy, 0, 0, rootStartX);

        return positions;
    }

    /**
     * Apply force-directed layout
     */
    function applyForceDirectedLayout() {
        const nodes = stateManager.getNodes();
        const connections = stateManager.getConnections();

        if (nodes.length === 0) return [];

        // Parameters
        const options = stateManager.getLayout().options;
        const iterations = 100;
        const repulsionForce = 500;
        const attractionForce = 0.1;
        const nodeDistance = options.nodeSpacingX;

        // Create a copy of nodes with positions and velocities
        const simulationNodes = nodes.map(node => ({
            id: node.id,
            x: node.x,
            y: node.y,
            vx: 0,
            vy: 0
        }));

        // Run simulation
        for (let i = 0; i < iterations; i++) {
            // Apply repulsion between all nodes
            for (let a = 0; a < simulationNodes.length; a++) {
                for (let b = a + 1; b < simulationNodes.length; b++) {
                    const nodeA = simulationNodes[a];
                    const nodeB = simulationNodes[b];

                    const dx = nodeB.x - nodeA.x;
                    const dy = nodeB.y - nodeA.y;
                    const distance = Math.sqrt(dx * dx + dy * dy) || 1;

                    // Apply repulsion
                    const force = repulsionForce / (distance * distance);
                    const forceX = (dx / distance) * force;
                    const forceY = (dy / distance) * force;

                    nodeA.vx -= forceX;
                    nodeA.vy -= forceY;
                    nodeB.vx += forceX;
                    nodeB.vy += forceY;
                }
            }

            // Apply attraction along connections
            for (const connection of connections) {
                const source = simulationNodes.find(n => n.id === connection.source);
                const target = simulationNodes.find(n => n.id === connection.target);

                if (source && target) {
                    const dx = target.x - source.x;
                    const dy = target.y - source.y;
                    const distance = Math.sqrt(dx * dx + dy * dy) || 1;

                    // Apply spring force
                    const force = (distance - nodeDistance) * attractionForce;
                    const forceX = (dx / distance) * force;
                    const forceY = (dy / distance) * force;

                    source.vx += forceX;
                    source.vy += forceY;
                    target.vx -= forceX;
                    target.vy -= forceY;
                }
            }

            // Update positions
            for (const node of simulationNodes) {
                // Apply damping
                node.vx *= 0.9;
                node.vy *= 0.9;

                // Update position
                node.x += node.vx;
                node.y += node.vy;
            }
        }

        // Return final positions
        return simulationNodes.map(({id, x, y}) => ({id, x, y}));
    }

    /**
     * Animate nodes from original to new positions
     */
    function animateNodePositions(originalPositions, newPositions, onComplete) {
        const options = stateManager.getLayout().options;
        const duration = options.animationDuration || 500;
        const startTime = Date.now();

        // Create a map of positions by ID for faster lookup
        const posMap = {};
        newPositions.forEach(pos => {
            posMap[pos.id] = pos;
        });

        // Animation frame function
        function animate() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Apply interpolated positions
            originalPositions.forEach(origPos => {
                const newPos = posMap[origPos.id];
                if (newPos) {
                    const x = origPos.x + (newPos.x - origPos.x) * progress;
                    const y = origPos.y + (newPos.y - origPos.y) * progress;

                    stateManager.updateNode(origPos.id, {x, y});
                }
            });

            // Request render
            renderer.requestRender();

            // Continue animation if not complete
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Animation complete
                if (onComplete) onComplete();
            }
        }

        // Start animation
        requestAnimationFrame(animate);
    }

    /**
     * Set up event listeners
     */
    function setupEventListeners() {
        // Auto layout button
        const autoLayoutBtn = document.getElementById('auto-layout-btn');
        if (autoLayoutBtn) {
            autoLayoutBtn.addEventListener('click', applyLayout);
        }

        // Layout type selection
        const layoutTypeSelect = document.getElementById('layout-type');
        if (layoutTypeSelect) {
            layoutTypeSelect.addEventListener('change', (e) => {
                stateManager.updateLayoutSettings({type: e.target.value});
            });
        }
    }

    // Initialize
    setupEventListeners();

    // Return public API
    return {
        applyLayout,
        applyHierarchicalLayout,
        applyForceDirectedLayout
    };
}