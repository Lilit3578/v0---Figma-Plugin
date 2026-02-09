/**
 * Design Audit Service
 *
 * Post-generation tree walker that checks for common design mistakes
 * BEFORE the RSNT is rendered to Figma. Returns warnings that get
 * merged into the Resolution Summary shown to the designer.
 *
 * These are design-level checks, not structural validity checks
 * (that's handled by validateRSNT in types/rsnt.ts).
 */

import { RSNT_Node } from '../types/rsnt';
import { DesignSystemInventory } from './auto-discovery';

export interface AuditWarning {
    message: string;
    nodeId: string;
    category: string;
    severity: 'info' | 'warning';
}

/**
 * Run design audit on an RSNT tree. Returns array of warnings.
 */
export function runDesignAudit(
    root: RSNT_Node,
    inventory: DesignSystemInventory
): AuditWarning[] {
    const warnings: AuditWarning[] = [];

    walkNode(root, inventory, warnings);

    return warnings;
}

function walkNode(
    node: RSNT_Node,
    inventory: DesignSystemInventory,
    warnings: AuditWarning[]
): void {
    if (!node) return;

    // Run checks on this node's children as a group
    if (node.children && node.children.length > 0) {
        checkMultiplePrimaryActions(node, inventory, warnings);
        checkTextHierarchy(node, warnings);
        checkOrphanInputs(node, inventory, warnings);
    }

    // Check for empty containers
    checkEmptyContainer(node, warnings);

    // Recurse
    if (node.children) {
        for (const child of node.children) {
            walkNode(child, inventory, warnings);
        }
    }
}

// ============================================================================
// CHECK 1: Multiple primary actions at the same level
// ============================================================================

function checkMultiplePrimaryActions(
    parent: RSNT_Node,
    inventory: DesignSystemInventory,
    warnings: AuditWarning[]
): void {
    if (!parent.children) return;

    let primaryCount = 0;

    for (const child of parent.children) {
        if (isPrimaryAction(child, inventory)) {
            primaryCount++;
        }
    }

    if (primaryCount > 1) {
        warnings.push({
            message: `${primaryCount} primary action buttons in the same section — only one element should be the primary action. Make others secondary or ghost style.`,
            nodeId: parent.id || 'unknown',
            category: 'VISUAL_HIERARCHY',
            severity: 'warning'
        });
    }
}

/**
 * Heuristic: is this node a "primary action" button?
 */
function isPrimaryAction(node: RSNT_Node, inventory: DesignSystemInventory): boolean {
    // Check semanticRole
    if (node.semanticRole && node.semanticRole.toLowerCase().includes('primary')) {
        return true;
    }

    // Check if it's a COMPONENT_INSTANCE pointing to a button with primary variant
    if (node.type === 'COMPONENT_INSTANCE' && node.componentId) {
        const component = inventory.components.find(c => c.id === node.componentId);
        if (component) {
            // Component name contains "button" or semantic type is button
            const isButton = component.semanticType === 'button' ||
                component.name.toLowerCase().includes('button') ||
                component.name.toLowerCase().includes('btn');

            if (isButton) {
                // Check if variant is primary (via properties or propertyMappings)
                if (node.properties) {
                    const propValues = Object.values(node.properties).map(v => String(v).toLowerCase());
                    if (propValues.some(v => v.includes('primary') || v.includes('filled') || v.includes('solid'))) {
                        return true;
                    }
                }
                // If no variant specified on a button component, assume primary (default)
                if (!node.properties || Object.keys(node.properties).length === 0) {
                    return true;
                }
            }
        }
    }

    // Check tailwind classes for primary indicators
    if (node.tailwindClasses) {
        if (node.tailwindClasses.some(c => c === 'bg-primary' || c === 'bg-blue-600' || c === 'bg-indigo-600')) {
            // Only if it looks like a button (has label text in props or name contains btn)
            const name = (node.name || '').toLowerCase();
            if (name.includes('btn') || name.includes('button') || name.includes('submit') || name.includes('action')) {
                return true;
            }
        }
    }

    return false;
}

// ============================================================================
// CHECK 2: No text hierarchy (all text nodes same size)
// ============================================================================

function checkTextHierarchy(
    parent: RSNT_Node,
    warnings: AuditWarning[]
): void {
    if (!parent.children) return;

    const textNodes = parent.children.filter(c => c.type === 'TEXT' && c.fontSize !== undefined);

    if (textNodes.length >= 2) {
        const sizes = new Set(textNodes.map(t => t.fontSize));

        if (sizes.size === 1) {
            warnings.push({
                message: `${textNodes.length} text elements at the same level all use the same font size (${textNodes[0].fontSize}px) — vary size or weight to create visual hierarchy.`,
                nodeId: parent.id || 'unknown',
                category: 'VISUAL_HIERARCHY',
                severity: 'info'
            });
        }
    }
}

// ============================================================================
// CHECK 3: Orphan inputs (Input without a sibling Label)
// ============================================================================

function checkOrphanInputs(
    parent: RSNT_Node,
    inventory: DesignSystemInventory,
    warnings: AuditWarning[]
): void {
    if (!parent.children) return;

    for (const child of parent.children) {
        if (isInputComponent(child, inventory)) {
            // Check if there's a sibling label, or a label within the same parent's children
            const hasLabel = parent.children.some(sibling =>
                sibling !== child && isLabelComponent(sibling, inventory)
            );

            // Also check if the input itself has a label property
            const hasLabelProp = child.properties && ('label' in child.properties || 'placeholder' in child.properties);

            if (!hasLabel && !hasLabelProp) {
                warnings.push({
                    message: `Input "${child.name || child.id}" has no associated label — add a Label element or label prop for accessibility.`,
                    nodeId: child.id || 'unknown',
                    category: 'ACCESSIBILITY',
                    severity: 'warning'
                });
            }
        }
    }
}

function isInputComponent(node: RSNT_Node, inventory: DesignSystemInventory): boolean {
    if (node.semanticRole && (node.semanticRole === 'Input' || node.semanticRole === 'TextArea' || node.semanticRole === 'Select')) {
        return true;
    }
    if (node.type === 'COMPONENT_INSTANCE' && node.componentId) {
        const component = inventory.components.find(c => c.id === node.componentId);
        if (component && component.semanticType === 'input') return true;
    }
    return false;
}

function isLabelComponent(node: RSNT_Node, inventory: DesignSystemInventory): boolean {
    if (node.semanticRole === 'Label') return true;
    if (node.type === 'TEXT') return true; // A TEXT node adjacent to an input serves as a label
    if (node.type === 'COMPONENT_INSTANCE' && node.componentId) {
        const component = inventory.components.find(c => c.id === node.componentId);
        if (component && (component.semanticType === 'text' || component.name.toLowerCase().includes('label'))) return true;
    }
    return false;
}

// ============================================================================
// CHECK 4: Empty containers
// ============================================================================

function checkEmptyContainer(
    node: RSNT_Node,
    warnings: AuditWarning[]
): void {
    if (node.type === 'FRAME' && (!node.children || node.children.length === 0)) {
        // Only warn if it also has no fills (truly empty, likely a mistake)
        if (!node.fills || node.fills.length === 0) {
            warnings.push({
                message: `Frame "${node.name || node.id}" is empty with no children or fills — likely a placeholder that was not populated.`,
                nodeId: node.id || 'unknown',
                category: 'STRUCTURE',
                severity: 'info'
            });
        }
    }
}
