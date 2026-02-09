import { RSNT_Node } from '../types/rsnt';
import { normalizeColor } from '../libs/color-utils';
import { RenderResult, RenderError, createRenderErrorUI, createExecutionError, createResolutionError, ErrorCode } from '../types/errors';
import { fontManager } from './font-manager';
import { processInChunks } from '../utils/chunking';
import { ResolutionResult, ExecutionInstructions, ComponentInstructions, FrameInstructions } from '../types/resolution-types';
import { propertyMappingService } from './property-mapping';

/**
 * Render RSNT node to Figma
 * Returns RenderResult with node and any errors/warnings encountered
 */
export async function renderRSNT(
    node: RSNT_Node,
    parent?: BaseNode & ChildrenMixin,
    onProgress?: (progress: { current: number, total: number }) => void,
    shouldCancel?: () => boolean
): Promise<RenderResult> {
    const errors: RenderError[] = [];
    const warnings: RenderError[] = [];

    // 1. Flatten the tree for linear processing
    const flatNodes = flattenRSNT(node);

    // 2. Process in chunks
    const processNode = async (flatNode: FlatNode, index: number) => {
        const { rsnt, parent: flatParent } = flatNode;

        try {
            let figmaNode: SceneNode;

            // Create node based on type
            // Note: If resolution is provided, use executeInstructions instead
            switch (rsnt.type) {
                case 'COMPONENT_INSTANCE':
                    figmaNode = await renderComponentInstance(rsnt);
                    break;
                case 'FRAME':
                    figmaNode = await renderFrame(rsnt);
                    break;
                case 'TEXT':
                    figmaNode = await renderText(rsnt);
                    break;
                default:
                    // Safety net: the AI sometimes uses semantic type names (H1, Button,
                    // etc.) instead of "COMPONENT_INSTANCE". If componentId is present the
                    // intent is clear — route to component rendering regardless of type string.
                    if (rsnt.componentId) {
                        console.warn(`Node "${rsnt.id}" has unrecognised type "${rsnt.type}" but componentId is set — treating as COMPONENT_INSTANCE`);
                        figmaNode = await renderComponentInstance(rsnt);
                        break;
                    }
                    throw createExecutionError(ErrorCode.NODE_CREATION_FAILED, { type: rsnt.type }, `Unknown node type: ${rsnt.type}`);
            }

            flatNode.figmaNode = figmaNode;

            if (rsnt.name) figmaNode.name = rsnt.name;

            // Apply properties modularly
            if ('fills' in figmaNode) applyFills(figmaNode, rsnt, warnings, errors);
            if ('strokes' in figmaNode) applyStrokes(figmaNode, rsnt, warnings, errors);
            if ('cornerRadius' in figmaNode) applyCornerRadius(figmaNode, rsnt);
            if ('constraints' in figmaNode) applyConstraints(figmaNode, rsnt);
            if ('layoutMode' in figmaNode) applyLayout(figmaNode, rsnt);

            // Apply new high-fidelity properties
            if ('effects' in figmaNode) applyEffects(figmaNode, rsnt);
            if ('opacity' in figmaNode) applyLayerProps(figmaNode, rsnt);

            // ATTACH TO PARENT
            attachToParent(figmaNode, flatParent, parent, warnings, rsnt.id);

        } catch (error: any) {
            console.error(`Error processing node ${rsnt.id}:`, error);
            errors.push(createRenderErrorUI(
                error instanceof Error ? error : createExecutionError(ErrorCode.NODE_CREATION_FAILED, { error }),
                rsnt.id,
                'error',
                'Failed to create node'
            ));
        }
    };

    try {
        await processInChunks(
            flatNodes,
            25, // Chunk size
            processNode,
            onProgress,
            shouldCancel
        );
    } catch (e: any) {
        if (e.message === 'Operation cancelled') {
            const root = flatNodes[0]?.figmaNode;
            if (root && !root.removed) {
                root.remove();
            }
            throw e;
        }
        throw e;
    }

    return {
        node: flatNodes[0].figmaNode as SceneNode,
        errors,
        warnings
    };
}

// Helper types and functions

interface FlatNode {
    rsnt: RSNT_Node;
    parent: FlatNode | null;
    figmaNode?: SceneNode;
}

function flattenRSNT(root: RSNT_Node): FlatNode[] {
    const result: FlatNode[] = [];
    function traverse(node: RSNT_Node, parent: FlatNode | null) {
        const flatNode: FlatNode = { rsnt: node, parent };
        result.push(flatNode);
        if (node.children) {
            for (const child of node.children) {
                traverse(child, flatNode);
            }
        }
    }
    traverse(root, null);
    return result;
}

async function renderComponentInstance(node: RSNT_Node, overrides?: ComponentInstructions['overrides']): Promise<InstanceNode> {
    let component: ComponentNode | ComponentSetNode | null = null;

    if (node.componentId) {
        component = figma.getNodeById(node.componentId) as ComponentNode | ComponentSetNode;
    }

    // Fallback: If component not found by ID, try finding by key or name
    if (!component) {
        // Strategy 1: Component Key Lookup (Robust for Library Components)
        if (node.componentKey) {
            try {
                console.log(`Attempting to import component by key: ${node.componentKey}`);
                // Use importComponentByKeyAsync to fetch from library
                // This works even if the master component isn't in the current file
                component = await figma.importComponentByKeyAsync(node.componentKey);
                console.log(`Recovered component via Key Lookup: ${component.name} (ID: ${component.id})`);
            } catch (e) {
                console.warn(`Failed to import component by key "${node.componentKey}":`, e);
            }
        }

        // Strategy 2: Fallback search by name (for local components or if key fails)
        if (!component && node.name) {
            console.warn(`Component ID "${node.componentId}" not found. Attempting fallback search by name: "${node.name}"`);

            // Exact Name Match
            let candidates = figma.root.findAll(n => (n.type === 'COMPONENT' || n.type === 'COMPONENT_SET') && n.name === node.name);

            // Case-Insensitive Match
            if (candidates.length === 0) {
                const lowerName = node.name.toLowerCase();
                candidates = figma.root.findAll(n => (n.type === 'COMPONENT' || n.type === 'COMPONENT_SET') && n.name.toLowerCase() === lowerName);
            }

            // Cleaned Partial Match
            if (candidates.length === 0) {
                const cleanName = node.name.split('/').pop()?.trim().toLowerCase();
                if (cleanName) {
                    candidates = figma.root.findAll(n => {
                        if (n.type !== 'COMPONENT' && n.type !== 'COMPONENT_SET') return false;
                        const nName = n.name.toLowerCase();
                        return nName === cleanName || nName.endsWith(`/${cleanName}`) || nName.includes(cleanName);
                    });
                }
            }

            if (candidates.length > 0) {
                candidates.sort((a, b) => a.name.length - b.name.length);
                component = candidates[0] as ComponentNode | ComponentSetNode;
                console.log(`Recovered component "${node.name}" (ID: ${component.id}) via name fallback.`);

                // Constructive update: if we found it by name/key, update the node ID so subsequent steps work
                if (node.componentId !== component.id) {
                    // We can't mutate readonly props easily if frozen, but RSNT is usually a POJO
                    node.componentId = component.id;
                }
            } else {
                console.warn(`Fallback search failed for "${node.name}".`);
            }
        }
    }

    if (!component) {
        throw createResolutionError(ErrorCode.COMPONENT_NOT_FOUND, { componentId: node.componentId, name: node.name });
    }

    console.log(`[Renderer] Selected component: "${component.name}"`, component.componentPropertyDefinitions);

    // Explicit type check to satisfy compiler
    const type = component.type;
    if (type !== 'COMPONENT' && type !== 'COMPONENT_SET') {
        throw createExecutionError(ErrorCode.NODE_CREATION_FAILED, { componentId: node.componentId, type }, `Node ${node.componentId} is not a component`);
    }
    const instance = component.type === 'COMPONENT_SET'
        ? (component as ComponentSetNode).defaultVariant.createInstance()
        : (component as ComponentNode).createInstance();

    // --- Property application with semantic mapping ---
    if (node.properties) {
        try {
            // Separate text-content keys from real variant/style properties.
            // The AI may place text in properties as "text" or "content".
            const textKeys = ['text', 'content', 'characters'];
            const propsForMapping: Record<string, string> = {};
            let textFromProps: string | undefined;

            for (const [key, value] of Object.entries(node.properties)) {
                if (textKeys.includes(key)) {
                    textFromProps = value;
                } else {
                    propsForMapping[key] = value;
                }
            }

            // Map semantic property names (e.g. variant: "primary") to the actual
            // component property names (e.g. Emphasis: "High") using the mapping
            // that was built during discovery.
            if (Object.keys(propsForMapping).length > 0) {
                // Apply semantic mapping
                const mapped = propertyMappingService.applyMappingWithWarnings(component.id, propsForMapping);

                if (mapped.warnings.length > 0) {
                    console.warn(`Property mapping for "${node.name || node.id}":`, mapped.warnings);
                }

                // MERGE: Start with original properties and overwrite with mapped ones.
                // This preserves properties like "mode" that AI provided but mapping skipped.
                // We also include "skippedProps" from the mapping result explicitly if they weren't in result.
                const propsToSet = { ...propsForMapping, ...mapped.componentProperties };

                console.log(`[Renderer] Final properties for "${node.name}":`, propsToSet);

                const resolved = resolvePropsAgainstDefinitions(
                    component as ComponentNode | ComponentSetNode, propsToSet
                );

                if (Object.keys(resolved).length > 0) {
                    console.log(`[Renderer] Applying properties to "${node.name}":`, resolved);
                    try {
                        instance.setProperties(resolved);
                    } catch (e) {
                        console.error(`[Renderer] setProperties failed for "${node.name}":`, e);
                        // Fallback: try setting them one by one if the batch fails
                        for (const [k, v] of Object.entries(resolved)) {
                            try { instance.setProperties({ [k]: v }); } catch (inner) { /* ignore */ }
                        }
                    }
                } else {
                    console.warn(`[Renderer] No properties resolved for "${node.name}" from input:`, propsToSet);
                }
            }

            // Surface the extracted text for the text-application step below
            if (textFromProps && !node.characters) {
                (node as any)._textFromProps = textFromProps;
            }
        } catch (error) {
            console.warn(`Failed to set properties on "${node.name || node.id}":`, error);
        }
    }

    // --- Text content application ---
    // Components are atomic (no children). To update their internal text the renderer
    // finds TEXT layers inside the instance and overwrites characters.
    // The text source is node.characters (standard RSNT field) or a "text"/"content"
    // key that was extracted from properties above.
    const textContent = node.characters || (node as any)._textFromProps;
    if (textContent) {
        try {
            const textNodes = instance.findAll(n => n.type === 'TEXT') as TextNode[];
            if (textNodes.length > 0) {
                const textNode = textNodes[0];

                // Figma requires all fonts used by a text node to be loaded before
                // characters can be written. Load whatever fonts are currently in use.
                const currentLen = textNode.characters.length;
                const fontsToLoad: FontName[] = currentLen > 0
                    ? textNode.getRangeAllFontNames(0, currentLen)
                    : [textNode.fontName as FontName];
                await Promise.all(fontsToLoad.map(f => figma.loadFontAsync(f)));

                textNode.characters = textContent;
            } else {
                // Component has no TEXT layer — text will be invisible.
                // This commonly happens when the AI picks an icon-only variant.
                console.warn(`[text-lost] "${node.name || node.id}": characters="${textContent}" but component has no TEXT layer. The component may be an icon-only variant.`);
            }
        } catch (e) {
            console.warn(`Failed to set text on "${node.name || node.id}":`, e);
        }
    }

    // Apply overrides if provided (from Tier 2 structural match)
    if (overrides) {
        if (overrides.fills && 'fills' in instance) {
            instance.fills = overrides.fills;
        }
        if (overrides.strokes && 'strokes' in instance) {
            instance.strokes = overrides.strokes;
        }
        if (overrides.text) {
            const textNodes = instance.findAll(n => n.type === 'TEXT') as TextNode[];
            for (const textNode of textNodes) {
                textNode.characters = overrides.text;
            }
        }
        if (overrides.padding && 'paddingTop' in instance) {
            instance.paddingTop = overrides.padding.top;
            instance.paddingRight = overrides.padding.right;
            instance.paddingBottom = overrides.padding.bottom;
            instance.paddingLeft = overrides.padding.left;
        }
    }

    return instance;
}

async function renderFrame(node: RSNT_Node): Promise<FrameNode> {
    const frame = figma.createFrame();
    if (node.width !== undefined) {
        frame.resize(node.width, node.height || 100);
    }
    if (node.height !== undefined && node.width === undefined) {
        frame.resize(frame.width, node.height);
    }
    return frame;
}

async function renderText(node: RSNT_Node): Promise<TextNode> {
    const text = figma.createText();
    const font = await fontManager.getFontForNode(node.fontFamily, node.fontStyle);
    text.fontName = font;
    if (node.characters) text.characters = node.characters;
    if (node.fontSize) text.fontSize = node.fontSize;
    // If a width is specified, set it and switch to fixed-width wrapping mode
    // so multi-line paragraphs wrap correctly instead of extending as a single line.
    if (node.width !== undefined) {
        text.textAutoResize = 'HEIGHT';
        text.resize(node.width, text.height);
    }
    return text;
}

// Modular Property Appliers

function applyFills(figmaNode: any, rsnt: RSNT_Node, warnings: RenderError[], errors: RenderError[]) {
    if (!rsnt.fills) return;
    const fills: Paint[] = [];

    for (const fill of rsnt.fills) {
        if (fill.type === 'SOLID' && fill.color) {
            const { r, g, b } = fill.color;
            if (r === undefined || g === undefined || b === undefined) {
                warnings.push(createRenderErrorUI(createExecutionError(ErrorCode.PROPERTY_BINDING_FAILED), rsnt.id, 'warning', 'Invalid color values'));
                continue;
            }
            fills.push({
                type: 'SOLID',
                color: normalizeColor(fill.color),
                opacity: (fill as any).opacity !== undefined ? (fill as any).opacity : 1
            });
        } else if (fill.type === 'VARIABLE' && fill.variableId) {
            // Bind the variable so the fill updates when the design token changes
            const variable = figma.variables.getVariableById(fill.variableId);
            if (variable) {
                // Resolve current value as fallback color
                const value = resolveVariable(fill.variableId, 'COLOR');
                const fallbackColor = (value && typeof value === 'object' && 'r' in value)
                    ? { r: value.r, g: value.g, b: value.b, a: 1 }
                    : { r: 0, g: 0, b: 0, a: 1 };

                fills.push({
                    type: 'SOLID',
                    color: fallbackColor,
                    boundVariables: {
                        color: { type: 'VARIABLE_REF', variableId: fill.variableId }
                    }
                } as any); // boundVariables supported in Figma API v1.98+
            } else {
                fills.push({ type: 'SOLID', color: { r: 1, g: 1, b: 1 } });
                warnings.push(createRenderErrorUI(createExecutionError(ErrorCode.VARIABLE_NOT_FOUND), rsnt.id, 'warning', `Variable ${fill.variableId} not found — using fallback`));
            }
        }
    }
    figmaNode.fills = fills;
}

function applyStrokes(figmaNode: any, rsnt: RSNT_Node, warnings: RenderError[], errors: RenderError[]) {
    if (!rsnt.strokes || rsnt.strokes.length === 0) {
        if ('strokes' in figmaNode) figmaNode.strokes = [];
        return;
    }
    figmaNode.strokes = rsnt.strokes.map(stroke => ({
        type: 'SOLID',
        color: normalizeColor(stroke.color),
        opacity: stroke.opacity !== undefined ? stroke.opacity : 1
    }));

    if ('strokeWeight' in figmaNode) {
        // Use node-level strokeWeight if present, fallback to first stroke's weight, then default to 1
        figmaNode.strokeWeight = (rsnt.strokeWeight as any) || (rsnt.strokes[0] as any).weight || 1;
    }
}

function applyCornerRadius(figmaNode: any, rsnt: RSNT_Node) {
    if (rsnt.cornerRadius === undefined) return;
    if (typeof rsnt.cornerRadius === 'number') {
        figmaNode.cornerRadius = rsnt.cornerRadius;
    } else if (rsnt.cornerRadius.variableId) {
        const value = resolveVariable(rsnt.cornerRadius.variableId, 'FLOAT');
        if (typeof value === 'number') figmaNode.cornerRadius = value;
    }
}

/**
 * Resolve AI-provided property names against a component's actual definitions.
 * The AI often outputs generic semantic keys (e.g. "variant", "size", "type")
 * instead of the real Figma property names (e.g. "Style", "Size").
 * Strategy: direct key match first; if the key is unknown, scan every VARIANT
 * property's variantOptions for a match on the VALUE and use that property name.
 */
function resolvePropsAgainstDefinitions(
    component: ComponentNode | ComponentSetNode,
    props: Record<string, string>
): Record<string, string> {
    const defs = component.componentPropertyDefinitions;
    const resolved: Record<string, string> = {};

    // 1. Map definition keys to lowercase for case-insensitive lookup
    const defKeysLower: Record<string, string> = {};
    Object.keys(defs).forEach(k => { defKeysLower[k.toLowerCase()] = k; });

    for (const [rawKey, rawValue] of Object.entries(props)) {
        const key = rawKey.toLowerCase();
        const value = rawValue.toLowerCase();

        // Strategy A: Key Match (Case-Insensitive)
        const realKey = defKeysLower[key];
        if (realKey) {
            const propDef = defs[realKey];

            // For variants, we also need to match the VALUE case-insensitively
            if (propDef.type === 'VARIANT' && propDef.variantOptions) {
                const realValue = propDef.variantOptions.find(opt => opt.toLowerCase() === value);
                if (realValue) {
                    resolved[realKey] = realValue;
                    continue;
                }
            } else {
                // For non-variants, just direct set
                resolved[realKey] = rawValue;
                continue;
            }
        }

        // Strategy B: Value-based match — find ANY VARIANT property that accepts this value
        let matchedByValue = false;
        for (const [propName, propDef] of Object.entries(defs)) {
            if (propDef.type === 'VARIANT' && propDef.variantOptions) {
                const realValue = propDef.variantOptions.find(opt => opt.toLowerCase() === value);
                if (realValue) {
                    if (!resolved[propName]) {
                        resolved[propName] = realValue;
                        matchedByValue = true;
                        console.log(`  Resolved property "${rawKey}: ${rawValue}" → "${propName}: ${realValue}" (Value matching)`);
                    }
                    break;
                }
            }
        }

        if (!matchedByValue && !realKey) {
            console.warn(`  Could not resolve property "${rawKey}: ${rawValue}" — no matching definition`);
        }
    }

    return resolved;
}

function applyConstraints(figmaNode: any, rsnt: RSNT_Node) {
    if (rsnt.constraints) {
        figmaNode.constraints = rsnt.constraints;
    } else if (rsnt.layoutMode === 'NONE' && (rsnt.width || rsnt.height)) {
        // Default to TOP-LEFT for fixed frames if no constraints provided
        figmaNode.constraints = { horizontal: 'MIN', vertical: 'MIN' };
    }
}

function applyLayerProps(figmaNode: any, rsnt: RSNT_Node) {
    if (rsnt.opacity !== undefined) figmaNode.opacity = rsnt.opacity;
    if (rsnt.blendMode) figmaNode.blendMode = rsnt.blendMode;
    if (rsnt.visible !== undefined) figmaNode.visible = rsnt.visible;
}

function applyEffects(figmaNode: any, rsnt: RSNT_Node) {
    if (rsnt.effects && rsnt.effects.length > 0) {
        figmaNode.effects = rsnt.effects.map(effect => {
            // Reconstruct effect object based on type to ensure Figma accepts it
            if (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') {
                return {
                    type: effect.type,
                    color: effect.color || { r: 0, g: 0, b: 0, a: 0.25 },
                    offset: effect.offset || { x: 0, y: 4 },
                    radius: effect.radius || 4,
                    spread: effect.spread || 0,
                    visible: effect.visible !== undefined ? effect.visible : true,
                    blendMode: effect.blendMode || 'NORMAL'
                };
            } else {
                return {
                    type: effect.type,
                    radius: effect.radius || 4,
                    visible: effect.visible !== undefined ? effect.visible : true
                };
            }
        });
    }
}

// CSS-to-Figma alignment value mapping. The AI sometimes outputs CSS flexbox
// terminology (FLEX_START, FLEX_END, etc.) instead of Figma enum values.
const ALIGNMENT_MAP: Record<string, string> = {
    'FLEX_START': 'MIN', 'FLEX_END': 'MAX',
    'START': 'MIN', 'END': 'MAX',
    'JUSTIFY_START': 'MIN', 'JUSTIFY_END': 'MAX',
    'JUSTIFY_CENTER': 'CENTER', 'JUSTIFY_BETWEEN': 'SPACE_BETWEEN',
    'STRETCH': 'MIN', // best Figma approximation for stretch
};
const VALID_PRIMARY_ALIGN = new Set(['MIN', 'MAX', 'CENTER', 'SPACE_BETWEEN']);
const VALID_COUNTER_ALIGN = new Set(['MIN', 'MAX', 'CENTER']);

function sanitizeAlignment(value: string, validSet: Set<string>): string | null {
    const upper = value.toUpperCase();
    if (validSet.has(upper)) return upper;
    const mapped = ALIGNMENT_MAP[upper];
    if (mapped && validSet.has(mapped)) return mapped;
    console.warn(`Unsupported alignment value "${value}" — skipped`);
    return null;
}

function applyLayout(figmaNode: any, rsnt: RSNT_Node) {
    if (rsnt.layoutMode) figmaNode.layoutMode = rsnt.layoutMode;
    if (rsnt.primaryAxisSizingMode) figmaNode.primaryAxisSizingMode = rsnt.primaryAxisSizingMode;
    if (rsnt.counterAxisSizingMode) figmaNode.counterAxisSizingMode = rsnt.counterAxisSizingMode;

    // Safety net: when auto-layout is enabled but the AI omitted both width and
    // counterAxisSizingMode, Figma defaults to HUG — the frame shrinks to its
    // content width.  Defaulting to STRETCH instead makes the frame fill its
    // parent's available space, which is the expected behaviour for content
    // containers.  If the AI DID set an explicit width, the resize() call below
    // will pin it to that value afterward.
    if (rsnt.layoutMode && rsnt.layoutMode !== 'NONE' && !rsnt.counterAxisSizingMode && rsnt.width === undefined) {
        figmaNode.counterAxisSizingMode = 'STRETCH';
    }

    if (rsnt.primaryAxisAlignItems) {
        const safe = sanitizeAlignment(rsnt.primaryAxisAlignItems, VALID_PRIMARY_ALIGN);
        if (safe) figmaNode.primaryAxisAlignItems = safe;
    }
    if (rsnt.counterAxisAlignItems) {
        const safe = sanitizeAlignment(rsnt.counterAxisAlignItems, VALID_COUNTER_ALIGN);
        if (safe) figmaNode.counterAxisAlignItems = safe;
    }

    if (rsnt.itemSpacing !== undefined) {
        if (typeof rsnt.itemSpacing === 'number') {
            figmaNode.itemSpacing = rsnt.itemSpacing;
        } else if (rsnt.itemSpacing.variableId) {
            const variable = figma.variables.getVariableById(rsnt.itemSpacing.variableId);
            if (variable) figmaNode.setBoundVariable('itemSpacing', variable);
        }
    }

    if (rsnt.padding) {
        const applyPadding = (side: string, value: any) => {
            const prop = `padding${side.charAt(0).toUpperCase() + side.slice(1)}`;
            if (typeof value === 'number') (figmaNode as any)[prop] = value;
            else if (value?.variableId) {
                const variable = figma.variables.getVariableById(value.variableId);
                if (variable) figmaNode.setBoundVariable(prop, variable);
            }
        };
        applyPadding('top', rsnt.padding.top);
        applyPadding('right', rsnt.padding.right);
        applyPadding('bottom', rsnt.padding.bottom);
        applyPadding('left', rsnt.padding.left);
    }

    // Re-apply explicit dimensions after all layout properties are set.
    // Setting layoutMode switches Figma to auto-layout which defaults to HUG sizing,
    // discarding any dimensions set before layoutMode was applied.
    if (rsnt.layoutMode && rsnt.layoutMode !== 'NONE' && (rsnt.width !== undefined || rsnt.height !== undefined)) {
        const w = rsnt.width ?? figmaNode.width;
        const h = rsnt.height ?? figmaNode.height;
        figmaNode.resize(w, h);
    }
}

function attachToParent(figmaNode: SceneNode, flatParent: FlatNode | null, externalParent: (BaseNode & ChildrenMixin) | undefined, warnings: RenderError[], nodeId: string) {
    if (!flatParent) {
        if (externalParent && 'appendChild' in externalParent) externalParent.appendChild(figmaNode);
    } else if (flatParent.figmaNode) {
        if ('appendChild' in flatParent.figmaNode && flatParent.figmaNode.type !== 'INSTANCE') {
            flatParent.figmaNode.appendChild(figmaNode);
        } else if (flatParent.figmaNode.type === 'INSTANCE') {
            warnings.push(createRenderErrorUI(createExecutionError(ErrorCode.INVALID_LAYOUT_PRIMITIVE), nodeId, 'warning', 'Instances cannot have children'));
        }
    }
}

function resolveVariable(variableId: string, expectedType: VariableResolvedDataType): any {
    try {
        const variable = figma.variables.getVariableById(variableId);
        if (variable && variable.resolvedType === expectedType) {
            const collection = figma.variables.getVariableCollectionById(variable.variableCollectionId);
            const mode = collection?.defaultModeId || Object.keys(variable.valuesByMode)[0];
            return variable.valuesByMode[mode];
        }
    } catch (e) {
        console.warn('Variable resolution failed', e);
    }
    return null;
}

/**
 * ============================================================================
 * RESOLUTION INSTRUCTION EXECUTION
 * ============================================================================
 */

/**
 * Execute resolution instructions to create a Figma node
 * This is the bridge between resolution and rendering
 */
export async function executeInstructions(
    instructions: ExecutionInstructions,
    rsnt: RSNT_Node
): Promise<SceneNode> {
    if (instructions.type === 'INSTANTIATE_COMPONENT') {
        return executeComponentInstructions(instructions, rsnt);
    } else {
        return executeFrameInstructions(instructions, rsnt);
    }
}

/**
 * Execute component instantiation instructions
 */
async function executeComponentInstructions(
    instructions: ComponentInstructions,
    rsnt: RSNT_Node
): Promise<InstanceNode> {
    // Create a temporary RSNT node with the component ID and properties
    const tempNode: RSNT_Node = {
        ...rsnt,
        componentId: instructions.componentId,
        properties: instructions.properties,
    };

    // Use existing renderComponentInstance with overrides
    return renderComponentInstance(tempNode, instructions.overrides);
}

/**
 * Execute frame creation instructions
 */
async function executeFrameInstructions(
    instructions: FrameInstructions,
    rsnt: RSNT_Node
): Promise<FrameNode> {
    const frame = figma.createFrame();

    // Set name
    if (rsnt.name) {
        frame.name = rsnt.name;
    }

    // Set layout mode
    frame.layoutMode = instructions.layoutMode;

    // Set dimensions if specified
    if (rsnt.width !== undefined) {
        frame.resize(rsnt.width, rsnt.height || 100);
    }
    if (rsnt.height !== undefined && rsnt.width === undefined) {
        frame.resize(frame.width, rsnt.height);
    }

    // Apply styling
    const { styling } = instructions;

    // Apply fills
    if (styling.fills) {
        frame.fills = styling.fills;
    }

    // Apply strokes
    if (styling.strokes) {
        frame.strokes = styling.strokes;
    }

    // Apply corner radius
    if (styling.cornerRadius !== undefined) {
        frame.cornerRadius = styling.cornerRadius;
    }

    // Apply padding
    if (styling.padding) {
        frame.paddingTop = styling.padding.top;
        frame.paddingRight = styling.padding.right;
        frame.paddingBottom = styling.padding.bottom;
        frame.paddingLeft = styling.padding.left;
    }

    // Apply variable bindings if present (Tier 3)
    if (instructions.variableBindings) {
        applyVariableBindings(frame, instructions.variableBindings);
    }

    return frame;
}

/**
 * Apply variable bindings to a frame
 */
function applyVariableBindings(
    frame: FrameNode,
    bindings: Record<string, string>
): void {
    for (const [property, variableId] of Object.entries(bindings)) {
        try {
            const variable = figma.variables.getVariableById(variableId);
            if (variable) {
                // Determine which property to bind
                // Note: Figma API has specific field names for variable bindings
                if (property === 'fill' || property === 'textFill' || property.includes('color')) {
                    // Bind variable to fill using boundVariables on the paint
                    try {
                        const currentFills = frame.fills;
                        if (currentFills !== figma.mixed && currentFills.length > 0) {
                            const existingColor = (currentFills[0] as SolidPaint).color || { r: 0, g: 0, b: 0 };
                            frame.fills = [{
                                type: 'SOLID',
                                color: existingColor,
                                boundVariables: {
                                    color: { type: 'VARIABLE_REF', variableId }
                                }
                            } as any];
                        } else {
                            frame.fills = [{
                                type: 'SOLID',
                                color: { r: 0, g: 0, b: 0, a: 1 },
                                boundVariables: {
                                    color: { type: 'VARIABLE_REF', variableId }
                                }
                            } as any];
                        }
                    } catch (e) {
                        console.warn('Could not bind fill variable:', e);
                    }
                } else if (property.includes('padding')) {
                    // Bind specific padding side
                    const side = property.replace('padding', '').toLowerCase();
                    const fieldName = `padding${side.charAt(0).toUpperCase() + side.slice(1)}` as any;
                    try {
                        frame.setBoundVariable(fieldName, variable);
                    } catch (e) {
                        console.warn(`Could not bind padding ${side}:`, e);
                    }
                } else if (property.includes('radius')) {
                    // Bind corner radius
                    try {
                        frame.setBoundVariable('topLeftRadius' as any, variable);
                    } catch (e) {
                        console.warn('Could not bind corner radius:', e);
                    }
                }
            }
        } catch (e) {
            console.warn(`Failed to bind variable ${variableId} to ${property}:`, e);
        }
    }
}

/**
 * Render RSNT with resolution results
 * This is an alternative entry point that uses pre-resolved instructions
 */
export async function renderWithResolution(
    resolutions: ResolutionResult[],
    parent?: BaseNode & ChildrenMixin,
    onProgress?: (progress: { current: number, total: number }) => void,
    shouldCancel?: () => boolean
): Promise<RenderResult> {
    const errors: RenderError[] = [];
    const warnings: RenderError[] = [];
    const createdNodes: SceneNode[] = [];

    // Process resolutions in chunks
    const processResolution = async (resolution: ResolutionResult, index: number) => {
        try {
            // Extract RSNT from resolution metadata
            // Note: This assumes the resolution includes the original RSNT
            // In practice, you'd need to pass both resolution and RSNT
            const rsnt = resolution.metadata as any; // Placeholder

            const figmaNode = await executeInstructions(resolution.instructions, rsnt);

            // Attach tier/confidence metadata
            figmaNode.setPluginData('resolutionTier', resolution.tier.toString());
            figmaNode.setPluginData('resolutionConfidence', resolution.confidence.toString());
            figmaNode.setPluginData('resolutionMethod', resolution.method);

            // Collect warnings
            for (const warning of resolution.warnings) {
                warnings.push(createRenderErrorUI(
                    createExecutionError(ErrorCode.PROPERTY_BINDING_FAILED),
                    rsnt.id || 'unknown',
                    'warning',
                    warning
                ));
            }

            createdNodes.push(figmaNode);

            // Attach to parent
            if (parent && 'appendChild' in parent) {
                parent.appendChild(figmaNode);
            }
        } catch (error: any) {
            console.error(`Error executing resolution ${index}:`, error);
            errors.push(createRenderErrorUI(
                error instanceof Error ? error : createExecutionError(ErrorCode.NODE_CREATION_FAILED, { error }),
                `resolution-${index}`,
                'error',
                'Failed to execute resolution instructions'
            ));
        }
    };

    try {
        await processInChunks(
            resolutions,
            25, // Chunk size
            processResolution,
            onProgress,
            shouldCancel
        );
    } catch (e: any) {
        if (e.message === 'Operation cancelled') {
            // Clean up created nodes
            for (const node of createdNodes) {
                if (!node.removed) {
                    node.remove();
                }
            }
            throw e;
        }
        throw e;
    }

    return {
        node: createdNodes[0] || null as any,
        errors,
        warnings
    };
}
// The function `resolvePropsAgainstDefinitions` was not found in the provided document.
// If you intended to add this function, please provide its full content.