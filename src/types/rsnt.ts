/**
 * Recursive Semantic Node Tree (RSNT) Types
 */
// types/rsnt.ts

export type LayoutRole =
    | "Desktop"
    | "Page"
    | "Sidebar"
    | "MainArea"
    | "Content"
    | "Header"
    | "Footer"
    | "Navigation"
    | "Grid"
    | "CardGrid";

export type SemanticRole =
    | ButtonRole
    | FormRole
    | LayoutRole
    | TypographyRole
    | string;

export type ButtonRole = "PrimaryButton" | "SecondaryButton" | "GhostButton";
export type FormRole = "Form" | "FormField" | "Input" | "Label";
export type TypographyRole = "Heading" | "Paragraph";

export type LayoutPrimitive = "stack-v" | "stack-h" | "flex-center" | string;

export type SizingConstraint = 'hug' | 'fill' | 'fixed';

export interface RSNT_Node {
    id: string;
    semanticRole: SemanticRole;
    layoutPrimitive: LayoutPrimitive;
    tailwindClasses: string[];
    props: Record<string, any>;
    children?: RSNT_Node[];
    constraints: {
        width: SizingConstraint;
        height: SizingConstraint;
    };
}

/**
 * Validation result structure
 */
export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

/**
 * Validates an RSNT node tree for required fields and logical consistency.
 * Also checks for circular references.
 */
export function validateRSNT(node: RSNT_Node, visited: Set<RSNT_Node> = new Set()): ValidationResult {
    const result: ValidationResult = {
        valid: true,
        errors: []
    };

    // 1. Recursive Check - Required fields
    if (!node.id) result.errors.push(`Missing 'id' on node.`);
    if (!node.semanticRole) result.errors.push(`Missing 'semanticRole' on node ${node.id || '(unknown)'}.`);
    if (!node.layoutPrimitive) result.errors.push(`Missing 'layoutPrimitive' on node ${node.id || '(unknown)'}.`);
    if (!node.constraints) {
        result.errors.push(`Missing 'constraints' on node ${node.id || '(unknown)'}.`);
    } else {
        if (!node.constraints.width) result.errors.push(`Missing 'constraints.width' on node ${node.id || '(unknown)'}.`);
        if (!node.constraints.height) result.errors.push(`Missing 'constraints.height' on node ${node.id || '(unknown)'}.`);
    }

    // 2. Circular Reference Detection
    if (visited.has(node)) {
        result.errors.push(`Circular reference detected at node ${node.id}.`);
        result.valid = false;
        return result;
    }
    visited.add(node);

    // 3. Recursive validation of children
    if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
            const childResult = validateRSNT(child, new Set(visited));
            if (!childResult.valid) {
                result.errors.push(...childResult.errors);
            }
        }
    }

    result.valid = result.errors.length === 0;
    return result;
}
