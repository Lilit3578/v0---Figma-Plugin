/**
 * Design Reasoning Service
 * Analyzes user intent and generates design reasoning BEFORE generating layouts
 */

import { DesignSystemInventory } from './auto-discovery';
import { extractJSON } from '../utils/json-utils';

export interface DesignReasoning {
    goal: string;                    // Primary user goal
    pattern: string;                 // Detected pattern name
    layoutStrategy: 'stack' | 'grid' | 'split-view' | 'dashboard' | 'hero';
    hierarchy: {
        primary: string[];             // Element types that need most visual weight
        secondary: string[];           // Supporting elements
        tertiary: string[];            // Minor elements
    };
    spatialRules: SpatialRule[];
    tokenUsage: {
        spacing: 'tight' | 'comfortable' | 'spacious';
        emphasis: 'high-contrast' | 'subtle' | 'monochrome';
    };
    explanation: string;             // Human-readable reasoning
}

export interface SpatialRule {
    rule: string;                    // e.g., "CTAs follow content"
    affected: string[];              // Element types affected
    reasoning: string;
}

const REASONING_SYSTEM_PROMPT = `You are a Senior Product Designer with expertise in:
- Visual hierarchy and information architecture
- UI/UX design patterns (F-pattern, Z-pattern, Grid layouts)
- Gestalt principles (Proximity, Similarity, Continuity)
- Accessibility and usability best practices

Your role is to ANALYZE design requests and produce REASONING before generating layouts.`;

/**
 * Analyze design intent and generate reasoning
 */
export async function analyzeDesignIntent(
    userIntent: string,
    inventory: DesignSystemInventory,
    aiCall: (prompt: string, systemPrompt: string) => Promise<string>
): Promise<DesignReasoning> {

    const spacingTokens = inventory.guidelines?.spacing.scale || [4, 8, 16, 24, 32, 48];
    const components = inventory.components.map(c => c.name).slice(0, 20).join(', ');

    const prompt = `
Analyze this design request and think step-by-step BEFORE generating any layout.

User Request: "${userIntent}"

Available spacing tokens: ${spacingTokens.join(', ')}px
Available components: ${components}

THINK THROUGH THESE STEPS:

1. UNDERSTAND THE GOAL
   - What is the user trying to accomplish?
   - What is the PRIMARY action? (e.g., "Submit form", "Browse items")
   - What is the SECONDARY action? (e.g., "Cancel", "Learn more")

2. IDENTIFY THE PATTERN
   - F-Pattern: Forms, text-heavy pages (vertical flow, left-aligned)
   - Z-Pattern: Landing pages, hero sections (diagonal eye movement)
   - Grid: Galleries, dashboards (equal visual weight, scannable)
   - Split-View: Sidebars, comparisons (70-30 or 80-20 distribution)
   - Stack: Simple mobile layouts (vertical, single column)

3. ESTABLISH HIERARCHY
   - Which elements need MAXIMUM visual weight? (primary actions, key metrics)
   - Which are SUPPORTING? (descriptions, metadata)
   - Which are MINOR? (links, disclaimers)

4. DETERMINE SPATIAL RULES
   - Where should CTAs be placed? (F-pattern → bottom, Z-pattern → inline)
   - Should content come before actions? (almost always YES)
   - How should related items be grouped? (proximity principle)

5. SELECT TOKEN STRATEGY
   - Tight spacing (4-12px): Dense dashboards, compact mobile
   - Comfortable spacing (16-32px): Standard forms, readable content
   - Spacious spacing (48-64px): Marketing pages, hero sections
   
   - High contrast: CTAs, errors, primary actions
   - Subtle: Secondary text, metadata
   - Monochrome: Minimal designs, professional dashboards

RETURN THIS JSON STRUCTURE:
{
  "goal": "Brief description of primary user goal",
  "pattern": "F-Pattern|Z-Pattern|Grid|Split-View|Stack",
  "layoutStrategy": "stack|grid|split-view|dashboard|hero",
  "hierarchy": {
    "primary": ["button", "heading"],
    "secondary": ["text", "image"],
    "tertiary": ["link"]
  },
  "spatialRules": [
    {
      "rule": "CTAs follow content",
      "affected": ["button"],
      "reasoning": "Users need context before taking action"
    }
  ],
  "tokenUsage": {
    "spacing": "comfortable",
    "emphasis": "high-contrast"
  },
  "explanation": "Multi-sentence explanation of your reasoning"
}

CRITICAL: Return ONLY valid JSON. No markdown, no explanation outside the JSON.
`;

    const response = await aiCall(prompt, REASONING_SYSTEM_PROMPT);
    const reasoning = extractJSON(response);

    console.log('[DesignReasoning] Generated reasoning:', reasoning);

    return reasoning;
}

/**
 * Apply reasoning to reorder components by READING ORDER — not raw visual weight.
 *
 * The previous version put "primary" elements first, which placed buttons above
 * inputs. Then applySpatialRules tried to move buttons back to the bottom,
 * causing a tug-of-war. This version uses a single, unified pass that respects
 * natural reading flow: heading → descriptive text → content/fields → actions.
 */
export function applyHierarchyOrdering(
    components: any[],
    _reasoning: DesignReasoning
): any[] {
    // Semantic reading-order buckets (top → bottom)
    const ACTION_TYPES = new Set(['button', 'link', 'cta']);
    const HEADING_TYPES = new Set(['heading', 'title', 'display']);
    const DESCRIPTIVE_TYPES = new Set(['text', 'description', 'caption', 'subtitle']);

    const headings: any[] = [];
    const descriptions: any[] = [];
    const content: any[] = [];   // inputs, toggles, selects, images, cards, etc.
    const actions: any[] = [];

    for (const c of components) {
        const type = (c.requirement?.type || '').toLowerCase();
        if (HEADING_TYPES.has(type)) {
            headings.push(c);
        } else if (ACTION_TYPES.has(type)) {
            actions.push(c);
        } else if (DESCRIPTIVE_TYPES.has(type)) {
            descriptions.push(c);
        } else {
            content.push(c);
        }
    }

    const ordered = [...headings, ...descriptions, ...content, ...actions];

    // Safety: include any components that somehow weren't categorised
    for (const c of components) {
        if (!ordered.includes(c)) ordered.push(c);
    }

    console.log('[HierarchyOrdering] Reading order:',
        ordered.map(c => c.requirement?.type).join(' → '));

    return ordered;
}

/**
 * Apply spatial rules to RSNT node tree (post-build pass).
 *
 * Because applyHierarchyOrdering already puts actions at the bottom and headings
 * at the top, this function only needs to handle edge-cases the AI's spatial
 * rules surface (e.g. specific overrides). It will NOT fight the hierarchy
 * ordering — both agree on reading order.
 */
export function applySpatialRules(
    nodes: any[],
    reasoning: DesignReasoning
): any[] {
    if (!nodes || !Array.isArray(nodes)) return nodes;
    if (!reasoning || !reasoning.spatialRules || !Array.isArray(reasoning.spatialRules)) return nodes;

    let reordered = [...nodes];

    for (const rule of reasoning.spatialRules) {
        if (!rule || !rule.rule || !Array.isArray(rule.affected)) continue;

        const ruleLower = rule.rule.toLowerCase();

        if (ruleLower.includes('ctas follow content') || ruleLower.includes('actions at bottom')) {
            // Move matching nodes to the end (idempotent — hierarchy ordering already did this)
            const isAffected = (n: any) =>
                rule.affected.some(type => {
                    const name = (n.name || '').toLowerCase();
                    const reqType = (n.requirement?.type || n.type || '').toLowerCase();
                    return name.includes(type.toLowerCase()) || reqType === type.toLowerCase();
                });

            const ctas = reordered.filter(isAffected);
            const others = reordered.filter(n => !ctas.includes(n));
            reordered = [...others, ...ctas];
            console.log(`[SpatialRule] Enforced: ${rule.rule}`);
        }

        if (ruleLower.includes('hero at top') || ruleLower.includes('heading first')) {
            const isAffected = (n: any) =>
                rule.affected.some(type => {
                    const name = (n.name || '').toLowerCase();
                    const reqType = (n.requirement?.type || n.type || '').toLowerCase();
                    return name.includes(type.toLowerCase()) || reqType === type.toLowerCase();
                });

            const heroes = reordered.filter(isAffected);
            const others = reordered.filter(n => !heroes.includes(n));
            reordered = [...heroes, ...others];
            console.log(`[SpatialRule] Enforced: ${rule.rule}`);
        }

        // Labels-above-fields is handled internally by RSNTBuilder primitives
    }

    return reordered;
}
