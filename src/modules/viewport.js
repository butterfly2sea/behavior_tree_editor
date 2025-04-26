/**
 * Viewport module
 * Manages viewport transformations for infinite canvas
 */

import {editorEvents, EDITOR_EVENTS} from './events.js';
import {logger} from '../index.js';
import {screenToWorld} from './renderer.js';

export function initViewport(elements, state, renderer) {
    const stateManager = state;

    logger.debug('Initializing viewport');

    // Listen for events that affect the viewport
    setupEventListeners();

    /**
     * Set viewport scale (zoom level)
     * @param {number} newScale - New scale value
     * @param {Object} focusPoint - Focus point for zooming (in screen coordinates)
     */
    function setScale(newScale, focusPoint = null) {
        const viewport = stateManager.getViewport();
        const oldScale = viewport.scale;

        // Clamp scale to min/max values
        newScale = Math.min(Math.max(newScale, viewport.minScale), viewport.maxScale);

        // If scale hasn't changed, do nothing
        if (newScale === oldScale) return;

        // If focus point is provided, zoom toward that point
        if (focusPoint) {
            const {canvas} = elements;

            // Get focus point in world coordinates before zoom
            const worldPointBefore = screenToWorld(
                focusPoint.x,
                focusPoint.y,
                viewport
            );

            // Update scale
            stateManager.updateViewport({scale: newScale});

            // Get focus point in world coordinates after zoom
            const worldPointAfter = screenToWorld(
                focusPoint.x,
                focusPoint.y,
                {...viewport, scale: newScale}
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

        // Notify about zoom change
        editorEvents.emit(EDITOR_EVENTS.ZOOM_CHANGED, newScale);

        // Request render update
        renderer.requestRender(true);
    }

    /**
     * Zoom in by a factor
     * @param {number} factor - Zoom factor (default: 1.2)
     * @param {Object} focusPoint - Focus point for zooming
     */
    function zoomIn(factor = 1.2, focusPoint = null) {
        const viewport = stateManager.getViewport();
        setScale(viewport.scale * factor, focusPoint);
    }

    /**
     * Zoom out by a factor
     * @param {number} factor - Zoom factor (default: 1.2)
     * @param {Object} focusPoint - Focus point for zooming
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
     * Pan the viewport
     * @param {number} deltaX - X-axis pan amount
     * @param {number} deltaY - Y-axis pan amount
     */
    function pan(deltaX, deltaY) {
        const viewport = stateManager.getViewport();

        stateManager.updateViewport({
            offsetX: viewport.offsetX + deltaX,
            offsetY: viewport.offsetY + deltaY
        });

        // Request render update
        renderer.requestRender(true);
    }

    /**
     * Center viewport on a specific point
     * @param {number} x - X coordinate in world space
     * @param {number} y - Y coordinate in world space
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
     * Center viewport on a specific node
     * @param {string} nodeId - ID of the node to center on
     */
    function centerOnNode(nodeId) {
        const nodes = stateManager.getNodes();
        const node = nodes.find(n => n.id === nodeId);

        if (node) {
            // Center on node's center point
            centerOn(node.x + 75, node.y + 20);
        }
    }

    /**
     * Fit all nodes in the viewport
     * @param {number} padding - Padding around the nodes (default: 50)
     */
    function fitAllNodes(padding = 50) {
        const nodes = stateManager.getNodes();

        if (nodes.length === 0) return;

        // Calculate bounds of all nodes
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        nodes.forEach(node => {
            minX = Math.min(minX, node.x);
            minY = Math.min(minY, node.y);
            maxX = Math.max(maxX, node.x + 150);
            maxY = Math.max(maxY, node.y + 40);
        });

        // Add padding
        minX -= padding;
        minY -= padding;
        maxX += padding;
        maxY += padding;

        // Calculate required scale
        const {canvas} = elements;
        const contentWidth = maxX - minX;
        const contentHeight = maxY - minY;
        const scaleX = canvas.clientWidth / contentWidth;
        const scaleY = canvas.clientHeight / contentHeight;
        const scale = Math.min(scaleX, scaleY);

        // Clamp scale to min/max values
        const viewport = stateManager.getViewport();
        const newScale = Math.min(Math.max(scale, viewport.minScale), viewport.maxScale);

        // Calculate center point
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        // Update viewport
        stateManager.updateViewport({
            scale: newScale,
            offsetX: -centerX + canvas.clientWidth / (2 * newScale),
            offsetY: -centerY + canvas.clientHeight / (2 * newScale)
        });

        // Notify about zoom change
        editorEvents.emit(EDITOR_EVENTS.ZOOM_CHANGED, newScale);

        // Request render update
        renderer.requestRender(true);
    }

    /**
     * Set up event listeners for viewport
     */
    function setupEventListeners() {
        // Listen for mouse wheel events on canvas (handled in events.js)

        // Listen for zoom control events (handled in events.js)

        // Listen for fit button click
        const fitButton = document.getElementById('fit-all-btn');
        if (fitButton) {
            fitButton.addEventListener('click', () => fitAllNodes());
        }
    }

    /**
     * Get the current viewport state
     * @returns {Object} - Viewport state
     */
    function getViewport() {
        return stateManager.getViewport();
    }

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
        getViewport
    };
}