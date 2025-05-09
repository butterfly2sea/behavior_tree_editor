/**
 * 行为树节点类型定义
 * 按照标准行为树模式分类为五大类:
 * - 组合节点(Composite): 控制多个子节点执行顺序的节点
 * - 装饰节点(Decorator): 修改单个子节点行为或结果的节点
 * - 条件节点(Condition): 检查条件的节点，不执行实际行动
 * - 行为节点(Action): 执行具体行动的叶节点
 * - 子树节点(SubTree): 引用其他行为树的节点
 *
 * 每个节点类型具有以下属性:
 * - type: 节点类型标识符
 * - name: 显示名称
 * - builtin: 是否为内置节点类型
 * - description: 节点描述
 * - properties: 节点可编辑属性
 * - maxChildren: 最大子节点数量 (null表示无限制)
 * - canBeChildless: 是否可以没有子节点
 */

export const NODE_TYPES = {
    // 组合节点 - 管理多个子节点的执行流程
    composite: [{
        type: 'Sequence',
        name: '顺序',
        builtin: true,
        description: '按顺序执行子节点。如果一个子节点返回FAILURE，则停止并返回FAILURE。如果一个子节点返回RUNNING，下次会从该节点继续执行。所有子节点成功则返回SUCCESS。',
        properties: [],
        maxChildren: null,
        canBeChildless: false
    }, {
        type: 'SequenceWithMemory',
        name: '带记忆顺序',
        builtin: true,
        description: '按顺序执行子节点，但会记住执行状态。当从RUNNING状态恢复时，会从上次运行的子节点继续，而不是从头开始。',
        properties: [],
        maxChildren: null,
        canBeChildless: false
    }, {
        type: 'ReactiveSequence',
        name: '反应式顺序',
        builtin: true,
        description: '类似于并行节点。所有子节点从前往后执行：如果子节点返回RUNNING，则停止其余子节点并返回RUNNING。如果子节点返回SUCCESS，检查下一个子节点。如果子节点返回FAILURE，停止并返回FAILURE。',
        properties: [],
        maxChildren: null,
        canBeChildless: false
    }, {
        type: 'Fallback',
        name: '选择',
        builtin: true,
        description: '尝试执行子节点，直到一个成功。如果一个子节点返回SUCCESS，则停止并返回SUCCESS。如果所有子节点返回FAILURE，则返回FAILURE。',
        properties: [],
        maxChildren: null,
        canBeChildless: false
    }, {
        type: 'ReactiveFallback',
        name: '反应式选择',
        builtin: true,
        description: '类似于并行节点。所有子节点从前往后执行：如果子节点返回RUNNING，继续检查下一个子节点。如果子节点返回FAILURE，继续检查下一个子节点。如果子节点返回SUCCESS，停止并返回SUCCESS。',
        properties: [],
        maxChildren: null,
        canBeChildless: false
    }, {
        type: 'Parallel',
        name: '并行',
        builtin: true,
        description: '并行执行所有子节点。当成功阈值数量的子节点成功时返回成功，当失败阈值数量的子节点失败时返回失败。',
        properties: [{
            name: 'success_count', type: 'number', default: -1, description: '返回SUCCESS所需的子节点数量，-1表示全部子节点'
        }, {
            name: 'failure_count', type: 'number', default: 1, description: '返回FAILURE所需的子节点数量'
        }],
        maxChildren: null,
        canBeChildless: false
    }, {
        type: 'ParallelAll',
        name: '全并行',
        builtin: true,
        description: '并行执行所有子节点，但与Parallel不同，它始终会完成所有子节点的执行。',
        properties: [{
            name: 'max_failures', type: 'number', default: 1, description: '如果返回FAILURE的子节点数超过此值，ParallelAll返回FAILURE'
        }],
        maxChildren: null,
        canBeChildless: false
    }, {
        type: 'IfThenElse',
        name: '条件分支',
        builtin: true,
        description: '必须有2或3个子节点。第一个子节点是条件，如果返回SUCCESS，则执行第二个子节点；如果返回FAILURE，则执行第三个子节点。',
        properties: [],
        maxChildren: 3,
        canBeChildless: false
    }, {
        type: 'WhileDoElse',
        name: '条件循环',
        builtin: true,
        description: '必须有2或3个子节点。第一个子节点是条件判断，每次tick都会执行。如果返回SUCCESS，执行第二个子节点；如果返回FAILURE，执行第三个子节点。',
        properties: [],
        maxChildren: 3,
        canBeChildless: false
    }, {
        type: 'Switch',
        name: '开关选择',
        builtin: true,
        description: '根据指定变量的值执行不同的子节点。类似于编程语言中的switch语句。',
        properties: [{
            name: 'variable', type: 'string', default: '', description: '要检查的变量'
        }, {
            name: 'case_1', type: 'string', default: '', description: '第一个分支的条件值'
        }, {
            name: 'case_2', type: 'string', default: '', description: '第二个分支的条件值'
        }, {
            name: 'case_3', type: 'string', default: '', description: '第三个分支的条件值'
        }],
        maxChildren: null,
        canBeChildless: false
    }, {
        type: 'ManualSelector',
        name: '手动选择',
        builtin: true,
        description: '使用终端用户界面手动选择要执行的子节点。',
        properties: [{
            name: 'repeat_last_selection', type: 'boolean', default: false, description: '如果为true，重复执行上次选择的子节点'
        }],
        maxChildren: null,
        canBeChildless: false
    }], decorator: [{
        type: 'ForceSuccess',
        name: '强制成功',
        builtin: true,
        description: '无论子节点返回什么状态，都转换为SUCCESS（除非是RUNNING）。',
        properties: [],
        maxChildren: 1,
        canBeChildless: false
    }, {
        type: 'ForceFailure',
        name: '强制失败',
        builtin: true,
        description: '无论子节点返回什么状态，都转换为FAILURE（除非是RUNNING）。',
        properties: [],
        maxChildren: 1,
        canBeChildless: false
    }, {
        type: 'Inverter',
        name: '取反器',
        builtin: true,
        description: '反转子节点的结果：SUCCESS变为FAILURE，FAILURE变为SUCCESS。RUNNING状态保持不变。',
        properties: [],
        maxChildren: 1,
        canBeChildless: false
    }, {
        type: 'KeepRunningUntilFailure',
        name: '运行直到失败',
        builtin: true,
        description: '重复执行子节点，直到子节点返回FAILURE。如果子节点返回SUCCESS，重置子节点并继续返回RUNNING。',
        properties: [],
        maxChildren: 1,
        canBeChildless: false
    }, {
        type: 'RepeatNode',
        name: '重复',
        builtin: true,
        description: '重复执行子节点指定的次数。如果子节点返回FAILURE，则立即停止并返回FAILURE。',
        properties: [{
            name: 'num_cycles', type: 'number', default: 1, description: '重复执行子节点的次数。使用-1表示无限重复。'
        }],
        maxChildren: 1,
        canBeChildless: false
    }, {
        type: 'RetryUntilSuccessful',
        name: '重试直到成功',
        builtin: true,
        description: '在子节点失败时重试。如果子节点返回SUCCESS，停止重试并返回SUCCESS。',
        properties: [{
            name: 'num_attempts', type: 'number', default: 1, description: '最大重试次数。使用-1表示无限重试。'
        }],
        maxChildren: 1,
        canBeChildless: false
    }, {
        type: 'Timeout',
        name: '超时',
        builtin: true,
        description: '如果子节点运行时间超过指定时间，则中止子节点并返回FAILURE。',
        properties: [{
            name: 'msec', type: 'number', default: 1000, description: '超时时间（毫秒）'
        }],
        maxChildren: 1,
        canBeChildless: false
    }, {
        type: 'Delay',
        name: '延迟',
        builtin: true,
        description: '等待指定时间后再执行子节点，返回子节点的执行结果。',
        properties: [{
            name: 'delay_msec', type: 'number', default: 1000, description: '延迟时间（毫秒）'
        }],
        maxChildren: 1,
        canBeChildless: false
    }, {
        type: 'RunOnce',
        name: '仅执行一次',
        builtin: true,
        description: '只执行子节点一次。之后可以设置为跳过或返回相同结果。',
        properties: [{
            name: 'then_skip', type: 'boolean', default: true, description: '如果为true，第一次执行后跳过；否则返回子节点返回的相同状态'
        }],
        maxChildren: 1,
        canBeChildless: false
    }, {
        type: 'Script', name: '脚本条件', builtin: true, description: '使用脚本条件判断是否执行子节点。', properties: [{
            name: 'code', type: 'string', default: '', description: '要执行的脚本代码'
        }], maxChildren: 1, canBeChildless: true
    }], action: [{
        type: 'FlightmodeCtrl',
        name: '飞行模式控制',
        builtin: true,
        description: '依据输入参数设置飞行模式。',
        properties: [{
            name: 'mode', type: 'number', default: 0, description: '期望的飞行模式：1-手动，2-定高，3-定点，4-起飞，5-降落，6-等待，等'
        }, {
            name: 'param7', type: 'number', default: -1, description: '起飞模式时的起飞高度'
        }],
        maxChildren: 0,
        canBeChildless: true
    }, {
        type: 'LockCtrl',
        name: '锁定控制',
        builtin: true,
        description: '上锁、解锁控制，依据期望状态调用服务发送上锁、解锁控制。',
        properties: [{
            name: 'state', type: 'number', default: 0, description: '期望的锁状态：0-上锁，1-解锁'
        }],
        maxChildren: 0,
        canBeChildless: true
    }, {
        type: 'NavwayCtrl',
        name: '航线控制',
        builtin: true,
        description: '编队节点控制，对编队节点开始、暂停、继续、停止控制。',
        properties: [{
            name: 'frame', type: 'number', default: 1, description: '1-节点自己进行offboard控制，0-节点只进行计算不进行实际控制'
        }, {
            name: 'command', type: 'number', default: 0, description: '控制指令：0-开始，1-暂停，2-继续，3-停止'
        }],
        maxChildren: 0,
        canBeChildless: true
    }, {
        type: 'TraceAttackCtrl',
        name: '跟踪打击控制',
        builtin: true,
        description: '跟踪打击控制，包括开始、暂停、继续及停止控制。',
        properties: [{
            name: 'frame', type: 'number', default: 1, description: '1-节点自己进行offboard控制，0-节点只计算不控制'
        }, {
            name: 'command', type: 'number', default: 0, description: '控制指令：0-开始，1-暂停，2-继续，3-停止'
        }, {
            name: 'current', type: 'number', default: 0, description: '0-跟踪，1-打击'
        }],
        maxChildren: 0,
        canBeChildless: true
    }, {
        type: 'OffboardCtrl',
        name: 'Offboard控制',
        builtin: true,
        description: '发送offboard控制话题，用于控制无人机的位置、姿态等，话题名默认为inner/control/offboard。',
        properties: [{
            name: 'ctrl', type: 'string', default: 'inner/control/offboard', description: 'offboard控制量信息，由其它节点提供值'
        }, {
            name: 'yaw', type: 'number', default: 0, description: '航向控制'
        }],
        maxChildren: 0,
        canBeChildless: true
    }, {
        type: 'SetLine',
        name: '设置航线',
        builtin: true,
        description: '设置航线相关信息，利用对应话题发布航线、到点距离、分组、偏移等消息。',
        properties: [{
            name: 'antiDis', type: 'number', default: 0.6, description: '避撞距离'
        }, {
            name: 'type', type: 'number', default: 1023, description: '设置内容类型'
        }, {
            name: 'vehiTypParam', type: 'string', default: 'vehiType', description: 'json参数中载具参数名'
        }, {
            name: 'spdParam', type: 'string', default: 'spd', description: 'json参数中速度参数名'
        }, {
            name: 'ptTypParam', type: 'string', default: 'pointTag', description: 'json参数中航点类型参数名'
        }, {
            name: 'disParam', type: 'string', default: 'arvDis', description: 'json参数中到点距离参数名'
        }, {
            name: 'ptsParam', type: 'string', default: 'wayPoints', description: 'json参数中航点参数名'
        }, {
            name: 'lpsParam', type: 'string', default: 'loops', description: 'json参数中循环次数参数名'
        }],
        maxChildren: 0,
        canBeChildless: true
    }, {
        type: 'SetDstPt',
        name: '设置目标点',
        builtin: true,
        description: '设置目的点，主要用于详查时，先飞到详查点（此目的点）。',
        properties: [{
            name: 'step', type: 'number', default: 0, description: '任务步骤：0-当前水平位置障碍高度，1-目的水平位置障碍高度，2-目的位置'
        }, {
            name: 'obsHgh', type: 'number', default: -60, description: '避障高度'
        }, {
            name: 'rdsParam', type: 'string', default: 'radius', description: '半径参数名'
        }, {
            name: 'itvParam', type: 'string', default: 'intval', description: '间隔参数名'
        }, {
            name: 'altParam', type: 'string', default: 'alt', description: '高度参数名'
        }, {
            name: 'ptTypParam', type: 'string', default: 'pointTag', description: '点类型参数名'
        }, {
            name: 'dstParam', type: 'string', default: 'dstLoc', description: '目标点参数名'
        }],
        maxChildren: 0,
        canBeChildless: true
    }, {
        type: 'SetTriggers',
        name: '设置触发器',
        builtin: true,
        description: '设置触发器，比如延迟触发等。',
        properties: [{
            name: 'delay', type: 'number', default: 0, description: '延迟时间'
        }],
        maxChildren: 0,
        canBeChildless: true
    }, {
        type: 'SetTraceAttackObj',
        name: '设置跟踪打击目标',
        builtin: true,
        description: '设置跟踪打击目标，利用对应话题发布目标消息。',
        properties: [{
            name: 'filter', type: 'boolean', default: false, description: '是否过滤'
        }, {
            name: 'tgtIdParam', type: 'string', default: 'tgtId', description: 'json任务中目标参数名'
        }, {
            name: 'srcIdParam', type: 'string', default: 'srcId', description: 'json任务中目标来源的飞机id'
        }],
        maxChildren: 0,
        canBeChildless: true
    }, {
        type: 'TopicTrans',
        name: '话题转发',
        builtin: true,
        description: '发送转发话题，话题名通过参数传入。',
        properties: [{
            name: 'tpc', type: 'string', default: 'formation/task_gen', description: '待发布话题名'
        }],
        maxChildren: 0,
        canBeChildless: true
    }, {
        type: 'Joystick',
        name: '摇杆控制',
        builtin: true,
        description: '处理地面发来的摇杆数据并转换为mavros的manual控制消息进行转发。',
        properties: [{
            name: 'lost', type: 'number', default: 2000, description: '失去摇杆控制时长判定（毫秒）'
        }],
        maxChildren: 0,
        canBeChildless: true
    }, {
        type: 'GetLocation',
        name: '获取位置',
        builtin: true,
        description: '获取本机简单飞控信息，并将位置信息输出给offboard控制量。',
        properties: [{
            name: 'target', type: 'string', default: '', description: 'offboard控制量'
        }, {
            name: 'mode', type: 'number', default: '', description: 'offboard模式'
        }, {
            name: 'zoffset', type: 'number', default: 0, description: '垂直向偏移量'
        }, {
            name: 'fixed', type: 'number', default: 0, description: '垂直向使用固定值'
        }],
        maxChildren: 0,
        canBeChildless: true
    }, {
        type: 'GetGroupLocation',
        name: '获取分组位置',
        builtin: true,
        description: '获取分组中飞机位置信息包括本机及它机。',
        properties: [],
        maxChildren: 0,
        canBeChildless: true
    }, {
        type: 'CommandStatus',
        name: '指令状态',
        builtin: true,
        description: '用于使用行为节点发布指令回复信息，包括命令回复和任务状态回复。',
        properties: [{
            name: 'cmd', type: 'number', default: 0, description: '消息对应的cmd参数'
        }, {
            name: 'subcmd', type: 'number', default: 0, description: '消息对应的subcmd参数'
        }, {
            name: 'status', type: 'number', default: 0, description: '消息对应的status参数'
        }, {
            name: 'rslt', type: 'string', default: '', description: '消息对应的rslt参数'
        }],
        maxChildren: 0,
        canBeChildless: true
    }], condition: [{
        type: 'CheckArriveDst',
        name: '检查到达目标',
        builtin: true,
        description: '检查是否到达目标点，可以包括只判定垂直向是否到达、三向距离是否到达、其它飞机是否到达。',
        properties: [{
            name: 'target', type: 'string', default: '', description: '目标控制量'
        }, {
            name: 'arvdis', type: 'number', default: 0.2, description: '到点判定距离'
        }, {
            name: 'onlyz', type: 'number', default: 1, description: '是否只判定垂直向是否到达'
        }],
        maxChildren: 0,
        canBeChildless: true
    }, {
        type: 'CheckStartTask',
        name: '检查任务开始',
        builtin: true,
        description: '检测任务是否开始，可以根据不同触发类型判断。',
        properties: [{
            name: 'delay', type: 'number', default: 0, description: '延迟时间(毫秒)'
        }],
        maxChildren: 0,
        canBeChildless: true
    }, {
        type: 'CheckWayViaTp',
        name: '检查航点通过',
        builtin: true,
        description: '检查航点经由航向点是否到达。',
        properties: [{
            name: 'arriveDis', type: 'number', default: 1, description: '到点距离(米)'
        }],
        maxChildren: 0,
        canBeChildless: true
    }, {
        type: 'CheckQuitSearch',
        name: '检查停止搜索',
        builtin: true,
        description: '检测是否停止搜索，依据是否收到目标位置消息进行判定。',
        properties: [],
        maxChildren: 0,
        canBeChildless: true
    }, {
        type: 'CheckAllArriveDst',
        name: '检查全部到达目标',
        builtin: true,
        description: '检查是否全部到达目标，现检测同分组内全部飞机朝向都指向航线的第一个航点。',
        properties: [{
            name: 'delay', type: 'number', default: 5000, description: '全部飞机航向就绪后的等待时间'
        }, {
            name: 'dstyaw', type: 'number', default: 0, description: '目标航向'
        }],
        maxChildren: 0,
        canBeChildless: true
    }], subtree: [{
        type: 'SubTree',
        name: '子树',
        builtin: true,
        description: '包装整个子树，创建一个单独的黑板。如果要通过端口传输数据，需要显式重新映射端口。',
        properties: [{
            name: 'ID', type: 'string', default: '', description: '子树的ID'
        }, {
            name: '_autoremap', type: 'boolean', default: false, description: '是否自动重新映射端口'
        }],
        maxChildren: 0,
        canBeChildless: true
    }]
};

/**
 * 获取节点类别的默认属性
 * @param {string} category - 节点类别
 * @returns {Array} - 默认属性数组
 */
export function getDefaultPropertiesForCategory(category) {
    switch (category) {
        case 'composite':
            return [{
                name: 'success_threshold', type: 'number', default: '1', description: '成功阈值'
            }, {
                name: 'failure_threshold', type: 'number', default: '1', description: '失败阈值'
            }];

        case 'decorator':
            return [{
                name: 'param', type: 'string', default: '', description: '参数'
            }];

        case 'action':
            return [{
                name: 'action_name', type: 'string', default: '', description: '动作名称'
            }, {
                name: 'sync', type: 'boolean', default: 'true', description: '是否同步执行'
            }];

        case 'condition':
            return [{
                name: 'expression', type: 'string', default: '', description: '条件表达式'
            }];

        case 'subtree':
            return [{
                name: 'tree_id', type: 'string', default: '', description: '子树ID'
            }];

        default:
            return [];
    }
}

/**
 * 获取节点类别的默认约束
 * @param {string} category - 节点类别
 * @returns {Object} - 包含maxChildren和canBeChildless的约束对象
 */
export function getDefaultConstraintsForCategory(category) {
    switch (category) {
        case 'composite':
            return {
                maxChildren: null, // 无限制
                canBeChildless: false // 必须有子节点
            };

        case 'decorator':
            return {
                maxChildren: 1, // 只能有一个子节点
                canBeChildless: false // 必须有子节点
            };

        case 'action':
        case 'condition':
            return {
                maxChildren: 0, // 不能有子节点
                canBeChildless: true // 必须是叶节点
            };

        case 'subtree':
            return {
                maxChildren: 0, // 不能有子节点
                canBeChildless: true // 必须是叶节点
            };

        default:
            return {
                maxChildren: null, canBeChildless: true
            };
    }
}

/**
 * 根据类型和类别获取节点定义
 * @param {string} type - 节点类型
 * @param {string} category - 节点类别
 * @returns {Object|null} - 节点定义或null
 */
export function getNodeDefinition(type, category) {
    // 检查内置类型
    if (NODE_TYPES[category]) {
        const builtInType = NODE_TYPES[category].find(nt => nt.type === type);
        if (builtInType) return builtInType;
    }

    // 检查自定义节点类型
    if (typeof window !== 'undefined' && window.state && window.state.customNodeTypes) {
        return window.state.customNodeTypes.find(nt => nt.type === type);
    }

    return null;
}