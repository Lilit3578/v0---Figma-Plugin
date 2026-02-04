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
import { componentSelector } from './component-selector';
import * as variableResolver from './variable-resolver';
import * as primitiveScanner from './primitive-scanner';
import { resolutionTracker } from './resolution-tracker';
import { WarningCategory, WarningSeverity } from '../types/resolution-types';
import { TAILWIND_DEFAULTS, getTailwindColor, getTailwindSpacing, getTailwindRadius } from '../constants/tailwind-defaults';
import { normalizeColor } from '../libs/color-utils';
import { propertyMappingService } from './property-mapping';

// ============================================================================
// INTERFACES
// ============================================================================

import {
    ResolutionResult,
    ExecutionInstructions,
    ComponentInstructions,
    FrameInstructions,
    StructuralMatchCandidate,
    OverrideSafetyReport,
    ResolutionStats, // importing the analytics one, but we use CollectorStats locally
    WarningAggregation
} from '../types/resolution-types';

import { resolveAllConflicts, applyResolutionToInstructions } from './conflicts';

/**
 * Statistics for resolution performance (Collector version)
 */
export interface CollectorStats {
    tierCounts: Record<1 | 2 | 3 | 4 | 5, number>;
    averageConfidence: Record<1 | 2 | 3 | 4 | 5, number>;
    totalNodes: number;
    totalTimeMs: number;
}

// ============================================================================
// TIER FALLBACK REASONS
// ============================================================================

const FALLBACK_REASONS = {
    tier1: {
        noMatch: 'No matching component',
        insufficientMappings: 'Insufficient property mappings (<70%)',
        lowConfidence: 'Low confidence (<0.7)'
    },
    tier2: {
        noStructuralMatch: 'No structural match',
        overrideSafetyFailed: 'Override safety check failed',
        noMatchingRole: 'No exact component match found (no matching semantic role). Using structurally similar component.', // Kept for backward compat if needed
        insufficientMappings: 'No exact component match found (insufficient property mappings). Using structurally similar component.',
    },
    tier3: {
        insufficientVariables: 'Insufficient variables (<70% resolved)',
        lowConfidence: 'Low variable confidence',
        general: 'No matching components found. Building from scratch with design tokens.'
    },
    tier4: {
        poorApproximation: 'Approximations too poor (<0.35 confidence)',
        general: 'Insufficient design tokens. Using closest available colors/spacing from file.'
    },
    tier5: 'Using system defaults',
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
 * Calculate structural match score for a component candidate
 * Scoring breakdown:
 * - Layout match: +40 points
 * - Alignment match: +30 points
 * - Flexibility indicator: +20 points
 * - Simple structure: +10 points
 * Total: 100 points max
 */
function calculateStructuralMatchScore(
    node: RSNT_Node,
    component: ComponentInfo
): StructuralMatchCandidate {
    let score = 0;
    const matchDetails = {
        layoutMatch: false,
        alignmentMatch: false,
        flexibilityIndicator: false,
        simpleStructure: false,
    };

    // 1. Layout mode match (+40 points)
    if (component.anatomy?.layoutInfo?.mode === node.layoutMode) {
        score += 40;
        matchDetails.layoutMatch = true;
    }

    // 2. Alignment match (+30 points)
    // Check both primary and counter axis alignment
    if (component.anatomy?.layoutInfo) {
        const layoutInfo = component.anatomy.layoutInfo;

        // Map RSNT alignment to Figma alignment
        const primaryMatch =
            (node.primaryAxisAlignItems === 'CENTER' && layoutInfo.primaryAxisAlignItems === 'CENTER') ||
            (node.primaryAxisAlignItems === 'MIN' && layoutInfo.primaryAxisAlignItems === 'MIN') ||
            (node.primaryAxisAlignItems === 'MAX' && layoutInfo.primaryAxisAlignItems === 'MAX') ||
            (node.primaryAxisAlignItems === 'SPACE_BETWEEN' && layoutInfo.primaryAxisAlignItems === 'SPACE_BETWEEN');

        const counterMatch =
            (node.counterAxisAlignItems === 'CENTER' && layoutInfo.counterAxisAlignItems === 'CENTER') ||
            (node.counterAxisAlignItems === 'MIN' && layoutInfo.counterAxisAlignItems === 'MIN') ||
            (node.counterAxisAlignItems === 'MAX' && layoutInfo.counterAxisAlignItems === 'MAX');

        if (primaryMatch && counterMatch) {
            score += 30;
            matchDetails.alignmentMatch = true;
        } else if (primaryMatch || counterMatch) {
            score += 15; // Partial credit
        }
    }

    // 3. Flexibility indicator in name (+20 points)
    if (/base|slot|template|container|generic/i.test(component.name)) {
        score += 20;
        matchDetails.flexibilityIndicator = true;
    }

    // 4. Simple structure (+10 points)
    // Components with fewer children are more flexible
    const childCount = component.anatomy?.layerCount || 0;
    if (childCount < 5) {
        score += 10;
        matchDetails.simpleStructure = true;
    }

    // Calculate confidence (0.65-0.75 range for Tier 2)
    const rawConfidence = score / 100;
    const confidence = 0.65 + (rawConfidence * 0.10); // Scale to 0.65-0.75

    return {
        component,
        score,
        confidence,
        matchDetails,
    };
}

/**
 * Find structural match candidates and rank by score
 * Returns top 3 candidates
 */
function findStructuralMatches(
    node: RSNT_Node,
    inventory: DesignSystemInventory
): StructuralMatchCandidate[] {
    console.log(`[Tier 2] Searching for structural matches...`);
    console.log(`[Tier 2] Target layout: ${node.layoutMode}, alignment: ${node.primaryAxisAlignItems}/${node.counterAxisAlignItems}`);

    // 1. Filter components by layout mode
    const layoutMatches = inventory.components.filter(
        (c) => c.anatomy?.layoutInfo?.mode === node.layoutMode
    );

    console.log(`[Tier 2] Found ${layoutMatches.length} component(s) with matching layout mode`);

    if (layoutMatches.length === 0) {
        return [];
    }

    // 2. Score all candidates
    const scoredCandidates = layoutMatches.map((component) =>
        calculateStructuralMatchScore(node, component)
    );

    // 3. Sort by score (descending)
    scoredCandidates.sort((a, b) => b.score - a.score);

    // 4. Return top 3
    const topCandidates = scoredCandidates.slice(0, 3);

    console.log(`[Tier 2] Top candidates:`);
    topCandidates.forEach((candidate, idx) => {
        console.log(`  ${idx + 1}. ${candidate.component.name} (score: ${candidate.score}/100, confidence: ${(candidate.confidence * 100).toFixed(0)}%)`);
        console.log(`     Layout: ${candidate.matchDetails.layoutMatch ? '✓' : '✗'}, Alignment: ${candidate.matchDetails.alignmentMatch ? '✓' : '✗'}, Flexible: ${candidate.matchDetails.flexibilityIndicator ? '✓' : '✗'}, Simple: ${candidate.matchDetails.simpleStructure ? '✓' : '✗'}`);
    });

    return topCandidates;
}

/**
 * Validate that overrides won't break the component
 * Performs virtual testing of override compatibility
 */
function validateOverrideCompatibility(
    overrides: ComponentInstructions['overrides'],
    component: ComponentInfo
): OverrideSafetyReport {
    const testResults = {
        textChange: true,
        fillChange: true,
        paddingChange: true,
    };
    const unsafeProperties: string[] = [];

    // Test 1: Text override safety
    if (overrides?.text) {
        // Check if component has text nodes that can be overridden
        const hasTextNodes = component.anatomy?.hasLabel || (component.anatomy?.textNodeCount ?? 0) > 0;
        if (!hasTextNodes) {
            testResults.textChange = false;
            unsafeProperties.push('text (no text nodes found)');
        }
    }

    // Test 2: Fill override safety
    if (overrides?.fills) {
        // Most components can accept fill overrides
        // Only fail if component has complex nested fills or is an icon
        const isIcon = /icon/i.test(component.name) || component.anatomy?.hasIcon;
        if (isIcon) {
            testResults.fillChange = false;
            unsafeProperties.push('fills (icon component - may break visual)');
        }
    }

    // Test 3: Padding override safety
    if (overrides?.padding) {
        // Check if component uses auto layout (can accept padding changes)
        const hasAutoLayout = component.anatomy?.layoutInfo?.mode !== 'NONE';
        if (!hasAutoLayout) {
            testResults.paddingChange = false;
            unsafeProperties.push('padding (no auto layout)');
        }
    }

    // Overall safety: all tests must pass
    const safe = testResults.textChange && testResults.fillChange && testResults.paddingChange;

    return {
        safe,
        unsafeProperties,
        testResults,
    };
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
 * Tier 2: Find structurally similar component and apply overrides
 * Confidence: 0.65-0.75
 */
async function tryTier2StructuralMatch(
    node: RSNT_Node,
    inventory: DesignSystemInventory
): Promise<ResolutionResult | null> {
    console.log(`[Tier 2] Starting structural match for node "${node.name || node.id}"`);

    // 1. Find and rank structural match candidates
    const candidates = findStructuralMatches(node, inventory);

    if (candidates.length === 0) {
        console.log(`[Tier 2] No structural matches found, falling back to Tier 3`);
        return null;
    }

    // 2. Test each candidate for override compatibility
    for (const candidate of candidates) {
        console.log(`[Tier 2] Testing candidate: ${candidate.component.name}`);

        // Generate overrides
        const overrides = generateOverrides(node, candidate.component);
        console.log(`[Tier 2] Generated overrides: ${overrides ? Object.keys(overrides).join(', ') : 'none'}`);

        // Validate override safety
        const safetyReport = validateOverrideCompatibility(overrides, candidate.component);
        console.log(`[Tier 2] Safety check: ${safetyReport.safe ? '✓ SAFE' : '✗ UNSAFE'}`);

        if (!safetyReport.safe) {
            console.log(`[Tier 2] Unsafe properties: ${safetyReport.unsafeProperties.join(', ')}`);
            console.log(`[Tier 2] Rejecting ${candidate.component.name}, trying next candidate...`);
            continue;
        }

        // Found a compatible match!
        console.log(`[Tier 2] ✓ Selected: ${candidate.component.name} (score: ${candidate.score}/100)`);
        console.log(`[Tier 2] Match details: Layout=${candidate.matchDetails.layoutMatch}, Alignment=${candidate.matchDetails.alignmentMatch}, Flexible=${candidate.matchDetails.flexibilityIndicator}, Simple=${candidate.matchDetails.simpleStructure}`);

        return {
            success: true,
            tier: 2,
            method: 'structural_match',
            instructions: {
                type: 'INSTANTIATE_COMPONENT',
                componentId: candidate.component.id,
                properties: {},
                overrides,
            },
            confidence: candidate.confidence,
            warnings: [
                `Using base component "${candidate.component.name}" with overrides - styling may not match brand exactly`,
                `Match score: ${candidate.score}/100 (${Object.entries(candidate.matchDetails).filter(([_, v]) => v).map(([k]) => k).join(', ')})`
            ],
        };
    }

    // No compatible candidates found
    console.log(`[Tier 2] All candidates failed safety checks, falling back to Tier 3`);
    return null;
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

import {
    getCachedPrimitiveInventory,
    findClosestColor,
    findClosestSpacing,
    findClosestRadius,
    generateColorWarning,
    generateSpacingWarning,
    generateRadiusWarning,
    type ColorMatch,
    type SpacingMatch,
    type RadiusMatch
} from './primitive-scanner';

/**
 * Tier 4: Use closest available primitive values from file
 * Confidence: 0.35-0.60
 */
async function tryTier4PrimitiveFallback(
    node: RSNT_Node
): Promise<ResolutionResult | null> {
    console.log(`[Tier 4] Starting primitive fallback for node "${node.name || node.id}"`);

    // 1. Get cached primitive inventory
    const inventory = await getCachedPrimitiveInventory();

    if (inventory.colors.size === 0 && inventory.spacing.size === 0 && inventory.radii.size === 0) {
        console.log(`[Tier 4] No primitives found in file, falling back to Tier 5`);
        return null;
    }

    // 2. Build styling from primitive matches
    const styling: FrameInstructions['styling'] = {};
    const warnings: string[] = [];
    const confidences: number[] = [];

    // Match fills (background colors)
    if (node.fills && node.fills.length > 0) {
        const firstFill = node.fills[0];
        if (firstFill.type === 'SOLID' && firstFill.color) {
            const targetHex = rgbToHex(firstFill.color);
            const colorMatch = findClosestColor(targetHex, inventory.colors);

            if (colorMatch) {
                console.log(`[Tier 4] Fill color: ${targetHex} -> ${colorMatch.color} (ΔE = ${colorMatch.deltaE.toFixed(1)}, confidence = ${(colorMatch.confidence * 100).toFixed(0)}%)`);

                styling.fills = [{ type: 'SOLID', color: normalizeColor(colorMatch.color) }];
                confidences.push(colorMatch.confidence);

                if (colorMatch.deltaE > 0.5) {
                    warnings.push(generateColorWarning(targetHex, colorMatch));
                }
            } else {
                console.log(`[Tier 4] No suitable fill color found (all ΔE >= 10)`);
            }
        }
    }

    // Match strokes (border colors)
    if (node.strokes && node.strokes.length > 0) {
        const firstStroke = node.strokes[0];
        if (firstStroke.type === 'SOLID' && firstStroke.color) {
            const targetHex = rgbToHex(firstStroke.color);
            const colorMatch = findClosestColor(targetHex, inventory.colors);

            if (colorMatch) {
                console.log(`[Tier 4] Stroke color: ${targetHex} -> ${colorMatch.color} (ΔE = ${colorMatch.deltaE.toFixed(1)}, confidence = ${(colorMatch.confidence * 100).toFixed(0)}%)`);

                styling.strokes = [{ type: 'SOLID', color: normalizeColor(colorMatch.color) }];
                confidences.push(colorMatch.confidence);

                if (colorMatch.deltaE > 0.5) {
                    warnings.push(generateColorWarning(targetHex, colorMatch));
                }
            } else {
                console.log(`[Tier 4] No suitable stroke color found (all ΔE >= 10)`);
            }
        }
    }

    // Match padding
    if (node.padding) {
        const extractNumeric = (val: number | { variableId: string } | undefined): number => {
            if (typeof val === 'number') return val;
            return 0;
        };

        const paddingValues = {
            top: extractNumeric(node.padding.top),
            right: extractNumeric(node.padding.right),
            bottom: extractNumeric(node.padding.bottom),
            left: extractNumeric(node.padding.left)
        };

        // Try to match each padding value individually
        const matchedPadding: { top: number; right: number; bottom: number; left: number } = {
            top: 0,
            right: 0,
            bottom: 0,
            left: 0
        };

        for (const [side, targetValue] of Object.entries(paddingValues) as [keyof typeof paddingValues, number][]) {
            if (targetValue > 0) {
                const spacingMatch = findClosestSpacing(targetValue, inventory.spacing);

                if (spacingMatch) {
                    console.log(`[Tier 4] Padding ${side}: ${targetValue}px -> ${spacingMatch.value}px (distance = ${spacingMatch.distance}px, confidence = ${(spacingMatch.confidence * 100).toFixed(0)}%)`);

                    matchedPadding[side] = spacingMatch.value;
                    confidences.push(spacingMatch.confidence);

                    if (spacingMatch.distance > 0) {
                        warnings.push(generateSpacingWarning(targetValue, spacingMatch, `Padding ${side}`));
                    }
                }
            }
        }

        // Only set padding if at least one side was matched
        if (matchedPadding.top > 0 || matchedPadding.right > 0 || matchedPadding.bottom > 0 || matchedPadding.left > 0) {
            styling.padding = matchedPadding;
        }
    }

    // Match corner radius
    if (node.cornerRadius !== undefined) {
        const numericRadius = typeof node.cornerRadius === 'number' ? node.cornerRadius : 0;

        if (numericRadius > 0) {
            const radiusMatch = findClosestRadius(numericRadius, inventory.radii);

            if (radiusMatch) {
                console.log(`[Tier 4] Corner radius: ${numericRadius}px -> ${radiusMatch.value}px (distance = ${radiusMatch.distance}px, confidence = ${(radiusMatch.confidence * 100).toFixed(0)}%)`);

                styling.cornerRadius = radiusMatch.value;
                confidences.push(radiusMatch.confidence);

                if (radiusMatch.distance > 0) {
                    warnings.push(generateRadiusWarning(numericRadius, radiusMatch));
                }
            }
        }
    }

    // 3. Calculate aggregate confidence
    const aggregateConfidence = confidences.length > 0
        ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length
        : 0;

    console.log(`[Tier 4] Aggregate confidence: ${(aggregateConfidence * 100).toFixed(0)}% (threshold: 35%)`);

    // 4. Check if confidence meets threshold
    if (aggregateConfidence < 0.35) {
        console.log(`[Tier 4] Confidence too low, falling back to Tier 5`);
        return null;
    }

    // 5. Return result
    console.log(`[Tier 4] ✓ Success with ${confidences.length} primitive matches`);

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
        confidence: aggregateConfidence,
        warnings,
    };
}

/**
 * Convert RGB to hex (helper for Tier 4)
 */
function rgbToHex(rgb: RGB): string {
    const r = Math.round(rgb.r * 255);
    const g = Math.round(rgb.g * 255);
    const b = Math.round(rgb.b * 255);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
}

/**
 * Convert hex to RGB (helper for Tier 4)
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
    const attemptedTiers: number[] = [];
    let result: ResolutionResult | null = null;

    // Try Tier 1: Exact Match
    attemptedTiers.push(1);
    result = await tryTier1ExactMatch(node, inventory);
    if (result) {
        return recordAndReturn(result, node, startTime, attemptedTiers);
    }

    // Try Tier 2: Structural Match
    attemptedTiers.push(2);
    result = await tryTier2StructuralMatch(node, inventory);
    if (result) {
        const metadata: ResolutionResult['metadata'] = {
            nodeId: node.id,
            timeMs: Date.now() - startTime,
            fallbackReason: FALLBACK_REASONS.tier2.noMatchingRole
        };
        result.metadata = metadata;
        return recordAndReturn(result, node, startTime, attemptedTiers);
    }

    // Try Tier 3: Variable Construction
    attemptedTiers.push(3);
    result = await tryTier3VariableConstruction(node, inventory);
    if (result) {
        const metadata: ResolutionResult['metadata'] = {
            nodeId: node.id,
            timeMs: Date.now() - startTime,
            fallbackReason: FALLBACK_REASONS.tier3.general
        };
        result.metadata = metadata;
        return recordAndReturn(result, node, startTime, attemptedTiers);
    }

    // Try Tier 4: Primitive Fallback
    attemptedTiers.push(4);
    result = await tryTier4PrimitiveFallback(node);
    if (result) {
        const metadata: ResolutionResult['metadata'] = {
            nodeId: node.id,
            timeMs: Date.now() - startTime,
            fallbackReason: FALLBACK_REASONS.tier4.general
        };
        result.metadata = metadata;
        return recordAndReturn(result, node, startTime, attemptedTiers);
    }

    // Tier 5: System Defaults (always succeeds)
    attemptedTiers.push(5);
    result = tryTier5SystemDefaults(node);
    const metadata: ResolutionResult['metadata'] = {
        nodeId: node.id,
        timeMs: Date.now() - startTime,
        fallbackReason: FALLBACK_REASONS.tier5
    };
    result.metadata = metadata;

    // ========================================================================
    // CONFLICT RESOLUTION
    // ========================================================================
    // Intervene before returning to apply priority rules (Component > Preset > AI > System)
    const conflicts = await resolveAllConflicts(node, result, inventory);

    if (conflicts.length > 0) {
        applyResolutionToInstructions(result.instructions, conflicts);

        // Log conflicts to warnings for visibility
        result.warnings.push(...conflicts.map(c =>
            `Conflict: ${c.property} resolved to ${c.winner.source} (${c.winner.formattedValue})`
        ));

        // Add to metadata (casting to any to avoid strict type error if metadata is rigid)
        // ideally we extend the type, but runtime this works
        (result.metadata as any).conflicts = conflicts;
    }

    return recordAndReturn(result, node, startTime, attemptedTiers);
}

/**
 * Attach metadata and record statistics
 */
function recordAndReturn(
    result: ResolutionResult,
    node: RSNT_Node,
    startTime: number,
    attemptedTiers: number[]
): ResolutionResult {
    const timeMs = Date.now() - startTime;

    // Attach standard metadata
    const finalResult: ResolutionResult = {
        ...result,
        metadata: {
            ...result.metadata,
            nodeId: node.id,
            timeMs,
        },
    };

    // Track detailed resolution log
    const detailedWarnings = finalResult.warnings.map(w =>
        resolutionTracker.createCategorizedWarning(w, finalResult.tier, node.id)
    );

    resolutionTracker.record({
        nodeId: node.id,
        tier: finalResult.tier,
        confidence: finalResult.confidence,
        method: finalResult.method,
        timeTaken: timeMs,
        fallbackReason: finalResult.metadata?.fallbackReason,
        warnings: detailedWarnings,
        succeeded: true,
        attemptedTiers: attemptedTiers as any
    });

    return finalResult;
}

// ============================================================================
// STATISTICS TRACKING
// ============================================================================

/**
 * Collect and aggregate resolution statistics
 */
export class ResolutionStatsCollector {
    private stats: CollectorStats = {
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
    getStats(): CollectorStats {
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
