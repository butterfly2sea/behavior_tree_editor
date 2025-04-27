```
/behavior-tree-editor
│
├── index.html                 1# 主HTML文件
│
├── css/
│   ├── styles.css             1# 全局样式
│   ├── components.css         1# 组件样式
│   ├── layout.css             1# 布局样式
│   └── theme.css              1# 主题变量
│
├── src/
│   ├── index.js               1# 应用入口点
│   │
│   ├── core/
│   │   ├── state.js           1# 简化的状态管理
│   │   ├── events.js          1# 重构的事件系统
│   │   ├── renderer.js        1# 优化的渲染系统
│   │   └── config.js          1# 全局配置
│   │
│   ├── modules/
│   │   ├── nodes.js           1# 节点管理
│   │   ├── connections.js     1# 连接管理(修复连线显示)
│   │   ├── viewport.js        1# 视图控制
│   │   ├── grid.js            1# 网格管理
│   │   ├── layout.js          1# 自动布局(修复交互问题)
│   │   ├── serialization.js   1# 导入导出功能
│   │   └── monitor.js         1# 监控功能(从dock-panel分离)
│   │
│   ├── components/
│   │   ├── dock-panel.js      1# 侧边栏面板
│   │   ├── properties.js      1# 属性面板
│   │   ├── toolbar.js         1# 工具栏
│   │   ├── minimap.js         1# 缩略图
│   │   └── dialogs.js         1# 对话框组件
│   │
│   ├── utils/
│   │   ├── dom.js             1# DOM工具(合并dom-utils)
│   │   ├── drag.js            1# HTML5拖放工具
│   │   ├── validation.js      1# 验证工具
│   │   ├── logger.js          1# 日志工具
│   │   └── helpers.js         1# 通用工具函数
│   │
│   └── data/
│       └── node-types.js      # 节点类型定义
```