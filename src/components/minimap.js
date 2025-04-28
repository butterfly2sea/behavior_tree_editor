/**
 * Minimap Module - Provides an overview of the graph with navigation
 */
import {eventBus, EVENTS} from '../core/events.js';
import {logger} from '../utils/logger.js';
import {config} from '../core/config.js';

export function initMinimap(elements, state, renderer) {
    const stateManager = state;

    // Minimap state
    let isDragging = false;
    let lastMousePosition = {x: 0, y: 0};
    let minimapScale = 1;

    /**
     * Toggle minimap visibility
     */
    function toggleMinimap() {
        const {minimapContainer} = elements;
        const minimapState = stateManager.getMinimap();

        if (!minimapContainer) return;

        minimapState.isVisible = !minimapState.isVisible;
        minimapContainer.style.display = minimapState.isVisible ? 'block' : 'none';

        if (minimapState.isVisible) {
            renderMinimap();
        }
    }

    /**
     * Set minimap size
     */
    function setMinimapSize(width, height) {
        const {minimap, minimapContainer} = elements;

        if (!minimap || !minimapContainer) return;

        stateManager.getMinimap().width = width;
        stateManager.getMinimap().height = height;

        minimapContainer.style.width = `${width}px`;
        minimapContainer.style.height = `${height}px`;
        minimap.width = width;
        minimap.height = height;

        renderMinimap();
    }

    /**
     * Calculate the scale to fit all nodes in the minimap
     */
    function calculateMinimapScale(bounds) {
        const minimapState = stateManager.getMinimap();
        const padding = 10; // Padding around the content

        // Calculate scale to fit all nodes in the minimap
        const scaleX = (minimapState.width - padding * 2) / bounds.width;
        const scaleY = (minimapState.height - padding * 2) / bounds.height;

        // Use the smaller scale to ensure everything fits
        return Math.min(scaleX, scaleY);
    }

    /**
     * Get bounds of all nodes
     */
    function calculateNodesBounds(nodes) {
        if (nodes.length === 0) {
            return {
                minX: -500, minY: -500,
                maxX: 500, maxY: 500,
                width: 1000, height: 1000
            };
        }

        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        nodes.forEach(node => {
            minX = Math.min(minX, node.x);
            minY = Math.min(minY, node.y);
            maxX = Math.max(maxX, node.x + config.nodeWidth);
            maxY = Math.max(maxY, node.y + config.nodeHeight);
        });

        // Add padding
        minX -= 100;
        minY -= 100;
        maxX += 100;
        maxY += 100;

        return {
            minX, minY, maxX, maxY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    /**
     * Render the minimap
     */
    function renderMinimap() {
        const {minimap} = elements;
        if (!minimap) return;

        const nodes = stateManager.getNodes();
        const connections = stateManager.getConnections();
        const viewport = stateManager.getViewport();
        const minimapState = stateManager.getMinimap();

        const ctx = minimap.getContext('2d');
        ctx.clearRect(0, 0, minimapState.width, minimapState.height);

        // Calculate bounds of all nodes
        const bounds = calculateNodesBounds(nodes);

        // Calculate scale for the minimap
        minimapScale = calculateMinimapScale(bounds);
        const padding = 10;

        // Draw background
        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(0, 0, minimapState.width, minimapState.height);

        // Draw connections
        ctx.strokeStyle = '#999';
        ctx.lineWidth = 1;

        connections.forEach(conn => {
            const sourceNode = nodes.find(n => n.id === conn.source);
            const targetNode = nodes.find(n => n.id === conn.target);

            if (sourceNode && targetNode) {
                const sourceX = padding + (sourceNode.x + config.nodeWidth / 2 - bounds.minX) * minimapScale;
                const sourceY = padding + (sourceNode.y + config.nodeHeight / 2 - bounds.minY) * minimapScale;
                const targetX = padding + (targetNode.x + config.nodeWidth / 2 - bounds.minX) * minimapScale;
                const targetY = padding + (targetNode.y + config.nodeHeight / 2 - bounds.minY) * minimapScale;

                ctx.beginPath();
                ctx.moveTo(sourceX, sourceY);

                // Draw curved line
                const midX = (sourceX + targetX) / 2;
                const midY = (sourceY + targetY) / 2 + 20;
                ctx.quadraticCurveTo(midX, midY, targetX, targetY);
                ctx.stroke();
            }
        });

        // Draw nodes with category-based colors
        nodes.forEach(node => {
            const x = padding + (node.x - bounds.minX) * minimapScale;
            const y = padding + (node.y - bounds.minY) * minimapScale;
            const width = config.nodeWidth * minimapScale;
            const height = config.nodeHeight * minimapScale;

            // Set color based on node category
            let fillColor;
            switch (node.category) {
                case 'control':
                    fillColor = '#6ab8f1'; // Light blue
                    break;
                case 'decorator':
                    fillColor = '#7ff888'; // Light green
                    break;
                case 'action':
                    fillColor = '#f4c780'; // Light orange
                    break;
                case 'condition':
                    fillColor = '#e27cf1'; // Light purple
                    break;
                default:
                    fillColor = '#f67a7a';
            }

            ctx.fillStyle = fillColor;
            ctx.strokeStyle = '#666';
            ctx.lineWidth = 0.5;

            // Draw rounded rectangle for nodes
            const radius = 3;
            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + width - radius, y);
            ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
            ctx.lineTo(x + width, y + height - radius);
            ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
            ctx.lineTo(x + radius, y + height);
            ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
            ctx.lineTo(x, y + radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
            ctx.fill();
            ctx.stroke();
        });

        // Draw viewport rectangle
        const viewportMinX = -viewport.offsetX / viewport.scale;
        const viewportMinY = -viewport.offsetY / viewport.scale;
        const container = minimap.parentElement.parentElement;
        const viewportWidth = container.clientWidth / viewport.scale;
        const viewportHeight = container.clientHeight / viewport.scale;

        const viewportX = padding + (viewportMinX - bounds.minX) * minimapScale;
        const viewportY = padding + (viewportMinY - bounds.minY) * minimapScale;
        const viewportScaledWidth = viewportWidth * minimapScale;
        const viewportScaledHeight = viewportHeight * minimapScale;

        ctx.strokeStyle = '#2196f3'; // Primary color
        ctx.lineWidth = 2;
        ctx.strokeRect(viewportX, viewportY, viewportScaledWidth, viewportScaledHeight);

        // Fill with semi-transparent color
        ctx.fillStyle = 'rgba(33, 150, 243, 0.1)';
        ctx.fillRect(viewportX, viewportY, viewportScaledWidth, viewportScaledHeight);
    }

    /**
     * Convert minimap coordinates to world coordinates
     */
    function minimapToWorld(x, y) {
        const {minimap} = elements;
        if (!minimap) return {x: 0, y: 0};

        const minimapState = stateManager.getMinimap();
        const padding = 10;
        const nodes = stateManager.getNodes();
        const bounds = calculateNodesBounds(nodes);

        // Calculate world coordinates
        const worldX = bounds.minX + (x - padding) / minimapScale;
        const worldY = bounds.minY + (y - padding) / minimapScale;

        return {x: worldX, y: worldY};
    }

    /**
     * Handle click on the minimap - center viewport on clicked position
     */
    function handleMinimapClick(x, y) {
        const worldPos = minimapToWorld(x, y);

        // Center viewport on this point
        const {canvas} = elements;
        const viewport = stateManager.getViewport();

        stateManager.updateViewport({
            offsetX: -worldPos.x + canvas.clientWidth / (2 * viewport.scale),
            offsetY: -worldPos.y + canvas.clientHeight / (2 * viewport.scale)
        });

        renderer.requestRender(true);
    }

    /**
     * Start dragging the viewport on the minimap
     */
    function startViewportDrag(e) {
        const rect = elements.minimap.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Check if click is inside the viewport rectangle
        const viewport = stateManager.getViewport();
        const nodes = stateManager.getNodes();
        const bounds = calculateNodesBounds(nodes);
        const padding = 10;

        const viewportMinX = -viewport.offsetX / viewport.scale;
        const viewportMinY = -viewport.offsetY / viewport.scale;
        const container = elements.minimap.parentElement.parentElement;
        const viewportWidth = container.clientWidth / viewport.scale;
        const viewportHeight = container.clientHeight / viewport.scale;

        const viewportX = padding + (viewportMinX - bounds.minX) * minimapScale;
        const viewportY = padding + (viewportMinY - bounds.minY) * minimapScale;
        const viewportScaledWidth = viewportWidth * minimapScale;
        const viewportScaledHeight = viewportHeight * minimapScale;

        if (
            x >= viewportX &&
            x <= viewportX + viewportScaledWidth &&
            y >= viewportY &&
            y <= viewportY + viewportScaledHeight
        ) {
            isDragging = true;
            lastMousePosition = {x, y};

            // Add drag event listeners
            document.addEventListener('mousemove', onMinimapDrag);
            document.addEventListener('mouseup', stopViewportDrag);
        } else {
            // If clicked outside viewport, center on that point
            handleMinimapClick(x, y);
        }
    }

    /**
     * Handle dragging the viewport on the minimap
     */
    function onMinimapDrag(e) {
        if (!isDragging) return;

        const rect = elements.minimap.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Calculate delta in minimap coordinates
        const dx = x - lastMousePosition.x;
        const dy = y - lastMousePosition.y;

        // Convert to world coordinates
        const worldDx = dx / minimapScale;
        const worldDy = dy / minimapScale;

        // Update viewport position
        const viewport = stateManager.getViewport();
        stateManager.updateViewport({
            offsetX: viewport.offsetX - worldDx * viewport.scale,
            offsetY: viewport.offsetY - worldDy * viewport.scale
        });

        lastMousePosition = {x, y};
        renderer.requestRender(true);
    }

    /**
     * Stop dragging the viewport
     */
    function stopViewportDrag() {
        isDragging = false;
        document.removeEventListener('mousemove', onMinimapDrag);
        document.removeEventListener('mouseup', stopViewportDrag);
    }

    /**
     * Set up event listeners
     */
    function setupEventListeners() {
        const {minimap} = elements;

        if (!minimap) return;

        // Handle minimap clicks
        minimap.addEventListener('mousedown', (e) => {
            const rect = minimap.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            startViewportDrag(e);
        });

        // Update minimap when viewport changes
        eventBus.on(EVENTS.VIEWPORT_CHANGED, renderMinimap);

        // Update minimap when nodes change
        eventBus.on(EVENTS.NODE_CHANGED, renderMinimap);
        eventBus.on(EVENTS.CONNECTION_CHANGED, renderMinimap);

        // Update minimap on window resize
        window.addEventListener('resize', renderMinimap);
    }

    // Initialize
    setupEventListeners();

    // Return public API
    return {
        toggleMinimap,
        setMinimapSize,
        renderMinimap,
        handleMinimapClick
    };
}