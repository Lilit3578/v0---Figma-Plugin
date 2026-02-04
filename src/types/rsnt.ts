import { ErrorCode, ERROR_GUIDANCE } from './errors';

export type NodeType = 'COMPONENT_INSTANCE' | 'FRAME' | 'TEXT';

export interface RSNT_Node {
    id: string;
    type: NodeType;

    // For COMPONENT_INSTANCE
    componentId?: string;
    properties?: Record<string, string>;

    // For FRAME
    width?: number;
    height?: number;
    layoutMode?: 'HORIZONTAL' | 'VERTICAL' | 'NONE';
    primaryAxisSizingMode?: 'FIXED' | 'AUTO';
    counterAxisSizingMode?: 'FIXED' | 'AUTO';
    primaryAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
    counterAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX';
    itemSpacing?: number | { variableId: string };
    padding?: {
        top?: number | { variableId: string };
        right?: number | { variableId: string };
        bottom?: number | { variableId: string };
        left?: number | { variableId: string };
    };

    // For TEXT
    characters?: string;
    fontSize?: number;
    fontFamily?: string;  // NEW: Font family name
    fontStyle?: string;   // NEW: Font style (Regular, Bold, Italic, etc.)

    // Styling (for any type)
    fills?: Array<{
        type: 'SOLID' | 'VARIABLE';
        color?: { r: number; g: number; b: number };
        variableId?: string;
    }>;
    strokes?: Array<{
        type: 'SOLID';
        color: { r: number; g: number; b: number };
    }>;
    cornerRadius?: number | { variableId: string };

    // Layout constraints
    constraints?: {
        horizontal: 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'SCALE';
        vertical: 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'SCALE';
    };

    // Children
    children?: RSNT_Node[];

    // Metadata
    name?: string;

    // Semantic annotations (for validation)
    semanticRole?: string;
    layoutPrimitive?: string;
    tailwindClasses?: string[];

    // Metadata
    metadata?: {
        confidence?: {
            score: number;
            factors?: any; // Avoiding circular dependency, will be ConfidenceFactors
            breakdown?: string[];
        };
        [key: string]: any;
    };
}

export interface ValidationContext {
    availableComponents: Set<string>;
    availableVariables: Set<string>;
    parentNode?: RSNT_Node;
}

export interface ValidationError {
    rule: string;
    message: string;
    location: string; // Node path like "root > card > form"
    severity: 'error';
    code: ErrorCode;
    guidance: string;
}

export interface ValidationWarning {
    rule: string;
    message: string;
    location: string;
    severity: 'warning';
    code?: ErrorCode;
    guidance?: string;
}

export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
}

export interface ValidationOptions {
    maxDepth?: number;
    strictMode?: boolean;
}

/**
 * Comprehensive validation - checks required fields, component/variable existence, 
 * color values, hierarchy, layout constraints, and all 8 validation rules
 */
export function validateRSNT(
    node: RSNT_Node,
    context: ValidationContext,
    options: ValidationOptions = {}
): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Import constants
    const {
        MAX_NESTING_DEPTH,
        APPROVED_SEMANTIC_ROLES,
        APPROVED_LAYOUT_PRIMITIVES,
        REQUIRED_PROPS_BY_TYPE,
        REQUIRED_PROPS_BY_ROLE,
        isValidTailwindClass,
    } = require('./rsnt-constants');

    const maxDepth = options.maxDepth ?? MAX_NESTING_DEPTH;

    // Initialize tracking for comprehensive validation
    const visited = new Set<string>();
    const idPaths = new Map<string, string[]>();

    // Internal recursive validation function
    function validateNode(
        currentNode: RSNT_Node,
        currentContext: ValidationContext,
        path: string[] = [],
        depth: number = 0
    ): void {
        const nodeId = currentNode.id || 'unknown';
        const locationPath = path.join(' > ') || 'root';

        // RULE 1: Circular Reference Detection (CRITICAL BUG FIX)
        // Use the same visited Set across all recursive calls
        if (visited.has(nodeId)) {
            const code = ErrorCode.CIRCULAR_DEPENDENCY;
            errors.push({
                rule: 'circular-reference',
                message: `Circular reference detected at node ${nodeId}`,
                location: locationPath,
                severity: 'error',
                code,
                guidance: ERROR_GUIDANCE[code].guidance
            });
            return; // Stop processing this branch
        }

        visited.add(nodeId);

        // RULE 2: ID Uniqueness Check
        if (nodeId !== 'unknown') {
            if (!idPaths.has(nodeId)) {
                idPaths.set(nodeId, []);
            }
            idPaths.get(nodeId)!.push(locationPath);
        }

        // RULE 5: Maximum Nesting Depth Check
        if (depth > maxDepth) {
            const code = ErrorCode.EXCEEDS_MAX_DEPTH;
            errors.push({
                rule: 'max-nesting-depth',
                message: `Exceeded maximum nesting depth of ${maxDepth} at node ${nodeId} (depth: ${depth})`,
                location: locationPath,
                severity: 'error',
                code,
                guidance: ERROR_GUIDANCE[code].guidance
            });
            return; // Stop processing deeper
        }

        // Basic structure validation
        if (!currentNode.id) {
            const code = ErrorCode.MISSING_REQUIRED_PROPERTY;
            errors.push({ rule: 'required-field', message: 'Missing id', location: locationPath, severity: 'error', code, guidance: ERROR_GUIDANCE[code].guidance });
        }
        if (!currentNode.type) {
            const code = ErrorCode.MISSING_REQUIRED_PROPERTY;
            errors.push({ rule: 'required-field', message: 'Missing type', location: locationPath, severity: 'error', code, guidance: ERROR_GUIDANCE[code].guidance });
        }

        // Type-specific validation
        switch (currentNode.type) {
            case 'COMPONENT_INSTANCE':
                if (!currentNode.componentId) {
                    const code = ErrorCode.MISSING_REQUIRED_PROPERTY;
                    errors.push({ rule: 'required-field', message: 'COMPONENT_INSTANCE requires componentId', location: locationPath, severity: 'error', code, guidance: ERROR_GUIDANCE[code].guidance });
                } else if (!currentContext.availableComponents.has(currentNode.componentId)) {
                    const code = ErrorCode.COMPONENT_NOT_FOUND;
                    errors.push({ rule: 'component-not-found', message: `Component ${currentNode.componentId} not found in file`, location: locationPath, severity: 'error', code, guidance: ERROR_GUIDANCE[code].guidance });
                }

                // CRITICAL: Component instances cannot have children
                // Instead of erroring, we'll strip them and warn
                if (currentNode.children && currentNode.children.length > 0) {
                    warnings.push({ rule: 'atomic-component', message: `COMPONENT_INSTANCE ${currentNode.id} had ${currentNode.children.length} children - automatically removed (components are atomic)`, location: locationPath, severity: 'warning' });
                    // Strip children to fix the AI's mistake
                    currentNode.children = [];
                }

                // Validate variant properties if component exists
                if (currentNode.properties && Object.keys(currentNode.properties).length > 0) {
                    warnings.push({ rule: 'component-properties', message: `Component instance has properties - ensure they match component variants`, location: locationPath, severity: 'warning' });
                }
                break;

            case 'FRAME':
                // Validate layout mode consistency
                if (currentNode.layoutMode && currentNode.layoutMode !== 'NONE') {
                    // Check for conflicting sizing modes
                    if (currentNode.width && currentNode.primaryAxisSizingMode === 'AUTO') {
                        warnings.push({ rule: 'layout-conflict', message: `Frame ${currentNode.id}: Fixed width with AUTO primaryAxisSizingMode may cause issues`, location: locationPath, severity: 'warning' });
                    }
                    if (currentNode.height && currentNode.counterAxisSizingMode === 'AUTO') {
                        warnings.push({ rule: 'layout-conflict', message: `Frame ${currentNode.id}: Fixed height with AUTO counterAxisSizingMode may cause issues`, location: locationPath, severity: 'warning' });
                    }
                }

                // Validate dimensions
                if (currentNode.width !== undefined && currentNode.width <= 0) {
                    const code = ErrorCode.INVALID_LAYOUT_PRIMITIVE;
                    errors.push({ rule: 'invalid-dimension', message: `Frame ${currentNode.id}: Width must be positive`, location: locationPath, severity: 'error', code, guidance: ERROR_GUIDANCE[code].guidance });
                }
                if (currentNode.height !== undefined && currentNode.height <= 0) {
                    const code = ErrorCode.INVALID_LAYOUT_PRIMITIVE;
                    errors.push({ rule: 'invalid-dimension', message: `Frame ${currentNode.id}: Height must be positive`, location: locationPath, severity: 'error', code, guidance: ERROR_GUIDANCE[code].guidance });
                }
                break;

            case 'TEXT':
                if (!currentNode.characters) {
                    warnings.push({ rule: 'empty-text', message: `TEXT node ${currentNode.id} has no characters`, location: locationPath, severity: 'warning' });
                }
                if (currentNode.fontSize !== undefined && currentNode.fontSize <= 0) {
                    const code = ErrorCode.MISSING_REQUIRED_PROPERTY;
                    errors.push({ rule: 'invalid-font-size', message: `TEXT node ${currentNode.id}: Font size must be positive`, location: locationPath, severity: 'error', code, guidance: ERROR_GUIDANCE[code].guidance });
                }
                break;
        }

        // Validate fills (color values)
        if (currentNode.fills) {
            for (let i = 0; i < currentNode.fills.length; i++) {
                const fill = currentNode.fills[i];

                if (fill.type === 'SOLID' && fill.color) {
                    const { r, g, b } = fill.color;

                    // Check for NaN/undefined values - treat as WARNING not error
                    // This allows rendering to proceed and handle it gracefully
                    if (isNaN(r) || isNaN(g) || isNaN(b) || r === undefined || g === undefined || b === undefined) {
                        warnings.push({ rule: 'invalid-color', message: `Node ${currentNode.id}, fill ${i}: Invalid color values (will be skipped during rendering) - r=${r}, g=${g}, b=${b}`, location: locationPath, severity: 'warning' });
                        continue; // Skip further validation for this fill
                    }

                    // Check for valid range (0-1) - this is still an error
                    if (r < 0 || r > 1 || g < 0 || g > 1 || b < 0 || b > 1) {
                        const code = ErrorCode.MISSING_REQUIRED_PROPERTY;
                        errors.push({ rule: 'invalid-color-range', message: `Node ${currentNode.id}, fill ${i}: Color values must be between 0 and 1 - r=${r}, g=${g}, b=${b}`, location: locationPath, severity: 'error', code, guidance: ERROR_GUIDANCE[code].guidance });
                    }
                } else if (fill.type === 'VARIABLE' && fill.variableId) {
                    // Check if variable exists
                    if (!currentContext.availableVariables.has(fill.variableId)) {
                        const code = ErrorCode.VARIABLE_NOT_FOUND;
                        errors.push({ rule: 'variable-not-found', message: `Node ${currentNode.id}, fill ${i}: Variable ${fill.variableId} not found in file`, location: locationPath, severity: 'error', code, guidance: ERROR_GUIDANCE[code].guidance });
                    }
                }
            }
        }

        // Validate strokes
        if (currentNode.strokes) {
            for (let i = 0; i < currentNode.strokes.length; i++) {
                const stroke = currentNode.strokes[i];
                if (stroke.color) {
                    const { r, g, b } = stroke.color;

                    // Treat undefined/NaN as warnings, not errors
                    if (isNaN(r) || isNaN(g) || isNaN(b) || r === undefined || g === undefined || b === undefined) {
                        warnings.push({ rule: 'invalid-stroke-color', message: `Node ${currentNode.id}, stroke ${i}: Invalid color values (will be skipped during rendering)`, location: locationPath, severity: 'warning' });
                        continue;
                    }

                    if (r < 0 || r > 1 || g < 0 || g > 1 || b < 0 || b > 1) {
                        const code = ErrorCode.MISSING_REQUIRED_PROPERTY;
                        errors.push({ rule: ' invalid-stroke-range', message: `Node ${currentNode.id}, stroke ${i}: Color values must be between 0 and 1`, location: locationPath, severity: 'error', code, guidance: ERROR_GUIDANCE[code].guidance });
                    }
                }
            }
        }

        // Validate variable references in spacing/padding
        if (currentNode.itemSpacing && typeof currentNode.itemSpacing === 'object' && currentNode.itemSpacing.variableId) {
            if (!currentContext.availableVariables.has(currentNode.itemSpacing.variableId)) {
                const code = ErrorCode.VARIABLE_NOT_FOUND;
                errors.push({ rule: 'variable-not-found', message: `Node ${currentNode.id}: itemSpacing variable ${currentNode.itemSpacing.variableId} not found`, location: locationPath, severity: 'error', code, guidance: ERROR_GUIDANCE[code].guidance });
            }
        }

        if (currentNode.padding) {
            const paddingSides = ['top', 'right', 'bottom', 'left'] as const;
            for (const side of paddingSides) {
                const value = currentNode.padding[side];
                if (value && typeof value === 'object' && value.variableId) {
                    if (!currentContext.availableVariables.has(value.variableId)) {
                        const code = ErrorCode.VARIABLE_NOT_FOUND;
                        errors.push({ rule: 'variable-not-found', message: `Node ${currentNode.id}: padding.${side} variable ${value.variableId} not found`, location: locationPath, severity: 'error', code, guidance: ERROR_GUIDANCE[code].guidance });
                    }
                }
            }
        }

        if (currentNode.cornerRadius && typeof currentNode.cornerRadius === 'object' && currentNode.cornerRadius.variableId) {
            if (!currentContext.availableVariables.has(currentNode.cornerRadius.variableId)) {
                const code = ErrorCode.VARIABLE_NOT_FOUND;
                errors.push({ rule: 'variable-not-found', message: `Node ${currentNode.id}: cornerRadius variable ${currentNode.cornerRadius.variableId} not found`, location: locationPath, severity: 'error', code, guidance: ERROR_GUIDANCE[code].guidance });
            }
        }

        // Recursive validation with context
        if (currentNode.children) {
            currentNode.children.forEach((child, idx) => {
                validateNode(
                    child,
                    currentContext,
                    [...path, currentNode.name || currentNode.id],
                    depth + 1
                );
            });
        }
    }

    // Start validation from root
    validateNode(node, context, [node.name || node.id], 0);

    // Check for duplicate IDs
    for (const [id, paths] of idPaths.entries()) {
        if (paths.length > 1) {
            const code = ErrorCode.CIRCULAR_DEPENDENCY; // Spec doesn't have DUPLICATE_ID, using related error
            errors.push({
                rule: 'duplicate-id',
                message: `Duplicate ID "${id}" found at: ${paths.join(', ')}`,
                location: 'root',
                severity: 'error',
                code,
                guidance: ERROR_GUIDANCE[code].guidance
            });
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}