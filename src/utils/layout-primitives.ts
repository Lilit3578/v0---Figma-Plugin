/**
 * Utility to map RSNT layout primitives to Figma Auto Layout properties.
 */

/**
 * Applies Auto Layout settings to a Figma FrameNode based on a primitive string.
 * @param node The FrameNode to apply settings to.
 * @param primitive The layout primitive string (e.g., 'stack-v', 'flex-center').
 */
export function applyLayoutPrimitive(node: FrameNode, primitive: string): void {
    // Ensure we are in a layout mode to apply these properties
    // Defaulting to VERTICAL for most, as stack-v is the fallback

    switch (primitive) {
        case 'stack-v':
            node.layoutMode = 'VERTICAL';
            node.primaryAxisAlignItems = 'MIN';
            node.counterAxisAlignItems = 'MIN';
            break;

        case 'stack-v-center':
            node.layoutMode = 'VERTICAL';
            node.primaryAxisAlignItems = 'MIN';
            node.counterAxisAlignItems = 'CENTER';
            break;

        case 'stack-h':
            node.layoutMode = 'HORIZONTAL';
            node.primaryAxisAlignItems = 'MIN';
            node.counterAxisAlignItems = 'MIN';
            break;

        case 'stack-h-center':
            node.layoutMode = 'HORIZONTAL';
            node.primaryAxisAlignItems = 'CENTER';
            node.counterAxisAlignItems = 'CENTER';
            break;

        case 'flex-center':
            node.layoutMode = 'HORIZONTAL';
            node.primaryAxisAlignItems = 'CENTER';
            node.counterAxisAlignItems = 'CENTER';
            break;

        case 'flex-space-between':
            node.layoutMode = 'HORIZONTAL';
            node.primaryAxisAlignItems = 'SPACE_BETWEEN';
            node.counterAxisAlignItems = 'CENTER';
            break;

        default:
            // Default: stack-v
            node.layoutMode = 'VERTICAL';
            node.primaryAxisAlignItems = 'MIN';
            node.counterAxisAlignItems = 'MIN';
            break;
    }
}
