/**
 * Component Anatomy Analysis
 * Analyzes the internal structure of components to determine their purpose
 */

export interface ComponentAnatomy {
    hasIcon: boolean;           // Contains component instance named "icon" or small square
    hasLabel: boolean;          // Contains TEXT node
    hasImage: boolean;          // Contains RECTANGLE with image fill
    hasContainer: boolean;      // Root is FRAME with children
    layerCount: number;         // Total descendant count
    textNodeCount: number;      // How many TEXT nodes
    instanceCount: number;      // How many component instances
    structureSignature: string; // Hash/string representing structure (e.g., "F>I+T")
    layoutInfo: LayoutInfo;
    dimensionInfo: DimensionInfo;
}

export interface LayoutInfo {
    mode: 'HORIZONTAL' | 'VERTICAL' | 'NONE';
    primaryAxisAlignItems: string;
    counterAxisAlignItems: string;
    itemSpacing: number;
    padding: {
        top: number;
        right: number;
        bottom: number;
        left: number;
    };
}

export interface DimensionInfo {
    width: number;
    height: number;
    aspectRatio: number;
    isResponsive: boolean;
}

export interface PatternMatch {
    pattern: string;
    confidence: number; // 0.0 to 1.0
}

export interface KnownPattern {
    name: string;
    hasIcon?: boolean;
    hasLabel?: boolean;
    hasContainer?: boolean;
    minHeight?: number;
    maxHeight?: number;
    containerType?: string[]; // 'HORIZONTAL', 'VERTICAL', 'NONE'
}

export const KNOWN_PATTERNS: KnownPattern[] = [
    {
        name: 'ActionableElement', // Button, Link, IconButton
        hasLabel: true, // Usually has text, but icon-only buttons exist (handled by loose match)
        minHeight: 32,
        maxHeight: 56,
        containerType: ['HORIZONTAL', 'VERTICAL'] // Flex containers
    },
    {
        name: 'InputElement',
        hasLabel: false, // Text in input is usually placeholder, often treated differently or hidden
        minHeight: 36,
        maxHeight: 48,
        containerType: ['HORIZONTAL', 'NONE']
    },
    {
        name: 'CardElement',
        hasContainer: true,
        // hasMultipleChildren: true, 
        containerType: ['VERTICAL', 'NONE'], // Cards are often vertical stacks
    }
];

// Abstraction for Figma nodes to allow testing without Figma env
export interface LayerNode {
    id: string;
    name: string;
    type: string;
    children?: LayerNode[];
    width: number;
    height: number;
    layoutMode?: 'HORIZONTAL' | 'VERTICAL' | 'NONE';
    primaryAxisAlignItems?: string;
    counterAxisAlignItems?: string;
    itemSpacing?: number;
    paddingTop?: number;
    paddingRight?: number;
    paddingBottom?: number;
    paddingLeft?: number;
    fills?: ReadonlyArray<any>;
    strokes?: ReadonlyArray<any>;
    mainComponent?: { name: string }; // For instances
}

/**
 * Analyze a component to extract its anatomy
 */
export function analyzeComponentAnatomy(node: LayerNode): ComponentAnatomy {
    const stats = {
        hasIcon: false,
        hasLabel: false,
        hasImage: false,
        layerCount: 0,
        textNodeCount: 0,
        instanceCount: 0,
        signatures: [] as string[]
    };

    // Helper to traverse and collect stats
    function traverse(current: LayerNode, depth: number = 0): string {
        stats.layerCount++;
        let mySig = abbreviationForType(current.type);

        // Icon detection
        if (current.type === 'INSTANCE' || current.type === 'COMPONENT') {
            const name = current.name.toLowerCase();
            const mainName = current.mainComponent?.name.toLowerCase() || '';
            const isSmall = current.width <= 32 && current.height <= 32;

            if (name.includes('icon') || mainName.includes('icon') || (isSmall && current.type === 'INSTANCE')) {
                stats.hasIcon = true;
            }
            stats.instanceCount++;
        }

        // Label detection
        if (current.type === 'TEXT') {
            stats.hasLabel = true;
            stats.textNodeCount++;
        }

        // Image detection (Rectangle with Image fill - simplified check)
        if (current.type === 'RECTANGLE' && hasImageFill(current)) {
            stats.hasImage = true;
        }

        // Recursive step
        if (current.children && current.children.length > 0) {
            const childSigs = current.children.map(child => traverse(child, depth + 1));
            if (childSigs.length > 0) {
                // Simplified signature: Parent>(Child1+Child2)
                mySig += `>(${childSigs.join('+')})`;
            }
        }

        return mySig;
    }

    // Start traversal
    // We don't count the root node itself as a child layer, but traverse does increment.
    // Adjust logic if strictly descendants needed.
    const signature = traverse(node);

    // Final Anatomy Object
    return {
        hasIcon: stats.hasIcon,
        hasLabel: stats.hasLabel,
        hasImage: stats.hasImage,
        hasContainer: (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') && (node.children?.length || 0) > 0,
        layerCount: stats.layerCount - 1, // Exclude self
        textNodeCount: stats.textNodeCount,
        instanceCount: stats.instanceCount,
        structureSignature: signature,
        layoutInfo: extractLayoutInfo(node),
        dimensionInfo: extractDimensionInfo(node)
    };
}

/**
 * Calculate match confidence for a pattern
 */
export function matchPatternConfidence(anatomy: ComponentAnatomy, pattern: KnownPattern): PatternMatch {
    let score = 0;
    let maxPossible = 0;

    // Baseline checks
    if (pattern.hasIcon !== undefined) {
        maxPossible += 30;
        if (anatomy.hasIcon === pattern.hasIcon) score += 30;
        else score -= 20;
    }

    if (pattern.hasLabel !== undefined) {
        maxPossible += 30;
        if (anatomy.hasLabel === pattern.hasLabel) score += 30;
        else score -= 20;
    }

    if (pattern.hasContainer !== undefined) {
        maxPossible += 10;
        if (anatomy.hasContainer === pattern.hasContainer) score += 10;
        else score -= 10;
    }

    // Dimension checks (Partial matches)
    if (pattern.minHeight || pattern.maxHeight) {
        maxPossible += 15;
        const h = anatomy.dimensionInfo.height;
        if ((!pattern.minHeight || h >= pattern.minHeight) &&
            (!pattern.maxHeight || h <= pattern.maxHeight)) {
            score += 15;
        } else if (pattern.minHeight && h < pattern.minHeight) {
            score -= 10;
        }
    }

    // Layout Mode check
    if (pattern.containerType) {
        maxPossible += 15;
        if (pattern.containerType.includes(anatomy.layoutInfo.mode)) {
            score += 15;
        }
    }

    // Normalize to 0-1
    if (maxPossible === 0) return { pattern: pattern.name, confidence: 0 };

    const confidence = Math.max(0, Math.min(1, score / maxPossible));

    return {
        pattern: pattern.name,
        confidence
    };
}


// --- Helpers ---

function abbreviationForType(type: string): string {
    const map: Record<string, string> = {
        'FRAME': 'F',
        'GROUP': 'G',
        'COMPONENT': 'C',
        'INSTANCE': 'I',
        'TEXT': 'T',
        'RECTANGLE': 'R',
        'VECTOR': 'V',
        'ELLIPSE': 'E',
        'LINE': 'L'
    };
    return map[type] || '?';
}

function hasImageFill(node: LayerNode): boolean {
    if (!node.fills) return false;
    // In Figma API, fills have type 'IMAGE'
    return node.fills.some((fill: any) => fill.type === 'IMAGE');
}

function extractLayoutInfo(node: LayerNode): LayoutInfo {
    return {
        mode: node.layoutMode || 'NONE',
        primaryAxisAlignItems: node.primaryAxisAlignItems || 'MIN',
        counterAxisAlignItems: node.counterAxisAlignItems || 'MIN',
        itemSpacing: node.itemSpacing || 0,
        padding: {
            top: node.paddingTop || 0,
            right: node.paddingRight || 0,
            bottom: node.paddingBottom || 0,
            left: node.paddingLeft || 0
        }
    };
}

function extractDimensionInfo(node: LayerNode): DimensionInfo {
    return {
        width: node.width,
        height: node.height,
        aspectRatio: node.height > 0 ? node.width / node.height : 0,
        isResponsive: (node.layoutMode !== 'NONE') // Simplified check
    };
}
