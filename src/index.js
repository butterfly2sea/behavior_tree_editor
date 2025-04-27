/**
 * BehaviorTree.CPP Editor - Main Entry Point
 */
import {config} from './core/config.js';
import {Logger} from './utils/logger.js';
import {initState} from './core/state.js';
import {eventBus, EVENTS} from './core/events.js';
import {initRenderer} from './core/renderer.js';
import {initViewport} from './modules/viewport.js';
import {initGrid} from './modules/grid.js';
import {initNodes} from './modules/nodes.js';
import {initConnections} from './modules/connections.js';
import {initLayout} from './modules/layout.js';
import {initMinimap} from './components/minimap.js';
import {initSerialization} from './modules/serialization.js';
import {initMonitor} from './modules/monitor.js';
import {initToolbar} from './components/toolbar.js';
import {initDockPanel} from './components/dock-panel.js';
import {initPropertiesPanel} from './components/properties.js';
import {initDialogs} from './components/dialogs.js';
import {setupKeyboardShortcuts} from './utils/helpers.js';

// Create global logger
export const logger = new Logger(config.logLevel);

// Initialize DOM elements object
const elements = {
    // Main containers
    canvas: document.getElementById('canvas'),
    gridCanvas: document.getElementById('grid-canvas'),
    connectionsLayer: document.getElementById('connections-layer'),
    activeConnectionLayer: document.getElementById('active-connection-layer'),
    dockPanel: document.getElementById('dock-panel'),
    propertiesPanel: document.getElementById('properties-panel'),
    propertiesContent: document.getElementById('properties-content'),

    // Tree view
    nodeTreeView: document.getElementById('node-tree-view'),

    // Modals
    createNodeModal: document.getElementById('create-node-modal'),
    xmlModal: document.getElementById('xml-modal'),
    xmlContent: document.getElementById('xml-content'),

    // Context menus
    connectionContextMenu: document.getElementById('connection-context-menu'),
    nodeContextMenu: document.getElementById('node-context-menu'),

    // Minimap
    minimap: document.getElementById('minimap'),
    minimapContainer: document.getElementById('minimap-container'),

    // Monitor elements
    sseUrlInput: document.getElementById('sse-url'),
    monitorStatusIndicator: document.getElementById('monitor-status-indicator'),
    monitorStatusText: document.getElementById('monitor-status-text'),
    startMonitorBtn: document.getElementById('start-monitor-btn'),
    stopMonitorBtn: document.getElementById('stop-monitor-btn')
};

// Initialize the application
function init() {
    try {
        logger.info('Initializing BehaviorTree.CPP Editor');

        // Initialize modules
        const state = initState();
        const renderer = initRenderer(elements, state);

        // Initialize core modules
        const viewport = initViewport(elements, state, renderer);
        const grid = initGrid(elements, state, renderer);
        const nodes = initNodes(elements, state, renderer);
        const connections = initConnections(elements, state, renderer);
        const layout = initLayout(elements, state, renderer);
        const minimap = initMinimap(elements, state, renderer);
        const serialization = initSerialization(elements, state);
        const monitor = initMonitor(elements, state, renderer);

        // Initialize UI components
        const toolbar = initToolbar(elements, state);
        const dockPanel = initDockPanel(elements, state, nodes);
        const propertiesPanel = initPropertiesPanel(elements, state, renderer);
        const dialogs = initDialogs(elements, state);

        // Setup keyboard shortcuts
        setupKeyboardShortcuts(state);

        // Handle window resize
        window.addEventListener('resize', () => {
            eventBus.emit(EVENTS.VIEWPORT_CHANGED, {type: 'resize'});
        });

        // Initial render
        renderer.requestFullRender();

        logger.info('Editor initialization complete');
    } catch (error) {
        logger.error('Failed to initialize editor:', error);
        showErrorToast('Failed to initialize editor: ' + error.message);
    }
}

// Display user-friendly error notification
export function showErrorToast(message) {
    const toast = document.createElement('div');
    toast.className = 'error-notification';
    toast.innerHTML = `
    <div class="error-icon">⚠️</div>
    <div class="error-message">${message}</div>
    <div class="error-close">×</div>
  `;

    document.body.appendChild(toast);

    // Automatically remove after 5 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 5000);

    // Click to dismiss
    toast.querySelector('.error-close').addEventListener('click', () => {
        toast.remove();
    });
}

// Start the application when DOM is loaded
document.addEventListener('DOMContentLoaded', init);