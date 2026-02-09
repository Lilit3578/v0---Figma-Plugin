/**
 * RSNT Builder - Converts DesignDecisions to RSNT_Node trees
 *
 * This is Phase 4 of the Antigravity approach: Take explicit design decisions
 * and build a valid RSNT tree that can be rendered to Figma.
 *
 * The builder handles:
 * - Component instantiation from design system
 * - Primitive fallback when no matching component exists
 * - Layout construction with proper auto-layout settings
 * - Styling application (fills, strokes, corner radius)
 * - Hierarchy/grouping based on decision engine output
 */

import { RSNT_Node } from '../types/rsnt';
import { DesignSystemInventory } from './auto-discovery';
import {
    DesignDecision,
    ComponentDecision,
    LayoutDecision,
    StylingDecision,
    HierarchyDecision
} from './decision-engine';

// ============================================================================
// TYPES
// ============================================================================

export interface BuildResult {
    rsnt: RSNT_Node;
    warnings: string[];
    buildLog: BuildLogEntry[];
}

export interface BuildLogEntry {
    phase: 'component' | 'layout' | 'styling' | 'hierarchy';
    action: string;
    details: string;
}

// ============================================================================
// RSNT BUILDER
// ============================================================================

export class RSNTBuilder {
    private buildLog: BuildLogEntry[] = [];
    private warnings: string[] = [];
    private nodeIdCounter: number = 0;

    constructor(private inventory: DesignSystemInventory) {}

    /**
     * Build RSNT tree from design decisions
     */
    build(decision: DesignDecision): BuildResult {
        this.buildLog = [];
        this.warnings = [];
        this.nodeIdCounter = 0;

        // Create root frame
        const root = this.createRootFrame(decision);

        // Build component nodes
        const componentNodes = this.buildComponents(decision.components);

        // Apply hierarchy (grouping)
        const structuredChildren = this.applyHierarchy(
            componentNodes,
            decision.hierarchy,
            decision.layout
        );

        // Attach children to root
        root.children = structuredChildren;

        // Apply root styling
        this.applyStyling(root, decision.styling);

        this.log('hierarchy', 'Complete', `Built RSNT tree with ${this.countNodes(root)} nodes`);

        return {
            rsnt: root,
            warnings: this.warnings,
            buildLog: this.buildLog
        };
    }

    /**
     * Create the root frame with layout settings
     */
    private createRootFrame(decision: DesignDecision): RSNT_Node {
        const layout = decision.layout;

        const root: RSNT_Node = {
            id: this.generateId('root'),
            type: 'FRAME',
            name: decision.intent.title || `${decision.intent.type}-container`,
            layoutMode: layout.layoutMode,
            primaryAxisSizingMode: layout.primaryAxisSizingMode,
            counterAxisSizingMode: layout.counterAxisSizingMode,
            primaryAxisAlignItems: layout.primaryAxisAlignItems,
            counterAxisAlignItems: layout.counterAxisAlignItems,
            itemSpacing: layout.itemSpacing,
            padding: layout.padding,
            children: []
        };

        // Apply fixed dimensions if specified
        if (layout.width) {
            root.width = layout.width;
        }
        if (layout.height) {
            root.height = layout.height;
        }

        this.log('layout', 'Created root frame',
            `${layout.layoutMode} layout, ${layout.itemSpacing}px spacing`);

        return root;
    }

    /**
     * Build RSNT nodes for each component decision
     */
    private buildComponents(decisions: ComponentDecision[]): RSNT_Node[] {
        return decisions.map((decision, index) => {
            if (decision.selectedComponent) {
                // Use existing design system component
                return this.buildComponentInstance(decision, index);
            } else {
                // Build from primitives
                return this.buildPrimitive(decision, index);
            }
        });
    }

    /**
     * Build a component instance node
     */
    private buildComponentInstance(decision: ComponentDecision, index: number): RSNT_Node {
        const component = decision.selectedComponent!;

        const node: RSNT_Node = {
            id: this.generateId(`component-${index}`),
            type: 'COMPONENT_INSTANCE',
            name: decision.requirement.label || component.name,
            componentId: component.id,
            properties: decision.properties
        };

        this.log('component', `Instantiated ${component.name}`,
            `Confidence: ${(decision.confidence * 100).toFixed(0)}% - ${decision.reasoning}`);

        return node;
    }

    /**
     * Build a primitive fallback when no component matches
     */
    private buildPrimitive(decision: ComponentDecision, index: number): RSNT_Node {
        const req = decision.requirement;

        switch (req.type) {
            case 'input':
                return this.buildInputPrimitive(req, index);
            case 'button':
                return this.buildButtonPrimitive(req, index);
            case 'heading':
                return this.buildHeadingPrimitive(req, index);
            case 'text':
                return this.buildTextPrimitive(req, index);
            case 'divider':
                return this.buildDividerPrimitive(index);
            case 'checkbox':
            case 'toggle':
                return this.buildTogglePrimitive(req, index);
            default:
                return this.buildGenericPrimitive(req, index);
        }
    }

    /**
     * Build input field from primitives (label + field container)
     */
    private buildInputPrimitive(req: ComponentDecision['requirement'], index: number): RSNT_Node {
        const container: RSNT_Node = {
            id: this.generateId(`input-${index}`),
            type: 'FRAME',
            name: `input-${req.label || 'field'}`,
            layoutMode: 'VERTICAL',
            primaryAxisSizingMode: 'AUTO',
            counterAxisSizingMode: 'AUTO',
            itemSpacing: 6,
            children: []
        };

        // Add label if present
        if (req.label) {
            container.children!.push({
                id: this.generateId(`label-${index}`),
                type: 'TEXT',
                name: 'label',
                characters: req.label,
                fontSize: 14,
                fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2 } }]
            });
        }

        // Add input field
        const inputField: RSNT_Node = {
            id: this.generateId(`field-${index}`),
            type: 'FRAME',
            name: 'input-field',
            layoutMode: 'HORIZONTAL',
            primaryAxisSizingMode: 'FIXED',
            counterAxisSizingMode: 'AUTO',
            width: 280,
            padding: { top: 10, right: 12, bottom: 10, left: 12 },
            cornerRadius: 6,
            fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }],
            strokes: [{ type: 'SOLID', color: { r: 0.85, g: 0.85, b: 0.85 } }],
            children: [{
                id: this.generateId(`placeholder-${index}`),
                type: 'TEXT',
                name: 'placeholder',
                characters: req.placeholder || `Enter ${req.label?.toLowerCase() || 'text'}...`,
                fontSize: 14,
                fills: [{ type: 'SOLID', color: { r: 0.6, g: 0.6, b: 0.6 } }]
            }]
        };

        container.children!.push(inputField);

        this.log('component', `Built input primitive`,
            `Label: "${req.label}", Type: ${req.inputType || 'text'}`);
        this.warnings.push(`No Input component found - created "${req.label}" using primitives`);

        return container;
    }

    /**
     * Build button from primitives
     */
    private buildButtonPrimitive(req: ComponentDecision['requirement'], index: number): RSNT_Node {
        const isPrimary = req.variant === 'primary' || !req.variant;
        const isDestructive = req.variant === 'destructive';

        let bgColor = { r: 0.2, g: 0.4, b: 0.9 }; // Primary blue
        let textColor = { r: 1, g: 1, b: 1 };

        if (isDestructive) {
            bgColor = { r: 0.9, g: 0.2, b: 0.2 };
        } else if (req.variant === 'secondary') {
            bgColor = { r: 0.95, g: 0.95, b: 0.95 };
            textColor = { r: 0.2, g: 0.2, b: 0.2 };
        } else if (req.variant === 'ghost' || req.variant === 'tertiary') {
            bgColor = { r: 1, g: 1, b: 1 };
            textColor = { r: 0.2, g: 0.4, b: 0.9 };
        }

        const button: RSNT_Node = {
            id: this.generateId(`button-${index}`),
            type: 'FRAME',
            name: `button-${req.variant || 'primary'}`,
            layoutMode: 'HORIZONTAL',
            primaryAxisSizingMode: 'AUTO',
            counterAxisSizingMode: 'AUTO',
            primaryAxisAlignItems: 'CENTER',
            counterAxisAlignItems: 'CENTER',
            padding: { top: 10, right: 20, bottom: 10, left: 20 },
            cornerRadius: 6,
            fills: [{ type: 'SOLID', color: bgColor }],
            children: [{
                id: this.generateId(`button-text-${index}`),
                type: 'TEXT',
                name: 'label',
                characters: req.label || 'Button',
                fontSize: 14,
                fills: [{ type: 'SOLID', color: textColor }]
            }]
        };

        this.log('component', `Built button primitive`,
            `"${req.label}", Variant: ${req.variant || 'primary'}`);
        this.warnings.push(`No Button component found - created "${req.label}" using primitives`);

        return button;
    }

    /**
     * Build heading from primitives
     */
    private buildHeadingPrimitive(req: ComponentDecision['requirement'], index: number): RSNT_Node {
        const level = req.level || 2;
        const fontSizes: Record<number, number> = {
            1: 32,
            2: 24,
            3: 20,
            4: 18,
            5: 16,
            6: 14
        };

        const heading: RSNT_Node = {
            id: this.generateId(`heading-${index}`),
            type: 'TEXT',
            name: `h${level}`,
            characters: req.text || 'Heading',
            fontSize: fontSizes[level] || 24,
            fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1 } }]
        };

        this.log('component', `Built heading primitive`, `Level ${level}: "${req.text}"`);

        return heading;
    }

    /**
     * Build text from primitives
     */
    private buildTextPrimitive(req: ComponentDecision['requirement'], index: number): RSNT_Node {
        const text: RSNT_Node = {
            id: this.generateId(`text-${index}`),
            type: 'TEXT',
            name: 'text',
            characters: req.text || '',
            fontSize: 14,
            fills: [{ type: 'SOLID', color: { r: 0.3, g: 0.3, b: 0.3 } }]
        };

        this.log('component', `Built text primitive`, `"${(req.text || '').substring(0, 30)}..."`);

        return text;
    }

    /**
     * Build divider from primitives
     */
    private buildDividerPrimitive(index: number): RSNT_Node {
        const divider: RSNT_Node = {
            id: this.generateId(`divider-${index}`),
            type: 'FRAME',
            name: 'divider',
            layoutMode: 'NONE',
            width: 280,
            height: 1,
            fills: [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9 } }]
        };

        this.log('component', `Built divider primitive`, 'Horizontal line');

        return divider;
    }

    /**
     * Build toggle/checkbox from primitives
     */
    private buildTogglePrimitive(req: ComponentDecision['requirement'], index: number): RSNT_Node {
        const container: RSNT_Node = {
            id: this.generateId(`toggle-${index}`),
            type: 'FRAME',
            name: `toggle-${req.label || 'option'}`,
            layoutMode: 'HORIZONTAL',
            primaryAxisSizingMode: 'AUTO',
            counterAxisSizingMode: 'AUTO',
            counterAxisAlignItems: 'CENTER',
            itemSpacing: 8,
            children: [
                {
                    id: this.generateId(`toggle-box-${index}`),
                    type: 'FRAME',
                    name: 'checkbox',
                    layoutMode: 'NONE',
                    width: 18,
                    height: 18,
                    cornerRadius: 4,
                    fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }],
                    strokes: [{ type: 'SOLID', color: { r: 0.7, g: 0.7, b: 0.7 } }]
                },
                {
                    id: this.generateId(`toggle-label-${index}`),
                    type: 'TEXT',
                    name: 'label',
                    characters: req.label || 'Option',
                    fontSize: 14,
                    fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2 } }]
                }
            ]
        };

        this.log('component', `Built toggle primitive`, `"${req.label}"`);
        this.warnings.push(`No Toggle/Checkbox component found - created "${req.label}" using primitives`);

        return container;
    }

    /**
     * Build generic primitive for unknown types
     */
    private buildGenericPrimitive(req: ComponentDecision['requirement'], index: number): RSNT_Node {
        const generic: RSNT_Node = {
            id: this.generateId(`generic-${index}`),
            type: 'FRAME',
            name: `${req.type}-placeholder`,
            layoutMode: 'HORIZONTAL',
            primaryAxisSizingMode: 'AUTO',
            counterAxisSizingMode: 'AUTO',
            primaryAxisAlignItems: 'CENTER',
            counterAxisAlignItems: 'CENTER',
            padding: { top: 16, right: 16, bottom: 16, left: 16 },
            cornerRadius: 4,
            fills: [{ type: 'SOLID', color: { r: 0.95, g: 0.95, b: 0.95 } }],
            strokes: [{ type: 'SOLID', color: { r: 0.8, g: 0.8, b: 0.8 } }],
            children: [{
                id: this.generateId(`generic-text-${index}`),
                type: 'TEXT',
                name: 'placeholder-text',
                characters: `[${req.type}]`,
                fontSize: 12,
                fills: [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5 } }]
            }]
        };

        this.log('component', `Built generic placeholder`, `Type: ${req.type}`);
        this.warnings.push(`Unknown component type "${req.type}" - created placeholder`);

        return generic;
    }

    /**
     * Apply hierarchy/grouping to component nodes
     */
    private applyHierarchy(
        nodes: RSNT_Node[],
        hierarchy: HierarchyDecision,
        layout: LayoutDecision
    ): RSNT_Node[] {
        if (hierarchy.structure === 'flat') {
            // No grouping needed
            this.log('hierarchy', 'Flat structure', 'No grouping applied');
            return nodes;
        }

        // Create groups
        const result: RSNT_Node[] = [];

        for (const group of hierarchy.groups) {
            if (group.components.length === 0) continue;

            const groupNodes = group.components.map(idx => nodes[idx]).filter(Boolean);

            if (group.hasContainer) {
                // Wrap in container frame
                const container: RSNT_Node = {
                    id: this.generateId(`group-${group.name}`),
                    type: 'FRAME',
                    name: group.name,
                    layoutMode: layout.layoutMode,
                    primaryAxisSizingMode: 'AUTO',
                    counterAxisSizingMode: 'AUTO',
                    itemSpacing: layout.itemSpacing,
                    children: groupNodes
                };
                result.push(container);

                this.log('hierarchy', `Created group container`,
                    `"${group.name}" with ${groupNodes.length} children`);
            } else {
                // Add nodes directly (but in order)
                result.push(...groupNodes);
            }
        }

        // Add any ungrouped nodes
        const groupedIndices = new Set(hierarchy.groups.flatMap(g => g.components));
        const ungrouped = nodes.filter((_, idx) => !groupedIndices.has(idx));
        result.push(...ungrouped);

        return result;
    }

    /**
     * Apply styling to a frame node
     */
    private applyStyling(node: RSNT_Node, styling: StylingDecision): void {
        if (styling.fills && styling.fills.length > 0) {
            node.fills = styling.fills;
        }

        if (styling.cornerRadius !== undefined) {
            node.cornerRadius = styling.cornerRadius;
        }

        if (styling.hasBorder && styling.borderColor) {
            node.strokes = [{
                type: 'SOLID',
                color: styling.borderColor
            }];
        }

        this.log('styling', 'Applied styling',
            `Fills: ${styling.fills?.length || 0}, Radius: ${styling.cornerRadius}px, Border: ${styling.hasBorder}`);
    }

    /**
     * Generate unique node ID
     */
    private generateId(prefix: string): string {
        return `${prefix}-${++this.nodeIdCounter}`;
    }

    /**
     * Count total nodes in tree
     */
    private countNodes(node: RSNT_Node): number {
        let count = 1;
        if (node.children) {
            for (const child of node.children) {
                count += this.countNodes(child);
            }
        }
        return count;
    }

    /**
     * Add entry to build log
     */
    private log(phase: BuildLogEntry['phase'], action: string, details: string): void {
        this.buildLog.push({ phase, action, details });
    }
}

/**
 * Factory function
 */
export function createRSNTBuilder(inventory: DesignSystemInventory): RSNTBuilder {
    return new RSNTBuilder(inventory);
}
