import { RSNT_Node } from '../types/rsnt';
import { normalizeColor } from '../libs/utils';
import { RenderResult, RenderError, createRenderErrorUI, createExecutionError, createResolutionError, ErrorCode } from '../types/errors';
import { fontManager } from './font-manager';
import { processInChunks } from '../utils/chunking';

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

async function renderComponentInstance(node: RSNT_Node): Promise<InstanceNode> {
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
    if (node.properties) {
        try {
            instance.setProperties(node.properties);
        } catch (error) {
            console.warn('Failed to set some properties:', error);
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
            const value = resolveVariable(fill.variableId, 'COLOR');
            if (value && typeof value === 'object' && 'r' in value) {
                fills.push({ type: 'SOLID', color: { r: value.r, g: value.g, b: value.b } });
            } else {
                fills.push({ type: 'SOLID', color: { r: 1, g: 1, b: 1 } });
                warnings.push(createRenderErrorUI(createExecutionError(ErrorCode.VARIABLE_NOT_FOUND), rsnt.id, 'warning', 'Variable fallback applied'));
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

function applyLayout(figmaNode: any, rsnt: RSNT_Node) {
    if (rsnt.layoutMode) figmaNode.layoutMode = rsnt.layoutMode;
    if (rsnt.primaryAxisSizingMode) figmaNode.primaryAxisSizingMode = rsnt.primaryAxisSizingMode;
    if (rsnt.counterAxisSizingMode) figmaNode.counterAxisSizingMode = rsnt.counterAxisSizingMode;
    if (rsnt.primaryAxisAlignItems) figmaNode.primaryAxisAlignItems = rsnt.primaryAxisAlignItems;
    if (rsnt.counterAxisAlignItems) figmaNode.counterAxisAlignItems = rsnt.counterAxisAlignItems;

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