/**
 * RSNT Conversion Service
 * Converts Figma SceneNodes back to RSNT_Node JSON for AI context
 */

import { RSNT_Node, NodeType } from '../types/rsnt';

export const rsntConversionService = {
    /**
     * Convert a Figma node to RSNT_Node
     */
    convertNodeToRSNT(node: SceneNode): RSNT_Node {
        // Basic properties — use Figma's stable node ID for reliable targeting
        const rsnt: RSNT_Node = {
            id: node.id,
            type: this.mapType(node.type),
            name: node.name
        };

        // Type specific extractions
        if (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE') {
            const frameParams = node as FrameNode; // Cast for shared properties

            // ALWAYS capture actual dimensions — the AI needs these for spatial reasoning
            // regardless of layout mode
            rsnt.width = frameParams.width;
            rsnt.height = frameParams.height;

            // Layout Info
            // Map Figma layoutMode to RSNT layoutMode
            if (frameParams.layoutMode === 'HORIZONTAL' || frameParams.layoutMode === 'VERTICAL') {
                rsnt.layoutMode = frameParams.layoutMode;
            } else {
                rsnt.layoutMode = 'NONE';
            }

            if (frameParams.layoutMode !== 'NONE') {
                rsnt.primaryAxisSizingMode = frameParams.primaryAxisSizingMode;
                rsnt.counterAxisSizingMode = frameParams.counterAxisSizingMode;
                // Check for BASELINE (not supported in RSNT) - casting to any to avoid type overlap error if types are strict
                const pAlign = frameParams.primaryAxisAlignItems as string;
                const cAlign = frameParams.counterAxisAlignItems as string;

                rsnt.primaryAxisAlignItems = (pAlign === 'BASELINE') ? 'MIN' : frameParams.primaryAxisAlignItems as any;
                rsnt.counterAxisAlignItems = (cAlign === 'BASELINE') ? 'MIN' : frameParams.counterAxisAlignItems as any;
                rsnt.itemSpacing = frameParams.itemSpacing;

                rsnt.padding = {
                    top: frameParams.paddingTop,
                    right: frameParams.paddingRight,
                    bottom: frameParams.paddingBottom,
                    left: frameParams.paddingLeft
                };
            } else {
                // Extract constraints for non-auto-layout frames (moved up from below)
                rsnt.constraints = {
                    horizontal: frameParams.constraints.horizontal,
                    vertical: frameParams.constraints.vertical
                };
            }

            // Advanced Styling
            rsnt.fills = this.extractFills(frameParams.fills);
            rsnt.strokes = this.extractStrokes(frameParams); // Pass the node to extract strokes and their weights
            if (typeof frameParams.cornerRadius === 'number') {
                rsnt.cornerRadius = frameParams.cornerRadius;
            }
            if (typeof frameParams.strokeWeight === 'number') {
                rsnt.strokeWeight = frameParams.strokeWeight;
            }

            // Extract Effects (Shadows, Blurs)
            rsnt.effects = this.extractEffects(frameParams.effects);

            // Extract Layer Properties
            rsnt.opacity = frameParams.opacity;
            rsnt.blendMode = frameParams.blendMode as any;
            rsnt.visible = frameParams.visible;

            // Instance specifics
            if (node.type === 'INSTANCE') {
                rsnt.type = 'COMPONENT_INSTANCE';
                const instance = node as InstanceNode;
                const mainComponent = instance.mainComponent;

                try {
                    // Extract component properties
                    const rsntProps: Record<string, string> = {};
                    console.log(`[Extraction] Properties for instance "${instance.name}":`, instance.componentProperties);
                    for (const [key, value] of Object.entries(instance.componentProperties)) {
                        // Normalize the key to be more AI-friendly
                        const normalizedKey = key.split('#')[0].trim().toLowerCase();
                        rsntProps[normalizedKey] = String(value.value);
                    }
                    rsnt.properties = rsntProps;
                    console.log(`[Extraction]   - Normalized props:`, rsntProps);
                } catch (e) {
                    console.warn(`Failed to extract properties for ${instance.name}`, e);
                }

                // If the main component is a variant, use the parent (Component Set) as the componentId
                // because that's what we discovered and mapped.
                if (mainComponent?.parent?.type === 'COMPONENT_SET') {
                    rsnt.componentId = mainComponent.parent.id;
                    rsnt.componentKey = mainComponent.parent.key;
                } else {
                    rsnt.componentId = mainComponent?.id;
                    rsnt.componentKey = mainComponent?.key;
                }
            }

            // Recursion for children (unless it's an instance, which we treat as atomic for RSNT usually)
            // BUT for "modification" we might want to see inside if we are "detaching" or modifying structure.
            // However, the rule says INSTANCE nodes are atomic.
            if (node.type !== 'INSTANCE' && 'children' in node) {
                rsnt.children = (node as FrameNode).children.map(child => this.convertNodeToRSNT(child));
            }
        } else if (node.type === 'TEXT') {
            const text = node as TextNode;
            rsnt.characters = text.characters;
            rsnt.fontSize = text.fontSize as number; // Assuming single font size
            // Font Name extraction could go here
            // Extract Layer Properties for Text too
            rsnt.opacity = text.opacity;
            rsnt.blendMode = text.blendMode as any;
            rsnt.visible = text.visible;
            rsnt.effects = this.extractEffects(text.effects);

            if (text.parent && (text.parent as FrameNode).layoutMode === 'NONE') {
                rsnt.constraints = {
                    horizontal: text.constraints.horizontal,
                    vertical: text.constraints.vertical
                };
            }

            rsnt.fills = this.extractFills(text.fills);
        }

        return rsnt;
    },

    mapType(figmaType: string): NodeType {
        switch (figmaType) {
            case 'INSTANCE': return 'COMPONENT_INSTANCE';
            case 'TEXT': return 'TEXT';
            case 'FRAME':
            case 'COMPONENT':
            case 'COMPONENT_SET':
            case 'GROUP': // Map groups to frames for RSNT simplicity usually
                return 'FRAME';
            default: return 'FRAME'; // Default fallback
        }
    },

    extractFills(fills: ReadonlyArray<Paint> | PluginAPI['mixed']): any[] | undefined {
        if (!fills || fills === figma.mixed || !Array.isArray(fills)) return undefined;

        return fills.map(fill => {
            if (fill.type === 'SOLID') {
                return {
                    type: 'SOLID',
                    color: { r: fill.color.r, g: fill.color.g, b: fill.color.b },
                    opacity: fill.opacity // Capture fill opacity if present
                };
            }
            return null;
        }).filter(f => f) as any[]; // Type assertion for simplicity
    },

    extractStrokes(node: any): any[] | undefined {
        const strokes = node.strokes;
        if (!strokes || strokes === figma.mixed || !Array.isArray(strokes)) return undefined;
        const weight = node.strokeWeight;

        return strokes.map(stroke => {
            if (stroke.type === 'SOLID') {
                return {
                    type: 'SOLID',
                    color: { r: stroke.color.r, g: stroke.color.g, b: stroke.color.b },
                    opacity: stroke.opacity,
                    weight: typeof weight === 'number' ? weight : 1
                };
            }
            return null;
        }).filter(s => s) as any[];
    },

    extractEffects(effects: ReadonlyArray<Effect> | PluginAPI['mixed']): any[] | undefined {
        if (!effects || effects === figma.mixed || !Array.isArray(effects)) return undefined;

        return effects.map(effect => {
            if (!effect.visible) return { ...effect, visible: false }; // Keep invisible effects for completeness or skip? Let's keep.

            if (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') {
                return {
                    type: effect.type,
                    color: effect.color,
                    offset: effect.offset,
                    radius: effect.radius,
                    spread: effect.spread,
                    visible: effect.visible,
                    blendMode: effect.blendMode
                };
            } else if (effect.type === 'LAYER_BLUR' || effect.type === 'BACKGROUND_BLUR') {
                return {
                    type: effect.type,
                    radius: effect.radius,
                    visible: effect.visible
                };
            }
            return null;
        }).filter(e => e) as any[];
    }
};
