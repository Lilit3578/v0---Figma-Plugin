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
    layoutMode?: 'HORIZONTAL' | 'VERTICAL' | 'NONE';
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

export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

/**
 * Basic validation - just check required fields
 */
export function validateRSNT(node: RSNT_Node): ValidationResult {
    const errors: string[] = [];

    if (!node.id) errors.push('Missing id');
    if (!node.type) errors.push('Missing type');

    if (node.type === 'COMPONENT_INSTANCE' && !node.componentId) {
        errors.push('COMPONENT_INSTANCE requires componentId');
    }

    // Validate children recursively
    if (node.children) {
        node.children.forEach((child, idx) => {
            const childResult = validateRSNT(child);
            if (!childResult.valid) {
                errors.push(`Child ${idx}: ${childResult.errors.join(', ')}`);
            }
        });
    }

    return {
        valid: errors.length === 0,
        errors
    };
}