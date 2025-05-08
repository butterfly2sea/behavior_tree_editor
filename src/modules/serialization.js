/**
 * Serialization Module - 处理保存、加载和导出操作
 */
import {eventBus, EVENTS} from '../core/events.js';
import {logger} from '../utils/logger.js';
import {showErrorToast} from '../index.js';

export function initSerialization(elements, state) {
    const stateManager = state;

    /**
     * 保存当前树到JSON文件
     */
    function saveTree() {
        try {
            const nodes = stateManager.getNodes();
            const connections = stateManager.getConnections();

            // 执行语义校验
            const validation = validateTreeSemantics(nodes, connections);
            if (!validation.isValid) {
                showErrorToast(validation.message);
                return;
            }

            // 准备要导出的数据
            const treeData = {
                nodes: nodes,
                connections: connections,
                customNodeTypes: stateManager.getCustomNodeTypes(),
                collapsedCategories: stateManager.getState().collapsedCategories,
                grid: stateManager.getGrid()
            };

            // 创建Blob并使用现代File API下载
            const blob = new Blob([JSON.stringify(treeData, null, 2)], {type: 'application/json'});
            const url = URL.createObjectURL(blob);

            // 创建下载链接
            const a = document.createElement('a');
            a.href = url;
            a.download = 'behavior_tree.json';
            a.click();

            // 清理
            URL.revokeObjectURL(url);

            logger.info('行为树保存成功');
        } catch (error) {
            logger.error('保存树时出错:', error);
            showErrorToast('保存树失败: ' + error.message);
        }
    }

    /**
     * 从JSON文件加载树
     */
    function loadTree() {
        try {
            // 以编程方式创建文件输入
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';

            input.onchange = async (event) => {
                const file = event.target.files[0];
                if (!file) return;

                try {
                    // 使用现代File API读取文件
                    const content = await file.text();
                    const data = JSON.parse(content);

                    // 验证数据
                    if (!isValidTreeData(data)) {
                        throw new Error('无效的行为树文件格式');
                    }

                    // 执行语义校验
                    const validation = validateTreeSemantics(data.nodes || [], data.connections || []);
                    if (!validation.isValid) {
                        showErrorToast(validation.message);
                        return;
                    }

                    // 准备要加载的状态
                    const newState = {
                        nodes: data.nodes || [],
                        connections: data.connections || [],
                        customNodeTypes: data.customNodeTypes || [],
                        collapsedCategories: data.collapsedCategories || {},
                        grid: data.grid || stateManager.getGrid(),

                        // 重置这些值
                        selectedNodes: [],
                        selectedConnection: null,
                        pendingConnection: null,

                        // 保持当前视口
                        viewport: stateManager.getViewport(),

                        // ID计数器
                        idCounters: {
                            nodes: calculateNextNodeId(data.nodes),
                            connections: calculateNextConnectionId(data.connections)
                        }
                    };

                    // 加载状态
                    stateManager.loadState(newState);

                    logger.info('行为树加载成功');
                } catch (error) {
                    logger.error('解析树文件时出错:', error);
                    showErrorToast('解析树文件出错: ' + error.message);
                }
            };

            // 触发文件选择
            input.click();
        } catch (error) {
            logger.error('加载树时出错:', error);
            showErrorToast('加载树失败: ' + error.message);
        }
    }

    /**
     * 计算下一个节点ID计数器
     */
    function calculateNextNodeId(nodes) {
        if (!nodes || nodes.length === 0) return 0;

        return nodes.reduce((max, node) => {
            const idNum = parseInt(node.id.replace('node_', ''));
            return isNaN(idNum) ? max : Math.max(max, idNum + 1);
        }, 0);
    }

    /**
     * 计算下一个连接ID计数器
     */
    function calculateNextConnectionId(connections) {
        if (!connections || connections.length === 0) return 0;

        return connections.reduce((max, conn) => {
            const idNum = parseInt(conn.id.replace('conn_', ''));
            return isNaN(idNum) ? max : Math.max(max, idNum + 1);
        }, 0);
    }

    /**
     * 清除当前树
     */
    function clearTree() {
        if (confirm('确定要清除树吗？这将删除所有节点和连接。')) {
            stateManager.resetState();
            logger.info('行为树已清除');
        }
    }

    /**
     * 导出行为树为XML格式
     */
    function exportXml() {
        const nodes = stateManager.getNodes();
        const connections = stateManager.getConnections();

        // 执行语义校验
        const validation = validateTreeSemantics(nodes, connections);
        if (!validation.isValid) {
            showErrorToast(validation.message);
            return;
        }

        try {
            // 生成XML
            const xmlStr = generateBehaviorTreeXml();

            // 在XML模态框中显示
            const {xmlModal, xmlContent} = elements;

            if (xmlContent) {
                xmlContent.textContent = xmlStr;
            }

            if (xmlModal) {
                xmlModal.style.display = 'block';
            }

            logger.info('行为树已导出为XML');
        } catch (error) {
            logger.error('导出XML时出错:', error);
            showErrorToast('导出XML失败: ' + error.message);
        }
    }

    /**
     * 校验行为树结构的语义有效性
     * @param {Array} nodes - 节点数组
     * @param {Array} connections - 连接数组
     * @returns {Object} - 校验结果，包含isValid和message
     */
    function validateTreeSemantics(nodes, connections) {
        // 验证根节点唯一性
        const rootValidation = validateRoot(nodes, connections);
        if (!rootValidation.isValid) {
            return rootValidation;
        }

        // 验证叶子节点类型
        const leavesValidation = validateLeafNodes(nodes, connections);
        if (!leavesValidation.isValid) {
            return leavesValidation;
        }

        return {isValid: true, message: "行为树结构校验通过"};
    }

    /**
     * 验证行为树只有一个根节点
     * @param {Array} nodes - 节点数组
     * @param {Array} connections - 连接数组
     * @returns {Object} - 校验结果，包含isValid和message
     */
    function validateRoot(nodes, connections) {
        if (nodes.length === 0) {
            return {
                isValid: false,
                message: "错误: 行为树中不包含任何节点。"
            };
        }

        // 找出所有不是任何连接目标的节点，即根节点
        const targetIds = connections.map(c => c.target);
        const rootNodes = nodes.filter(node => !targetIds.includes(node.id));

        if (rootNodes.length === 0) {
            return {
                isValid: false,
                message: "错误: 未找到根节点。行为树必须有且只有一个根节点。可能存在循环引用。"
            };
        }

        return {isValid: true, message: ""};
    }

    /**
     * 验证所有叶子节点(无子节点的节点)必须是行为节点或子树节点
     * @param {Array} nodes - 节点数组
     * @param {Array} connections - 连接数组
     * @returns {Object} - 校验结果，包含isValid和message
     */
    function validateLeafNodes(nodes, connections) {
        // 找出所有不是任何连接源的节点，即叶子节点
        const sourceIds = connections.map(c => c.source);
        const leafNodes = nodes.filter(node => !sourceIds.includes(node.id));

        // 检查每个叶子节点的类型
        const invalidLeaves = leafNodes.filter(node =>
            node.category !== 'action' && node.category !== 'subtree' && node.category !== 'condition'
        );

        if (invalidLeaves.length > 0) {
            const invalidNames = invalidLeaves.map(node => `"${node.name}"`).join(', ');
            return {
                isValid: false,
                message: `错误: 发现${invalidLeaves.length}个无效的叶子节点: ${invalidNames}。叶子节点必须是行为节点或子树节点。`
            };
        }

        return {isValid: true, message: ""};
    }

    /**
     * 构建用于XML导出的树层次结构
     */
    function buildTreeHierarchy() {
        const nodes = stateManager.getNodes();
        const connections = stateManager.getConnections();

        // 找到根节点
        const targetIds = connections.map(c => c.target);
        const rootNodes = nodes.filter(node => !targetIds.includes(node.id));

        if (rootNodes.length === 0) return null;

        // 递归构建层次结构
        function buildNodeHierarchy(nodeId) {
            const node = nodes.find(n => n.id === nodeId);
            if (!node) return null;

            // 找到子节点连接
            const childConnections = connections.filter(c => c.source === nodeId);

            // 递归获取子层次结构并排序
            const children = childConnections
                .map(conn => {
                    const childNode = nodes.find(n => n.id === conn.target);
                    return childNode ? buildNodeHierarchy(conn.target) : null;
                })
                .filter(Boolean)
                .sort((a, b) => a.x - b.x); // 按X坐标排序

            return {
                ...node,
                children
            };
        }

        return rootNodes.map((root) => buildNodeHierarchy(root.id));
    }

    /**
     * 生成BehaviorTree.CPP兼容的XML
     */
    function generateBehaviorTreeXml() {
        const treeHierarchy = buildTreeHierarchy();
        const customNodes = stateManager.getCustomNodeTypes();

        if (!treeHierarchy) {
            return '<root BTCPP_format="4">\n  <!-- 未找到有效的树结构 -->\n</root>';
        }

        let xml = '<?xml version="1.0"?>\n';
        xml += '<root BTCPP_format="4">\n';

        xml = treeHierarchy.reduce((total, tree) => total + `  <BehaviorTree ID="${tree.name}">\n${generateNodeXml(tree, 4)}  </BehaviorTree>\n`, xml)

        // 添加TreeNodesModel部分，包含自定义节点定义
        if (customNodes.length > 0) {
            xml += '  <TreeNodesModel>\n';

            customNodes.forEach(nodeType => {
                xml += `    <Node ID="${escapeXml(nodeType.type)}" `;

                // 添加类别
                switch (nodeType.category) {
                    case 'composite':
                        xml += 'NodeType="Composite"';
                        break;
                    case 'decorator':
                        xml += 'NodeType="Decorator"';
                        break;
                    case 'action':
                        xml += 'NodeType="Action"';
                        break;
                    case 'condition':
                        xml += 'NodeType="Condition"';
                        break;
                    default:
                        xml += 'NodeType="SubTree"';
                }

                xml += '/>\n';
            });

            xml += '  </TreeNodesModel>\n';
        }

        xml += '</root>';

        return xml;
    }

    /**
     * 为节点及其子节点生成XML
     */
    function generateNodeXml(node, indent) {
        const spaces = ' '.repeat(indent);
        const hasChildren = node.children && node.children.length > 0;

        // 生成参数字符串
        let params = '';
        for (const [key, value] of Object.entries(node.properties)) {
            if (value) {
                params += ` ${key}="${escapeXml(value)}"`;
            }
        }

        if (!hasChildren) {
            // 叶子节点
            return `${spaces}<${escapeXml(node.type)} name="${escapeXml(node.name)}"${params}/>\n`;
        } else {
            // 有子节点的节点
            let xml = `${spaces}<${escapeXml(node.type)} name="${escapeXml(node.name)}"${params}>\n`;

            // 添加子节点
            for (const child of node.children) {
                xml += generateNodeXml(child, indent + 2);
            }

            xml += `${spaces}</${escapeXml(node.type)}>\n`;
            return xml;
        }
    }

    /**
     * 转义XML特殊字符
     */
    function escapeXml(str) {
        if (str === undefined || str === null) return '';

        // 使用安全的字符引用替换
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * 将XML内容复制到剪贴板
     */
    function copyXmlToClipboard() {
        const {xmlContent} = elements;
        if (!xmlContent) return;

        const textToCopy = xmlContent.textContent;

        // 使用现代Clipboard API
        navigator.clipboard.writeText(textToCopy)
            .then(() => {
                // 成功反馈
                const copyXmlBtn = document.getElementById('copy-xml-btn');
                if (copyXmlBtn) {
                    const originalText = copyXmlBtn.textContent;
                    copyXmlBtn.textContent = '已复制!';
                    setTimeout(() => {
                        copyXmlBtn.textContent = originalText;
                    }, 2000);
                }
            })
            .catch(err => {
                logger.error('复制文本失败:', err);
                showErrorToast('复制XML到剪贴板失败');
            });
    }

    /**
     * 验证导入的树数据
     */
    function isValidTreeData(data) {
        // 基本验证
        if (!data || typeof data !== 'object') return false;
        if (!Array.isArray(data.nodes)) return false;
        if (!Array.isArray(data.connections)) return false;

        // 基本格式检查
        try {
            for (const node of data.nodes) {
                if (typeof node !== 'object') return false;
                if (typeof node.id !== 'string') return false;
                if (typeof node.type !== 'string') return false;
                if (typeof node.category !== 'string') return false;
                if (typeof node.x !== 'number') return false;
                if (typeof node.y !== 'number') return false;
                if (typeof node.properties !== 'object') return false;
            }

            for (const conn of data.connections) {
                if (typeof conn !== 'object') return false;
                if (typeof conn.id !== 'string') return false;
                if (typeof conn.source !== 'string') return false;
                if (typeof conn.target !== 'string') return false;
            }
        } catch (e) {
            return false;
        }

        return true;
    }

    /**
     * 设置事件监听器
     */
    function setupEventListeners() {
        // 监听工具栏操作
        eventBus.on(EVENTS.TOOLBAR_ACTION, (data) => {
            switch (data.action) {
                case 'save':
                    saveTree();
                    break;
                case 'load':
                    loadTree();
                    break;
                case 'export-xml':
                    exportXml();
                    break;
                case 'clear':
                    clearTree();
                    break;
            }
        });

        // 复制XML按钮
        const copyXmlBtn = document.getElementById('copy-xml-btn');
        if (copyXmlBtn) {
            copyXmlBtn.addEventListener('click', copyXmlToClipboard);
        }

        // 关闭XML模态框
        const closeXmlModal = document.getElementById('close-xml-modal');
        if (closeXmlModal) {
            closeXmlModal.addEventListener('click', () => {
                elements.xmlModal.style.display = 'none';
            });
        }

        // 点击外部关闭模态框
        window.addEventListener('click', (e) => {
            if (e.target === elements.xmlModal) {
                elements.xmlModal.style.display = 'none';
            }
        });
    }

    // 初始化
    setupEventListeners();

    // 返回公共API
    return {
        saveTree,
        loadTree,
        clearTree,
        exportXml,
        copyXmlToClipboard,
        validateTreeSemantics
    };
}