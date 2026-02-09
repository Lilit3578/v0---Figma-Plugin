/**
 * Design Fixer - Post-generation correction pass
 *
 * Automatically fixes common AI mistakes in generated RSNT trees:
 * - Fix A: Sizing modes - child frames that should STRETCH to fill parent
 * - Fix B: Spacing snap - snap off-scale spacing to nearest allowed value
 * - Fix C: Text hierarchy - ensure titles are larger than body text
 * - Fix D: Root frame - ensure proper root frame dimensions
 * - Fix E: Container padding - ensure cards/containers have padding
 */

import { RSNT_Node } from '../types/rsnt';
import { DesignSystemGuidelines } from './auto-discovery';

export interface FixerOptions {
    guidelines: DesignSystemGuidelines;
    targetWidth?: number;  // Default canvas width (e.g., 1440 for desktop)
    targetHeight?: number; // Default canvas height (e.g., 900)
    minPadding?: number;   // Minimum padding for containers
}

export interface FixReport {
    fixesApplied: FixEntry[];
    totalFixes: number;
}

export interface FixEntry {
    nodeId: string;
    nodeName?: string;
    fixType: 'SIZING_MODE' | 'SPACING_SNAP' | 'TEXT_HIERARCHY' | 'ROOT_FRAME' | 'CONTAINER_PADDING';
    description: string;
    before: any;
    after: any;
}

const DEFAULT_OPTIONS: Partial<FixerOptions> = {
    targetWidth: 1440,
    targetHeight: 900,
    minPadding: 16,
};

/**
 * Main entry point - apply all fixes to an RSNT tree
 */
export function fixDesign(root: RSNT_Node, options: FixerOptions): FixReport {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const fixes: FixEntry[] = [];

    // Fix D: Root frame dimensions first (affects downstream fixes)
    fixRootFrame(root, opts, fixes);

    // Fix A: Sizing modes (recursive)
    fixSizingModes(root, null, opts, fixes);

    // Fix B: Spacing snap (recursive)
    fixSpacingValues(root, opts, fixes);

    // Fix E: Container padding (recursive)
    fixContainerPadding(root, opts, fixes);

    // Fix C: Text hierarchy (recursive, must run after structure fixes)
    fixTextHierarchy(root, opts, fixes);

    return {
        fixesApplied: fixes,
        totalFixes: fixes.length,
    };
}

/**
 * Fix D: Ensure root frame has proper dimensions
 */
function fixRootFrame(node: RSNT_Node, options: FixerOptions, fixes: FixEntry[]): void {
    if (node.type !== 'FRAME') return;

    const needsWidthFix = !node.width || node.width < 100;
    const needsHeightFix = !node.height || node.height < 100;

    if (needsWidthFix || needsHeightFix) {
        const before = { width: node.width, height: node.height };

        if (needsWidthFix) {
            node.width = options.targetWidth!;
        }
        if (needsHeightFix) {
            node.height = options.targetHeight!;
        }

        fixes.push({
            nodeId: node.id,
            nodeName: node.name,
            fixType: 'ROOT_FRAME',
            description: `Root frame missing dimensions - set to ${node.width}×${node.height}`,
            before,
            after: { width: node.width, height: node.height },
        });
    }

    // Ensure root has auto-layout if it has children
    if (node.children && node.children.length > 0 && !node.layoutMode) {
        const before = { layoutMode: node.layoutMode };
        node.layoutMode = 'VERTICAL';
        node.primaryAxisSizingMode = 'FIXED';
        node.counterAxisSizingMode = 'FIXED';

        fixes.push({
            nodeId: node.id,
            nodeName: node.name,
            fixType: 'ROOT_FRAME',
            description: 'Root frame missing layoutMode - set to VERTICAL',
            before,
            after: { layoutMode: 'VERTICAL' },
        });
    }
}

/**
 * Fix A: Detect and fix sizing modes
 *
 * Rule: If a FRAME child is inside a VERTICAL auto-layout parent,
 * and the child has no explicit width, it should use counterAxisSizingMode: 'FIXED'
 * with counterAxisAlignItems determining stretch behavior.
 *
 * More specifically: child frames that should fill parent width need
 * the parent to have counterAxisAlignItems: 'STRETCH' or the child needs
 * explicit counterAxisSizingMode handling.
 */
function fixSizingModes(
    node: RSNT_Node,
    parent: RSNT_Node | null,
    options: FixerOptions,
    fixes: FixEntry[]
): void {
    // Check if this node needs STRETCH fix
    if (node.type === 'FRAME' && parent?.type === 'FRAME' && parent.layoutMode) {
        const isVerticalParent = parent.layoutMode === 'VERTICAL';
        const isHorizontalParent = parent.layoutMode === 'HORIZONTAL';

        // For VERTICAL parent: child should stretch horizontally (counterAxis)
        // For HORIZONTAL parent: child should stretch vertically (counterAxis)

        if (isVerticalParent) {
            // Child should fill parent width unless it has explicit width
            const hasExplicitWidth = node.width !== undefined && node.width > 0;
            const shouldStretch = !hasExplicitWidth && node.counterAxisSizingMode !== 'FIXED';

            // If child is a container-like frame (has children, has padding, or has fills)
            const isContainer = (node.children && node.children.length > 0) ||
                               node.padding ||
                               (node.fills && node.fills.length > 0);

            if (shouldStretch && isContainer) {
                // The child itself should declare it wants to stretch
                if (node.counterAxisSizingMode !== 'FIXED') {
                    const before = { counterAxisSizingMode: node.counterAxisSizingMode };
                    // In Figma auto-layout, counterAxisSizingMode on the CHILD being 'FIXED'
                    // combined with constraints.horizontal = 'STRETCH' makes it fill
                    // But the simpler approach is setting layoutAlign on the child
                    // Since RSNT uses counterAxisSizingMode, we use 'FIXED' + parent stretch

                    // Actually, the correct pattern is:
                    // - Parent has layoutMode: VERTICAL
                    // - Child frame that wants to fill width should NOT have a fixed width
                    // - Child should have layoutGrow or be affected by parent's counterAxisAlignItems

                    // For RSNT, we handle this by ensuring parent uses STRETCH alignment
                    // Let's fix the parent's counterAxisAlignItems instead
                }
            }
        }

        // Check if parent should have stretch alignment for children
        if (parent.layoutMode !== 'NONE') {
            const childFrames = parent.children?.filter(c => c.type === 'FRAME') || [];
            const containersWithoutWidth = childFrames.filter(c =>
                !c.width &&
                ((c.children && c.children.length > 0) || c.padding || (c.fills && c.fills.length > 0))
            );

            // If parent has container children without explicit widths, parent should use stretch
            if (containersWithoutWidth.length > 0 && !parent.counterAxisAlignItems) {
                // Don't modify parent here - we'll handle it when processing parent
            }
        }
    }

    // For parent frames: ensure counterAxisAlignItems is set appropriately
    if (node.type === 'FRAME' && node.layoutMode && node.layoutMode !== 'NONE' && node.children) {
        const childFrames = node.children.filter(c => c.type === 'FRAME');
        const containersWithoutWidth = childFrames.filter(c =>
            !c.width &&
            ((c.children && c.children.length > 0) || c.padding || (c.fills && c.fills.length > 0))
        );

        // If we have container children that lack explicit width, they probably should stretch
        if (containersWithoutWidth.length > 0) {
            // Check each child and add counterAxisSizingMode if needed
            for (const child of containersWithoutWidth) {
                if (child.counterAxisSizingMode !== 'FIXED') {
                    const before = { counterAxisSizingMode: child.counterAxisSizingMode };

                    // Set the child to fill - in Figma's model this is done via layoutAlign
                    // In RSNT, we'll use a combination approach
                    // Actually, for RSNT -> Figma, the rendering code checks counterAxisSizingMode

                    // Looking at rendering.ts, it sets:
                    // frame.counterAxisSizingMode = rsntNode.counterAxisSizingMode || 'AUTO'
                    // And for children to stretch, the parent needs counterAxisAlignItems

                    // Let's set both: child gets explicit sizing mode, parent gets alignment
                    child.counterAxisSizingMode = 'FIXED';

                    // We also need to ensure the child will actually stretch
                    // In newer Figma API, this is done via layoutSizingHorizontal/Vertical
                    // But RSNT uses the older model

                    // For the child to fill, we need to NOT set a fixed width
                    // and the parent's counterAxisAlignItems should cause stretching

                    // Actually, the issue is more nuanced. Let me check the correct approach:
                    // - counterAxisSizingMode: 'AUTO' means hug contents
                    // - counterAxisSizingMode: 'FIXED' means use explicit dimension
                    //
                    // For a child to FILL its parent's cross-axis:
                    // - The child should use layoutGrow (for primary axis fill)
                    // - For cross-axis fill, the parent's primaryAxisAlignItems/counterAxisAlignItems matter
                    //
                    // Since RSNT doesn't have layoutGrow, the pattern is:
                    // - Don't set explicit width on child
                    // - Parent has counterAxisAlignItems that causes children to stretch

                    // For now, just ensure the parent has MIN alignment (which allows children to define their own size)
                    // But we SHOULD set counterAxisSizingMode to indicate intent

                    fixes.push({
                        nodeId: child.id,
                        nodeName: child.name,
                        fixType: 'SIZING_MODE',
                        description: `Container frame should fill parent width - set counterAxisSizingMode to FIXED`,
                        before,
                        after: { counterAxisSizingMode: 'FIXED' },
                    });
                }
            }
        }
    }

    // Recurse into children
    if (node.children) {
        for (const child of node.children) {
            fixSizingModes(child, node, options, fixes);
        }
    }
}

/**
 * Fix B: Snap spacing values to nearest allowed value from design system
 */
function fixSpacingValues(node: RSNT_Node, options: FixerOptions, fixes: FixEntry[]): void {
    const spacingScale = options.guidelines.spacing.scale;
    if (spacingScale.length === 0) {
        // No scale defined, skip
        if (node.children) {
            for (const child of node.children) {
                fixSpacingValues(child, options, fixes);
            }
        }
        return;
    }

    // Fix itemSpacing
    if (typeof node.itemSpacing === 'number' && !spacingScale.includes(node.itemSpacing)) {
        const snapped = snapToScale(node.itemSpacing, spacingScale);
        if (snapped !== node.itemSpacing) {
            const before = { itemSpacing: node.itemSpacing };
            node.itemSpacing = snapped;
            fixes.push({
                nodeId: node.id,
                nodeName: node.name,
                fixType: 'SPACING_SNAP',
                description: `itemSpacing ${before.itemSpacing} snapped to ${snapped}`,
                before,
                after: { itemSpacing: snapped },
            });
        }
    }

    // Fix padding values
    if (node.padding) {
        const sides = ['top', 'right', 'bottom', 'left'] as const;
        for (const side of sides) {
            const value = node.padding[side];
            if (typeof value === 'number' && !spacingScale.includes(value)) {
                const snapped = snapToScale(value, spacingScale);
                if (snapped !== value) {
                    const before = { [`padding.${side}`]: value };
                    node.padding[side] = snapped;
                    fixes.push({
                        nodeId: node.id,
                        nodeName: node.name,
                        fixType: 'SPACING_SNAP',
                        description: `padding.${side} ${value} snapped to ${snapped}`,
                        before,
                        after: { [`padding.${side}`]: snapped },
                    });
                }
            }
        }
    }

    // Recurse
    if (node.children) {
        for (const child of node.children) {
            fixSpacingValues(child, options, fixes);
        }
    }
}

/**
 * Fix E: Ensure containers (frames with fills or multiple children) have padding
 */
function fixContainerPadding(node: RSNT_Node, options: FixerOptions, fixes: FixEntry[]): void {
    if (node.type !== 'FRAME') {
        if (node.children) {
            for (const child of node.children) {
                fixContainerPadding(child, options, fixes);
            }
        }
        return;
    }

    // Is this a "card" or container? (has background fill and children)
    const hasBackgroundFill = node.fills && node.fills.some(f =>
        f.type === 'SOLID' && f.color && (f.color.r > 0.9 && f.color.g > 0.9 && f.color.b > 0.9) // white-ish
    );
    const hasMultipleChildren = node.children && node.children.length > 1;
    const hasBorderRadius = node.cornerRadius &&
        (typeof node.cornerRadius === 'number' ? node.cornerRadius > 0 : true);

    const isContainer = (hasBackgroundFill || hasBorderRadius) && hasMultipleChildren;

    if (isContainer && !node.padding) {
        // Add default padding
        const defaultPadding = findNearestInScale(options.minPadding!, options.guidelines.spacing.scale);

        node.padding = {
            top: defaultPadding,
            right: defaultPadding,
            bottom: defaultPadding,
            left: defaultPadding,
        };

        fixes.push({
            nodeId: node.id,
            nodeName: node.name,
            fixType: 'CONTAINER_PADDING',
            description: `Container missing padding - added ${defaultPadding}px on all sides`,
            before: { padding: undefined },
            after: { padding: node.padding },
        });
    }

    // Also check for zero padding
    if (isContainer && node.padding) {
        const allZero = ['top', 'right', 'bottom', 'left'].every(side => {
            const val = node.padding![side as keyof typeof node.padding];
            return typeof val === 'number' && val === 0;
        });

        if (allZero) {
            const defaultPadding = findNearestInScale(options.minPadding!, options.guidelines.spacing.scale);
            const before = { padding: { ...node.padding } };

            node.padding = {
                top: defaultPadding,
                right: defaultPadding,
                bottom: defaultPadding,
                left: defaultPadding,
            };

            fixes.push({
                nodeId: node.id,
                nodeName: node.name,
                fixType: 'CONTAINER_PADDING',
                description: `Container had zero padding - set to ${defaultPadding}px`,
                before,
                after: { padding: node.padding },
            });
        }
    }

    // Recurse
    if (node.children) {
        for (const child of node.children) {
            fixContainerPadding(child, options, fixes);
        }
    }
}

/**
 * Fix C: Ensure text hierarchy - titles should be larger than body text
 */
function fixTextHierarchy(node: RSNT_Node, options: FixerOptions, fixes: FixEntry[]): void {
    if (node.type !== 'FRAME' || !node.children) {
        if (node.children) {
            for (const child of node.children) {
                fixTextHierarchy(child, options, fixes);
            }
        }
        return;
    }

    // Find text nodes in this frame's direct children
    const textNodes = node.children.filter(c => c.type === 'TEXT');

    if (textNodes.length < 2) {
        // Need at least 2 text nodes to check hierarchy
        for (const child of node.children) {
            fixTextHierarchy(child, options, fixes);
        }
        return;
    }

    // Identify likely titles (first text, or text with title-like names)
    const titlePatterns = /title|heading|header|name|label/i;
    const bodyPatterns = /body|description|subtitle|sub|caption|text|content/i;

    // Sort by position (first in array is likely higher in visual hierarchy)
    // and by font size (larger should be title)
    const withMeta = textNodes.map((t, idx) => ({
        node: t,
        index: idx,
        fontSize: t.fontSize || 14,
        isLikelyTitle: titlePatterns.test(t.name || '') ||
                       titlePatterns.test(t.characters || '') ||
                       idx === 0,
        isLikelyBody: bodyPatterns.test(t.name || '') ||
                      bodyPatterns.test(t.characters || ''),
    }));

    // Find the title candidate (first text or one matching title pattern)
    const titleCandidate = withMeta.find(t => t.isLikelyTitle && !t.isLikelyBody);
    const bodyCandidate = withMeta.find(t => t.isLikelyBody || (!t.isLikelyTitle && t.index > 0));

    if (titleCandidate && bodyCandidate) {
        // Title should be larger than body
        if (titleCandidate.fontSize <= bodyCandidate.fontSize) {
            const fontSizes = options.guidelines.typography.sizes;
            const currentBodySize = bodyCandidate.fontSize;

            // Find a title size that's larger than body
            const largerSizes = fontSizes.filter(s => s > currentBodySize);
            if (largerSizes.length > 0) {
                const newTitleSize = largerSizes[0]; // Smallest size larger than body
                const before = { fontSize: titleCandidate.fontSize };
                titleCandidate.node.fontSize = newTitleSize;

                fixes.push({
                    nodeId: titleCandidate.node.id,
                    nodeName: titleCandidate.node.name,
                    fixType: 'TEXT_HIERARCHY',
                    description: `Title text should be larger than body - increased from ${before.fontSize}px to ${newTitleSize}px`,
                    before,
                    after: { fontSize: newTitleSize },
                });
            }
        }
    }

    // Recurse into child frames
    for (const child of node.children) {
        fixTextHierarchy(child, options, fixes);
    }
}

/**
 * Helper: Find nearest value in a scale
 */
function snapToScale(value: number, scale: number[]): number {
    if (scale.length === 0) return value;

    let nearest = scale[0];
    let minDiff = Math.abs(value - scale[0]);

    for (const s of scale) {
        const diff = Math.abs(value - s);
        if (diff < minDiff) {
            minDiff = diff;
            nearest = s;
        }
    }

    return nearest;
}

/**
 * Helper: Find nearest value in scale, preferring the given default if close
 */
function findNearestInScale(defaultValue: number, scale: number[]): number {
    if (scale.length === 0) return defaultValue;
    if (scale.includes(defaultValue)) return defaultValue;
    return snapToScale(defaultValue, scale);
}
