/**
 * Layout Rules - Validates RSNT against layout patterns
 */

import { RSNT_Node } from '../types/rsnt';
import { ValidationRule } from './basic-rules';
import { LAYOUT_SCHEMAS, LayoutPattern, ChildRule } from '../types/layout-schemas';

/**
 * Detect layout pattern from RSNT structure
 */
function detectLayoutPattern(node: RSNT_Node): LayoutPattern | null {
    // Check for desktop default
    if (node.semanticRole === 'Desktop' || node.semanticRole === 'Page') {
        if (node.layoutPrimitive === 'stack-v') {
            return 'desktop_default';
        }
    }

    // Check for two-column layout
    if (node.layoutPrimitive === 'stack-h' && node.children?.length === 2) {
        const firstChild = node.children[0];
        const hasNavigation = firstChild && ['Sidebar', 'Navigation', 'SidePanel'].includes(firstChild.semanticRole);
        if (hasNavigation) {
            return 'two_column';
        }
    }

    // Check for three-column layout
    if (node.layoutPrimitive === 'stack-h' && node.children?.length === 3) {
        return 'three_column';
    }

    // Check for header-content-footer
    if (node.layoutPrimitive === 'stack-v' && node.children && node.children.length >= 2) {
        const firstChild = node.children[0];
        const hasHeader = firstChild && ['Header', 'Navigation', 'TopBar'].includes(firstChild.semanticRole);
        const lastChild = node.children[node.children.length - 1];
        const hasFooter = lastChild && lastChild.semanticRole === 'Footer';

        if (hasHeader || (hasHeader && hasFooter)) {
            return 'header_content_footer';
        }
    }

    // Check for dashboard grid
    if (node.children?.some(c =>
        ['Grid', 'CardGrid'].includes(c.semanticRole) ||
        c.layoutPrimitive.includes('grid')
    )) {
        return 'dashboard_grid';
    }

    // Check for split view
    if (node.layoutPrimitive === 'stack-h' && node.children?.length === 2) {
        const allFill = node.children.every(c => c.constraints.width === 'fill');
        if (allFill) {
            return 'split_view';
        }
    }

    return null;
}

/**
 * Extract width value from Tailwind classes
 */
function extractWidth(tailwindClasses: string[]): number | null {
    for (const cls of tailwindClasses) {
        const match = cls.match(/w-\[(\d+)px\]/);
        if (match) {
            return parseInt(match[1]);
        }
    }
    return null;
}

/**
 * Validate child against rule
 */
function validateChild(
    child: RSNT_Node,
    rule: ChildRule,
    position: number
): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check semantic role
    if (rule.semanticRole && !rule.semanticRole.includes(child.semanticRole)) {
        errors.push(
            `Position ${position}: Expected one of [${rule.semanticRole.join(', ')}], got "${child.semanticRole}"`
        );
    }

    // Check constraints
    if (rule.constraints) {
        if (rule.constraints.width && child.constraints.width !== rule.constraints.width) {
            errors.push(
                `"${child.id}": Expected width="${rule.constraints.width}", got "${child.constraints.width}"`
            );
        }
        if (rule.constraints.height && child.constraints.height !== rule.constraints.height) {
            errors.push(
                `"${child.id}": Expected height="${rule.constraints.height}", got "${child.constraints.height}"`
            );
        }
    }

    // Check width limits
    if (rule.maxWidth || rule.minWidth) {
        const width = extractWidth(child.tailwindClasses);
        if (width !== null) {
            if (rule.maxWidth && width > rule.maxWidth) {
                errors.push(`"${child.id}": Width ${width}px exceeds maximum ${rule.maxWidth}px`);
            }
            if (rule.minWidth && width < rule.minWidth) {
                errors.push(`"${child.id}": Width ${width}px below minimum ${rule.minWidth}px`);
            }
        }
    }

    // Check layout primitive
    if (rule.layoutPrimitive && child.layoutPrimitive !== rule.layoutPrimitive) {
        errors.push(
            `"${child.id}": Expected layoutPrimitive="${rule.layoutPrimitive}", got "${child.layoutPrimitive}"`
        );
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Validate RSNT against detected layout pattern
 */
function validateLayoutPattern(
    node: RSNT_Node,
    pattern: LayoutPattern
): { valid: boolean; errors: string[]; warnings: string[] } {
    const schema = LAYOUT_SCHEMAS[pattern];
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate root constraints
    if (schema.rootConstraints.semanticRole) {
        if (!schema.rootConstraints.semanticRole.includes(node.semanticRole)) {
            warnings.push(
                `Layout "${pattern}": Root should be one of [${schema.rootConstraints.semanticRole.join(', ')}], ` +
                `but got "${node.semanticRole}"`
            );
        }
    }

    if (schema.rootConstraints.layoutPrimitive !== node.layoutPrimitive) {
        errors.push(
            `Layout "${pattern}": Root must use layoutPrimitive="${schema.rootConstraints.layoutPrimitive}", ` +
            `but got "${node.layoutPrimitive}"`
        );
    }

    if (schema.rootConstraints.constraints) {
        if (schema.rootConstraints.constraints.width &&
            node.constraints.width !== schema.rootConstraints.constraints.width) {
            errors.push(
                `Layout "${pattern}": Root must have width="${schema.rootConstraints.constraints.width}"`
            );
        }
        if (schema.rootConstraints.constraints.height &&
            node.constraints.height !== schema.rootConstraints.constraints.height) {
            warnings.push(
                `Layout "${pattern}": Root should have height="${schema.rootConstraints.constraints.height}"`
            );
        }
    }

    // Validate children
    if (node.children && node.children.length > 0) {
        schema.childrenRules.forEach((rule, ruleIndex) => {
            if (rule.position === 'any') {
                // Validate all children against this rule
                node.children!.forEach((child, i) => {
                    const result = validateChild(child, rule, i);
                    if (!result.valid) {
                        errors.push(...result.errors);
                    }
                });
            } else if (rule.position === 'first') {
                if (node.children!.length > 0) {
                    const result = validateChild(node.children![0], rule, 0);
                    if (!result.valid) {
                        errors.push(...result.errors);
                    }
                } else if (rule.required) {
                    errors.push(`Layout "${pattern}": Required first child is missing`);
                }
            } else if (rule.position === 'last') {
                const lastIndex = node.children!.length - 1;
                if (lastIndex >= 0) {
                    const result = validateChild(node.children![lastIndex], rule, lastIndex);
                    if (!result.valid) {
                        errors.push(...result.errors);
                    }
                } else if (rule.required) {
                    errors.push(`Layout "${pattern}": Required last child is missing`);
                }
            } else if (typeof rule.position === 'number') {
                const child = node.children![rule.position];
                if (child) {
                    const result = validateChild(child, rule, rule.position);
                    if (!result.valid) {
                        errors.push(...result.errors);
                    }
                } else if (rule.required) {
                    errors.push(
                        `Layout "${pattern}": Required child at position ${rule.position} is missing`
                    );
                }
            }
        });
    } else if (schema.childrenRules.some(r => r.required)) {
        errors.push(`Layout "${pattern}": Required children are missing`);
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}

/**
 * Generate layout validation rules
 */
export function generateLayoutRules(): ValidationRule[] {
    return [
        // Meta-rule: Detects pattern and validates against schema
        {
            id: 'layout-pattern-validation',
            type: 'property',
            severity: 'error',
            message: 'Layout pattern validation failed',
            validate: (node: RSNT_Node, parent?: RSNT_Node) => {
                // Only validate root-level nodes
                if (parent) return true;

                const detectedPattern = detectLayoutPattern(node);

                // If no pattern detected, it's a custom layout (allowed)
                if (!detectedPattern) return true;

                const result = validateLayoutPattern(node, detectedPattern);

                if (!result.valid) {
                    console.error(`Layout validation failed for pattern "${detectedPattern}":`, result.errors);
                    return false;
                }

                if (result.warnings.length > 0) {
                    console.warn(`Layout warnings for pattern "${detectedPattern}":`, result.warnings);
                }

                return true;
            }
        },

        // Rule: All direct children of Desktop/Page must fill width
        {
            id: 'desktop-children-fill-width',
            type: 'property',
            severity: 'error',
            message: 'All direct children of Desktop/Page layout must have width="fill"',
            validate: (node: RSNT_Node, parent?: RSNT_Node) => {
                if (!parent) return true;

                const isDesktopParent = ['Desktop', 'Page', 'Container'].includes(parent.semanticRole);
                if (!isDesktopParent) return true;

                // Check if this child fills width
                return node.constraints.width === 'fill';
            }
        },

        // Rule: Sidebars must be vertical layout
        {
            id: 'sidebar-vertical-layout',
            type: 'property',
            severity: 'error',
            message: 'Sidebars must use vertical layout (stack-v)',
            validate: (node: RSNT_Node) => {
                if (!['Sidebar', 'Navigation', 'SidePanel'].includes(node.semanticRole)) {
                    return true;
                }
                return node.layoutPrimitive === 'stack-v';
            }
        },

        // Rule: Sidebars must have fixed width and fill height
        {
            id: 'sidebar-sizing',
            type: 'property',
            severity: 'error',
            message: 'Sidebars must have fixed width and fill height',
            validate: (node: RSNT_Node) => {
                if (!['Sidebar', 'Navigation', 'SidePanel'].includes(node.semanticRole)) {
                    return true;
                }
                return node.constraints.width === 'fixed' && node.constraints.height === 'fill';
            }
        },

        // Rule: Main areas must fill both dimensions
        {
            id: 'mainarea-sizing',
            type: 'property',
            severity: 'error',
            message: 'Main content areas must have fill width and fill height',
            validate: (node: RSNT_Node) => {
                if (!['MainArea', 'Content'].includes(node.semanticRole)) {
                    return true;
                }
                return node.constraints.width === 'fill' && node.constraints.height === 'fill';
            }
        },

        // Rule: Headers and Footers must fill width and hug height
        {
            id: 'header-footer-sizing',
            type: 'property',
            severity: 'warning',
            message: 'Headers and Footers should have fill width and hug height',
            validate: (node: RSNT_Node) => {
                if (!['Header', 'Footer', 'TopBar'].includes(node.semanticRole)) {
                    return true;
                }
                return node.constraints.width === 'fill' && node.constraints.height === 'hug';
            }
        }
    ];
}

// Export ready-to-use layout rules
export const LAYOUT_RULES = generateLayoutRules();