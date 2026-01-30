/**
 * Simplified RSNT for MVP - References actual Figma assets
 */

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
}

export interface ValidationContext {
    availableComponents: Set<string>;
    availableVariables: Set<string>;
    parentNode?: RSNT_Node;
}

export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];  // NEW: Separate warnings from errors
}

/**
 * Comprehensive validation - checks required fields, component/variable existence, 
 * color values, hierarchy, and layout constraints
 */
export function validateRSNT(node: RSNT_Node, context: ValidationContext): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic structure validation
    if (!node.id) errors.push('Missing id');
    if (!node.type) errors.push('Missing type');

    // Type-specific validation
    switch (node.type) {
        case 'COMPONENT_INSTANCE':
            if (!node.componentId) {
                errors.push('COMPONENT_INSTANCE requires componentId');
            } else if (!context.availableComponents.has(node.componentId)) {
                errors.push(`Component ${node.componentId} not found in file`);
            }

            // CRITICAL: Component instances cannot have children
            // Instead of erroring, we'll strip them and warn
            if (node.children && node.children.length > 0) {
                warnings.push(`COMPONENT_INSTANCE ${node.id} had ${node.children.length} children - automatically removed (components are atomic)`);
                // Strip children to fix the AI's mistake
                node.children = [];
            }

            // Validate variant properties if component exists
            if (node.properties && Object.keys(node.properties).length > 0) {
                warnings.push(`Component instance has properties - ensure they match component variants`);
            }
            break;

        case 'FRAME':
            // Validate layout mode consistency
            if (node.layoutMode && node.layoutMode !== 'NONE') {
                // Check for conflicting sizing modes
                if (node.width && node.primaryAxisSizingMode === 'AUTO') {
                    warnings.push(`Frame ${node.id}: Fixed width with AUTO primaryAxisSizingMode may cause issues`);
                }
                if (node.height && node.counterAxisSizingMode === 'AUTO') {
                    warnings.push(`Frame ${node.id}: Fixed height with AUTO counterAxisSizingMode may cause issues`);
                }
            }

            // Validate dimensions
            if (node.width !== undefined && node.width <= 0) {
                errors.push(`Frame ${node.id}: Width must be positive`);
            }
            if (node.height !== undefined && node.height <= 0) {
                errors.push(`Frame ${node.id}: Height must be positive`);
            }
            break;

        case 'TEXT':
            if (!node.characters) {
                warnings.push(`TEXT node ${node.id} has no characters`);
            }
            if (node.fontSize !== undefined && node.fontSize <= 0) {
                errors.push(`TEXT node ${node.id}: Font size must be positive`);
            }
            break;
    }

    // Validate fills (color values)
    if (node.fills) {
        for (let i = 0; i < node.fills.length; i++) {
            const fill = node.fills[i];

            if (fill.type === 'SOLID' && fill.color) {
                const { r, g, b } = fill.color;

                // Check for NaN/undefined values - treat as WARNING not error
                // This allows rendering to proceed and handle it gracefully
                if (isNaN(r) || isNaN(g) || isNaN(b) || r === undefined || g === undefined || b === undefined) {
                    warnings.push(`Node ${node.id}, fill ${i}: Invalid color values (will be skipped during rendering) - r=${r}, g=${g}, b=${b}`);
                    continue; // Skip further validation for this fill
                }

                // Check for valid range (0-1) - this is still an error
                if (r < 0 || r > 1 || g < 0 || g > 1 || b < 0 || b > 1) {
                    errors.push(`Node ${node.id}, fill ${i}: Color values must be between 0 and 1 - r=${r}, g=${g}, b=${b}`);
                }
            } else if (fill.type === 'VARIABLE' && fill.variableId) {
                // Check if variable exists
                if (!context.availableVariables.has(fill.variableId)) {
                    errors.push(`Node ${node.id}, fill ${i}: Variable ${fill.variableId} not found in file`);
                }
            }
        }
    }

    // Validate strokes
    if (node.strokes) {
        for (let i = 0; i < node.strokes.length; i++) {
            const stroke = node.strokes[i];
            if (stroke.color) {
                const { r, g, b } = stroke.color;

                // Treat undefined/NaN as warnings, not errors
                if (isNaN(r) || isNaN(g) || isNaN(b) || r === undefined || g === undefined || b === undefined) {
                    warnings.push(`Node ${node.id}, stroke ${i}: Invalid color values (will be skipped during rendering)`);
                    continue;
                }

                if (r < 0 || r > 1 || g < 0 || g > 1 || b < 0 || b > 1) {
                    errors.push(`Node ${node.id}, stroke ${i}: Color values must be between 0 and 1`);
                }
            }
        }
    }

    // Validate variable references in spacing/padding
    if (node.itemSpacing && typeof node.itemSpacing === 'object' && node.itemSpacing.variableId) {
        if (!context.availableVariables.has(node.itemSpacing.variableId)) {
            errors.push(`Node ${node.id}: itemSpacing variable ${node.itemSpacing.variableId} not found`);
        }
    }

    if (node.padding) {
        const paddingSides = ['top', 'right', 'bottom', 'left'] as const;
        for (const side of paddingSides) {
            const value = node.padding[side];
            if (value && typeof value === 'object' && value.variableId) {
                if (!context.availableVariables.has(value.variableId)) {
                    errors.push(`Node ${node.id}: padding.${side} variable ${value.variableId} not found`);
                }
            }
        }
    }

    if (node.cornerRadius && typeof node.cornerRadius === 'object' && node.cornerRadius.variableId) {
        if (!context.availableVariables.has(node.cornerRadius.variableId)) {
            errors.push(`Node ${node.id}: cornerRadius variable ${node.cornerRadius.variableId} not found`);
        }
    }

    // Recursive validation with context
    if (node.children) {
        node.children.forEach((child, idx) => {
            const childContext: ValidationContext = {
                ...context,
                parentNode: node
            };
            const childResult = validateRSNT(child, childContext);

            if (!childResult.valid) {
                errors.push(`Child ${idx} (${child.id}): ${childResult.errors.join(', ')}`);
            }

            // Aggregate warnings
            warnings.push(...childResult.warnings);
        });
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}