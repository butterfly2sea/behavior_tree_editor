import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import html from '@rollup/plugin-html';
import livereload from 'rollup-plugin-livereload';
import serve from 'rollup-plugin-serve';
import copy from 'rollup-plugin-copy';
import postcss from 'rollup-plugin-postcss';

const production = !process.env.ROLLUP_WATCH;

// HTML template function for @rollup/plugin-html
function htmlTemplate({ attributes, files, meta, publicPath, title }) {
  // 提取CSS和JS文件
  const scripts = (files.js || [])
    .map(({ fileName }) => `<script src="${publicPath}${fileName}"></script>`)
    .join('\n');

  const links = (files.css || [])
    .map(({ fileName }) => `<link rel="stylesheet" href="${publicPath}${fileName}">`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BehaviorTree.CPP Editor</title>
    ${links}
</head>
<body>
<div class="header">
    <h1>BehaviorTree.CPP Editor</h1>
</div>

<div class="toolbar" id="main-toolbar">
    <div class="toolbar-group">
        <button id="save-btn" title="Save"><i class="icon-save"></i> Save</button>
        <button id="load-btn" title="Load"><i class="icon-folder"></i> Load</button>
        <button id="clear-btn" title="Clear"><i class="icon-trash"></i> Clear</button>
        <button id="export-xml-btn" class="export-button" title="Export XML"><i class="icon-export"></i> Export XML
        </button>
    </div>

    <div class="toolbar-group">
        <button id="toggle-grid-btn" title="Toggle Grid"><i class="icon-grid"></i> Grid</button>
        <button id="toggle-snap-btn" title="Toggle Snap to Grid"><i class="icon-snap"></i> Snap</button>
    </div>

    <div class="toolbar-group">
        <button id="align-left-btn" title="Align Left"><i class="icon-align-left"></i></button>
        <button id="align-center-btn" title="Align Center"><i class="icon-align-center"></i></button>
        <button id="align-right-btn" title="Align Right"><i class="icon-align-right"></i></button>
        <button id="align-top-btn" title="Align Top"><i class="icon-align-top"></i></button>
        <button id="align-middle-btn" title="Align Middle"><i class="icon-align-middle"></i></button>
        <button id="align-bottom-btn" title="Align Bottom"><i class="icon-align-bottom"></i></button>
    </div>

    <div class="toolbar-group layout-controls">
        <button id="auto-layout-btn" title="Auto Layout"><i class="icon-layout"></i> Auto Layout</button>
        <select id="layout-type">
            <option value="hierarchical">Hierarchical</option>
            <option value="forcedirected">Force Directed</option>
        </select>
    </div>
</div>

<div class="main-container">
    <div class="dock-panel" id="dock-panel">
        <div class="dock-header">
            <h3>Node Palette</h3>
            <button id="toggle-dock-btn" class="toggle-dock-btn" title="Toggle Palette">
                <i class="icon-chevron-left"></i>
            </button>
        </div>

        <div class="tree-view" id="node-tree-view"></div>

        <button id="add-node-btn" class="add-node-button">
            <i class="icon-plus"></i> Add Custom Node
        </button>

        <div class="monitor-panel">
            <div class="monitor-header">
                <h3>Tree Monitor</h3>
                <div class="monitor-status">
                    <span class="status-indicator disconnected" id="monitor-status-indicator"></span>
                    <span id="monitor-status-text">Disconnected</span>
                </div>
            </div>
            <input type="text" id="sse-url" class="monitor-url"
                   placeholder="SSE URL" value="http://localhost:8080/tree_status">
            <button id="start-monitor-btn" class="monitor-button">
                <i class="icon-play"></i> Start Monitoring
            </button>
            <button id="stop-monitor-btn" class="monitor-button stop" style="display: none;">
                <i class="icon-stop"></i> Stop Monitoring
            </button>
        </div>
    </div>

    <div class="editor-container">
        <div class="canvas-container">
            <canvas class="grid-canvas" id="grid-canvas"></canvas>
            <div class="canvas" id="canvas">
                <svg class="connections-layer" id="connections-layer"></svg>
                <svg class="active-connection-layer" id="active-connection-layer" style="display: none;"></svg>
            </div>
        </div>

        <div class="zoom-controls">
            <button id="zoom-in-btn" class="zoom-button" title="Zoom In">+</button>
            <button id="zoom-reset-btn" class="zoom-button" title="Reset Zoom">⟳</button>
            <button id="zoom-out-btn" class="zoom-button" title="Zoom Out">-</button>
        </div>

        <div class="minimap-container" id="minimap-container">
            <canvas id="minimap" width="150" height="150"></canvas>
        </div>

        <div class="properties-panel" id="properties-panel" style="display: none;">
            <h3>Properties</h3>
            <div id="properties-content"></div>
        </div>
    </div>
</div>

<!-- Modals -->
<div id="create-node-modal" class="modal">
    <div class="modal-content">
        <span class="close" id="close-create-modal">&times;</span>
        <h2>创建自定义节点</h2>
        <form id="create-node-form" class="create-node-form">
            <div class="form-row">
                <label for="custom-node-name">节点名称:</label>
                <input type="text" id="custom-node-name" required>
            </div>
            <div class="form-row">
                <label for="custom-node-category">类别:</label>
                <select id="custom-node-category">
                    <option value="control">Control</option>
                    <option value="decorator">Decorator</option>
                    <option value="action">Action</option>
                    <option value="condition">Condition</option>
                </select>
            </div>

            <!-- 添加描述字段 -->
            <div class="form-row">
                <label for="custom-node-description">描述:</label>
                <textarea id="custom-node-description" rows="2"></textarea>
            </div>

            <!-- 添加属性列表部分 -->
            <div class="form-row">
                <label>属性:</label>
                <div id="node-properties-container">
                    <!-- 动态生成的属性列表 -->
                </div>
                <button type="button" id="add-property-btn" class="secondary-btn">添加属性</button>
            </div>

            <div class="modal-buttons">
                <button type="button" class="cancel-btn" id="cancel-create-node">取消</button>
                <button type="submit" class="create-btn">创建</button>
            </div>
        </form>
    </div>
</div>

<!-- 添加属性模态框 -->
<div id="add-property-modal" class="modal">
    <div class="modal-content">
        <span class="close" id="close-property-modal">&times;</span>
        <h3>添加节点属性</h3>
        <form id="add-property-form">
            <div class="form-row">
                <label for="property-name">属性名:</label>
                <input type="text" id="property-name" required>
            </div>
            <div class="form-row">
                <label for="property-type">类型:</label>
                <select id="property-type">
                    <option value="string">文本</option>
                    <option value="number">数字</option>
                    <option value="boolean">布尔值</option>
                </select>
            </div>
            <div class="form-row">
                <label for="property-default">默认值:</label>
                <input type="text" id="property-default">
            </div>
            <div class="form-row">
                <label for="property-description">描述:</label>
                <input type="text" id="property-description">
            </div>
            <div class="modal-buttons">
                <button type="button" class="cancel-btn" id="cancel-add-property">取消</button>
                <button type="submit" class="add-btn">添加</button>
            </div>
        </form>
    </div>
</div>

<div id="xml-modal" class="modal">
    <div class="modal-content">
        <span class="close" id="close-xml-modal">&times;</span>
        <h2>Behavior Tree XML</h2>
        <p>BehaviorTree.CPP compatible XML format:</p>
        <div class="xml-content" id="xml-content"></div>
        <button class="copy-btn" id="copy-xml-btn">Copy to Clipboard</button>
    </div>
</div>

<!-- Context Menus -->
<div class="context-menu" id="connection-context-menu">
    <ul>
        <li id="delete-connection">Delete Connection</li>
    </ul>
</div>

<div class="context-menu" id="node-context-menu">
    <ul>
        <li id="delete-node">Delete Node</li>
        <li id="duplicate-node">Duplicate Node</li>
    </ul>
</div>

${scripts}
</body>
</html>`;
}

export default {
  input: 'src/main.js', // 使用新的入口文件
  output: {
    file: 'dist/bundle.js',
    format: 'iife',
    sourcemap: !production,
    name: 'BehaviorTreeEditor'
  },
  plugins: [
    // Resolve node modules
    resolve({
      browser: true
    }),

    // Bundle CSS files
    postcss({
      extract: true, // 提取到单独的CSS文件
      minimize: production
    }),

    // Generate HTML from template
    html({
      title: 'BehaviorTree.CPP Editor',
      template: htmlTemplate
    }),

    // 只在生产环境中复制资源
    production && copy({
      targets: [
        { src: 'assets/**/*', dest: 'dist/assets' }
      ],
      verbose: true
    }),

    // Development server
    !production && serve({
      contentBase: 'dist',
      port: 3000,
      open: true
    }),

    // Live reload in development
    !production && livereload('dist'),

    // Minify in production
    production && terser()
  ],
  watch: {
    clearScreen: false
  }
};