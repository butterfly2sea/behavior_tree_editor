/**
 * Validation Utilities
 */

/**
 * Validate a node property value based on its type
 * @param {any} value - Property value to validate
 * @param {string} type - Property type (string, number, boolean, etc.)
 * @param {Object} constraints - Optional validation constraints
 * @returns {boolean} - Whether the value is valid
 */
export function validateNodeProperty(value, type, constraints = {}) {
    // Handle empty values based on required constraint
    if ((value === undefined || value === null || value === '') && constraints.required) {
        return false;
    }

    // Empty non-required values are valid
    if (value === undefined || value === null || value === '') {
        return true;
    }

    // Validate based on type
    switch (type) {
        case 'string':
            // Convert to string if not already
            if (typeof value !== 'string') {
                value = String(value);
            }

            // Check min length
            if (constraints.minLength !== undefined && value.length < constraints.minLength) {
                return false;
            }

            // Check max length
            if (constraints.maxLength !== undefined && value.length > constraints.maxLength) {
                return false;
            }

            // Check pattern
            if (constraints.pattern && !new RegExp(constraints.pattern).test(value)) {
                return false;
            }

            return true;

        case 'number':
        case 'float':
            // Convert to number and check if valid
            const numValue = Number(value);
            if (isNaN(numValue) || !isFinite(numValue)) {
                return false;
            }

            // Check min value
            if (constraints.min !== undefined && numValue < constraints.min) {
                return false;
            }

            // Check max value
            if (constraints.max !== undefined && numValue > constraints.max) {
                return false;
            }

            return true;

        case 'integer':
            // Convert to number and check if integer
            const intValue = Number(value);
            if (isNaN(intValue) || !Number.isInteger(intValue)) {
                return false;
            }

            // Check min value
            if (constraints.min !== undefined && intValue < constraints.min) {
                return false;
            }

            // Check max value
            if (constraints.max !== undefined && intValue > constraints.max) {
                return false;
            }

            return true;

        case 'boolean':
            // Check if value is a valid boolean
            return (
                value === true ||
                value === false ||
                value === 'true' ||
                value === 'false'
            );

        case 'enum':
            // Check if value is in allowed values
            if (constraints.values && !constraints.values.includes(value)) {
                return false;
            }

            return true;

        default:
            // For unknown types, assume it's valid
            return true;
    }
}

/**
 * Validate connection
 * @param {Object} sourceNode - Source node
 * @param {Object} targetNode - Target node
 * @param {Array} connections - Existing connections
 * @returns {Object} - {valid: boolean, message: string}
 */
export function validateConnection(sourceNode, targetNode, connections) {
    // Cannot connect to self
    if (sourceNode.id === targetNode.id) {
        return {
            valid: false,
            message: 'Cannot connect a node to itself'
        };
    }

    // Check if target already has a parent
    const targetParents = connections.filter(conn => conn.target === targetNode.id);
    if (targetParents.length > 0) {
        return {
            valid: false,
            message: 'Target node already has a parent'
        };
    }

    // Get node definitions to check constraints
    const {getNodeTypeDefinition} = window;
    if (!getNodeTypeDefinition) {
        return {valid: true, message: ''};
    }

    const sourceDef = getNodeTypeDefinition(sourceNode.type, sourceNode.category);
    const targetDef = getNodeTypeDefinition(targetNode.type, targetNode.category);

    if (!sourceDef || !targetDef) {
        return {valid: true, message: ''};
    }

    // Check if source can have children
    if (sourceDef.maxChildren === 0) {
        return {
            valid: false,
            message: `${sourceDef.name} nodes cannot have children`
        };
    }

    // Check if source already has max children
    if (sourceDef.maxChildren !== null) {
        const childCount = connections.filter(conn => conn.source === sourceNode.id).length;
        if (childCount >= sourceDef.maxChildren) {
            return {
                valid: false,
                message: `${sourceDef.name} nodes can have at most ${sourceDef.maxChildren} ${sourceDef.maxChildren === 1 ? 'child' : 'children'}`
            };
        }
    }

    // Check for cycles - would this create a loop?
    if (wouldCreateCycle(sourceNode.id, targetNode.id, connections)) {
        return {
            valid: false,
            message: 'Connection would create a cycle'
        };
    }

    return {valid: true, message: ''};
}

/**
 * Check if connection would create a cycle
 */
function wouldCreateCycle(sourceId, targetId, connections) {
    // If target is already an ancestor of source, connecting would create a cycle
    let currentId = sourceId;
    const visited = new Set();

    while (currentId) {
        if (visited.has(currentId)) break;
        visited.add(currentId);

        // If we reach the target, we would create a cycle
        if (currentId === targetId) return true;

        // Find parent of current node
        const parentConn = connections.find(conn => conn.target === currentId);
        currentId = parentConn ? parentConn.source : null;
    }

    return false;
}

/**
 * Validate form data
 * @param {Object} formData - Form data to validate
 * @param {Object} schema - Validation schema
 * @returns {Object} - {valid: boolean, errors: Object}
 */
export function validateForm(formData, schema) {
    const errors = {};
    let valid = true;

    // Validate each field against schema
    Object.entries(schema).forEach(([field, rules]) => {
        const value = formData[field];

        // Check required
        if (rules.required && (value === undefined || value === null || value === '')) {
            errors[field] = `${field} is required`;
            valid = false;
            return;
        }

        // Skip further validation if value is empty and not required
        if (value === undefined || value === null || value === '') {
            return;
        }

        // Check type
        if (rules.type) {
            const typeValid = validateNodeProperty(value, rules.type, rules);
            if (!typeValid) {
                errors[field] = `${field} is not a valid ${rules.type}`;
                valid = false;
            }
        }

        // Check custom validator
        if (rules.validator && typeof rules.validator === 'function') {
            const customValid = rules.validator(value, formData);
            if (!customValid) {
                errors[field] = rules.message || `${field} is invalid`;
                valid = false;
            }
        }
    });

    return {valid, errors};
}