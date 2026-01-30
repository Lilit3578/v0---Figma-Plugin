import { RSNT_Node } from '../types/rsnt';
import { normalizeColor } from '../libs/utils';
import { RenderResult, RenderError, createRenderError } from '../types/errors';
import { fontManager } from './font-manager';

/**
 * Render RSNT node to Figma
 * Returns RenderResult with node and any errors/warnings encountered
 */
export async function renderRSNT(node: RSNT_Node, parent?: BaseNode & ChildrenMixin): Promise<RenderResult> {
    const errors: RenderError[] = [];
    const warnings: RenderError[] = [];

    let figmaNode: SceneNode;

    // Create node based on type
    switch (node.type) {
        case 'COMPONENT_INSTANCE':
            figmaNode = await renderComponentInstance(node);
            break;

        case 'FRAME':
            figmaNode = await renderFrame(node);
            break;

        case 'TEXT':
            figmaNode = await renderText(node);
            break;

        default:
            throw new Error(`Unknown node type: ${node.type}`);
    }

    // Set name
    if (node.name) {
        figmaNode.name = node.name;
    }

    // Apply fills
    if (node.fills && 'fills' in figmaNode) {
        const fills: Paint[] = [];

        for (const fill of node.fills) {
            if (fill.type === 'SOLID' && fill.color) {
                // CRITICAL: Validate color values exist before normalizing
                const { r, g, b } = fill.color;

                if (r === undefined || g === undefined || b === undefined) {
                    warnings.push(createRenderError(
                        new Error(`Color has undefined values: r=${r}, g=${g}, b=${b}`),
                        node.id,
                        'warning',
                        'Skipped invalid fill - color values cannot be undefined'
                    ));
                    continue; // Skip this fill
                }

                const normalizedColor = normalizeColor(fill.color);

                // Validate color values after normalization
                if (!isNaN(normalizedColor.r) && !isNaN(normalizedColor.g) && !isNaN(normalizedColor.b)) {
                    fills.push({
                        type: 'SOLID',
                        color: normalizedColor
                    });
                } else {
                    warnings.push(createRenderError(
                        new Error(`Invalid color values after normalization: ${JSON.stringify(fill.color)}`),
                        node.id,
                        'warning',
                        'Skipped invalid fill'
                    ));
                }
            } else if (fill.type === 'VARIABLE' && fill.variableId) {
                // For variable fills, we need to use a different approach
                try {
                    const variable = figma.variables.getVariableById(fill.variableId);
                    if (variable && variable.resolvedType === 'COLOR') {
                        // Get the actual color value from the variable
                        const collection = figma.variables.getVariableCollectionById(variable.variableCollectionId);
                        const defaultMode = collection?.defaultModeId || Object.keys(variable.valuesByMode)[0];
                        const colorValue = variable.valuesByMode[defaultMode];

                        if (colorValue && typeof colorValue === 'object' && 'r' in colorValue) {
                            // Use the variable's color value directly
                            fills.push({
                                type: 'SOLID',
                                color: {
                                    r: colorValue.r,
                                    g: colorValue.g,
                                    b: colorValue.b
                                }
                            });
                            console.log('Applied color from variable:', variable.name);
                        } else {
                            warnings.push(createRenderError(
                                new Error(`Variable ${variable.name} has invalid color value`),
                                node.id,
                                'warning',
                                'Applied white fallback'
                            ));
                            fills.push({
                                type: 'SOLID',
                                color: { r: 1, g: 1, b: 1 } // White fallback
                            });
                        }
                    } else {
                        warnings.push(createRenderError(
                            new Error(`Variable ${fill.variableId} not found or not a color`),
                            node.id,
                            'warning',
                            'Applied white fallback'
                        ));
                        // Fallback to a default color
                        fills.push({
                            type: 'SOLID',
                            color: { r: 1, g: 1, b: 1 } // White fallback
                        });
                    }
                } catch (error: any) {
                    errors.push(createRenderError(
                        error,
                        node.id,
                        'error',
                        'Applied white fallback color'
                    ));
                    // Fallback to a default color
                    fills.push({
                        type: 'SOLID',
                        color: { r: 1, g: 1, b: 1 } // White fallback
                    });
                }
            }
        }

        // Apply fills if we have any
        if (fills.length > 0) {
            figmaNode.fills = fills;
        } else {
            // No valid fills, set to empty (transparent)
            figmaNode.fills = [];
        }
    }

    // Apply strokes
    if (node.strokes && 'strokes' in figmaNode) {
        figmaNode.strokes = node.strokes.map(stroke => ({
            type: 'SOLID',
            color: normalizeColor(stroke.color)
        }));
        if ('strokeWeight' in figmaNode) {
            figmaNode.strokeWeight = (node.strokes[0] as any).weight || 1;
        }
    }

    // Apply corner radius
    if (node.cornerRadius !== undefined && 'cornerRadius' in figmaNode) {
        if (typeof node.cornerRadius === 'number') {
            figmaNode.cornerRadius = node.cornerRadius;
        } else if (node.cornerRadius.variableId) {
            // Bind variable for corner radius - Note: topLeftRadius, topRightRadius, etc. are bindable
            // But 'cornerRadius' uniform value is NOT directly bindable
            // We need to set the numeric value from the variable
            try {
                const variable = figma.variables.getVariableById(node.cornerRadius.variableId);
                if (variable) {
                    // Get the variable value
                    const collection = figma.variables.getVariableCollectionById(variable.variableCollectionId);
                    const defaultMode = collection?.defaultModeId || Object.keys(variable.valuesByMode)[0];
                    const value = variable.valuesByMode[defaultMode];

                    if (typeof value === 'number') {
                        figmaNode.cornerRadius = value;
                    } else {
                        console.warn('Corner radius variable is not a number:', value);
                    }
                }
            } catch (error) {
                console.warn('Failed to apply corner radius variable:', error);
            }
        }
    }

    // Render children recursively (but NOT for component instances)
    if (node.children && 'appendChild' in figmaNode && figmaNode.type !== 'INSTANCE') {
        for (const child of node.children) {
            const childResult = await renderRSNT(child, figmaNode);
            figmaNode.appendChild(childResult.node);
            // Aggregate child errors
            errors.push(...childResult.errors);
            warnings.push(...childResult.warnings);
        }
    } else if (node.children && figmaNode.type === 'INSTANCE') {
        warnings.push(createRenderError(
            new Error('Component instances cannot have children'),
            node.id,
            'warning',
            'Ignored children for component instance'
        ));
    }

    // Apply constraints
    if (node.constraints && 'constraints' in figmaNode) {
        figmaNode.constraints = node.constraints;
    }

    // Add to parent if provided
    if (parent && 'appendChild' in parent) {
        parent.appendChild(figmaNode);
    }

    return {
        node: figmaNode,
        errors,
        warnings
    };
}

/**
 * Render component instance
 */
async function renderComponentInstance(node: RSNT_Node): Promise<InstanceNode> {
    if (!node.componentId) {
        throw new Error('Component instance missing componentId');
    }

    const component = figma.getNodeById(node.componentId);

    if (!component) {
        throw new Error(`Component not found: ${node.componentId}`);
    }

    if (component.type !== 'COMPONENT' && component.type !== 'COMPONENT_SET') {
        throw new Error(`Node ${node.componentId} is not a component`);
    }

    const instance = component.type === 'COMPONENT_SET'
        ? (component as ComponentSetNode).defaultVariant.createInstance()
        : (component as ComponentNode).createInstance();

    // Set variant properties
    if (node.properties) {
        try {
            instance.setProperties(node.properties);
        } catch (error) {
            console.warn('Failed to set some properties:', error);
        }
    }

    return instance;
}

/**
 * Render frame
 */
async function renderFrame(node: RSNT_Node): Promise<FrameNode> {
    const frame = figma.createFrame();

    // Apply explicit sizing
    if (node.width !== undefined) {
        frame.resize(node.width, node.height || 100);
    }
    if (node.height !== undefined && node.width === undefined) {
        frame.resize(frame.width, node.height);
    }

    // Apply layout mode
    if (node.layoutMode) {
        frame.layoutMode = node.layoutMode;
    }

    // Apply sizing modes for auto-layout
    if (node.primaryAxisSizingMode) {
        frame.primaryAxisSizingMode = node.primaryAxisSizingMode;
    }
    if (node.counterAxisSizingMode) {
        frame.counterAxisSizingMode = node.counterAxisSizingMode;
    }

    // Apply alignment
    if (node.primaryAxisAlignItems) {
        frame.primaryAxisAlignItems = node.primaryAxisAlignItems;
    }
    if (node.counterAxisAlignItems) {
        frame.counterAxisAlignItems = node.counterAxisAlignItems;
    }

    // Apply item spacing
    if (node.itemSpacing !== undefined) {
        if (typeof node.itemSpacing === 'number') {
            frame.itemSpacing = node.itemSpacing;
        } else if (node.itemSpacing.variableId) {
            try {
                const variable = figma.variables.getVariableById(node.itemSpacing.variableId);
                if (variable) {
                    frame.setBoundVariable('itemSpacing', variable);
                }
            } catch (error) {
                console.warn('Failed to bind itemSpacing variable:', error);
            }
        }
    }

    // Apply padding
    if (node.padding) {
        const applyPadding = (side: 'top' | 'right' | 'bottom' | 'left', value: number | { variableId: string } | undefined) => {
            if (value === undefined) return;

            const paddingProp = `padding${side.charAt(0).toUpperCase() + side.slice(1)}` as 'paddingTop' | 'paddingRight' | 'paddingBottom' | 'paddingLeft';

            if (typeof value === 'number') {
                frame[paddingProp] = value;
            } else if (value.variableId) {
                try {
                    const variable = figma.variables.getVariableById(value.variableId);
                    if (variable) {
                        frame.setBoundVariable(paddingProp, variable);
                    }
                } catch (error) {
                    console.warn(`Failed to bind ${paddingProp} variable:`, error);
                }
            }
        };

        applyPadding('top', node.padding.top);
        applyPadding('right', node.padding.right);
        applyPadding('bottom', node.padding.bottom);
        applyPadding('left', node.padding.left);
    }

    return frame;
}

/**
 * Render text node
 */
async function renderText(node: RSNT_Node): Promise<TextNode> {
    const text = figma.createText();

    // Load font dynamically using FontManager
    const font = await fontManager.getFontForNode(
        node.fontFamily,
        node.fontStyle
    );

    text.fontName = font;

    // Set text
    if (node.characters) {
        text.characters = node.characters;
    }

    // Set font size
    if (node.fontSize) {
        text.fontSize = node.fontSize;
    }

    return text;
}