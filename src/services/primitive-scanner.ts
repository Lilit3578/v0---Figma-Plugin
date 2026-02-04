/**
 * Primitive Scanner Service
 * 
 * Scans entire Figma file for primitive values (colors, spacing, radii)
 * and provides frequency-weighted proximity matching for Tier 4 fallback.
 */

import { RGB, rgbToHex, hexToRGB, rgbToCIELAB, calculateDeltaE } from '../libs/color-utils';

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Aggregated primitive values with frequency counts
 */
export interface PrimitiveInventory {
    colors: Map<string, number>;      // hex -> usage count
    spacing: Map<number, number>;     // px value -> usage count
    radii: Map<number, number>;       // px value -> usage count
}

/**
 * Color proximity match result
 */
export interface ColorMatch {
    color: string;           // hex color
    deltaE: number;          // perceptual difference
    frequency: number;       // usage count in file
    confidence: number;      // 0.0-1.0
}

/**
 * Spacing proximity match result
 */
export interface SpacingMatch {
    value: number;           // px value
    distance: number;        // absolute difference from target
    frequency: number;       // usage count in file
    confidence: number;      // 0.0-1.0
}

/**
 * Radius proximity match result
 */
export interface RadiusMatch {
    value: number;           // px value
    distance: number;        // absolute difference from target
    frequency: number;       // usage count in file
    confidence: number;      // 0.0-1.0
}

/**
 * Cache for primitive inventory
 */
interface PrimitiveCache {
    fileKey: string;
    lastModified: number;
    inventory: PrimitiveInventory;
}

// ============================================================================
// CACHE
// ============================================================================

let primitiveCache: PrimitiveCache | null = null;

/**
 * Get cached primitive inventory or scan file if cache invalid
 */
export async function getCachedPrimitiveInventory(): Promise<PrimitiveInventory> {
    const currentFileKey = figma.fileKey || 'unknown';
    const currentModified = Date.now(); // Figma doesn't expose lastModified reliably

    // Check cache validity
    if (
        primitiveCache &&
        primitiveCache.fileKey === currentFileKey
    ) {
        console.log('[Primitive Scanner] Using cached inventory');
        return primitiveCache.inventory;
    }

    // Scan file
    console.log('[Primitive Scanner] Scanning file for primitives...');
    const startTime = Date.now();
    const inventory = await buildPrimitiveInventory();
    const elapsed = Date.now() - startTime;
    console.log(`[Primitive Scanner] Scan complete in ${elapsed}ms`);
    console.log(`[Primitive Scanner] Found ${inventory.colors.size} colors, ${inventory.spacing.size} spacing values, ${inventory.radii.size} radii`);

    // Update cache
    primitiveCache = {
        fileKey: currentFileKey,
        lastModified: currentModified,
        inventory
    };

    return inventory;
}

/**
 * Invalidate cache (call when file structure changes)
 */
export function invalidatePrimitiveCache(): void {
    primitiveCache = null;
    console.log('[Primitive Scanner] Cache invalidated');
}

// ============================================================================
// SCANNING FUNCTIONS
// ============================================================================

/**
 * Scan file for all colors (fills and strokes)
 * Returns map of hex color -> usage count
 */
export function scanFileForColors(): Map<string, number> {
    const colorFrequency = new Map<string, number>();

    function traverseNode(node: SceneNode) {
        // Extract fills
        if ('fills' in node && Array.isArray(node.fills)) {
            for (const fill of node.fills) {
                if (fill.type === 'SOLID' && fill.color) {
                    const hex = rgbToHex(fill.color);
                    colorFrequency.set(hex, (colorFrequency.get(hex) || 0) + 1);
                }
            }
        }

        // Extract strokes
        if ('strokes' in node && Array.isArray(node.strokes)) {
            for (const stroke of node.strokes) {
                if (stroke.type === 'SOLID' && stroke.color) {
                    const hex = rgbToHex(stroke.color);
                    colorFrequency.set(hex, (colorFrequency.get(hex) || 0) + 1);
                }
            }
        }

        // Recurse into children
        if ('children' in node) {
            for (const child of node.children) {
                traverseNode(child);
            }
        }
    }

    // Scan all pages
    for (const page of figma.root.children) {
        // Traverse page children (PageNode contains SceneNodes)
        for (const child of page.children) {
            traverseNode(child);
        }
    }

    return colorFrequency;
}

/**
 * Scan file for all spacing values (padding and itemSpacing)
 * Returns map of px value -> usage count
 */
export function scanFileForSpacing(): Map<number, number> {
    const spacingFrequency = new Map<number, number>();

    function traverseNode(node: SceneNode) {
        // Extract spacing from Auto Layout nodes
        if ('layoutMode' in node && node.layoutMode !== 'NONE') {
            const values = [
                node.paddingTop,
                node.paddingRight,
                node.paddingBottom,
                node.paddingLeft,
                node.itemSpacing
            ];

            for (const val of values) {
                if (typeof val === 'number' && val > 0) {
                    // Round to nearest integer (ignore sub-pixel values)
                    const rounded = Math.round(val);
                    spacingFrequency.set(rounded, (spacingFrequency.get(rounded) || 0) + 1);
                }
            }
        }

        // Recurse into children
        if ('children' in node) {
            for (const child of node.children) {
                traverseNode(child);
            }
        }
    }

    // Scan all pages
    for (const page of figma.root.children) {
        // Traverse page children (PageNode contains SceneNodes)
        for (const child of page.children) {
            traverseNode(child);
        }
    }

    return spacingFrequency;
}

/**
 * Scan file for all corner radii
 * Returns map of px value -> usage count
 */
export function scanFileForRadii(): Map<number, number> {
    const radiusFrequency = new Map<number, number>();

    function traverseNode(node: SceneNode) {
        // Extract corner radius
        if ('cornerRadius' in node) {
            if (typeof node.cornerRadius === 'number' && node.cornerRadius > 0) {
                // Uniform radius
                radiusFrequency.set(node.cornerRadius, (radiusFrequency.get(node.cornerRadius) || 0) + 1);
            } else if (typeof node.cornerRadius === 'symbol') {
                // Mixed radii - check if properties exist
                if ('topLeftRadius' in node && 'topRightRadius' in node &&
                    'bottomLeftRadius' in node && 'bottomRightRadius' in node) {
                    const radii = [
                        node.topLeftRadius,
                        node.topRightRadius,
                        node.bottomLeftRadius,
                        node.bottomRightRadius
                    ];

                    for (const r of radii) {
                        if (typeof r === 'number' && r > 0) {
                            radiusFrequency.set(r, (radiusFrequency.get(r) || 0) + 1);
                        }
                    }
                }
            }
        }

        // Recurse into children
        if ('children' in node) {
            for (const child of node.children) {
                traverseNode(child);
            }
        }
    }

    // Scan all pages
    for (const page of figma.root.children) {
        // Traverse page children (PageNode contains SceneNodes)
        for (const child of page.children) {
            traverseNode(child);
        }
    }

    return radiusFrequency;
}

/**
 * Build complete primitive inventory by aggregating all scans
 */
export async function buildPrimitiveInventory(): Promise<PrimitiveInventory> {
    const colors = scanFileForColors();
    const spacing = scanFileForSpacing();
    const radii = scanFileForRadii();

    return {
        colors,
        spacing,
        radii
    };
}

// ============================================================================
// PROXIMITY MATCHING
// ============================================================================

/**
 * Find closest color using CIELAB Delta E
 * Only considers colors within ΔE < 10 threshold
 * Prefers frequently-used colors via weighting
 */
export function findClosestColor(
    targetHex: string,
    inventory: Map<string, number>
): ColorMatch | null {
    if (inventory.size === 0) return null;

    const targetLab = rgbToCIELAB(hexToRGB(targetHex));

    let bestMatch: ColorMatch | null = null;
    let minWeightedDeltaE = Infinity;
    let maxFrequency = 0;

    // Find max frequency for boost calculation
    for (const frequency of inventory.values()) {
        if (frequency > maxFrequency) {
            maxFrequency = frequency;
        }
    }

    for (const [hex, frequency] of inventory.entries()) {
        const candidateLab = rgbToCIELAB(hexToRGB(hex));
        const deltaE = calculateDeltaE(targetLab, candidateLab);

        // Filter: only consider ΔE < 10
        if (deltaE >= 10) continue;

        // Frequency weighting: prefer commonly-used colors
        // Use logarithmic weighting to avoid over-weighting high-frequency colors
        const weightedDeltaE = deltaE / Math.log(frequency + 2);

        if (weightedDeltaE < minWeightedDeltaE) {
            minWeightedDeltaE = weightedDeltaE;
            bestMatch = {
                color: hex,
                deltaE,
                frequency,
                confidence: calculateColorConfidence(deltaE, frequency, maxFrequency)
            };
        }
    }

    return bestMatch;
}

/**
 * Calculate confidence score for color match
 * Based on Delta E and frequency
 */
function calculateColorConfidence(deltaE: number, frequency: number, maxFrequency: number): number {
    // Base confidence from Delta E
    let confidence = 0;
    if (deltaE < 2) {
        confidence = 0.80;      // Very close
    } else if (deltaE < 5) {
        confidence = 0.60;      // Acceptable
    } else if (deltaE < 10) {
        confidence = 0.40;      // Noticeable difference
    } else {
        return 0;               // Too different
    }

    // Frequency boost
    if (frequency >= 20) {
        confidence += 0.05;
    }

    // Most frequent boost
    if (frequency === maxFrequency && maxFrequency > 1) {
        confidence += 0.10;
    }

    return Math.min(confidence, 1.0);
}

/**
 * Find closest spacing value
 * Prefers exact matches, then close matches, then distant matches
 * Frequency-weighted
 */
export function findClosestSpacing(
    targetValue: number,
    inventory: Map<number, number>
): SpacingMatch | null {
    if (inventory.size === 0) return null;

    let bestMatch: SpacingMatch | null = null;
    let minWeightedDistance = Infinity;
    let maxFrequency = 0;

    // Find max frequency for boost calculation
    for (const frequency of inventory.values()) {
        if (frequency > maxFrequency) {
            maxFrequency = frequency;
        }
    }

    for (const [value, frequency] of inventory.entries()) {
        const distance = Math.abs(value - targetValue);

        // Frequency weighting
        const weightedDistance = distance / Math.log(frequency + 2);

        if (weightedDistance < minWeightedDistance) {
            minWeightedDistance = weightedDistance;
            bestMatch = {
                value,
                distance,
                frequency,
                confidence: calculateSpacingConfidence(distance, frequency, maxFrequency)
            };
        }
    }

    return bestMatch;
}

/**
 * Calculate confidence score for spacing match
 * Based on distance and frequency
 */
function calculateSpacingConfidence(distance: number, frequency: number, maxFrequency: number): number {
    let confidence = 0;

    // Base confidence from distance
    if (distance === 0) {
        confidence = 0.90;      // Exact match
    } else if (distance <= 4) {
        confidence = 0.70;      // Close match (±4px)
    } else if (distance <= 8) {
        confidence = 0.50;      // Distant match (±8px)
    } else {
        confidence = 0.30;      // Very distant
    }

    // Frequency boost
    if (frequency >= 20) {
        confidence += 0.05;
    }

    // Most frequent boost
    if (frequency === maxFrequency && maxFrequency > 1) {
        confidence += 0.05;
    }

    return Math.min(confidence, 1.0);
}

/**
 * Find closest radius value
 * Same algorithm as spacing
 */
export function findClosestRadius(
    targetValue: number,
    inventory: Map<number, number>
): RadiusMatch | null {
    if (inventory.size === 0) return null;

    let bestMatch: RadiusMatch | null = null;
    let minWeightedDistance = Infinity;
    let maxFrequency = 0;

    // Find max frequency for boost calculation
    for (const frequency of inventory.values()) {
        if (frequency > maxFrequency) {
            maxFrequency = frequency;
        }
    }

    for (const [value, frequency] of inventory.entries()) {
        const distance = Math.abs(value - targetValue);

        // Frequency weighting
        const weightedDistance = distance / Math.log(frequency + 2);

        if (weightedDistance < minWeightedDistance) {
            minWeightedDistance = weightedDistance;
            bestMatch = {
                value,
                distance,
                frequency,
                confidence: calculateSpacingConfidence(distance, frequency, maxFrequency)
            };
        }
    }

    return bestMatch;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate approximation warning message for color
 */
export function generateColorWarning(target: string, match: ColorMatch): string {
    return `Color approximated: using ${match.color} instead of ${target} (ΔE = ${match.deltaE.toFixed(1)}, used ${match.frequency} times)`;
}

/**
 * Generate approximation warning message for spacing
 */
export function generateSpacingWarning(target: number, match: SpacingMatch, property: string): string {
    if (match.distance === 0) {
        return `${property}: exact match ${match.value}px (used ${match.frequency} times)`;
    }
    return `${property} approximated: using ${match.value}px instead of ${target}px (closest available, used ${match.frequency} times)`;
}

/**
 * Generate approximation warning message for radius
 */
export function generateRadiusWarning(target: number, match: RadiusMatch): string {
    if (match.distance === 0) {
        return `Border radius: exact match ${match.value}px (used ${match.frequency} times)`;
    }
    return `Border radius approximated: using ${match.value}px instead of ${target}px (closest available, used ${match.frequency} times)`;
}
