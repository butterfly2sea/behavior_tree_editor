/**
 * Viewport Module - Manages canvas viewport and zooming
 */
import {eventBus, EVENTS} from '../core/events.js';
import {logger} from '../utils/logger.js';
import {config} from '../core/config.js';
import {Point, Rectangle} from '../utils/geometry.js';

export function initViewport(elements, state, renderer) {
    const stateManager = state;

    // State for handling pan gestures
    let isPanning = false;
    let lastPanPosition = {x: 0, y: 0};

    // Track if alt key is pressed (for alternative pan method)
    let isAltKeyPressed = false;

    /**
     * Set viewport scale (zoom level)
     */
    function setScale(newScale, focusPoint = null) {
        const viewport = stateManager.getViewport();
        const oldScale = viewport.scale;

        // Clamp scale to min/max values
        newScale = Math.min(
            Math.max(newScale, viewport.minScale),
            viewport.maxScale
        );

        // If scale hasn't changed, do nothing
        if (newScale === oldScale) return;

        // If focus point is provided, zoom toward that point
        if (focusPoint) {
            const {canvas} = elements;

            // Get focus point in world coordinates before zoom
            const worldPointBefore = screenToWorld(
                focusPoint.x,
                focusPoint.y
            );

            // Update scale
            stateManager.updateViewport({scale: newScale});

            // Get focus point in world coordinates after zoom
            const worldPointAfter = screenToWorld(
                focusPoint.x,
                focusPoint.y
            );

            // Adjust offset to keep focus point stationary
            stateManager.updateViewport({
                offsetX: viewport.offsetX + (worldPointBefore.x - worldPointAfter.x),
                offsetY: viewport.offsetY + (worldPointBefore.y - worldPointAfter.y)
            });
        } else {
            // Just update scale without adjusting offset
            stateManager.updateViewport({scale: newScale});
        }

        // Request render update
        renderer.requestRender(true);
    }

    /**
     * Zoom in by a factor
     */
    function zoomIn(factor = 1.2, focusPoint = null) {
        const viewport = stateManager.getViewport();
        setScale(viewport.scale * factor, focusPoint);
    }

    /**
     * Zoom out by a factor
     */
    function zoomOut(factor = 1.2, focusPoint = null) {
        const viewport = stateManager.getViewport();
        setScale(viewport.scale / factor, focusPoint);
    }

    /**
     * Reset zoom to 100%
     */
    function resetZoom() {
        setScale(1.0);
    }

    /**
     * Convert screen coordinates to world coordinates
     */
    function screenToWorld(x, y) {
        const {scale, offsetX, offsetY} = stateManager.getViewport();
        return {
            x: x / scale - offsetX,
            y: y / scale - offsetY
        };
    }

    /**
     * Convert world coordinates to screen coordinates
     */
    function worldToScreen(x, y) {
        const {scale, offsetX, offsetY} = stateManager.getViewport();
        return {
            x: (x + offsetX) * scale,
            y: (y + offsetY) * scale
        };
    }

    /**
     * Pan the viewport by delta amounts
     */
    function pan(deltaX, deltaY) {
        const viewport = stateManager.getViewport();

        stateManager.updateViewport({
            offsetX: viewport.offsetX + deltaX / viewport.scale,
            offsetY: viewport.offsetY + deltaY / viewport.scale
        });

        // Request render update
        renderer.requestRender(true);
    }

    /**
     * Start panning the viewport
     */
    function startPan(e) {
        isPanning = true;
        lastPanPosition = {x: e.clientX, y: e.clientY};

        // Add pan-specific cursor class to canvas
        elements.canvas.classList.add('panning');

        document.addEventListener('mousemove', onPanMove);
        document.addEventListener('mouseup', stopPan);
    }

    /**
     * Handle mouse movement during panning
     */
    function onPanMove(e) {
        if (!isPanning) return;

        // Calculate delta since last move
        const deltaX = e.clientX - lastPanPosition.x;
        const deltaY = e.clientY - lastPanPosition.y;

        pan(deltaX, deltaY);

        lastPanPosition = {x: e.clientX, y: e.clientY};
    }

    /**
     * Stop panning the viewport
     */
    function stopPan() {
        isPanning = false;
        elements.canvas.classList.remove('panning');

        document.removeEventListener('mousemove', onPanMove);
        document.removeEventListener('mouseup', stopPan);
    }

    /**
     * Center viewport on a specific point
     */
    function centerOn(x, y) {
        const {canvas} = elements;
        const viewport = stateManager.getViewport();

        // Calculate center offset
        const offsetX = -x + canvas.clientWidth / (2 * viewport.scale);
        const offsetY = -y + canvas.clientHeight / (2 * viewport.scale);

        stateManager.updateViewport({offsetX, offsetY});

        // Request render update
        renderer.requestRender(true);
    }

    /**
     * Center on a specific node
     */
    function centerOnNode(nodeId) {
        const nodes = stateManager.getNodes();
        const node = nodes.find(n => n.id === nodeId);

        if (node) {
            centerOn(node.x + config.nodeWidth / 2, node.y + config.nodeHeight / 2);
        }
    }

    /**
     * Calculate the bounds of all nodes
     */
    function calculateNodesBounds(padding = 50) {
        const nodes = stateManager.getNodes();

        if (nodes.length === 0) return null;

        // Calculate bounds of all nodes
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        nodes.forEach(node => {
            minX = Math.min(minX, node.x);
            minY = Math.min(minY, node.y);
            maxX = Math.max(maxX, node.x + config.nodeWidth);
            maxY = Math.max(maxY, node.y + config.nodeHeight);
        });

        // Add padding
        minX -= padding;
        minY -= padding;
        maxX += padding;
        maxY += padding;

        return {
            minX, minY, maxX, maxY,
            width: maxX - minX,
            height: maxY - minY,
            center: {
                x: (minX + maxX) / 2,
                y: (minY + maxY) / 2
            }
        };
    }

    /**
     * Fit all nodes in the viewport
     */
    function fitAllNodes(padding = 50) {
        const nodes = stateManager.getNodes();

        if (nodes.length === 0) return;

        const bounds = calculateNodesBounds(padding);
        if (!bounds) return;

        // Calculate required scale
        const {canvas} = elements;
        const contentWidth = bounds.width;
        const contentHeight = bounds.height;
        const scaleX = canvas.clientWidth / contentWidth;
        const scaleY = canvas.clientHeight / contentHeight;
        const newScale = Math.min(scaleX, scaleY, config.viewport.maxScale);

        // Update viewport
        stateManager.updateViewport({
            scale: newScale,
            offsetX: -bounds.center.x + canvas.clientWidth / (2 * newScale),
            offsetY: -bounds.center.y + canvas.clientHeight / (2 * newScale)
        });

        // Request render update
        renderer.requestRender(true);
    }

    /**
     * Set up event listeners and initialize canvas dragging
     */
    function setupEventListeners() {
        // Wheel event for zooming
        elements.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();

            // Get mouse position relative to canvas
            const rect = elements.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // Zoom in or out based on wheel direction
            if (e.deltaY < 0) {
                zoomIn(1.1, {x: mouseX, y: mouseY});
            } else {
                zoomOut(1.1, {x: mouseX, y: mouseY});
            }
        });

        // Middle mouse button or Alt+left mouse button for panning
        elements.canvas.addEventListener('mousedown', (e) => {
            // Middle mouse button or Alt+left click to start panning
            if (e.button === 1 || (e.button === 0 && e.altKey)) {
                e.preventDefault();
                startPan(e);
            }
        });

        // Track Alt key state
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Alt') {
                isAltKeyPressed = true;
                elements.canvas.classList.add('alt-key-pressed');
            }
        });

        document.addEventListener('keyup', (e) => {
            if (e.key === 'Alt') {
                isAltKeyPressed = false;
                elements.canvas.classList.remove('alt-key-pressed');
            }
        });

        // Zoom control buttons
        const zoomInBtn = document.getElementById('zoom-in-btn');
        const zoomOutBtn = document.getElementById('zoom-out-btn');
        const zoomResetBtn = document.getElementById('zoom-reset-btn');

        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', () => zoomIn());
        }

        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', () => zoomOut());
        }

        if (zoomResetBtn) {
            zoomResetBtn.addEventListener('click', () => resetZoom());
        }

        // Fit All button
        const fitAllBtn = document.getElementById('fit-all-btn');
        if (fitAllBtn) {
            fitAllBtn.addEventListener('click', () => fitAllNodes());
        }
    }

    // Initialize
    setupEventListeners();

    // Return public API
    return {
        setScale,
        zoomIn,
        zoomOut,
        resetZoom,
        pan,
        centerOn,
        centerOnNode,
        fitAllNodes,
        screenToWorld,
        worldToScreen
    };
}