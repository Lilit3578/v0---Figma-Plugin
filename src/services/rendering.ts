import { RSNT_Node } from '../types/rsnt';
import { normalizeColor } from '../libs/utils';

/**
 * Render RSNT node to Figma
 */
export async function renderRSNT(node: RSNT_Node, parent?: BaseNode & ChildrenMixin): Promise<SceneNode> {

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
                fills.push({
                    type: 'SOLID',
                    color: normalizeColor(fill.color)
                });
            } else if (fill.type === 'VARIABLE' && fill.variableId) {
                // Bind variable to fill
                try {
                    const variable = figma.variables.getVariableById(fill.variableId);
                    if (variable) {
                        const solidFill: SolidPaint = {
                            type: 'SOLID',
                            color: { r: 0, g: 0, b: 0 }, // Placeholder, will be replaced by variable
                        };
                        fills.push(solidFill);

                        // Bind the variable after setting fills
                        figmaNode.fills = fills;
                        (figmaNode as any).setBoundVariable('fills', variable);
                    }
                } catch (error) {
                    console.warn('Failed to bind fill variable:', fill.variableId, error);
                }
            }
        }

        if (fills.length > 0 && !node.fills.some(f => f.type === 'VARIABLE')) {
            figmaNode.fills = fills;
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

    // Render children recursively
    if (node.children && 'appendChild' in figmaNode) {
        for (const child of node.children) {
            const childNode = await renderRSNT(child, figmaNode);
            figmaNode.appendChild(childNode);
        }
    }

    // Apply constraints
    if (node.constraints && 'constraints' in figmaNode) {
        figmaNode.constraints = node.constraints;
    }

    // Add to parent if provided
    if (parent && 'appendChild' in parent) {
        parent.appendChild(figmaNode);
    }

    return figmaNode;
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

    // Apply layout mode
    if (node.layoutMode) {
        frame.layoutMode = node.layoutMode;
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

    // Load font
    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });

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