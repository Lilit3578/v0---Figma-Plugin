/**
 * Decision Engine - Makes explicit design decisions with reasoning
 *
 * This is Phase 3 of the Antigravity approach: Take parsed intent and make
 * concrete design decisions about components, layout, styling, and hierarchy.
 *
 * The key insight: Decompose design decisions into discrete steps with
 * explicit reasoning, rather than asking AI to do everything at once.
 */

import { DesignSystemInventory, ComponentInfo } from './auto-discovery';
import { DesignIntent, ComponentRequirement } from './intent-parser';
import { propertyMappingService } from './property-mapping';
import { analyzeDesignIntent, applyHierarchyOrdering, applySpatialRules, DesignReasoning } from './design-reasoning';
import { detectPattern, designPatternService, DesignPattern } from './design-patterns';
import { resolveSpacingToken } from './token-resolver';

// ============================================================================
// TYPES
// ============================================================================

export interface ComponentDecision {
    requirement: ComponentRequirement;
    selectedComponent: {
        id: string;
        name: string;
        type: 'existing' | 'primitive' | 'composite';
    } | null;
    properties: Record<string, string>;
    fallback?: string; // If no exact match, describe fallback
    confidence: number;
    reasoning: string;
}

export interface LayoutDecision {
    layoutMode: 'VERTICAL' | 'HORIZONTAL' | 'NONE';
    primaryAxisSizingMode: 'FIXED' | 'AUTO';
    counterAxisSizingMode: 'FIXED' | 'AUTO';
    primaryAxisAlignItems: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
    counterAxisAlignItems: 'MIN' | 'CENTER' | 'MAX';
    itemSpacing: number;
    padding: { top: number; right: number; bottom: number; left: number };
    width?: number;
    height?: number;
    reasoning: string;
}

export interface StylingDecision {
    fills: Array<{ type: 'SOLID'; color: { r: number; g: number; b: number } }>;
    cornerRadius: number;
    hasBorder: boolean;
    borderColor?: { r: number; g: number; b: number };
    reasoning: string;
}

export interface HierarchyDecision {
    structure: 'flat' | 'grouped' | 'nested';
    groups: Array<{
        name: string;
        components: number[]; // Indices into component decisions
        hasContainer: boolean;
    }>;
    reasoning: string;
}

export interface DesignDecision {
    intent: DesignIntent;
    components: ComponentDecision[];
    layout: LayoutDecision;
    styling: StylingDecision;
    hierarchy: HierarchyDecision;
    overallConfidence: number;
    designRationale: string;
    reasoning?: DesignReasoning;
    pattern?: DesignPattern; // Full pattern object for validation
}

// ============================================================================
// DECISION ENGINE
// ============================================================================

export class DecisionEngine {
    private spacingScale: number[];
    private fontSizes: number[];
    private borderRadii: number[];

    constructor(
        private inventory: DesignSystemInventory,
        private aiCall: (prompt: string, systemPrompt: string) => Promise<string>
    ) {
        const guidelines = inventory.guidelines;
        this.spacingScale = guidelines?.spacing.scale || [4, 8, 12, 16, 24, 32, 48];
        this.fontSizes = guidelines?.typography.sizes || [12, 14, 16, 18, 20, 24, 32];
        this.borderRadii = guidelines?.borderRadius?.scale || [0, 4, 8, 12, 16];
    }

    /**
     * Make all design decisions for a parsed intent
     */
    async makeDecisions(intent: DesignIntent): Promise<DesignDecision> {
        console.log('=== Multi-Step Decision Making (WITH REASONING) ===');

        // NEW STEP 1: Generate Design Reasoning FIRST
        console.log('Step 1: Analyzing design intent and generating reasoning...');
        const reasoning = await analyzeDesignIntent(
            intent.description || intent.type,
            this.inventory,
            this.aiCall
        );

        console.log('Design Reasoning:', {
            goal: reasoning.goal,
            pattern: reasoning.pattern,
            layoutStrategy: reasoning.layoutStrategy,
            spacing: reasoning.tokenUsage.spacing
        });

        // NEW STEP 2: Detect Design Pattern
        console.log('Step 2: Detecting design pattern...');
        const pattern = detectPattern(intent.description || intent.type);

        if (pattern) {
            console.log(`Pattern Detected: ${pattern.name}`);
            console.log(`  Layout: ${pattern.layout.mode}`);
            console.log(`  CTA Placement: ${pattern.hierarchy.ctaPlacement}`);
        }

        // STEP 3: Select components (existing logic, but now with reasoning context)
        console.log('Step 3: Selecting components...');
        const componentDecisions = await this.selectComponents(intent);

        // NEW STEP 4: Apply Hierarchy Ordering
        console.log('Step 4: Applying hierarchy ordering...');
        const orderedComponents = applyHierarchyOrdering(componentDecisions, reasoning);

        console.log('Component order:', orderedComponents.map((c: any) => c.requirement.type));

        // STEP 5: Decide layout (enhanced with reasoning + pattern)
        console.log('Step 5: Deciding layout with reasoning...');
        const layoutDecision = this.decideLayoutWithReasoning(
            intent,
            orderedComponents,
            reasoning,
            pattern
        );

        // STEP 6: Decide styling
        const stylingDecision = this.decideStyling(intent);

        // STEP 7: Decide hierarchy (enhanced with spatial rules)
        const hierarchyDecision = this.decideHierarchyWithRules(
            intent,
            orderedComponents,
            reasoning
        );

        // Calculate overall confidence
        const confidences = [
            intent.confidence,
            ...orderedComponents.map((c: any) => c.confidence),
        ];
        const overallConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;

        return {
            intent,
            components: orderedComponents,
            layout: layoutDecision,
            styling: stylingDecision,
            hierarchy: hierarchyDecision,
            overallConfidence,
            designRationale: this.generateRationale(intent, orderedComponents, layoutDecision),
            reasoning, // Attach reasoning for transparency
            pattern: pattern || undefined, // Attach full detected pattern object
        };
    }

    /**
     * Step 1: Select appropriate components from the design system
     */
    private async selectComponents(intent: DesignIntent): Promise<ComponentDecision[]> {
        const decisions: ComponentDecision[] = [];

        for (const requirement of intent.components) {
            const decision = this.selectComponent(requirement, intent);
            decisions.push(decision);
        }

        return decisions;
    }

    private selectComponent(requirement: ComponentRequirement, intent: DesignIntent): ComponentDecision {
        // Try to find matching component in inventory
        const match = this.findBestComponentMatch(requirement);

        if (match) {
            // Validate property mapping
            const validation = this.validatePropertyMapping(match.component, requirement);

            if (!validation.canMap && validation.confidence < 0.5) {
                console.warn(`Component ${match.component.name} cannot map required properties:`, validation.warnings);
                // Fall through to primitive fallback (allows better customization than broken component)
            } else {
                return {
                    requirement,
                    selectedComponent: {
                        id: match.component.id,
                        name: match.component.name,
                        type: 'existing',
                    },
                    properties: this.mapProperties(requirement, match.component),
                    confidence: Math.min(match.confidence, validation.confidence),
                    reasoning: match.reasoning + (validation.warnings.length > 0 ? ` (${validation.warnings.join(', ')})` : ''),
                };
            }
        }

        // No match - will use primitive fallback
        return {
            requirement,
            selectedComponent: null,
            properties: {},
            fallback: this.describePrimitiveFallback(requirement),
            confidence: 0.5,
            reasoning: `No matching component found for "${requirement.type}". Will create using primitives.`,
        };
    }

    private findBestComponentMatch(requirement: ComponentRequirement): {
        component: ComponentInfo;
        confidence: number;
        reasoning: string;
    } | null {
        const searchTerms = this.getSearchTerms(requirement);
        let bestMatch: ComponentInfo | null = null;
        let bestScore = 0;
        let reasoning = '';

        for (const component of this.inventory.components) {
            const score = this.scoreComponentMatch(component, searchTerms, requirement);
            if (score > 0.3) {
                console.log(`[ComponentMatch] Scored ${component.name}: ${score.toFixed(2)} for requirment "${requirement.type}" + "${requirement.variant}"`);
            }
            if (score > bestScore) {
                bestScore = score;
                bestMatch = component;
            }
        }

        if (bestMatch && bestScore > 0.5) {
            const confidence = bestScore;
            reasoning = bestScore > 0.8
                ? `Exact match found: "${bestMatch.name}"`
                : bestScore > 0.5
                    ? `Good match found: "${bestMatch.name}" (may need property adjustment)`
                    : `Partial match found: "${bestMatch.name}" (best available option)`;

            return { component: bestMatch, confidence, reasoning };
        }

        return null;
    }

    private getSearchTerms(requirement: ComponentRequirement): string[] {
        const terms: string[] = [requirement.type];

        // Add common synonyms
        const synonyms: Record<string, string[]> = {
            input: ['field', 'textfield', 'text field', 'input box'],
            checkbox: ['check box', 'tick box', 'toggle'],
            radio: ['radio button', 'option'],
            text: ['label', 'typography', 'shim'],
            heading: ['header', 'title', 'headline', 'display'],
        };

        if (synonyms[requirement.type]) {
            terms.push(...synonyms[requirement.type]);
        }

        if (requirement.variant) terms.push(requirement.variant);
        if (requirement.inputType) terms.push(requirement.inputType);
        if (requirement.label) {
            // Extract meaningful words from label
            const words = requirement.label.toLowerCase().split(/\s+/);
            terms.push(...words.filter(w => w.length > 2));
        }

        return terms.map(t => t.toLowerCase());
    }

    private scoreComponentMatch(
        component: ComponentInfo,
        searchTerms: string[],
        requirement: ComponentRequirement
    ): number {
        const nameLower = component.name.toLowerCase();
        let score = 0;

        // 1. Direct type match (highest priority)
        if (nameLower === requirement.type || nameLower.includes(requirement.type)) {
            score += 0.5;
        }
        // 2. Strong Synonym Match (Manual Overrides for common mismatches)
        else if (requirement.type === 'input' && (nameLower.includes('field') || nameLower.includes('text'))) {
            score += 0.5;
        }
        else if (requirement.type === 'heading' && (nameLower.includes('title') || nameLower.includes('header'))) {
            score += 0.5;
        }

        // 3. Variant match
        if (requirement.variant && nameLower.includes(requirement.variant)) {
            score += 0.3;
        }

        // 4. Input type match
        if (requirement.inputType && nameLower.includes(requirement.inputType)) {
            score += 0.2;
        }

        // 5. General term matches (cumulative but capped)
        let termScore = 0;
        for (const term of searchTerms) {
            if (nameLower === term) {
                termScore += 0.3; // Exact term match is strong
            } else if (nameLower.includes(term)) {
                termScore += 0.1;
            }
        }
        score += Math.min(termScore, 0.4); // Cap term bonuses

        // Bonus for exact semantic type match
        if (component.semanticType) {
            const categoryLower = component.semanticType.toLowerCase();
            if (categoryLower === requirement.type || categoryLower.includes(requirement.type)) {
                score += 0.2;
            }
        }

        return Math.min(score, 1.0);
    }

    private mapProperties(requirement: ComponentRequirement, component: ComponentInfo): Record<string, string> {
        const props: Record<string, string> = {};

        // Map variant if component supports it
        if (requirement.variant) {
            let mappedSuccessfully = false;

            // Try semantic mapping first
            const mappings = propertyMappingService.getMappings(component.id);

            // LOGGING: Check what mappings we have
            console.log(`[ComponentMapper] Mapping variant "${requirement.variant}" for ${component.name}`);
            if (mappings) {
                console.log(`[ComponentMapper] Found ${Object.keys(mappings).length} semantic mappings`);
            } else {
                console.log(`[ComponentMapper] No semantic mappings found`);
            }

            if (mappings && Object.keys(mappings).length > 0) {
                const rsntProps = { variant: requirement.variant };
                const mapped = propertyMappingService.applyPropertyMapping(
                    component.id,
                    rsntProps,
                    false
                );

                // Only consider it successful if we actually mapped something different or meaningful
                if (Object.keys(mapped).length > 0) {
                    Object.assign(props, mapped);
                    mappedSuccessfully = true;
                    console.log(`[ComponentMapper] Semantic match success:`, mapped);
                }
            }

            // Fallback to string matching if semantic failed or didn't exist
            if (!mappedSuccessfully && component.variantProperties) {
                console.log(`[ComponentMapper] Attempting string fallback...`);
                // Fallback to string matching
                const variantProp = this.findVariantProperty(component, requirement.variant);
                if (variantProp) {
                    props[variantProp.name] = variantProp.value;
                    console.log(`[ComponentMapper] String fallback match: ${variantProp.name}=${variantProp.value}`);
                } else {
                    console.warn(`[ComponentMapper] Failed to map variant "${requirement.variant}" via string match. Component has:`, Object.keys(component.variantProperties));
                }
            }
        }

        // Map text/label
        if (requirement.label || requirement.text) {
            props.text = requirement.label || requirement.text || '';
        }

        // Map input type to variant if applicable (e.g. Field component)
        if (requirement.inputType && !props.variant) {
            // Try to map input type to a variant
            // e.g. inputType="email" -> variant="EmailAddress" or "Email"
            // e.g. inputType="password" -> variant="Password"

            if (component.variantProperties) {
                // Heuristic: Check if any variant value contains the input type
                const inputType = requirement.inputType.toLowerCase();
                const terms = [inputType];

                // Add specific mappings for common types
                if (inputType === 'email') terms.push('emailaddress', 'email address');
                if (inputType === 'text') terms.push('textinput', 'text input');

                let found = false;

                // Look through all variant properties
                for (const [propName, propDef] of Object.entries(component.variantProperties)) {
                    // Try to find a value that matches
                    for (const term of terms) {
                        const match = propDef.values.find(v => v.toLowerCase().replace(/\s/g, '') === term);
                        if (match) {
                            props[propName] = match;
                            found = true;
                            console.log(`[ComponentMapper] Mapped inputType "${requirement.inputType}" to ${propName}="${match}"`);
                            break;
                        }

                        // Try partial match if exact failed
                        const partial = propDef.values.find(v => v.toLowerCase().includes(term));
                        if (partial) {
                            props[propName] = partial;
                            found = true;
                            console.log(`[ComponentMapper] Mapped inputType "${requirement.inputType}" to ${propName}="${partial}" (partial)`);
                            break;
                        }
                    }
                    if (found) break;
                }
            }
        }

        return props;
    }

    private validatePropertyMapping(
        component: ComponentInfo,
        requirement: ComponentRequirement
    ): { canMap: boolean; confidence: number; warnings: string[] } {
        const warnings: string[] = [];

        if (!requirement.variant) {
            return { canMap: true, confidence: 1.0, warnings };
        }

        const mappings = propertyMappingService.getMappings(component.id);
        if (!mappings) {
            // If no mappings but has variants, we're flying blind
            if (component.variantProperties && Object.keys(component.variantProperties).length > 0) {
                warnings.push(`No property mappings available for ${component.name}`);
                // Still allow if string matching works
                const stringMatch = this.findVariantProperty(component, requirement.variant);
                if (stringMatch) return { canMap: true, confidence: 0.6, warnings };
                return { canMap: false, confidence: 0, warnings };
            }
            return { canMap: true, confidence: 1.0, warnings };
        }

        const rsntProps = { variant: requirement.variant };
        const mappingResult = propertyMappingService.applyMappingWithWarnings(
            component.id,
            rsntProps
        );

        let canMap = mappingResult.skippedProps.length === 0;
        let confidence = propertyMappingService.calculateOverallConfidence(mappings);

        // ✅ FIX: If semantic mapping failed, try string matching as fallback
        if (!canMap && component.variantProperties) {
            const stringMatch = this.findVariantProperty(component, requirement.variant);
            if (stringMatch) {
                canMap = true;
                confidence = Math.max(confidence, 0.9); // Boost confidence significantly for direct string match
                // We don't remove warnings here, but the canMap=true will allow selection
                // Add a positive note effectively neutralizing the warning
                warnings.push(`Resolved mapping via string match: "${requirement.variant}" -> "${stringMatch.value}"`);
            }
        }

        return { canMap, confidence, warnings: mappingResult.warnings };
    }

    private findVariantProperty(
        component: ComponentInfo,
        variant: string
    ): { name: string; value: string } | null {
        if (!component.variantProperties) return null;

        for (const [propName, propDef] of Object.entries(component.variantProperties)) {
            const optionsArray = propDef.values;
            // Case-insensitive match
            const match = optionsArray.find(o => o.toLowerCase() === variant.toLowerCase());
            if (match) {
                return { name: propName, value: match };
            }
            // Partial match
            const partial = optionsArray.find(o => o.toLowerCase().includes(variant.toLowerCase()));
            if (partial) {
                return { name: propName, value: partial };
            }
        }

        return null;
    }

    private describePrimitiveFallback(requirement: ComponentRequirement): string {
        switch (requirement.type) {
            case 'input':
                return `Create input field with label "${requirement.label}" using FRAME + TEXT primitives`;
            case 'button':
                return `Create ${requirement.variant || 'primary'} button with text "${requirement.label}" using FRAME + TEXT`;
            case 'heading':
                return `Create heading level ${requirement.level || 2} with text "${requirement.text}"`;
            case 'text':
                return `Create text node with content "${requirement.text}"`;
            default:
                return `Create ${requirement.type} using FRAME primitives`;
        }
    }

    /**
     * Step 2: Decide layout based on intent type and components
     */
    private decideLayout(intent: DesignIntent, components: ComponentDecision[]): LayoutDecision {
        const layout = intent.layout;

        // Map spacing names to values
        const spacingMap: Record<string, number> = {
            tight: this.findClosest(8, this.spacingScale),
            normal: this.findClosest(16, this.spacingScale),
            relaxed: this.findClosest(24, this.spacingScale),
        };

        // Determine padding based on intent type
        const paddingValue = this.determinePadding(intent);

        // Determine width based on intent type
        const width = this.determineWidth(intent);

        return {
            layoutMode: layout.direction === 'horizontal' ? 'HORIZONTAL' : 'VERTICAL',
            primaryAxisSizingMode: width ? 'FIXED' : 'AUTO',
            counterAxisSizingMode: 'AUTO',
            primaryAxisAlignItems: this.mapAlignment(layout.alignment, true),
            counterAxisAlignItems: this.mapAlignment(layout.alignment, false),
            itemSpacing: spacingMap[layout.spacing] || 16,
            padding: {
                top: paddingValue,
                right: paddingValue,
                bottom: paddingValue,
                left: paddingValue,
            },
            width,
            reasoning: this.generateLayoutReasoning(intent, components.length),
        };
    }

    private determinePadding(intent: DesignIntent): number {
        // Different padding for different intent types
        const paddingByType: Record<string, number> = {
            form: 24,
            card: 24,
            modal: 32,
            page: 48,
            section: 24,
            list: 16,
            navigation: 16,
            dashboard: 32,
        };

        const basePadding = paddingByType[intent.type] || 24;
        return this.findClosest(basePadding, this.spacingScale);
    }

    private determineWidth(intent: DesignIntent): number | undefined {
        // Width constraints based on intent type
        const widthByType: Record<string, number | undefined> = {
            form: 400,
            card: 360,
            modal: 480,
            page: 1440,
            section: undefined, // Fill parent
            list: undefined,
            navigation: 240,
            dashboard: 1440,
        };

        return intent.layout.maxWidth || widthByType[intent.type];
    }

    private mapAlignment(alignment: string, isPrimary: boolean): any {
        const map: Record<string, string> = {
            start: 'MIN',
            center: 'CENTER',
            end: 'MAX',
            stretch: isPrimary ? 'MIN' : 'MIN', // Stretch handled differently
        };
        return map[alignment] || 'MIN';
    }

    private findClosest(value: number, scale: number[]): number {
        if (scale.length === 0) return value;
        return scale.reduce((prev, curr) =>
            Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
        );
    }

    private generateLayoutReasoning(intent: DesignIntent, componentCount: number): string {
        const reasons: string[] = [];

        reasons.push(`${intent.type} typically uses ${intent.layout.direction} layout`);
        reasons.push(`${componentCount} components with ${intent.layout.spacing} spacing`);

        if (intent.constraints.platform === 'mobile') {
            reasons.push('Mobile-optimized layout');
        }

        return reasons.join('. ');
    }

    /**
     * Step 3: Decide styling based on intent
     */
    private decideStyling(intent: DesignIntent): StylingDecision {
        // Default background colors based on type
        const backgrounds: Record<string, { r: number; g: number; b: number }> = {
            form: { r: 1, g: 1, b: 1 }, // White
            card: { r: 1, g: 1, b: 1 },
            modal: { r: 1, g: 1, b: 1 },
            page: { r: 0.98, g: 0.98, b: 0.98 }, // Light gray
            section: { r: 1, g: 1, b: 1 },
            list: { r: 1, g: 1, b: 1 },
            navigation: { r: 0.98, g: 0.98, b: 0.98 },
            dashboard: { r: 0.96, g: 0.96, b: 0.98 },
        };

        // Border radius based on type
        const radiusByType: Record<string, number> = {
            form: 12,
            card: 12,
            modal: 16,
            page: 0,
            section: 8,
            list: 8,
            navigation: 0,
            dashboard: 0,
        };

        const needsBorder = ['card', 'modal', 'form'].includes(intent.type);

        return {
            fills: [{ type: 'SOLID', color: backgrounds[intent.type] || { r: 1, g: 1, b: 1 } }],
            cornerRadius: this.findClosest(radiusByType[intent.type] || 8, this.borderRadii),
            hasBorder: needsBorder,
            borderColor: needsBorder ? { r: 0.9, g: 0.9, b: 0.9 } : undefined,
            reasoning: `${intent.type} styling: ${needsBorder ? 'with border' : 'no border'}, ${radiusByType[intent.type]}px radius`,
        };
    }

    /**
     * Step 4: Decide hierarchy and grouping
     */
    private decideHierarchy(intent: DesignIntent, components: ComponentDecision[]): HierarchyDecision {
        // Determine grouping strategy
        if (components.length <= 3) {
            return {
                structure: 'flat',
                groups: [{
                    name: 'main',
                    components: components.map((_, i) => i),
                    hasContainer: false,
                }],
                reasoning: 'Simple layout with few components - flat structure',
            };
        }

        // Group by type for forms
        if (intent.type === 'form') {
            const groups = this.groupFormComponents(components);
            return {
                structure: 'grouped',
                groups,
                reasoning: 'Form components grouped by type (heading, inputs, actions)',
            };
        }

        // Default: single group
        return {
            structure: 'flat',
            groups: [{
                name: 'content',
                components: components.map((_, i) => i),
                hasContainer: components.length > 5,
            }],
            reasoning: 'Default flat structure with optional container',
        };
    }

    private groupFormComponents(components: ComponentDecision[]): HierarchyDecision['groups'] {
        const groups: HierarchyDecision['groups'] = [];

        // Find heading
        const headingIndices = components
            .map((c, i) => c.requirement.type === 'heading' ? i : -1)
            .filter(i => i >= 0);

        if (headingIndices.length > 0) {
            groups.push({
                name: 'header',
                components: headingIndices,
                hasContainer: false,
            });
        }

        // Find inputs
        const inputIndices = components
            .map((c, i) => ['input', 'select', 'checkbox', 'radio', 'toggle'].includes(c.requirement.type) ? i : -1)
            .filter(i => i >= 0);

        if (inputIndices.length > 0) {
            groups.push({
                name: 'fields',
                components: inputIndices,
                hasContainer: false,
            });
        }

        // Find buttons/actions
        const actionIndices = components
            .map((c, i) => c.requirement.type === 'button' ? i : -1)
            .filter(i => i >= 0);

        if (actionIndices.length > 0) {
            groups.push({
                name: 'actions',
                components: actionIndices,
                hasContainer: false,
            });
        }

        return groups;
    }

    private decideLayoutWithReasoning(
        intent: DesignIntent,
        components: ComponentDecision[],
        reasoning: DesignReasoning,
        pattern: DesignPattern | null
    ): LayoutDecision {
        // Use pattern layout if detected
        const layoutMode = pattern?.layout.mode ||
            (reasoning.layoutStrategy === 'stack' ? 'VERTICAL' :
                reasoning.layoutStrategy === 'grid' ? 'HORIZONTAL' : 'VERTICAL');

        // Map spacing semantic to token — use the token resolver to bind to
        // actual design system variables instead of hardcoded pixel values.
        const spacingTier = reasoning.tokenUsage.spacing;
        const densityMap: Record<string, 'tight' | 'comfortable' | 'spacious'> = {
            tight: 'tight',
            comfortable: 'comfortable',
            spacious: 'spacious',
        };
        const density = densityMap[spacingTier] || 'comfortable';
        const platform = intent.constraints.platform === 'mobile' ? 'mobile' : 'desktop';

        const spacingToken = resolveSpacingToken(
            { semanticIntent: intent.type, density, platform, element: 'section' },
            this.inventory
        );
        const itemSpacing = typeof spacingToken.value === 'number'
            ? spacingToken.value
            : this.findClosest(16, this.spacingScale);

        console.log(`[DecisionEngine] Resolved spacing: ${spacingToken.name} = ${itemSpacing}px (confidence: ${spacingToken.confidence})`);

        // Resolve padding via token resolver
        const paddingToken = resolveSpacingToken(
            { semanticIntent: intent.type, density, platform, element: 'container' },
            this.inventory
        );
        const paddingFallback = pattern
            ? ({ compact: 12, standard: 24, generous: 48 } as Record<string, number>)[pattern.spacing.priority] || 24
            : this.determinePadding(intent);
        const paddingValue = typeof paddingToken.value === 'number'
            ? paddingToken.value
            : paddingFallback;

        console.log(`[DecisionEngine] Resolved padding: ${paddingToken.name} = ${paddingValue}px (confidence: ${paddingToken.confidence})`);

        // Determine width based on pattern distribution
        let width: number | undefined;
        if (pattern?.layout.distribution === '20-80') {
            width = 240; // Sidebar width
        } else if (pattern?.layout.distribution === '70-30') {
            width = undefined; // Let it flex
        }

        return {
            layoutMode,
            primaryAxisSizingMode: width ? 'FIXED' : 'AUTO',
            counterAxisSizingMode: 'AUTO',
            primaryAxisAlignItems: this.mapAlignment(intent.layout.alignment, true),
            counterAxisAlignItems: this.mapAlignment(intent.layout.alignment, false),
            itemSpacing,
            padding: {
                top: paddingValue,
                right: paddingValue,
                bottom: paddingValue,
                left: paddingValue,
            },
            width,
            reasoning: `Using ${reasoning.pattern} pattern with ${spacingTier} spacing (${itemSpacing}px). Padding: ${paddingValue}px. ${pattern ? `Applied ${pattern.name} rules.` : ''}`,
        };
    }

    private decideHierarchyWithRules(
        intent: DesignIntent,
        components: ComponentDecision[],
        reasoning: DesignReasoning
    ): HierarchyDecision {
        // Use reasoning to determine grouping
        const shouldGroup = components.length > 5 || reasoning.layoutStrategy === 'dashboard';

        if (!shouldGroup) {
            return {
                structure: 'flat',
                groups: [{
                    name: 'main',
                    components: components.map((_, i) => i),
                    hasContainer: false,
                }],
                reasoning: 'Simple layout - flat structure'
            };
        }

        // Group by hierarchy tier
        const groups: HierarchyDecision['groups'] = [];

        const primaryIndices = components
            .map((c, i) => reasoning.hierarchy.primary.includes(c.requirement.type) ? i : -1)
            .filter(i => i >= 0);

        if (primaryIndices.length > 0) {
            groups.push({
                name: 'primary-content',
                components: primaryIndices,
                hasContainer: reasoning.layoutStrategy === 'dashboard',
            });
        }

        const secondaryIndices = components
            .map((c, i) => reasoning.hierarchy.secondary.includes(c.requirement.type) ? i : -1)
            .filter(i => i >= 0);

        if (secondaryIndices.length > 0) {
            groups.push({
                name: 'secondary-content',
                components: secondaryIndices,
                hasContainer: false,
            });
        }

        return {
            structure: 'grouped',
            groups,
            reasoning: `Grouped by ${reasoning.pattern} hierarchy rules`
        };
    }

    /**
     * Generate overall design rationale
     */
    private generateRationale(
        intent: DesignIntent,
        components: ComponentDecision[],
        layout: LayoutDecision
    ): string {
        const parts: string[] = [];

        // Intent understanding
        parts.push(`Creating ${intent.type} for ${intent.constraints.context || 'general'} purpose.`);

        // Component selection
        const existingCount = components.filter(c => c.selectedComponent?.type === 'existing').length;
        const primitiveCount = components.length - existingCount;
        if (existingCount > 0) {
            parts.push(`Using ${existingCount} existing design system components.`);
        }
        if (primitiveCount > 0) {
            parts.push(`Creating ${primitiveCount} elements from primitives.`);
        }

        // Layout decision
        parts.push(`${layout.layoutMode} layout with ${layout.itemSpacing}px spacing.`);

        // Confidence note
        const lowConfidenceComponents = components.filter(c => c.confidence < 0.6);
        if (lowConfidenceComponents.length > 0) {
            parts.push(`Note: ${lowConfidenceComponents.length} component(s) may need adjustment.`);
        }

        return parts.join(' ');
    }
}

/**
 * Factory function
 */
export function createDecisionEngine(
    inventory: DesignSystemInventory,
    aiCall: (prompt: string, systemPrompt: string) => Promise<string>
): DecisionEngine {
    return new DecisionEngine(inventory, aiCall);
}
