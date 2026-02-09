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
    if (!node.componentId) {
        throw createExecutionError(ErrorCode.MISSING_REQUIRED_PROPERTY, { node: node.id }, 'Component instance missing componentId');
    }
    const component = figma.getNodeById(node.componentId);
    if (!component) {
        throw createResolutionError(ErrorCode.COMPONENT_NOT_FOUND, { componentId: node.componentId });
    }
    if (component.type !== 'COMPONENT' && component.type !== 'COMPONENT_SET') {
        throw createExecutionError(ErrorCode.NODE_CREATION_FAILED, { componentId: node.componentId, type: component.type }, `Node ${node.componentId} is not a component`);
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
            const mapped = propertyMappingService.applyMappingWithWarnings(node.componentId, propsForMapping);

            if (mapped.warnings.length > 0) {
                console.warn(`Property mapping for "${node.name || node.id}":`, mapped.warnings);
            }

            // Use mapped properties if the service produced any; otherwise fall back
            // to raw properties (handles cases where the AI used the actual prop names).
            const propsToSet = Object.keys(mapped.componentProperties).length > 0
                ? mapped.componentProperties
                : propsForMapping;

            if (Object.keys(propsToSet).length > 0) {
                // Resolve against the component's actual property definitions.
                // The AI frequently outputs generic semantic names (e.g. "variant")
                // instead of the real property names (e.g. "Style"). This step
                // matches by VALUE: if the AI says { variant: "primary" } and the
                // component has a "Style" property whose variantOptions include
                // "primary", it resolves to { Style: "primary" }.
                const resolved = resolvePropsAgainstDefinitions(
                    component as ComponentNode | ComponentSetNode, propsToSet
                );
                if (Object.keys(resolved).length > 0) {
                    instance.setProperties(resolved);
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

/**
 * Modular Property Appliers
 */

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
            fills.push({ type: 'SOLID', color: normalizeColor(fill.color) });
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
    if (!rsnt.strokes) return;
    figmaNode.strokes = rsnt.strokes.map(stroke => ({
        type: 'SOLID',
        color: normalizeColor(stroke.color)
    }));
    if ('strokeWeight' in figmaNode) {
        figmaNode.strokeWeight = (rsnt.strokes[0] as any).weight || 1;
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

function applyConstraints(figmaNode: any, rsnt: RSNT_Node) {
    if (rsnt.constraints) figmaNode.constraints = rsnt.constraints;
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

    for (const [key, value] of Object.entries(props)) {
        // Direct match — AI used the correct property name
        if (defs[key]) {
            resolved[key] = value;
            continue;
        }

        // Value-based match — find the VARIANT property that accepts this value
        let matched = false;
        for (const [propName, propDef] of Object.entries(defs)) {
            if (propDef.type === 'VARIANT' && propDef.variantOptions?.includes(value)) {
                if (!resolved[propName]) {
                    resolved[propName] = value;
                    matched = true;
                    console.log(`  Resolved property "${key}: ${value}" → "${propName}: ${value}"`);
                }
                break;
            }
        }

        if (!matched) {
            console.warn(`  Could not resolve property "${key}: ${value}" — no matching definition`);
        }
    }

    return resolved;
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