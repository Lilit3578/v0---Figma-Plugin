import { RSNT_Node } from '../types/rsnt';
import { DesignIntent } from './intent-parser';

export interface Violation {
    type: 'hierarchy' | 'layout' | 'spacing' | 'accessibility';
    severity: 'error' | 'warning';
    message: string;
    nodeId: string; // The ID of the node in the RSNT tree (if available) or path
    fix?: (node: RSNT_Node) => void;
}

export class DesignPatternService {

    /**
     * Validates and fixes a generated RSNT tree against common design patterns
     */
    validateAndFix(root: RSNT_Node, intent: DesignIntent): { fixedRoot: RSNT_Node, violations: Violation[] } {
        const violations: Violation[] = [];

        // Clone to avoid mutation side-effects on original if needed, 
        // but here we modify in place for the 'fix'
        const fixedRoot = JSON.parse(JSON.stringify(root));

        // 1. Button Hierarchy Check
        // Ensure not all buttons in a group are primary
        this.checkButtonHierarchy(fixedRoot, violations);

        // 2. Container Padding Check (Placeholder for future)
        // this.checkContainerPadding(fixedRoot, violations);

        return { fixedRoot, violations };
    }

    private checkButtonHierarchy(node: RSNT_Node, violations: Violation[]) {
        // Traverse looking for containers with multiple buttons
        if (node.children && node.children.length > 0) {
            const buttons = node.children.filter((c: RSNT_Node) =>
                c.type === 'COMPONENT_INSTANCE' &&
                (c.name?.toLowerCase().includes('button') || c.semanticRole === 'PrimaryButton' || c.semanticRole === 'SecondaryButton')
            );

            if (buttons.length >= 2) {
                // Check if they are ALL primary
                const primaries = buttons.filter((b: RSNT_Node) =>
                    b.properties?.variant === 'primary' ||
                    b.properties?.type === 'primary' ||
                    // If no variant specified, it might be defaulting to primary
                    (!b.properties?.variant && !b.properties?.type)
                );

                if (primaries.length === buttons.length) {
                    violations.push({
                        type: 'hierarchy',
                        severity: 'warning',
                        message: 'Multiple buttons in a group should not all be primary',
                        nodeId: node.id
                    });

                    // Auto-fix: Keep first/last as primary (depending on platform), make others secondary
                    // Standard pattern: Primary is usually last or first. Let's assume Primary is the distinct one.
                    // If we have 2 buttons, 1 primary, 1 secondary.

                    // Fix: Make the *second* button secondary (common pattern: [Cancel] [Confirm]) 
                    // or [Primary] [Secondary] depending on system.
                    // Let's adopt a safe default: Keep the LAST one primary, make others secondary?
                    // Or keep FIRST one primary?

                    // If the user INTENT was specifically "two primary buttons", we shouldn't touch it.
                    // But we don't have that granularity here easily.

                    // Simple heuristic: Make the first one Primary, others Secondary
                    // (Or if "Cancel" is detected, make it secondary)

                    buttons.forEach((btn: RSNT_Node, index: number) => {
                        if (index > 0) { // Keep first one as is, change others
                            if (!btn.properties) btn.properties = {};
                            btn.properties.variant = 'secondary';

                            // If text implies negative action, maybe secondary/outline
                            if (btn.properties.text?.match(/cancel|back|close/i)) {
                                btn.properties.variant = 'secondary';
                            }
                        }
                    });
                }
            }

            // Recurse
            node.children.forEach((c: RSNT_Node) => this.checkButtonHierarchy(c, violations));
        }
    }
}

export const designPatternService = new DesignPatternService();
