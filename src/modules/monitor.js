/**
 * Monitor Module - Monitors behavior tree execution events
 */
import {eventBus, EVENTS} from '../core/events.js';
import {logger} from '../utils/logger.js';

export function initMonitor(elements, state, renderer) {
    const stateManager = state;
    let eventSource = null;

    /**
     * Start monitoring the behavior tree execution
     */
    function startMonitoring() {
        const sseUrl = elements.sseUrlInput?.value || 'http://localhost:8080/tree_status';

        if (eventSource) {
            stopMonitoring();
        }

        try {
            logger.info(`Starting monitor with URL: ${sseUrl}`);

            // Create EventSource for SSE connection
            eventSource = new EventSource(sseUrl);

            // Setup event listeners
            eventSource.onopen = handleConnectionOpen;
            eventSource.onerror = handleConnectionError;
            eventSource.onmessage = handleNodeStatusMessage;

            // Update state
            stateManager.updateMonitorState({
                active: true,
                eventSource: eventSource,
                nodeStates: {}
            });

            // Update UI
            updateMonitorUI(true);

        } catch (error) {
            logger.error('Failed to connect to event source:', error);
            stopMonitoring();
        }
    }

    /**
     * Stop monitoring
     */
    function stopMonitoring() {
        if (eventSource) {
            logger.info('Stopping monitor');

            // Close connection
            eventSource.close();
            eventSource = null;

            // Update state
            stateManager.updateMonitorState({
                active: false,
                eventSource: null,
                nodeStates: {}
            });

            // Update UI
            updateMonitorUI(false);

            // Force render to clear node statuses
            renderer.requestFullRender();
        }
    }

    /**
     * Handle connection open event
     */
    function handleConnectionOpen() {
        logger.info('Monitor connection opened');
        updateMonitorStatus('Connected', 'connected');
    }

    /**
     * Handle connection error event
     */
    function handleConnectionError(error) {
        logger.error('Monitor connection error:', error);
        updateMonitorStatus('Error', 'disconnected');

        // Auto-reconnect after a delay if still active
        if (stateManager.getMonitor().active) {
            setTimeout(() => {
                if (stateManager.getMonitor().active) {
                    startMonitoring();
                }
            }, 5000);
        }
    }

    /**
     * Handle node status message from SSE
     */
    function handleNodeStatusMessage(event) {
        try {
            const data = JSON.parse(event.data);

            if (data && data.tree_status) {
                const nodeStates = {};

                // Process node statuses
                data.tree_status.forEach(status => {
                    if (status.node_name && status.status) {
                        // Find node by name
                        const node = findNodeByName(status.node_name);

                        if (node) {
                            nodeStates[node.id] = status.status.toLowerCase();
                        }
                    }
                });

                // Update state
                stateManager.updateMonitorState({
                    nodeStates: nodeStates
                });

                // Request render update
                renderer.requestFullRender();
            }
        } catch (error) {
            logger.error('Error processing status message:', error);
        }
    }

    /**
     * Find a node by its name
     */
    function findNodeByName(nodeName) {
        const nodes = stateManager.getNodes();
        return nodes.find(node => node.name === nodeName);
    }

    /**
     * Update monitor UI status
     */
    function updateMonitorStatus(text, statusClass) {
        if (elements.monitorStatusText) {
            elements.monitorStatusText.textContent = text;
        }

        if (elements.monitorStatusIndicator) {
            elements.monitorStatusIndicator.className = `status-indicator ${statusClass}`;
        }
    }

    /**
     * Update monitor UI based on active state
     */
    function updateMonitorUI(active) {
        if (elements.startMonitorBtn) {
            elements.startMonitorBtn.style.display = active ? 'none' : 'block';
        }

        if (elements.stopMonitorBtn) {
            elements.stopMonitorBtn.style.display = active ? 'block' : 'none';
        }

        if (elements.sseUrlInput) {
            elements.sseUrlInput.disabled = active;
        }

        // Update status
        updateMonitorStatus(
            active ? 'Connected' : 'Disconnected',
            active ? 'connected' : 'disconnected'
        );
    }

    /**
     * Set up event listeners
     */
    function setupEventListeners() {
        // Monitor control buttons
        if (elements.startMonitorBtn) {
            elements.startMonitorBtn.addEventListener('click', startMonitoring);
        }

        if (elements.stopMonitorBtn) {
            elements.stopMonitorBtn.addEventListener('click', stopMonitoring);
        }

        // Stop monitoring when window is unloaded to clean up EventSource
        window.addEventListener('beforeunload', () => {
            if (eventSource) {
                eventSource.close();
            }
        });
    }

    // Initialize
    setupEventListeners();
    updateMonitorUI(false);

    // Return public API
    return {
        startMonitoring,
        stopMonitoring,
        isActive: () => stateManager.getMonitor().active
    };
}