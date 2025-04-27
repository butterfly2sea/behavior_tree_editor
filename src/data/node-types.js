/**
 * Node type definitions for BehaviorTree.CPP
 * Each node type has properties:
 * - type: The identifier for the node type
 * - name: Display name
 * - builtin: Whether this is a built-in node type (can't be deleted)
 * - description: Text description of the node
 * - properties: Editable properties of the node
 * - maxChildren: Maximum number of children allowed (null = unlimited)
 * - canBeChildless: Whether the node can have no children
 */

export const NODE_TYPES = {
    control: [
        {
            type: 'Sequence',
            name: 'Sequence',
            builtin: true,
            description: 'Ticks children in order until one fails. Succeeds if all children succeed, fails if any child fails.',
            properties: [
                {name: 'memory', type: 'boolean', default: 'false', description: 'Remember progress after a halt'}
            ],
            maxChildren: null, // Unlimited children
            canBeChildless: false // Must have at least one child
        },
        {
            type: 'ReactiveSequence',
            name: 'ReactiveSequence',
            builtin: true,
            description: 'Like Sequence, but it restarts when a child returns failure. Always restarts from first child.',
            properties: [],
            maxChildren: null,
            canBeChildless: false
        },
        {
            type: 'Fallback',
            name: 'Fallback',
            builtin: true,
            description: 'Ticks children in order until one succeeds. Succeeds if any child succeeds, fails if all children fail.',
            properties: [
                {name: 'memory', type: 'boolean', default: 'false', description: 'Remember progress after a halt'}
            ],
            maxChildren: null,
            canBeChildless: false
        },
        {
            type: 'ReactiveFallback',
            name: 'ReactiveFallback',
            builtin: true,
            description: 'Like Fallback, but it restarts when a child returns success. Always restarts from first child.',
            properties: [],
            maxChildren: null,
            canBeChildless: false
        },
        {
            type: 'IfThenElse',
            name: 'IfThenElse',
            builtin: true,
            description: 'Executes "then" or "else" child based on condition. First child is the condition, second is "then", third is "else".',
            properties: [],
            maxChildren: 3, // Condition, Then, Else
            canBeChildless: false
        },
        {
            type: 'WhileDoElse',
            name: 'WhileDoElse',
            builtin: true,
            description: 'Executes "do" as long as condition returns success. First child is the condition, second is "do", third is "else".',
            properties: [],
            maxChildren: 3, // Condition, Do, Else
            canBeChildless: false
        },
        {
            type: 'Parallel',
            name: 'Parallel',
            builtin: true,
            description: 'Executes all children concurrently. Succeeds when success_threshold children succeed. Fails when failure_threshold children fail.',
            properties: [
                {
                    name: 'success_threshold',
                    type: 'number',
                    default: '1',
                    description: 'Minimum successful children to return success'
                },
                {
                    name: 'failure_threshold',
                    type: 'number',
                    default: '1',
                    description: 'Minimum failed children to return failure'
                }
            ],
            maxChildren: null,
            canBeChildless: false
        },
        {
            type: 'ParallelAll',
            name: 'ParallelAll',
            builtin: true,
            description: 'Executes all children concurrently. Succeeds when all children succeed. Fails when any child fails.',
            properties: [],
            maxChildren: null,
            canBeChildless: false
        }
    ],
    decorator: [
        {
            type: 'Inverter',
            name: 'Inverter',
            builtin: true,
            description: 'Inverts the result of its child: SUCCESS to FAILURE and vice versa. RUNNING is passed through.',
            properties: [],
            maxChildren: 1, // Only one child
            canBeChildless: false
        },
        {
            type: 'ForceSuccess',
            name: 'ForceSuccess',
            builtin: true,
            description: 'Always returns success regardless of child result',
            properties: [],
            maxChildren: 1,
            canBeChildless: false
        },
        {
            type: 'ForceFailure',
            name: 'ForceFailure',
            builtin: true,
            description: 'Always returns failure regardless of child result',
            properties: [],
            maxChildren: 1,
            canBeChildless: false
        },
        {
            type: 'Repeat',
            name: 'Repeat',
            builtin: true,
            description: 'Repeats its child a specified number of times or until the child returns FAILURE',
            properties: [
                {name: 'num_cycles', type: 'number', default: '1', description: 'Number of repetitions'}
            ],
            maxChildren: 1,
            canBeChildless: false
        },
        {
            type: 'Retry',
            name: 'Retry',
            builtin: true,
            description: 'Retries its child a specified number of times until it succeeds',
            properties: [
                {name: 'num_attempts', type: 'number', default: '1', description: 'Number of attempts'}
            ],
            maxChildren: 1,
            canBeChildless: false
        },
        {
            type: 'Timeout',
            name: 'Timeout',
            builtin: true,
            description: 'Interrupts its child if it doesn\'t complete within the timeout',
            properties: [
                {name: 'msec', type: 'number', default: '1000', description: 'Timeout in milliseconds'}
            ],
            maxChildren: 1,
            canBeChildless: false
        },
        {
            type: 'DelayMs',
            name: 'DelayMs',
            builtin: true,
            description: 'Waits the specified time before ticking its child',
            properties: [
                {name: 'delay_ms', type: 'number', default: '100', description: 'Delay in milliseconds'}
            ],
            maxChildren: 1,
            canBeChildless: false
        },
        {
            type: 'RunOnce',
            name: 'RunOnce',
            builtin: true,
            description: 'Runs the child only once, caching the result for later ticks',
            properties: [
                {
                    name: 'reset_after',
                    type: 'boolean',
                    default: 'false',
                    description: 'Reset the cached result after x seconds'
                },
                {name: 'after_seconds', type: 'number', default: '0', description: 'Seconds after which to reset cache'}
            ],
            maxChildren: 1,
            canBeChildless: false
        }
    ],
    action: [
        {
            type: 'Action',
            name: 'Action',
            builtin: true,
            description: 'Generic action node. Calls a registered action in the BehaviorTree.CPP executor.',
            properties: [
                {name: 'action_name', type: 'string', default: '', description: 'Name of the action to execute'},
                {name: 'sync', type: 'boolean', default: 'true', description: 'Whether the action is synchronous'}
            ],
            maxChildren: 0, // No children allowed
            canBeChildless: true
        },
        {
            type: 'SetBlackboard',
            name: 'SetBlackboard',
            builtin: true,
            description: 'Sets a value in the blackboard. Can use different output_key and input_key.',
            properties: [
                {name: 'output_key', type: 'string', default: '', description: 'Blackboard key to set'},
                {
                    name: 'input_key',
                    type: 'string',
                    default: '',
                    description: 'Blackboard key to get the value from (optional)'
                },
                {
                    name: 'value',
                    type: 'string',
                    default: '',
                    description: 'Value to set (used only if input_key is empty)'
                }
            ],
            maxChildren: 0,
            canBeChildless: true
        },
        {
            type: 'Sleep',
            name: 'Sleep',
            builtin: true,
            description: 'Sleep for a specified duration',
            properties: [
                {name: 'msec', type: 'number', default: '1000', description: 'Duration in milliseconds'}
            ],
            maxChildren: 0,
            canBeChildless: true
        }
    ],
    condition: [
        {
            type: 'Condition',
            name: 'Condition',
            builtin: true,
            description: 'Generic condition node. Evaluates an expression or calls a registered condition in BehaviorTree.CPP.',
            properties: [
                {name: 'expression', type: 'string', default: '', description: 'Boolean expression to evaluate'}
            ],
            maxChildren: 0, // No children allowed
            canBeChildless: true
        },
        {
            type: 'CheckBlackboard',
            name: 'CheckBlackboard',
            builtin: true,
            description: 'Checks a value in the blackboard against a specified value or expression',
            properties: [
                {name: 'key', type: 'string', default: '', description: 'Blackboard key to check'},
                {name: 'expected', type: 'string', default: '', description: 'Expected value or expression'},
                {
                    name: 'comparison',
                    type: 'string',
                    default: '==',
                    description: 'Comparison operator (==, !=, >, >=, <, <=)'
                }
            ],
            maxChildren: 0,
            canBeChildless: true
        },
        {
            type: 'TimeoutAfter',
            name: 'TimeoutAfter',
            builtin: true,
            description: 'Returns FAILURE after a specified timeout',
            properties: [
                {name: 'msec', type: 'number', default: '1000', description: 'Timeout in milliseconds'}
            ],
            maxChildren: 0,
            canBeChildless: true
        }
    ],
    subtree: [
        {
            type: 'SubTree',
            name: 'SubTree',
            builtin: true,
            description: 'Includes another behavior tree as a subtree',
            properties: [
                {name: 'tree_id', type: 'string', default: '', description: 'ID of the subtree'}
            ],
            maxChildren: 0,
            canBeChildless: true
        }
    ]
};

/**
 * Get default properties based on node category
 * @param {string} category - Node category
 * @returns {Array} - Array of default properties
 */
export function getDefaultPropertiesForCategory(category) {
    switch (category) {
        case 'control':
            return [
                {name: 'success_threshold', type: 'number', default: '1', description: 'Success threshold'},
                {name: 'failure_threshold', type: 'number', default: '1', description: 'Failure threshold'}
            ];

        case 'decorator':
            return [
                {name: 'param', type: 'string', default: '', description: 'Parameter'}
            ];

        case 'action':
            return [
                {name: 'action_name', type: 'string', default: '', description: 'Action name'},
                {name: 'sync', type: 'boolean', default: 'true', description: 'Whether the action is synchronous'}
            ];

        case 'condition':
            return [
                {name: 'expression', type: 'string', default: '', description: 'Expression'}
            ];

        case 'subtree':
            return [
                {name: 'tree_id', type: 'string', default: '', description: 'ID of the subtree'}
            ];

        default:
            return [];
    }
}

/**
 * Get default constraints based on node category
 * @param {string} category - Node category
 * @returns {Object} - Object with maxChildren and canBeChildless properties
 */
export function getDefaultConstraintsForCategory(category) {
    switch (category) {
        case 'control':
            return {
                maxChildren: null, // Unlimited
                canBeChildless: false // Must have children
            };

        case 'decorator':
            return {
                maxChildren: 1, // Only one child
                canBeChildless: false // Must have a child
            };

        case 'action':
        case 'condition':
        case 'subtree':
            return {
                maxChildren: 0, // No children
                canBeChildless: true // Must be childless
            };

        default:
            return {
                maxChildren: null,
                canBeChildless: true
            };
    }
}

/**
 * Get node definition from type and category
 * @param {string} type - Node type
 * @param {string} category - Node category
 * @returns {Object|null} - Node definition or null if not found
 */
export function getNodeDefinition(type, category) {
    // First check built-in types
    if (NODE_TYPES[category]) {
        const builtInType = NODE_TYPES[category].find(nt => nt.type === type);
        if (builtInType) return builtInType;
    }

    // Check custom node types in state
    if (typeof window !== 'undefined' && window.state && window.state.customNodeTypes) {
        return window.state.customNodeTypes.find(nt => nt.type === type);
    }

    return null;
}