/**
 * BehaviorTree.CPP Editor
 * Main JavaScript entry point
 */

// Import modules
import { initState } from './modules/state.js';
import { initRenderer } from './modules/renderer.js';
import { initEvents, editorEvents, EDITOR_EVENTS } from './modules/events.js';
import { initViewport } from './modules/viewport.js';
import { initGrid } from './modules/grid.js';
import { initMinimap } from './modules/minimap.js';
import { initNodes } from './modules/nodes.js';
import { initConnections } from './modules/connections.js';
import { initSerialization } from './modules/serialization.js';
import { initLayout } from './modules/layout.js';
import { initToolbar } from './components/toolbar.js';
import { initDockPanel } from './components/dock-panel.js';
import { initPropertiesPanel } from './components/properties-panel.js';
import { Logger, LogLevel } from './utils/logger.js';

// Create global logger
export const logger = new Logger(LogLevel.INFO);

// DOM Elements
const elements = {
    canvas: document.getElementById('canvas'),
    gridCanvas: document.getElementById('grid-canvas'),
    connectionsLayer: document.getElementById('connections-layer'),
    activeConnectionLayer: document.getElementById('active-connection-layer'),
    propertiesPanel: document.getElementById('properties-panel'),
    propertiesContent: document.getElementById('properties-content'),
    nodeTreeView: document.getElementById('node-tree-view'),
    connectionContextMenu: document.getElementById('connection-context-menu'),
    nodeTypeContextMenu: document.getElementById('node-type-context-menu'),
    dockPanel: document.getElementById('dock-panel'),
    minimap: document.getElementById('minimap'),
    minimapContainer: document.getElementById('minimap-container'),
    createNodeModal: document.getElementById('create-node-modal'),
    xmlModal: document.getElementById('xml-modal'),
    xmlContent: document.getElementById('xml-content')
};

// Initialize the application
function init() {
    try {
        logger.info('Initializing BehaviorTree.CPP Editor');

        // Initialize modules
        const state = initState();
        const renderer = initRenderer(elements, state);
        const viewport = initViewport(elements, state, renderer);
        const grid = initGrid(elements, state, renderer);
        const minimap = initMinimap(elements, state, renderer);
        const nodes = initNodes(elements, state, renderer);
        const connections = initConnections(elements, state, renderer);
        const layout = initLayout(elements, state, renderer);
        const serialization = initSerialization(elements, state);

        // Initialize UI components
        initToolbar(elements, state, renderer);
        initDockPanel(elements, state, renderer);
        initPropertiesPanel(elements, state, renderer);

        // Initialize event handling
        initEvents(elements, state, renderer);

        // Subscribe to global events
        setupEventListeners();

        // Initial render
        renderer.requestFullRender();

        logger.info('Editor initialization complete');
    } catch (error) {
        logger.error('Failed to initialize editor:', error);
        showErrorToUser('Failed to initialize editor: ' + error.message);
    }
}

function setupEventListeners() {
    // Listen for window resize
    window.addEventListener('resize', () => {
        editorEvents.emit(EDITOR_EVENTS.WINDOW_RESIZED);
    });

    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Don't process shortcuts when typing in input fields
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }

        // Ctrl+S to save
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            editorEvents.emit(EDITOR_EVENTS.SAVE_REQUESTED);
        }

        // Ctrl+O to load
        if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
            e.preventDefault();
            editorEvents.emit(EDITOR_EVENTS.LOAD_REQUESTED);
        }

        // Delete to remove selected nodes
        if (e.key === 'Delete') {
            editorEvents.emit(EDITOR_EVENTS.DELETE_SELECTED_REQUESTED);
        }

        // Ctrl+A to select all
        if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
            e.preventDefault();
            editorEvents.emit(EDITOR_EVENTS.SELECT_ALL_REQUESTED);
        }

        // Escape to cancel operations
        if (e.key === 'Escape') {
            editorEvents.emit(EDITOR_EVENTS.ESCAPE_PRESSED);
        }
    });
}

// Display user-friendly error notification
export function showErrorToUser(message) {
    // Create error toast/notification
    const errorNotification = document.createElement('div');
    errorNotification.className = 'error-notification';
    errorNotification.innerHTML = `
        <div class="error-icon">⚠️</div>
        <div class="error-message">${message}</div>
        <div class="error-close">×</div>
    `;

    document.body.appendChild(errorNotification);

    // Automatically remove after 5 seconds
    setTimeout(() => {
        if (errorNotification.parentNode) {
            errorNotification.remove();
        }
    }, 5000);

    // Click to dismiss
    errorNotification.querySelector('.error-close').addEventListener('click', () => {
        errorNotification.remove();
    });
}

// Start the application when DOM is loaded
document.addEventListener('DOMContentLoaded', init);