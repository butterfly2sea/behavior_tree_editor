/**
 * Global configuration
 */
export const config = {
    // Logging
    logLevel: 'info', // debug, info, warn, error

    // Node defaults
    nodeWidth: 150,
    nodeHeight: 40,

    // Grid settings
    defaultGrid: {
        enabled: true,
        size: 20,
        snap: true
    },

    // Viewport
    viewport: {
        minScale: 0.1,
        maxScale: 5.0,
        defaultScale: 1.0
    },

    // Layout
    layout: {
        defaultType: 'hierarchical',
        nodeSpacingX: 20,
        nodeSpacingY: 20,
        treeSpacingX: 40,
        treeSpacingY: 40,
        animationDuration: 500
    },

    // Connection appearance
    connection: {
        strokeWidth: 2,
        normalColor: '#666',
        selectedColor: '#2196f3',
        pendingColor: '#0066cc',
        invalidColor: '#f44336'
    }
};