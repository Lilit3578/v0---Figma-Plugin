/**
 * Token Resolution Service
 * Maps semantic spacing/color intents to actual design tokens
 */

import { DesignSystemInventory, VariableInfo } from './auto-discovery';

export interface TokenContext {
    semanticIntent: string;          // "hero", "form", "card-grid", "sidebar"
    density: 'tight' | 'comfortable' | 'spacious';
    platform: 'mobile' | 'desktop' | 'responsive';
    element: string;                 // "button", "input", "card", "section"
}

export interface ResolvedToken {
    variableId: string;
    value: number | any;
    name: string;
    confidence: number;
}

/**
 * Resolve spacing token based on context
 */
export function resolveSpacingToken(
    context: TokenContext,
    inventory: DesignSystemInventory
): ResolvedToken {
    const scale = inventory.guidelines?.spacing.scale || [4, 8, 12, 16, 24, 32, 48, 64];

    // Heuristic mapping table
    const heuristics: Record<string, Record<string, number[]>> = {
        tight: {
            hero: [scale[2], scale[3]],       // 12-16px
            form: [scale[1], scale[2]],       // 8-12px
            'card-grid': [scale[2], scale[3]],
            sidebar: [scale[1], scale[2]],
            button: [scale[1], scale[2]],
        },
        comfortable: {
            hero: [scale[4], scale[5]],       // 24-32px
            form: [scale[3], scale[4]],       // 16-24px
            'card-grid': [scale[3], scale[4]],
            sidebar: [scale[2], scale[3]],
            button: [scale[2], scale[3]],
        },
        spacious: {
            hero: [scale[6], scale[7]],       // 48-64px
            form: [scale[4], scale[5]],       // 24-32px
            'card-grid': [scale[4], scale[5]],
            sidebar: [scale[3], scale[4]],
            button: [scale[3], scale[4]],
        }
    };

    const options = heuristics[context.density]?.[context.semanticIntent] ||
        heuristics[context.density]?.['form'] ||
        [scale[3]]; // fallback to 16px

    const value = context.platform === 'mobile' ? options[0] : options[1] || options[0];

    // Find matching variable
    const variable = inventory.variables.find(v =>
        v.resolvedType === 'FLOAT' &&
        v.value === value &&
        v.name.toLowerCase().includes('spacing')
    );

    if (variable) {
        return {
            variableId: variable.id,
            value: variable.value,
            name: variable.name,
            confidence: 1.0
        };
    }

    // Fallback: find closest
    const closest = findClosestSpacing(value, inventory.variables);
    return {
        variableId: closest?.id || '',
        value: closest?.value || value,
        name: closest?.name || 'fallback',
        confidence: 0.7
    };
}

/**
 * Resolve color token based on emphasis
 */
export function resolveColorToken(
    emphasis: 'primary' | 'secondary' | 'tertiary' | 'success' | 'error',
    inventory: DesignSystemInventory
): ResolvedToken | null {
    const colorVars = inventory.variables.filter(v => v.resolvedType === 'COLOR');

    // Name-based matching
    const match = colorVars.find(v =>
        v.name.toLowerCase().includes(emphasis.toLowerCase())
    );

    if (match) {
        return {
            variableId: match.id,
            value: match.value,
            name: match.name,
            confidence: 1.0
        };
    }

    return null;
}

/**
 * Find closest spacing value
 */
function findClosestSpacing(target: number, variables: VariableInfo[]): VariableInfo | null {
    const spacingVars = variables.filter(v =>
        v.resolvedType === 'FLOAT' &&
        v.name.toLowerCase().includes('spacing')
    );

    if (spacingVars.length === 0) return null;

    let closest = spacingVars[0];
    let minDiff = Math.abs((closest.value as number) - target);

    for (const v of spacingVars) {
        const diff = Math.abs((v.value as number) - target);
        if (diff < minDiff) {
            minDiff = diff;
            closest = v;
        }
    }

    return closest;
}

/**
 * Generate token mapping for entire layout
 */
export function generateTokenMapping(
    semanticIntent: string,
    density: 'tight' | 'comfortable' | 'spacious',
    platform: 'mobile' | 'desktop',
    inventory: DesignSystemInventory
): Record<string, ResolvedToken> {
    const mapping: Record<string, ResolvedToken> = {};

    // Resolve primary spacing
    mapping.itemSpacing = resolveSpacingToken(
        { semanticIntent, density, platform, element: 'section' },
        inventory
    );

    // Resolve padding
    mapping.padding = resolveSpacingToken(
        { semanticIntent, density, platform, element: 'container' },
        inventory
    );

    // Resolve gap (for grids)
    mapping.gap = resolveSpacingToken(
        { semanticIntent: 'card-grid', density, platform, element: 'grid' },
        inventory
    );

    return mapping;
}
