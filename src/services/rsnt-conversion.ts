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
        // Basic properties
        const rsnt: RSNT_Node = {
            id: node.name, // Use name as ID since we want semantic IDs if possible, or we'll map back
            type: this.mapType(node.type),
            name: node.name
        };

        // Type specific extractions
        if (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE') {
            const frameParams = node as FrameNode; // Cast for shared properties

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
                // Absolute positioning dimensions
                rsnt.width = frameParams.width;
                rsnt.height = frameParams.height;
            }

            // Styling
            rsnt.fills = this.extractFills(frameParams.fills);
            rsnt.strokes = this.extractStrokes(frameParams.strokes); // Requires adding extractStrokes if needed
            if (typeof frameParams.cornerRadius === 'number') {
                rsnt.cornerRadius = frameParams.cornerRadius;
            }

            // Instance specifics
            if (node.type === 'INSTANCE') {
                rsnt.type = 'COMPONENT_INSTANCE';
                rsnt.componentId = (node as InstanceNode).mainComponent?.id;
                // Properties could be extracted here if needed for exact variant matching
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
                    color: { r: fill.color.r, g: fill.color.g, b: fill.color.b }
                };
            }
            return null;
        }).filter(f => f) as any[]; // Type assertion for simplicity
    },

    extractStrokes(strokes: ReadonlyArray<Paint> | PluginAPI['mixed']): any[] | undefined {
        if (!strokes || strokes === figma.mixed || !Array.isArray(strokes)) return undefined;

        return strokes.map(stroke => {
            if (stroke.type === 'SOLID') {
                return {
                    type: 'SOLID',
                    color: { r: stroke.color.r, g: stroke.color.g, b: stroke.color.b }
                };
            }
            return null;
        }).filter(s => s) as any[];
    }
};
