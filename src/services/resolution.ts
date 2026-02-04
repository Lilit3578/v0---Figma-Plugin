/**
 * 5-Tier Fallback Resolution System
 * 
 * Guarantees 100% generation success by providing multiple fallback strategies:
 * - Tier 1: Library Exact Match (highest confidence)
 * - Tier 2: Structural Match with overrides
 * - Tier 3: Variable Construction from design tokens
 * - Tier 4: Primitive Fallback using file values
 * - Tier 5: System Defaults (always succeeds)
 */

import { RSNT_Node } from '../types/rsnt';
import { DesignSystemInventory, ComponentInfo, VariableInfo } from './auto-discovery';
import { TAILWIND_DEFAULTS, getTailwindColor, getTailwindSpacing, getTailwindRadius } from '../constants/tailwind-defaults';
import { normalizeColor } from '../libs/color-utils';
import { propertyMappingService } from './property-mapping';

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Result of resolving a single RSNT node
 */
export interface ResolutionResult {
    success: boolean;
    tier: 1 | 2 | 3 | 4 | 5;
    method: string;
    instructions: ExecutionInstructions;
    confidence: number;
    warnings: string[];
    metadata?: {
        nodeId: string;
        timeMs: number;
        fallbackReason?: string;
    };
}

/**
 * Instructions for rendering engine to execute
 */
export type ExecutionInstructions = ComponentInstructions | FrameInstructions;

/**
 * Instructions to instantiate a component
 */
export interface ComponentInstructions {
    type: 'INSTANTIATE_COMPONENT';
    componentId: string;
    properties: Record<string, any>;
    overrides?: {
        fills?: any[];
        strokes?: any[];
        text?: string;
        padding?: { top: number; right: number; bottom: number; left: number };
    };
}

/**
 * Instructions to create a frame from scratch
 */
export interface FrameInstructions {
    type: 'CREATE_FRAME';
    layoutMode: 'HORIZONTAL' | 'VERTICAL' | 'NONE';
    styling: {
        fills?: any[];
        strokes?: any[];
        cornerRadius?: number;
        padding?: { top: number; right: number; bottom: number; left: number };
    };
    variableBindings?: Record<string, string>;
    primitiveValues?: Record<string, any>;
}

/**
 * Statistics for resolution performance
 */
export interface ResolutionStats {
    tierCounts: Record<1 | 2 | 3 | 4 | 5, number>;
    averageConfidence: Record<1 | 2 | 3 | 4 | 5, number>;
    totalNodes: number;
    totalTimeMs: number;
}

/**
 * Aggregated warnings from resolution
 */
export interface WarningAggregation {
    componentWarnings: { message: string; count: number }[];
    variableWarnings: { message: string; count: number }[];
    approximationWarnings: { message: string; count: number }[];
    summary: string;
}

// ============================================================================
// TIER FALLBACK REASONS
// ============================================================================

const FALLBACK_REASONS = {
    tier2: {
        noMatchingRole: 'No exact component match found (no matching semantic role). Using structurally similar component.',
        insufficientMappings: 'No exact component match found (insufficient property mappings). Using structurally similar component.',
    },
    tier3: 'No matching components found. Building from scratch with design tokens.',
    tier4: 'Insufficient design tokens. Using closest available colors/spacing from file.',
    tier5: 'No design system assets found. Using generic Tailwind defaults.',
};

// ============================================================================
// TIER 1: LIBRARY EXACT MATCH
// ============================================================================

/**
 * Tier 1: Find exact component match based on semantic role and property mappings
 * Confidence: 0.8-1.0
 */
/**
 * Tier 1: Find exact component match based on semantic role and property mappings
 * Confidence: 0.8-1.0
 */
async function tryTier1ExactMatch(
    node: RSNT_Node,
    inventory: DesignSystemInventory
): Promise<ResolutionResult | null> {
    // 1. Find components with matching semantic role
    const candidates = inventory.components.filter(
        (c) => c.suggestedRole === node.semanticRole
    );

    if (candidates.length === 0) {
        return null;
    }

    console.log(`[Tier 1] Found ${candidates.length} candidate(s) for role "${node.semanticRole}"`);

    // 2. Validate property mappings using enhanced PropertyMappingService
    for (const candidate of candidates) {
        const mappings = candidate.propertyMappings || {};
        const nodeProps = node.properties || {};
        const nodePropKeys = Object.keys(nodeProps);

        // Handle components with no properties
        if (nodePropKeys.length === 0) {
            console.log(`[Tier 1] ✓ Match: ${candidate.name} (no properties to map)`);
            return {
                success: true,
                tier: 1,
                method: 'exact_match',
                instructions: {
                    type: 'INSTANTIATE_COMPONENT',
                    componentId: candidate.id,
                    properties: {},
                },
                confidence: 0.9,
                warnings: [],
            };
        }

        // Calculate overall confidence and mappability
        const overallConfidence = propertyMappingService.calculateOverallConfidence(mappings);
        const mappablePercentage = propertyMappingService.calculateMappablePercentage(nodeProps, mappings);

        console.log(`[Tier 1] Evaluating ${candidate.name}:`);
        console.log(`  Confidence: ${(overallConfidence * 100).toFixed(0)}% (threshold: 70%)`);
        console.log(`  Mappability: ${(mappablePercentage * 100).toFixed(0)}% (threshold: 70%)`);

        // Check if thresholds are met
        if (overallConfidence >= 0.70 && mappablePercentage >= 0.70) {
            // Apply property mappings with enhanced service
            const mappingResult = propertyMappingService.applyMappingWithWarnings(
                candidate.id,
                nodeProps
            );

            console.log(`[Tier 1] ✓ Match: ${candidate.name}`);
            console.log(`  Mapped properties: ${Object.keys(mappingResult.componentProperties).join(', ') || 'none'}`);
            if (mappingResult.skippedProps.length > 0) {
                console.log(`  Skipped properties: ${mappingResult.skippedProps.join(', ')}`);
            }

            return {
                success: true,
                tier: 1,
                method: 'exact_match',
                instructions: {
                    type: 'INSTANTIATE_COMPONENT',
                    componentId: candidate.id,
                    properties: mappingResult.componentProperties,
                },
                confidence: overallConfidence,
                warnings: mappingResult.warnings,
            };
        } else {
            console.log(`[Tier 1] ✗ ${candidate.name} failed thresholds`);
        }
    }

    console.log(`[Tier 1] No candidates met thresholds, falling back to Tier 2`);
    return null;
}


// ============================================================================
// TIER 2: STRUCTURAL MATCH
// ============================================================================

/**
 * Tier 2: Find structurally similar component and apply overrides
 * Confidence: 0.65-0.75
 */
async function tryTier2StructuralMatch(
    node: RSNT_Node,
    inventory: DesignSystemInventory
): Promise<ResolutionResult | null> {
    // 1. Find components with matching layout primitive
    const candidates = inventory.components.filter(
        (c) => c.anatomy?.layoutInfo?.mode === node.layoutMode
    );

    if (candidates.length === 0) {
        return null;
    }

    // 2. Filter for flexible components (Base, Slot, Template, Container)
    const flexibleCandidates = candidates.filter((c) =>
        /Base|Slot|Template|Container/i.test(c.name)
    );

    if (flexibleCandidates.length === 0) {
        return null;
    }

    // 3. Generate override instructions
    for (const candidate of flexibleCandidates) {
        const overrides = generateOverrides(node, candidate);

        if (validateOverrideCompatibility(overrides, candidate)) {
            return {
                success: true,
                tier: 2,
                method: 'structural_match',
                instructions: {
                    type: 'INSTANTIATE_COMPONENT',
                    componentId: candidate.id,
                    properties: {},
                    overrides,
                },
                confidence: 0.7,
                warnings: ['Using base component with overrides - may not match brand exactly'],
            };
        }
    }

    return null;
}

/**
 * Generate override instructions for a component
 */
function generateOverrides(
    node: RSNT_Node,
    component: ComponentInfo
): ComponentInstructions['overrides'] {
    const overrides: ComponentInstructions['overrides'] = {};

    // Override fills if specified
    if (node.fills && node.fills.length > 0) {
        const firstFill = node.fills[0];
        if (firstFill.type === 'SOLID' && firstFill.color) {
            overrides.fills = [{ type: 'SOLID', color: normalizeColor(firstFill.color) }];
        }
    }

    // Override strokes if specified
    if (node.strokes && node.strokes.length > 0) {
        const firstStroke = node.strokes[0];
        if (firstStroke.type === 'SOLID' && firstStroke.color) {
            overrides.strokes = [{ type: 'SOLID', color: normalizeColor(firstStroke.color) }];
        }
    }

    // Override text content if specified (for TEXT nodes)
    if (node.characters) {
        overrides.text = node.characters;
    }

    // Override padding if specified
    if (node.padding) {
        // Extract numeric values from padding
        const extractNumeric = (val: number | { variableId: string } | undefined): number => {
            if (typeof val === 'number') return val;
            return 0;
        };

        overrides.padding = {
            top: extractNumeric(node.padding.top),
            right: extractNumeric(node.padding.right),
            bottom: extractNumeric(node.padding.bottom),
            left: extractNumeric(node.padding.left),
        };
    }

    return overrides;
}

/**
 * Validate that overrides won't break the component
 */
function validateOverrideCompatibility(
    overrides: ComponentInstructions['overrides'],
    component: ComponentInfo
): boolean {
    // For now, assume all flexible components accept overrides
    // In the future, could check component structure
    return true;
}

// ============================================================================
// TIER 3: VARIABLE CONSTRUCTION
// ============================================================================

/**
 * Tier 3: Build frame from scratch using design tokens
 * Confidence: 0.7-0.9
 */
async function tryTier3VariableConstruction(
    node: RSNT_Node,
    inventory: DesignSystemInventory
): Promise<ResolutionResult | null> {
    // 1. Collect Tailwind classes
    const classes = node.tailwindClasses || [];

    if (classes.length === 0) {
        return null;
    }

    // 2. Resolve classes to variables
    const resolutions = await Promise.all(
        classes.map((cls) => resolveClassToVariable(cls, inventory))
    );

    // 3. Check success rate (≥70% with ≥0.8 confidence)
    const successful = resolutions.filter((r) => r && r.confidence >= 0.8);
    const successRate = successful.length / resolutions.length;

    if (successRate >= 0.7) {
        const successfulFiltered = successful.filter((r): r is { variableId: string; confidence: number } => r !== null);
        const variableBindings = buildVariableBindings(successfulFiltered);
        const styling = buildStylingFromClasses(classes, successfulFiltered);
        const unresolvedClasses = listUnresolvedClasses(classes, resolutions);

        return {
            success: true,
            tier: 3,
            method: 'variable_construction',
            instructions: {
                type: 'CREATE_FRAME',
                layoutMode: node.layoutMode || 'NONE',
                styling,
                variableBindings,
            },
            confidence: successfulFiltered.reduce((sum, r) => sum + r.confidence, 0) / successfulFiltered.length,
            warnings: unresolvedClasses,
        };
    }

    return null;
}

/**
 * Resolve a Tailwind class to a design variable
 * This is a placeholder - should integrate with existing variable resolution service
 */
async function resolveClassToVariable(
    className: string,
    inventory: DesignSystemInventory
): Promise<{ variableId: string; confidence: number } | null> {
    // TODO: Integrate with existing 3-tier variable resolution from Phase 1.4
    // For now, return null to force fallback to Tier 4/5
    return null;
}

/**
 * Build variable bindings from successful resolutions
 */
function buildVariableBindings(
    resolutions: Array<{ variableId: string; confidence: number }>
): Record<string, string> {
    const bindings: Record<string, string> = {};

    for (const resolution of resolutions) {
        // Map variable to appropriate property
        // This is simplified - real implementation would be more sophisticated
        bindings[resolution.variableId] = resolution.variableId;
    }

    return bindings;
}

/**
 * Build styling from Tailwind classes
 */
function buildStylingFromClasses(
    classes: string[],
    resolutions: any[]
): FrameInstructions['styling'] {
    const styling: FrameInstructions['styling'] = {};

    // Extract background colors
    const bgClass = classes.find((c) => c.startsWith('bg-'));
    if (bgClass) {
        const color = getTailwindColor(bgClass);
        if (color) {
            styling.fills = [{ type: 'SOLID', color: normalizeColor(color) }];
        }
    }

    // Extract border radius
    const roundedClass = classes.find((c) => c.startsWith('rounded'));
    if (roundedClass) {
        const radius = getTailwindRadius(roundedClass);
        if (radius !== null) {
            styling.cornerRadius = radius;
        }
    }

    // Extract padding
    const paddingClasses = classes.filter((c) => c.startsWith('p-') || c.startsWith('px-') || c.startsWith('py-'));
    if (paddingClasses.length > 0) {
        styling.padding = extractPaddingFromClasses(paddingClasses);
    }

    return styling;
}

/**
 * Extract padding values from Tailwind classes
 */
function extractPaddingFromClasses(classes: string[]): { top: number; right: number; bottom: number; left: number } {
    let top = 0, right = 0, bottom = 0, left = 0;

    for (const cls of classes) {
        const value = getTailwindSpacing(cls);
        if (value === null) continue;

        if (cls.startsWith('p-')) {
            top = right = bottom = left = value;
        } else if (cls.startsWith('px-')) {
            left = right = value;
        } else if (cls.startsWith('py-')) {
            top = bottom = value;
        } else if (cls.startsWith('pt-')) {
            top = value;
        } else if (cls.startsWith('pr-')) {
            right = value;
        } else if (cls.startsWith('pb-')) {
            bottom = value;
        } else if (cls.startsWith('pl-')) {
            left = value;
        }
    }

    return { top, right, bottom, left };
}

/**
 * List classes that couldn't be resolved
 */
function listUnresolvedClasses(
    classes: string[],
    resolutions: Array<any | null>
): string[] {
    const warnings: string[] = [];

    classes.forEach((cls, i) => {
        if (!resolutions[i] || resolutions[i].confidence < 0.8) {
            warnings.push(`Class "${cls}" could not be resolved to a design variable`);
        }
    });

    return warnings;
}

// ============================================================================
// TIER 4: PRIMITIVE FALLBACK
// ============================================================================

/**
 * Tier 4: Use closest available primitive values from file
 * Confidence: 0.4-0.6
 */
async function tryTier4PrimitiveFallback(
    node: RSNT_Node
): Promise<ResolutionResult | null> {
    // 1. Scan file for primitive values
    const primitives = await scanFilePrimitives();

    if (primitives.colors.length === 0 && primitives.spacing.length === 0) {
        return null;
    }

    // 2. Build frequency map
    const frequencyMap = buildFrequencyMap(primitives);

    // 3. Find closest primitives for each requirement
    const styling: FrameInstructions['styling'] = {};

    // Find closest color for fills
    if (node.fills && node.fills.length > 0) {
        const firstFill = node.fills[0];
        if (firstFill.type === 'SOLID' && firstFill.color) {
            const hexColor = rgbToHex(firstFill.color);
            const closestColor = findClosestColor(hexColor, primitives.colors, frequencyMap.colors);
            if (closestColor) {
                styling.fills = [{ type: 'SOLID', color: normalizeColor(closestColor) }];
            }
        }
    }

    // Find closest color for strokes
    if (node.strokes && node.strokes.length > 0) {
        const firstStroke = node.strokes[0];
        if (firstStroke.type === 'SOLID' && firstStroke.color) {
            const hexColor = rgbToHex(firstStroke.color);
            const closestColor = findClosestColor(hexColor, primitives.colors, frequencyMap.colors);
            if (closestColor) {
                styling.strokes = [{ type: 'SOLID', color: normalizeColor(closestColor) }];
            }
        }
    }

    // Find closest spacing for padding
    if (node.padding) {
        // Extract numeric values from padding
        const extractNumeric = (val: number | { variableId: string } | undefined): number => {
            if (typeof val === 'number') return val;
            return 0;
        };

        const avgPadding = (
            extractNumeric(node.padding.top) +
            extractNumeric(node.padding.right) +
            extractNumeric(node.padding.bottom) +
            extractNumeric(node.padding.left)
        ) / 4;

        const closestSpacing = findClosestSpacing(avgPadding, primitives.spacing, frequencyMap.spacing);
        if (closestSpacing !== null) {
            styling.padding = {
                top: closestSpacing,
                right: closestSpacing,
                bottom: closestSpacing,
                left: closestSpacing,
            };
        }
    }

    // Find closest radius
    if (node.cornerRadius !== undefined) {
        const numericRadius = typeof node.cornerRadius === 'number' ? node.cornerRadius : 0;
        const closestRadius = findClosestSpacing(numericRadius, primitives.radii, frequencyMap.radii);
        if (closestRadius !== null) {
            styling.cornerRadius = closestRadius;
        }
    }

    return {
        success: true,
        tier: 4,
        method: 'primitive_fallback',
        instructions: {
            type: 'CREATE_FRAME',
            layoutMode: node.layoutMode || 'NONE',
            styling,
            primitiveValues: styling,
        },
        confidence: 0.5,
        warnings: ['Using closest available values - no design tokens found'],
    };
}

/**
 * Scan current Figma file for primitive values
 */
async function scanFilePrimitives(): Promise<{
    colors: string[];
    spacing: number[];
    radii: number[];
}> {
    const colors = new Set<string>();
    const spacing = new Set<number>();
    const radii = new Set<number>();

    // Scan all nodes in the current page
    function scanNode(node: SceneNode) {
        // Extract fills
        if ('fills' in node && Array.isArray(node.fills)) {
            for (const fill of node.fills) {
                if (fill.type === 'SOLID' && fill.color) {
                    const hex = rgbToHex(fill.color);
                    colors.add(hex);
                }
            }
        }

        // Extract strokes
        if ('strokes' in node && Array.isArray(node.strokes)) {
            for (const stroke of node.strokes) {
                if (stroke.type === 'SOLID' && stroke.color) {
                    const hex = rgbToHex(stroke.color);
                    colors.add(hex);
                }
            }
        }

        // Extract padding (from auto layout)
        if ('paddingTop' in node) {
            spacing.add(node.paddingTop);
            spacing.add(node.paddingRight);
            spacing.add(node.paddingBottom);
            spacing.add(node.paddingLeft);
        }

        // Extract corner radius
        if ('cornerRadius' in node && typeof node.cornerRadius === 'number') {
            radii.add(node.cornerRadius);
        }

        // Recurse into children
        if ('children' in node) {
            for (const child of node.children) {
                scanNode(child);
            }
        }
    }

    for (const node of figma.currentPage.children) {
        scanNode(node);
    }

    return {
        colors: Array.from(colors),
        spacing: Array.from(spacing).filter((v) => v > 0),
        radii: Array.from(radii).filter((v) => v > 0),
    };
}

/**
 * Build frequency map for primitive values
 */
function buildFrequencyMap(primitives: {
    colors: string[];
    spacing: number[];
    radii: number[];
}): {
    colors: Map<string, number>;
    spacing: Map<number, number>;
    radii: Map<number, number>;
} {
    // For now, assume equal frequency
    // In the future, could scan entire file and count occurrences
    return {
        colors: new Map(primitives.colors.map((c) => [c, 1])),
        spacing: new Map(primitives.spacing.map((s) => [s, 1])),
        radii: new Map(primitives.radii.map((r) => [r, 1])),
    };
}

/**
 * Find closest color using Delta E
 */
function findClosestColor(
    targetColor: string,
    availableColors: string[],
    frequencyMap: Map<string, number>
): string | null {
    if (availableColors.length === 0) return null;

    // For now, use simple RGB distance
    // TODO: Implement Delta E for better color matching
    const targetRgb = hexToRgb(targetColor);
    if (!targetRgb) return availableColors[0];

    let closestColor = availableColors[0];
    let minDistance = Infinity;

    for (const color of availableColors) {
        const rgb = hexToRgb(color);
        if (!rgb) continue;

        const distance = Math.sqrt(
            Math.pow(rgb.r - targetRgb.r, 2) +
            Math.pow(rgb.g - targetRgb.g, 2) +
            Math.pow(rgb.b - targetRgb.b, 2)
        );

        // Weight by frequency
        const frequency = frequencyMap.get(color) || 1;
        const weightedDistance = distance / frequency;

        if (weightedDistance < minDistance) {
            minDistance = weightedDistance;
            closestColor = color;
        }
    }

    return closestColor;
}

/**
 * Find closest spacing value
 */
function findClosestSpacing(
    targetValue: number,
    availableValues: number[],
    frequencyMap: Map<number, number>
): number | null {
    if (availableValues.length === 0) return null;

    let closestValue = availableValues[0];
    let minDistance = Infinity;

    for (const value of availableValues) {
        const distance = Math.abs(value - targetValue);

        // Weight by frequency
        const frequency = frequencyMap.get(value) || 1;
        const weightedDistance = distance / frequency;

        if (weightedDistance < minDistance) {
            minDistance = weightedDistance;
            closestValue = value;
        }
    }

    return closestValue;
}

/**
 * Convert RGB to hex
 */
function rgbToHex(rgb: RGB): string {
    const r = Math.round(rgb.r * 255);
    const g = Math.round(rgb.g * 255);
    const b = Math.round(rgb.b * 255);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
}

/**
 * Convert hex to RGB
 */
function hexToRgb(hex: string): RGB | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? {
            r: parseInt(result[1], 16) / 255,
            g: parseInt(result[2], 16) / 255,
            b: parseInt(result[3], 16) / 255,
        }
        : null;
}

// ============================================================================
// TIER 5: SYSTEM DEFAULTS
// ============================================================================

/**
 * Tier 5: Use hardcoded Tailwind defaults (always succeeds)
 * Confidence: 0.3
 */
function tryTier5SystemDefaults(node: RSNT_Node): ResolutionResult {
    const styling = buildStylingFromDefaults(node);

    return {
        success: true,
        tier: 5,
        method: 'system_defaults',
        instructions: {
            type: 'CREATE_FRAME',
            layoutMode: node.layoutMode || 'NONE',
            styling,
            primitiveValues: styling,
        },
        confidence: 0.3,
        warnings: ['Using generic Tailwind defaults - not connected to your design system'],
    };
}

/**
 * Build styling from Tailwind defaults
 */
function buildStylingFromDefaults(node: RSNT_Node): FrameInstructions['styling'] {
    const styling: FrameInstructions['styling'] = {};

    // Use default blue for fills
    if (node.fills && node.fills.length > 0) {
        styling.fills = [{ type: 'SOLID', color: normalizeColor(TAILWIND_DEFAULTS.colors['blue-500']) }];
    }

    // Use default gray for strokes
    if (node.strokes && node.strokes.length > 0) {
        styling.strokes = [{ type: 'SOLID', color: normalizeColor(TAILWIND_DEFAULTS.colors['gray-500']) }];
    }

    // Use default padding
    if (node.padding) {
        const defaultPadding = TAILWIND_DEFAULTS.spacing['4'];
        styling.padding = {
            top: defaultPadding,
            right: defaultPadding,
            bottom: defaultPadding,
            left: defaultPadding,
        };
    }

    // Use default radius
    if (node.cornerRadius !== undefined) {
        styling.cornerRadius = TAILWIND_DEFAULTS.borderRadius['md'];
    }

    return styling;
}

// ============================================================================
// ORCHESTRATION
// ============================================================================

/**
 * Resolve a single RSNT node using 5-tier fallback system
 * Guarantees success (Tier 5 always works)
 */
export async function resolveNode(
    node: RSNT_Node,
    inventory: DesignSystemInventory
): Promise<ResolutionResult> {
    const startTime = Date.now();

    // Try Tier 1: Exact Match
    let result = await tryTier1ExactMatch(node, inventory);
    if (result) {
        return attachMetadata(result, node, startTime);
    }

    // Try Tier 2: Structural Match
    result = await tryTier2StructuralMatch(node, inventory);
    if (result) {
        const metadata: ResolutionResult['metadata'] = {
            nodeId: node.id,
            timeMs: Date.now() - startTime,
            fallbackReason: FALLBACK_REASONS.tier2.noMatchingRole
        };
        result.metadata = metadata;
        return attachMetadata(result, node, startTime);
    }

    // Try Tier 3: Variable Construction
    result = await tryTier3VariableConstruction(node, inventory);
    if (result) {
        const metadata: ResolutionResult['metadata'] = {
            nodeId: node.id,
            timeMs: Date.now() - startTime,
            fallbackReason: FALLBACK_REASONS.tier3
        };
        result.metadata = metadata;
        return attachMetadata(result, node, startTime);
    }

    // Try Tier 4: Primitive Fallback
    result = await tryTier4PrimitiveFallback(node);
    if (result) {
        const metadata: ResolutionResult['metadata'] = {
            nodeId: node.id,
            timeMs: Date.now() - startTime,
            fallbackReason: FALLBACK_REASONS.tier4
        };
        result.metadata = metadata;
        return attachMetadata(result, node, startTime);
    }

    // Tier 5: System Defaults (always succeeds)
    result = tryTier5SystemDefaults(node);
    const metadata: ResolutionResult['metadata'] = {
        nodeId: node.id,
        timeMs: Date.now() - startTime,
        fallbackReason: FALLBACK_REASONS.tier5
    };
    result.metadata = metadata;
    return attachMetadata(result, node, startTime);
}

/**
 * Attach metadata to resolution result
 */
function attachMetadata(
    result: ResolutionResult,
    node: RSNT_Node,
    startTime: number
): ResolutionResult {
    const timeMs = Date.now() - startTime;

    return {
        ...result,
        metadata: {
            ...result.metadata,
            nodeId: node.id,
            timeMs,
        },
    };
}

// ============================================================================
// STATISTICS TRACKING
// ============================================================================

/**
 * Collect and aggregate resolution statistics
 */
export class ResolutionStatsCollector {
    private stats: ResolutionStats = {
        tierCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        averageConfidence: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        totalNodes: 0,
        totalTimeMs: 0,
    };

    private confidenceSums: Record<1 | 2 | 3 | 4 | 5, number> = {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
    };

    /**
     * Record a resolution result
     */
    record(result: ResolutionResult): void {
        this.stats.tierCounts[result.tier]++;
        this.confidenceSums[result.tier] += result.confidence;
        this.stats.totalNodes++;
        this.stats.totalTimeMs += result.metadata?.timeMs || 0;
    }

    /**
     * Get final statistics report
     */
    getStats(): ResolutionStats {
        // Calculate average confidence for each tier
        for (const tier of [1, 2, 3, 4, 5] as const) {
            const count = this.stats.tierCounts[tier];
            if (count > 0) {
                this.stats.averageConfidence[tier] = this.confidenceSums[tier] / count;
            }
        }

        return this.stats;
    }

    /**
     * Get human-readable report
     */
    getReport(): string {
        const stats = this.getStats();
        const lines: string[] = [];

        lines.push('=== Resolution Statistics ===');
        lines.push(`Total nodes: ${stats.totalNodes}`);
        lines.push(`Total time: ${stats.totalTimeMs}ms`);
        lines.push('');
        lines.push('Tier breakdown:');

        for (const tier of [1, 2, 3, 4, 5] as const) {
            const count = stats.tierCounts[tier];
            const percentage = ((count / stats.totalNodes) * 100).toFixed(1);
            const avgConf = (stats.averageConfidence[tier] * 100).toFixed(1);

            lines.push(
                `  Tier ${tier}: ${count} nodes (${percentage}%) - avg confidence: ${avgConf}%`
            );
        }

        return lines.join('\n');
    }
}

// ============================================================================
// WARNING AGGREGATION
// ============================================================================

/**
 * Aggregate warnings from multiple resolution results
 */
export function aggregateWarnings(results: ResolutionResult[]): WarningAggregation {
    const componentWarnings: Map<string, number> = new Map();
    const variableWarnings: Map<string, number> = new Map();
    const approximationWarnings: Map<string, number> = new Map();

    for (const result of results) {
        for (const warning of result.warnings) {
            // Categorize warnings
            if (warning.includes('property') || warning.includes('component')) {
                componentWarnings.set(warning, (componentWarnings.get(warning) || 0) + 1);
            } else if (warning.includes('variable') || warning.includes('token')) {
                variableWarnings.set(warning, (variableWarnings.get(warning) || 0) + 1);
            } else if (warning.includes('approximation') || warning.includes('closest')) {
                approximationWarnings.set(warning, (approximationWarnings.get(warning) || 0) + 1);
            }
        }
    }

    // Convert maps to arrays
    const toArray = (map: Map<string, number>) =>
        Array.from(map.entries()).map(([message, count]) => ({ message, count }));

    const component = toArray(componentWarnings);
    const variable = toArray(variableWarnings);
    const approximation = toArray(approximationWarnings);

    // Generate summary
    const parts: string[] = [];

    if (approximation.length > 0) {
        const total = approximation.reduce((sum, w) => sum + w.count, 0);
        parts.push(`${total} nodes used approximations`);
    }

    if (variable.length > 0) {
        const total = variable.reduce((sum, w) => sum + w.count, 0);
        parts.push(`${total} nodes missing design tokens`);
    }

    if (component.length > 0) {
        const total = component.reduce((sum, w) => sum + w.count, 0);
        parts.push(`${total} nodes had component warnings`);
    }

    return {
        componentWarnings: component,
        variableWarnings: variable,
        approximationWarnings: approximation,
        summary: parts.join(', ') || 'No warnings',
    };
}
