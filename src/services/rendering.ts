import { RSNT_Node } from '../types/rsnt';
import { applyLayoutPrimitive } from '../utils/layout-primitives';
import { DESIGN_SYSTEM } from '../rules/design-system';

export type ComponentMappings = Record<string, string>;

/**
 * Interface for cached Figma variables
 */
interface VariableCache {
    [key: string]: Variable;
}

/**
 * Font cache to avoid loading the same font multiple times
 */
const loadedFonts = new Set<string>();

/**
 * Load a font safely with caching and fallback
 */
async function loadFontSafe(family: string, style: string): Promise<boolean> {
    const fontKey = `${family}-${style}`;

    if (loadedFonts.has(fontKey)) {
        return true; // Already loaded
    }

    try {
        await figma.loadFontAsync({ family, style });
        loadedFonts.add(fontKey);
        return true;
    } catch (error) {
        console.warn(`Failed to load font ${family} ${style}, falling back to Inter Regular`);

        // Fallback to Inter Regular
        if (fontKey !== 'Inter-Regular') {
            try {
                await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
                loadedFonts.add('Inter-Regular');
                return false; // Loaded fallback
            } catch (e) {
                console.error('Failed to load fallback font:', e);
                return false;
            }
        }
        return false;
    }
}

/**
 * Create and configure a text node with proper font loading
 */
async function createTextNode(
    text: string,
    semanticRole: string
): Promise<TextNode> {

    const textNode = figma.createText();

    // Determine font based on semantic role
    let family = 'Inter';
    let style = 'Regular';
    let fontSize = 16;

    if (semanticRole === 'Heading') {
        style = 'Bold';
        fontSize = 24;
    } else if (semanticRole === 'Label') {
        style = 'Medium';
        fontSize = 14;
    } else if (semanticRole === 'Paragraph') {
        style = 'Regular';
        fontSize = 16;
    }

    // Load font
    const loaded = await loadFontSafe(family, style);

    // Apply font
    if (loaded) {
        textNode.fontName = { family, style };
    } else {
        // Use fallback
        textNode.fontName = { family: 'Inter', style: 'Regular' };
    }

    // Set properties
    textNode.characters = text;
    textNode.fontSize = fontSize;
    textNode.name = semanticRole;

    return textNode;
}

/**
 * Ensure frame has proper Auto Layout configuration
 * FIXED: Only apply default padding if no explicit padding is in tailwindClasses
 */
function ensureAutoLayout(frame: FrameNode, hasExplicitPadding: boolean) {
    // Make sure Auto Layout is enabled
    if (frame.layoutMode === 'NONE') {
        frame.layoutMode = 'VERTICAL';
    }

    // FIXED: Only set default padding if none specified in Tailwind classes
    if (!hasExplicitPadding &&
        frame.paddingLeft === 0 && frame.paddingRight === 0 &&
        frame.paddingTop === 0 && frame.paddingBottom === 0) {
        // Very minimal default padding to avoid bloat
        frame.paddingLeft = frame.paddingRight = frame.paddingTop = frame.paddingBottom = 0;
    }

    // FIXED: Don't force itemSpacing if not specified
    // Let Tailwind gap-* classes handle this
}

/**
 * Discovers and caches local variables once per rendering session.
 */
async function getVariableCache(): Promise<VariableCache> {
    const variables = figma.variables.getLocalVariables();
    const cache: VariableCache = {};
    for (const v of variables) {
        cache[v.name] = v;
    }
    return cache;
}

/**
 * Main rendering function: Converts RSNT tree to Figma nodes.
 */
export async function renderRSNT(
    rsnt: RSNT_Node,
    mappings: ComponentMappings,
    context: { nodeCount: number; varCache?: VariableCache } = { nodeCount: 0 }
): Promise<FrameNode | InstanceNode | TextNode> {

    // 1. Safety Check: Max nodes
    context.nodeCount++;
    if (context.nodeCount > 50) {
        throw new Error(`RENDER_LIMIT: Design is too complex (exceeds 50 nodes). Please simplify your request.`);
    }

    // 2. Discover Variables if not already cached
    if (!context.varCache) {
        context.varCache = await getVariableCache();
    }

    let node: FrameNode | InstanceNode | TextNode;

    try {
        // 3. Check for component mapping
        // CRITICAL FIX: Only use component instances for LEAF nodes (no children)
        // Containers with children must be frames to allow appendChild
        const hasChildren = rsnt.children && rsnt.children.length > 0;
        const componentId = mappings[rsnt.semanticRole];

        if (componentId && !hasChildren) {
            const mappedComponent = figma.getNodeById(componentId);
            if (!mappedComponent) {
                throw new Error(`MISSING_COMPONENT: Mapped component for "${rsnt.semanticRole}" (ID: ${componentId}) was deleted or is inaccessible.`);
            }

            if (mappedComponent.type === 'COMPONENT' || mappedComponent.type === 'COMPONENT_SET') {
                const componentToUse = mappedComponent.type === 'COMPONENT_SET' ? mappedComponent.defaultVariant : mappedComponent;
                node = (componentToUse as ComponentNode).createInstance();
            } else {
                throw new Error(`INVALID_MAPPING: Node ${componentId} is not a component or component set.`);
            }
        } else {
            // 4. No mapping - create from scratch

            // Handle text-only semantic roles
            const textOnlyRoles = ['Heading', 'Paragraph', 'Label'];
            if (textOnlyRoles.includes(rsnt.semanticRole) && (rsnt.props.text || rsnt.props.label)) {
                const text = rsnt.props.text || rsnt.props.label || '';
                node = await createTextNode(text, rsnt.semanticRole);

                // Apply text styling from Tailwind classes
                await applyTextStyles(node, rsnt.tailwindClasses);

                return node;
            }

            // Create frame for everything else
            const frame = figma.createFrame();
            frame.name = `${rsnt.semanticRole} (${rsnt.id})`;

            // Default size for root node (Desktop mode)
            if (context.nodeCount === 1) {
                frame.resize(1440, 860);
            }

            applyLayoutPrimitive(frame, rsnt.layoutPrimitive);

            // FIXED: Check for explicit padding before calling ensureAutoLayout
            const hasExplicitPadding = rsnt.tailwindClasses.some(cls =>
                cls.startsWith('p-') || cls.startsWith('px-') || cls.startsWith('py-')
            );

            applyTailwindStyles(frame, rsnt.tailwindClasses, context.varCache);
            ensureAutoLayout(frame, hasExplicitPadding);

            node = frame;
        }

        // 5. Add text content to frames/instances (for buttons, cards, etc.)
        if ((node.type === 'FRAME' || node.type === 'INSTANCE') && (rsnt.props.text || rsnt.props.label)) {
            const text = rsnt.props.text || rsnt.props.label || '';
            const textNode = await createTextNode(text, 'Label');

            if (node.type === 'FRAME') {
                node.appendChild(textNode);
            } else if (node.type === 'INSTANCE') {
                // For instances, try to find and update existing text layer
                const textLayers = node.findAll(n => n.type === 'TEXT') as TextNode[];
                if (textLayers.length > 0) {
                    // Update first text layer
                    const existingFont = textLayers[0].fontName as FontName;
                    await loadFontSafe(existingFont.family, existingFont.style);
                    textLayers[0].characters = text;
                } else {
                    // No text layer exists, append new one
                    node.appendChild(textNode);
                }
            }
        }

        // 6. Process children recursively
        if (rsnt.children && rsnt.children.length > 0) {
            // Only frames can have children appended
            // If we somehow ended up with an instance that has children, skip child rendering
            if (node.type === 'INSTANCE') {
                console.warn(`Warning: Cannot add children to instance ${rsnt.id}. Skipping child rendering.`);
            } else if (node.type === 'FRAME') {
                for (const child of rsnt.children) {
                    const childNode = await renderRSNT(child, mappings, context);
                    node.appendChild(childNode);
                    // FIXED: Re-added constraint application
                    applyConstraints(childNode, child.constraints);
                }
            }
        }

        return node;

    } catch (error: any) {
        console.error(`Failed to render node "${rsnt.id}":`, error);
        throw new Error(`RENDER_ERROR: ${error.message || 'Unknown error during rendering'}`);
    }
}

/**
 * Apply constraints after all nodes are created.
 */
export function applyConstraints(node: SceneNode, constraints: any) {
    if (!constraints || node.type === 'TEXT') return;

    if (node.type === 'FRAME' || node.type === 'INSTANCE') {
        // Width constraints
        if (constraints.width === 'hug') {
            node.layoutSizingHorizontal = 'HUG';
        } else if (constraints.width === 'fill') {
            node.layoutSizingHorizontal = 'FILL';
        } else if (constraints.width === 'fixed') {
            node.layoutSizingHorizontal = 'FIXED';
        }

        // Height constraints
        if (constraints.height === 'hug') {
            node.layoutSizingVertical = 'HUG';
        } else if (constraints.height === 'fill') {
            node.layoutSizingVertical = 'FILL';
        } else if (constraints.height === 'fixed') {
            node.layoutSizingVertical = 'FIXED';
        }

        // Recursively apply to children
        if ('children' in node) {
            for (const child of node.children) {
                // Children need their constraints from RSNT tree, but we don't have access here
                // This is a limitation - ideally pass the full RSNT tree
            }
        }
    }
}

/**
 * Helper to find a variable by checking multiple naming patterns
 */
function findVariable(varCache: VariableCache, possibleNames: string[]): Variable | null {
    for (const name of possibleNames) {
        if (varCache[name]) {
            return varCache[name];
        }
    }
    return null;
}

/**
 * Apply Tailwind-like styling to a Figma FrameNode.
 * FIXED: Better support for spacing, shadows, and sizes
 */
function applyTailwindStyles(node: FrameNode, classes: string[], varCache: VariableCache) {
    classes.forEach(cls => {
        // Strip CSS pseudo-classes that can't be applied in Figma
        if (cls.startsWith('hover:') || cls.startsWith('focus:')) {
            console.warn(`Ignoring interactive pseudo-class: ${cls}`);
            return;
        }

        // ========================================
        // 1. PADDING LOGIC
        // ========================================
        if (cls.startsWith('p-') || cls.startsWith('px-') || cls.startsWith('py-')) {
            const parts = cls.split('-');
            const direction = parts[0]; // p, px, py, pl, pr, pt, pb
            const valStr = parts[1];

            // Look for design system value
            const dsValue = (DESIGN_SYSTEM.spacing as any)[valStr] ||
                (DESIGN_SYSTEM.spacing as any)[valStr.replace('.', '_')];

            const value = dsValue !== undefined ? dsValue : parseInt(valStr) * 4;

            if (direction === 'p') {
                node.paddingLeft = node.paddingRight = node.paddingTop = node.paddingBottom = value;
            } else if (direction === 'px') {
                node.paddingLeft = node.paddingRight = value;
            } else if (direction === 'py') {
                node.paddingTop = node.paddingBottom = value;
            } else if (direction === 'pl') {
                node.paddingLeft = value;
            } else if (direction === 'pr') {
                node.paddingRight = value;
            } else if (direction === 'pt') {
                node.paddingTop = value;
            } else if (direction === 'pb') {
                node.paddingBottom = value;
            }
        }

        // ========================================
        // 2. GAP LOGIC (itemSpacing)
        // ========================================
        if (cls.startsWith('gap-')) {
            const parts = cls.split('-');
            const valStr = parts[1];

            const dsValue = (DESIGN_SYSTEM.spacing as any)[valStr] ||
                (DESIGN_SYSTEM.spacing as any)[valStr.replace('.', '_')];

            const value = dsValue !== undefined ? dsValue : parseInt(valStr) * 4;
            node.itemSpacing = value;
        }

        // ========================================
        // 3. BORDER RADIUS LOGIC
        // ========================================
        if (cls.startsWith('rounded')) {
            const parts = cls.split('-');

            if (cls === 'rounded') {
                node.cornerRadius = DESIGN_SYSTEM.borderRadius.base;
            } else if (parts.length === 2) {
                const size = parts[1];
                const radius = (DESIGN_SYSTEM.borderRadius as any)[size];
                if (radius !== undefined) {
                    node.cornerRadius = radius;
                }
            }
        }

        // ========================================
        // 4. BACKGROUND COLOR LOGIC
        // ========================================
        if (cls.startsWith('bg-')) {
            const colorStr = cls.substring(3);
            const parts = colorStr.split('-');

            // Try to find variable first
            const possibleNames = [
                `color/${colorStr}`,
                `colors/${colorStr}`,
                `bg/${colorStr}`,
                colorStr
            ];

            const variable = findVariable(varCache, possibleNames);

            if (variable) {
                try {
                    const fills = node.fills;
                    const solidFill = (fills !== figma.mixed && fills && fills.length > 0 && fills[0].type === 'SOLID')
                        ? fills[0] as SolidPaint
                        : null;
                    if (solidFill) {
                        const newFill = figma.variables.setBoundVariableForPaint(
                            solidFill,
                            'color',
                            variable
                        );
                        node.fills = [newFill];
                    } else {
                        const solidFill: SolidPaint = {
                            type: 'SOLID',
                            color: { r: 0, g: 0, b: 0 }
                        };
                        const newFill = figma.variables.setBoundVariableForPaint(
                            solidFill,
                            'color',
                            variable
                        );
                        node.fills = [newFill];
                    }
                } catch (e) {
                    console.warn('Failed to bind color variable, using fallback:', e);
                    applyFallbackColor(node, parts);
                }
            } else {
                applyFallbackColor(node, parts);
            }
        }

        // ========================================
        // 5. BORDER COLOR/WIDTH LOGIC
        // ========================================
        if (cls === 'border' || cls.startsWith('border-')) {
            if (cls === 'border') {
                // Simple border - 1px solid
                node.strokes = [{
                    type: 'SOLID',
                    color: { r: 0.9, g: 0.9, b: 0.9 } // neutral-200
                }];
                node.strokeWeight = 1;
            } else {
                const parts = cls.split('-');
                if (parts.length === 2 && !isNaN(parseInt(parts[1]))) {
                    // Border width (border-2, border-4)
                    node.strokeWeight = parseInt(parts[1]);
                } else if (parts.length >= 2) {
                    // Border color (border-neutral-200)
                    const colorParts = parts.slice(1);
                    if (colorParts[0] === 'neutral' && colorParts[1]) {
                        const shade = colorParts[1];
                        const colorMap: Record<string, RGB> = {
                            '200': { r: 0.90, g: 0.90, b: 0.90 },
                            '300': { r: 0.83, g: 0.83, b: 0.83 },
                        };
                        if (colorMap[shade]) {
                            node.strokes = [{
                                type: 'SOLID',
                                color: colorMap[shade]
                            }];
                            node.strokeWeight = node.strokeWeight || 1;
                        }
                    }
                }
            }
        }

        // ========================================
        // 6. SIZING LOGIC (Fixed Width/Height)
        // ========================================
        // FIXED: Better handling for w-full, w-96, w-[specific], etc.
        if (cls.startsWith('w-')) {
            const parts = cls.split('-');
            const valStr = parts[1];

            if (valStr === 'full') {
                // w-full is handled by constraints (fill), not here
                return;
            }

            // Check if it's a standard Tailwind size (w-96 = 384px)
            const tailwindSizes: Record<string, number> = {
                '96': 384,
                '80': 320,
                '72': 288,
                '64': 256,
                '60': 240,
                '56': 224,
                '52': 208,
                '48': 192,
                '44': 176,
                '40': 160,
                '36': 144,
                '32': 128,
                '28': 112,
                '24': 96,
                '20': 80,
                '16': 64,
                '12': 48,
            };

            if (tailwindSizes[valStr]) {
                node.resize(tailwindSizes[valStr], node.height);
                return;
            }

            // Handle arbitrary values like [1440px]
            if (valStr.startsWith('[') && valStr.endsWith(']')) {
                const inner = valStr.substring(1, valStr.length - 1);
                const numericVal = parseFloat(inner.replace('px', ''));
                if (!isNaN(numericVal)) {
                    node.resize(numericVal, node.height);
                }
                return;
            }

            // Try design system spacing
            const dsValue = (DESIGN_SYSTEM.spacing as any)[valStr];
            if (dsValue !== undefined) {
                node.resize(dsValue, node.height);
            }
        }

        if (cls.startsWith('h-')) {
            const parts = cls.split('-');
            const valStr = parts[1];

            if (valStr === 'full' || valStr === 'screen') {
                return; // Handled by constraints
            }

            // Standard heights
            const heights: Record<string, number> = {
                '10': 40,
                '12': 48,
                '16': 64,
                '20': 80,
            };

            if (heights[valStr]) {
                node.resize(node.width, heights[valStr]);
                return;
            }

            // Handle arbitrary values
            if (valStr.startsWith('[') && valStr.endsWith(']')) {
                const inner = valStr.substring(1, valStr.length - 1);
                const numericVal = parseFloat(inner.replace('px', ''));
                if (!isNaN(numericVal)) {
                    node.resize(node.width, numericVal);
                }
            }
        }

        // ========================================
        // 7. SHADOW LOGIC (NEW)
        // ========================================
        if (cls.startsWith('shadow-')) {
            const shadowType = cls.substring(7); // 'lg', 'md', 'sm', etc.

            const shadows: Record<string, DropShadowEffect> = {
                'sm': {
                    type: 'DROP_SHADOW',
                    color: { r: 0, g: 0, b: 0, a: 0.05 },
                    offset: { x: 0, y: 1 },
                    radius: 2,
                    visible: true,
                    blendMode: 'NORMAL'
                },
                'md': {
                    type: 'DROP_SHADOW',
                    color: { r: 0, g: 0, b: 0, a: 0.1 },
                    offset: { x: 0, y: 4 },
                    radius: 6,
                    visible: true,
                    blendMode: 'NORMAL'
                },
                'lg': {
                    type: 'DROP_SHADOW',
                    color: { r: 0, g: 0, b: 0, a: 0.1 },
                    offset: { x: 0, y: 10 },
                    radius: 15,
                    visible: true,
                    blendMode: 'NORMAL'
                },
                'xl': {
                    type: 'DROP_SHADOW',
                    color: { r: 0, g: 0, b: 0, a: 0.15 },
                    offset: { x: 0, y: 20 },
                    radius: 25,
                    visible: true,
                    blendMode: 'NORMAL'
                }
            };

            if (shadows[shadowType]) {
                node.effects = [shadows[shadowType]];
            }
        }
    });
}

/**
 * Helper function to apply fallback colors when no variable is found
 */
function applyFallbackColor(node: FrameNode, parts: string[]) {
    if (parts.length === 1) {
        // Single color name
        const colorName = parts[0];
        if (colorName === 'white') {
            node.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
        } else if (colorName === 'black') {
            node.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
        } else if (colorName === 'primary') {
            node.fills = [{ type: 'SOLID', color: DESIGN_SYSTEM.colors.primary }];
        } else if (colorName === 'transparent') {
            node.fills = [];
        }
    } else if (parts.length === 2) {
        // Color with shade (e.g., neutral-500)
        const colorName = parts[0];
        const shade = parts[1];

        if (colorName === 'neutral' && (DESIGN_SYSTEM.colors.neutral as any)[shade]) {
            node.fills = [{
                type: 'SOLID',
                color: (DESIGN_SYSTEM.colors.neutral as any)[shade]
            }];
        }
    }
}

/**
 * Apply text-specific Tailwind classes
 * FIXED: Added text-center support
 */
async function applyTextStyles(textNode: TextNode, classes: string[]) {
    for (const cls of classes) {
        // Font sizes
        if (cls === 'text-xs') textNode.fontSize = 12;
        else if (cls === 'text-sm') textNode.fontSize = 14;
        else if (cls === 'text-base') textNode.fontSize = 16;
        else if (cls === 'text-lg') textNode.fontSize = 18;
        else if (cls === 'text-xl') textNode.fontSize = 20;
        else if (cls === 'text-2xl') textNode.fontSize = 24;
        else if (cls === 'text-3xl') textNode.fontSize = 30;
        else if (cls === 'text-4xl') textNode.fontSize = 36;

        // Font weights
        if (cls === 'font-normal') {
            await loadFontSafe('Inter', 'Regular');
            textNode.fontName = { family: 'Inter', style: 'Regular' };
        } else if (cls === 'font-medium') {
            await loadFontSafe('Inter', 'Medium');
            textNode.fontName = { family: 'Inter', style: 'Medium' };
        } else if (cls === 'font-semibold') {
            await loadFontSafe('Inter', 'SemiBold');
            textNode.fontName = { family: 'Inter', style: 'SemiBold' };
        } else if (cls === 'font-bold') {
            await loadFontSafe('Inter', 'Bold');
            textNode.fontName = { family: 'Inter', style: 'Bold' };
        }

        // Text alignment (NEW)
        if (cls === 'text-center') {
            textNode.textAlignHorizontal = 'CENTER';
        } else if (cls === 'text-left') {
            textNode.textAlignHorizontal = 'LEFT';
        } else if (cls === 'text-right') {
            textNode.textAlignHorizontal = 'RIGHT';
        }

        // Text colors
        if (cls.startsWith('text-') && !cls.startsWith('text-xs') && !cls.startsWith('text-sm') &&
            !cls.startsWith('text-base') && !cls.startsWith('text-lg') && !cls.startsWith('text-xl') &&
            !cls.startsWith('text-center') && !cls.startsWith('text-left') && !cls.startsWith('text-right')) {

            const colorStr = cls.substring(5);
            const parts = colorStr.split('-');

            // Simple color mapping
            if (colorStr === 'white') {
                textNode.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
            } else if (colorStr === 'black') {
                textNode.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
            } else if (parts[0] === 'neutral' && parts[1]) {
                const shade = parts[1];
                const colorMap: Record<string, RGB> = {
                    '50': { r: 0.98, g: 0.98, b: 0.98 },
                    '100': { r: 0.96, g: 0.96, b: 0.96 },
                    '200': { r: 0.90, g: 0.90, b: 0.90 },
                    '300': { r: 0.83, g: 0.83, b: 0.83 },
                    '400': { r: 0.63, g: 0.63, b: 0.63 },
                    '500': { r: 0.45, g: 0.45, b: 0.45 },
                    '600': { r: 0.32, g: 0.32, b: 0.32 },
                    '700': { r: 0.25, g: 0.25, b: 0.25 },
                    '800': { r: 0.15, g: 0.15, b: 0.15 },
                    '900': { r: 0.09, g: 0.09, b: 0.09 },
                };
                if (colorMap[shade]) {
                    textNode.fills = [{ type: 'SOLID', color: colorMap[shade] }];
                }
            }
        }
    }
}