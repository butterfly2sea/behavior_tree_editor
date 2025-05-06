/**
 * 行为树节点类型定义
 * 按照标准行为树模式重新分类为四大类:
 * - 组合节点(Composite): 控制多个子节点执行顺序的节点
 * - 装饰节点(Decorator): 修改单个子节点行为或结果的节点
 * - 条件节点(Condition): 检查条件的节点，不执行实际行动
 * - 行为节点(Action): 执行具体行动的叶节点
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
    composite: [
        {
            type: 'Sequence',
            name: '顺序执行',
            builtin: true,
            description: '依次执行所有子节点，如果一个子节点返回失败，则整个序列返回失败。',
            properties: [],
            maxChildren: null,
            canBeChildless: false
        },
        {
            type: 'SequenceWithMemory',
            name: '带记忆顺序执行',
            builtin: true,
            description: '带记忆的序列节点，会记住已经执行成功的子节点，当重新执行时从上次失败的节点开始。',
            properties: [],
            maxChildren: null,
            canBeChildless: false
        },
        {
            type: 'Fallback',
            name: '选择执行',
            builtin: true,
            description: '尝试执行子节点，直到一个子节点返回成功，否则返回失败。',
            properties: [],
            maxChildren: null,
            canBeChildless: false
        },
        {
            type: 'ReactiveFallback',
            name: '响应式选择执行',
            builtin: true,
            description: '响应式选择节点，每次执行时重新评估所有条件。',
            properties: [],
            maxChildren: null,
            canBeChildless: false
        },
        {
            type: 'SubTree',
            name: '子树',
            builtin: true,
            description: '引用其他行为树作为子树执行。',
            properties: [
                {
                    name: 'ID',
                    type: 'string',
                    default: '',
                    description: '子树的ID'
                },
                {
                    name: '_autoremap',
                    type: 'boolean',
                    default: false,
                    description: '是否自动重映射参数'
                }
            ],
            maxChildren: 0,
            canBeChildless: true
        }
    ],

    // 装饰节点 - 修改单个子节点的行为或结果
    decorator: [
        {
            type: 'Delay',
            name: '延迟',
            builtin: true,
            description: '延迟执行子节点指定的时间。',
            properties: [
                {
                    name: 'delay_msec',
                    type: 'number',
                    default: 1000,
                    description: '延迟时间(毫秒)'
                }
            ],
            maxChildren: 1,
            canBeChildless: false
        },
        {
            type: 'KeepRunningUntilFailure',
            name: '持续运行直到失败',
            builtin: true,
            description: '持续执行子节点直到返回失败。',
            properties: [],
            maxChildren: 1,
            canBeChildless: false
        },
        {
            type: 'ForceSuccess',
            name: '强制成功',
            builtin: true,
            description: '无论子节点返回什么，都强制返回成功。',
            properties: [],
            maxChildren: 1,
            canBeChildless: false
        },
        {
            type: 'RetryUntilSuccessful',
            name: '重试直到成功',
            builtin: true,
            description: '重试执行子节点直到成功或达到最大尝试次数。',
            properties: [
                {
                    name: 'num_attempts',
                    type: 'number',
                    default: 1,
                    description: '最大尝试次数'
                }
            ],
            maxChildren: 1,
            canBeChildless: false
        },
        {
            type: 'Repeat',
            name: '重复执行',
            builtin: true,
            description: '重复执行子节点指定的次数。',
            properties: [
                {
                    name: 'num_cycles',
                    type: 'number',
                    default: 1,
                    description: '重复次数'
                }
            ],
            maxChildren: 1,
            canBeChildless: false
        },
        {
            type: 'Script',
            name: '脚本',
            builtin: true,
            description: '执行简单的脚本代码。',
            properties: [
                {
                    name: 'code',
                    type: 'string',
                    default: '',
                    description: '要执行的脚本代码'
                }
            ],
            maxChildren: 0,
            canBeChildless: true
        }
    ],

    // 条件节点 - 评估条件并返回成功或失败
    condition: [
        {
            type: 'CheckArriveDst',
            name: '检查到达目标',
            builtin: true,
            description: '检查是否到达目标点，可以包括只判定垂直向是否到达、三向距离是否到达、其它飞机是否到达。',
            properties: [
                {
                    name: 'target',
                    type: 'string',
                    default: '',
                    description: '目标控制量'
                },
                {
                    name: 'arvdis',
                    type: 'number',
                    default: 0.2,
                    description: '到点判定距离'
                },
                {
                    name: 'onlyz',
                    type: 'number',
                    default: 1,
                    description: '是否只判定垂直向是否到达'
                }
            ],
            maxChildren: 0,
            canBeChildless: true
        },
        {
            type: 'CheckStartTask',
            name: '检查任务开始',
            builtin: true,
            description: '检测任务是否开始，可以根据不同触发类型判断。',
            properties: [
                {
                    name: 'delay',
                    type: 'number',
                    default: 0,
                    description: '延迟时间(毫秒)'
                }
            ],
            maxChildren: 0,
            canBeChildless: true
        },
        {
            type: 'CheckWayViaTp',
            name: '检查航点通过',
            builtin: true,
            description: '检查航点经由航向点是否到达。',
            properties: [
                {
                    name: 'arriveDis',
                    type: 'number',
                    default: 1,
                    description: '到点距离(米)'
                }
            ],
            maxChildren: 0,
            canBeChildless: true
        },
        {
            type: 'CheckQuitSearch',
            name: '检查停止搜索',
            builtin: true,
            description: '检测是否停止搜索，依据是否收到目标位置消息进行判定。',
            properties: [],
            maxChildren: 0,
            canBeChildless: true
        },
        {
            type: 'CheckAllArriveDst',
            name: '检查全部到达目标',
            builtin: true,
            description: '检查是否全部到达目标，现检测同分组内全部飞机朝向都指向航线的第一个航点。',
            properties: [
                {
                    name: 'delay',
                    type: 'number',
                    default: 5000,
                    description: '全部飞机航向就绪后的等待时间'
                },
                {
                    name: 'dstyaw',
                    type: 'number',
                    default: 0,
                    description: '目标航向'
                }
            ],
            maxChildren: 0,
            canBeChildless: true
        },
        {
            type: 'CheckFlightmode',
            name: '检查飞行模式',
            builtin: true,
            description: '检查飞行模式是否为指定模式。',
            properties: [
                {
                    name: 'mode',
                    type: 'number',
                    default: 0,
                    description: '期望的飞行模式'
                }
            ],
            maxChildren: 0,
            canBeChildless: true
        },
        {
            type: 'CommandStatus',
            name: '命令状态',
            builtin: true,
            description: '用于使用行为节点发布指令回复信息，包括命令回复和任务状态回复。',
            properties: [
                {
                    name: 'cmd',
                    type: 'number',
                    default: 0,
                    description: '消息对应的cmd参数'
                },
                {
                    name: 'subcmd',
                    type: 'number',
                    default: 0,
                    description: '消息对应的subcmd参数'
                },
                {
                    name: 'status',
                    type: 'number',
                    default: 0,
                    description: '消息对应的status参数'
                },
                {
                    name: 'rslt',
                    type: 'string',
                    default: '',
                    description: '消息对应的rslt参数'
                }
            ],
            maxChildren: 0,
            canBeChildless: true
        }
    ],

    // 行为节点 - 执行具体行动的叶节点
    action: [
        {
            type: 'FlightmodeCtrl',
            name: '飞行模式控制',
            builtin: true,
            description: '飞行模式控制，依据输入参数设置飞行模式。',
            properties: [
                {
                    name: 'mode',
                    type: 'number',
                    default: 0,
                    description: '期望的飞行模式'
                },
                {
                    name: 'param7',
                    type: 'number',
                    default: -1,
                    description: '起飞模式时的起飞高度'
                }
            ],
            maxChildren: 0,
            canBeChildless: true
        },
        {
            type: 'LockCtrl',
            name: '锁定控制',
            builtin: true,
            description: '上锁、解锁控制，依据期望状态调用服务发送上锁、解锁控制。',
            properties: [
                {
                    name: 'state',
                    type: 'number',
                    default: 1,
                    description: '期望的锁状态(0-上锁，1-解锁)'
                }
            ],
            maxChildren: 0,
            canBeChildless: true
        },
        {
            type: 'NavwayCtrl',
            name: '航线控制',
            builtin: true,
            description: '航线控制，对航线节点开始、暂停、继续、停止控制。',
            properties: [
                {
                    name: 'frame',
                    type: 'number',
                    default: 1,
                    description: '1-节点自己进行offboard控制，0-节点只进行计算不进行实际控制'
                },
                {
                    name: 'command',
                    type: 'number',
                    default: 0,
                    description: '控制指令(0-开始，1-暂停，2-继续，3-停止)'
                }
            ],
            maxChildren: 0,
            canBeChildless: true
        },
        {
            type: 'TraceAttackCtrl',
            name: '跟踪打击控制',
            builtin: true,
            description: '跟踪打击控制，包括开始、暂停、继续及停止控制。',
            properties: [
                {
                    name: 'frame',
                    type: 'number',
                    default: 1,
                    description: '1-节点自己进行offboard控制，0-节点只计算不控制'
                },
                {
                    name: 'command',
                    type: 'number',
                    default: 0,
                    description: '控制指令(0-开始，1-暂停，2-继续，3-停止)'
                },
                {
                    name: 'current',
                    type: 'number',
                    default: 0,
                    description: '0-跟踪，1-打击'
                }
            ],
            maxChildren: 0,
            canBeChildless: true
        },
        {
            type: 'OffboardCtrl',
            name: 'Offboard控制',
            builtin: true,
            description: '发送offboard控制消息，用于控制无人机的位置、姿态等。',
            properties: [
                {
                    name: 'ctrl',
                    type: 'string',
                    default: '',
                    description: 'offboard控制量信息'
                },
                {
                    name: 'yaw',
                    type: 'number',
                    default: 0,
                    description: '航向控制'
                }
            ],
            maxChildren: 0,
            canBeChildless: true
        },
        {
            type: 'SetLine',
            name: '设置航线',
            builtin: true,
            description: '设置航线相关信息，包括航点、到点距离、分组、偏移等。',
            properties: [
                {
                    name: 'antiDis',
                    type: 'number',
                    default: 0.6,
                    description: '避撞距离'
                },
                {
                    name: 'type',
                    type: 'number',
                    default: 1023,
                    description: '设置内容类型'
                },
                {
                    name: 'vehiTypParam',
                    type: 'string',
                    default: 'vehiType',
                    description: 'json参数中载具参数名'
                },
                {
                    name: 'spdParam',
                    type: 'string',
                    default: 'spd',
                    description: 'json参数中速度参数名'
                },
                {
                    name: 'ptTypParam',
                    type: 'string',
                    default: 'pointTag',
                    description: 'json参数中航点类型参数名'
                },
                {
                    name: 'disParam',
                    type: 'string',
                    default: 'arvDis',
                    description: 'json参数中到点距离参数名'
                },
                {
                    name: 'ptsParam',
                    type: 'string',
                    default: 'wayPoints',
                    description: 'json参数中航点参数名'
                },
                {
                    name: 'lpsParam',
                    type: 'string',
                    default: 'loops',
                    description: 'json参数中循环次数参数名'
                }
            ],
            maxChildren: 0,
            canBeChildless: true
        },
        {
            type: 'SetDstPt',
            name: '设置目标点',
            builtin: true,
            description: '设置目的点，主要用于详查时飞到详查点。',
            properties: [
                {
                    name: 'step',
                    type: 'number',
                    default: 0,
                    description: '任务步骤'
                },
                {
                    name: 'obsHgh',
                    type: 'number',
                    default: -60,
                    description: '避障高度'
                },
                {
                    name: 'rdsParam',
                    type: 'string',
                    default: 'radius',
                    description: '半径参数名'
                },
                {
                    name: 'itvParam',
                    type: 'string',
                    default: 'intval',
                    description: '间隔参数名'
                },
                {
                    name: 'altParam',
                    type: 'string',
                    default: 'alt',
                    description: '高度参数名'
                },
                {
                    name: 'ptTypParam',
                    type: 'string',
                    default: 'pointTag',
                    description: '点类型参数名'
                },
                {
                    name: 'dstParam',
                    type: 'string',
                    default: 'dstLoc',
                    description: '目标点参数名'
                }
            ],
            maxChildren: 0,
            canBeChildless: true
        },
        {
            type: 'SetTriggers',
            name: '设置触发器',
            builtin: true,
            description: '设置触发器，比如延迟触发等。',
            properties: [
                {
                    name: 'delay',
                    type: 'number',
                    default: 0,
                    description: '延迟时间'
                }
            ],
            maxChildren: 0,
            canBeChildless: true
        },
        {
            type: 'SetTraceAttackObj',
            name: '设置跟踪打击目标',
            builtin: true,
            description: '设置跟踪打击目标。',
            properties: [
                {
                    name: 'filter',
                    type: 'boolean',
                    default: false,
                    description: '是否过滤目标'
                },
                {
                    name: 'tgtIdParam',
                    type: 'string',
                    default: 'tgtId',
                    description: 'json任务中目标参数名'
                },
                {
                    name: 'srcIdParam',
                    type: 'string',
                    default: 'srcId',
                    description: 'json任务中目标来源的飞机id'
                }
            ],
            maxChildren: 0,
            canBeChildless: true
        },
        {
            type: 'TopicTrans',
            name: '话题转发',
            builtin: true,
            description: '发送转发话题。',
            properties: [
                {
                    name: 'tpc',
                    type: 'string',
                    default: 'formation/task_gen',
                    description: '待发布话题名'
                }
            ],
            maxChildren: 0,
            canBeChildless: true
        },
        {
            type: 'Joystick',
            name: '摇杆控制',
            builtin: true,
            description: '摇杆控制，处理地面发来的摇杆数据并转换为控制消息。',
            properties: [
                {
                    name: 'lost',
                    type: 'number',
                    default: 2000,
                    description: '失去摇杆控制时长判定(毫秒)'
                }
            ],
            maxChildren: 0,
            canBeChildless: true
        },
        {
            type: 'GetLocation',
            name: '获取位置',
            builtin: true,
            description: '获取本机简单飞控信息，并将位置信息输出给offboard控制量。',
            properties: [
                {
                    name: 'target',
                    type: 'string',
                    default: '',
                    description: 'offboard控制量'
                },
                {
                    name: 'zoffset',
                    type: 'number',
                    default: 0,
                    description: '垂直向偏移量'
                },
                {
                    name: 'fixed',
                    type: 'number',
                    default: 0,
                    description: '垂直向使用固定值'
                }
            ],
            maxChildren: 0,
            canBeChildless: true
        },
        {
            type: 'GetGroupLocation',
            name: '获取分组位置',
            builtin: true,
            description: '获取分组中飞机位置信息包括本机及它机。',
            properties: [
                {
                    name: 'test',
                    type: 'number',
                    default: 0,
                    description: '测试输出'
                }
            ],
            maxChildren: 0,
            canBeChildless: true
        }
    ]
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
                name: 'success_threshold',
                type: 'number',
                default: '1',
                description: '成功阈值'
            }, {
                name: 'failure_threshold',
                type: 'number',
                default: '1',
                description: '失败阈值'
            }];

        case 'decorator':
            return [{
                name: 'param',
                type: 'string',
                default: '',
                description: '参数'
            }];

        case 'action':
            return [{
                name: 'action_name',
                type: 'string',
                default: '',
                description: '动作名称'
            }, {
                name: 'sync',
                type: 'boolean',
                default: 'true',
                description: '是否同步执行'
            }];

        case 'condition':
            return [{
                name: 'expression',
                type: 'string',
                default: '',
                description: '条件表达式'
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

        default:
            return {
                maxChildren: null,
                canBeChildless: true
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