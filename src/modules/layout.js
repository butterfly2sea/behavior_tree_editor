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
        // 批量更新所有节点
        stateManager.batchUpdateNodes(positions);

        // 清理任何未完成的操作
        stateManager.cleanupAfterLayout();

        // 重置任何活动的选择框
        if (stateManager.getState().selectionBox.active) {
            stateManager.endSelectionBox();
            const box = document.getElementById('selection-box');
            if (box) box.remove();
        }

        // 通知布局完成
        eventBus.emit(EVENTS.LAYOUT_CHANGED, {
            type: 'completed',
            affectedNodes: positions.map(pos => pos.id)
        });

        // 强制完全渲染
        renderer.requestFullRender();
    }

    /**
     * Apply hierarchical (tree) layout
     */
    function applyHierarchicalLayout() {
        // 找到所有根节点
        const rootNodes = findRootNodes();
        if (rootNodes.length === 0) return [];

        // 如果只有一棵树，使用原始布局
        if (rootNodes.length === 1) {
            const treeHierarchy = buildTreeHierarchy(rootNodes[0]);
            if (treeHierarchy) {
                return calculateHierarchicalPositions(treeHierarchy);
            }
            return [];
        }

        // 为多棵树计算布局
        return calculateMultiTreeLayout(rootNodes);
    }

    /**
     * 计算多棵树的智能布局
     * @param {Array} rootNodes - 所有根节点
     * @returns {Array} - 所有节点的位置数组
     */
    function calculateMultiTreeLayout(rootNodes) {
        const options = stateManager.getLayout().options;
        const treeSpacingX = config.layout.treeSpacingX || 300;
        const treeSpacingY = config.layout.treeSpacingY || 200;

        // 先计算每棵树的独立布局和尺寸
        const treeLayouts = [];

        for (const rootNode of rootNodes) {
            const treeHierarchy = buildTreeHierarchy(rootNode);
            if (!treeHierarchy) continue;

            // 计算这棵树的布局（相对于原点）
            const positions = calculateHierarchicalPositions(treeHierarchy);

            // 计算树的边界
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

            positions.forEach(pos => {
                minX = Math.min(minX, pos.x);
                minY = Math.min(minY, pos.y);
                maxX = Math.max(maxX, pos.x + config.nodeWidth);
                maxY = Math.max(maxY, pos.y + config.nodeHeight);
            });

            // 计算这棵树的尺寸
            const width = maxX - minX;
            const height = maxY - minY;

            // 存储这棵树的布局信息
            treeLayouts.push({
                rootId: rootNode.id,
                positions,
                bounds: {minX, minY, maxX, maxY},
                width,
                height
            });
        }

        // 获取视口尺寸
        const viewport = stateManager.getViewport();
        const canvas = document.getElementById('canvas');
        const canvasWidth = canvas.clientWidth / viewport.scale;
        const canvasHeight = canvas.clientHeight / viewport.scale;

        // 计算合适的行列数
        const numTrees = treeLayouts.length;

        // 根据屏幕宽高比确定列数
        const aspectRatio = canvasWidth / canvasHeight;
        const numColumns = Math.min(
            numTrees,
            Math.max(1, Math.round(Math.sqrt(numTrees * aspectRatio)))
        );
        const numRows = Math.ceil(numTrees / numColumns);

        // 使用树布局位置，创建一个二维网格
        const grid = [];
        for (let i = 0; i < numRows; i++) {
            grid.push(new Array(numColumns).fill(null));
        }

        // 将树分配到网格中
        treeLayouts.forEach((tree, index) => {
            const row = Math.floor(index / numColumns);
            const col = index % numColumns;
            grid[row][col] = tree;
        });

        // 计算每列的最大宽度和每行的最大高度
        const columnWidths = new Array(numColumns).fill(0);
        const rowHeights = new Array(numRows).fill(0);

        for (let row = 0; row < numRows; row++) {
            for (let col = 0; col < numColumns; col++) {
                const tree = grid[row][col];
                if (tree) {
                    columnWidths[col] = Math.max(columnWidths[col], tree.width);
                    rowHeights[row] = Math.max(rowHeights[row], tree.height);
                }
            }
        }

        // 计算每行和每列的累积位置（考虑间距）
        const columnPositions = [0];
        for (let i = 1; i < numColumns; i++) {
            columnPositions[i] = columnPositions[i - 1] + columnWidths[i - 1] + treeSpacingX;
        }

        const rowPositions = [0];
        for (let i = 1; i < numRows; i++) {
            rowPositions[i] = rowPositions[i - 1] + rowHeights[i - 1] + treeSpacingY;
        }

        // 计算整个网格的尺寸
        const gridWidth = columnPositions[numColumns - 1] + columnWidths[numColumns - 1];
        const gridHeight = rowPositions[numRows - 1] + rowHeights[numRows - 1];

        // 计算网格起始坐标（使网格居中）
        const startX = (canvasWidth - gridWidth) / 2;
        const startY = (canvasHeight - gridHeight) / 2;

        // 为每棵树应用网格布局偏移
        let allPositions = [];

        for (let row = 0; row < numRows; row++) {
            for (let col = 0; col < numColumns; col++) {
                const tree = grid[row][col];
                if (!tree) continue;

                // 计算树在单元格中的位置（居中）
                const cellOffsetX = (columnWidths[col] - tree.width) / 2;
                const cellOffsetY = (rowHeights[row] - tree.height) / 2;

                // 计算最终偏移
                const offsetX = startX + columnPositions[col] + cellOffsetX - tree.bounds.minX;
                const offsetY = startY + rowPositions[row] + cellOffsetY - tree.bounds.minY;

                // 应用偏移到树的所有节点
                const offsetPositions = tree.positions.map(pos => ({
                    ...pos,
                    x: pos.x + offsetX,
                    y: pos.y + offsetY
                }));

                // 添加到所有位置
                allPositions = [...allPositions, ...offsetPositions];
            }
        }

        return allPositions;
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
                .filter(Boolean)
                .sort((a, b) => a.x - b.x);

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

        // 创建位置映射以便快速查找
        const posMap = {};
        newPositions.forEach(pos => {
            posMap[pos.id] = pos;
        });

        // 动画帧函数
        function animate() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // 应用插值位置
            originalPositions.forEach(origPos => {
                const newPos = posMap[origPos.id];
                if (newPos) {
                    const x = origPos.x + (newPos.x - origPos.x) * progress;
                    const y = origPos.y + (newPos.y - origPos.y) * progress;

                    stateManager.updateNode(origPos.id, {x, y});
                }
            });

            // 请求完整渲染包括连接线
            renderer.requestFullRender();

            // 继续动画如果没有完成
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // 动画完成
                if (onComplete) onComplete();
            }
        }

        // 开始动画
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
        applyForceDirectedLayout,
        findRootNodes
    };
}