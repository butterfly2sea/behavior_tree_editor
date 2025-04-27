```
/behavior-tree-editor
├── index.html
├── css/
│   ├── theme.css         # 主题变量
│   ├── layout.css        # 布局样式
│   ├── components.css    # 组件样式
│   └── styles.css        # 全局样式
├── src/
│   ├── index.js          # 应用入口
│   ├── core/
│   │   ├── config.js     # 全局配置
│   │   ├── events.js     # 事件系统(使用标准EventTarget)
│   │   ├── state.js      # 状态管理
│   │   └── renderer.js   # 渲染系统
│   ├── modules/
│   │   ├── nodes.js      # 节点管理
│   │   ├── connections.js # 连接管理
│   │   ├── viewport.js   # 视图控制
│   │   ├── grid.js       # 网格管理
│   │   ├── layout.js     # 自动布局
│   │   ├── serialization.js # 导入导出功能
│   │   └── monitor.js    # 监控功能
│   ├── components/
│   │   ├── dock-panel.js # 侧边栏面板
│   │   ├── properties.js # 属性面板
│   │   ├── toolbar.js    # 工具栏
│   │   ├── minimap.js    # 缩略图
│   │   └── dialogs.js    # 对话框组件
│   ├── utils/
│   │   ├── dom.js        # DOM工具
│   │   ├── drag.js       # 拖放工具
│   │   ├── validation.js # 验证工具
│   │   ├── logger.js     # 日志工具(合并版)
│   │   └── helpers.js    # 通用工具函数
│   └── data/
│       └── node-types.js # 节点类型定义
```