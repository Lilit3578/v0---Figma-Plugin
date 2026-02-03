import { VariableInfo, DesignSystemInventory } from './auto-discovery';
import { SEMANTIC_ALIASES } from '../data/semantic-aliases';
import { rgbToCIELAB, calculateDeltaE, hexToRGB, RGB } from '../libs/color-utils';
import { classificationService } from './classification'; // Reuse for AI calls if possible, or direct prompt

/**
 * Result of a variable resolution attempt
 */
export interface VariableResolutionResult {
    variableId?: string;
    foundVariable?: VariableInfo;
    confidence: number;
    tier: 1 | 2 | 3 | 4 | 0; // 0 = Not Found
    method: 'exact' | 'alias' | 'ai-reasoning' | 'proximity' | 'none';
    reasoning?: string;
    deltaE?: number; // Only for proximity matches
}

/**
 * Normalize a token name for comparison
 * "colors/blue/500" -> "colors-blue-500"
 */
function normalizeToken(token: string): string {
    return token.toLowerCase()
        .replace(/\//g, '-')
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
}

/**
 * Resolve a requested token to a variable in the inventory
 */
export async function resolveVariable(
    requestedToken: string,
    inventory: DesignSystemInventory
): Promise<VariableResolutionResult> {
    const variables = inventory.variables;
    const normalizedReq = normalizeToken(requestedToken);

    // --- TIER 1: EXACT MATCH ---
    // Check if any variable name normalizes to the same string
    // or matches exactly
    const exactMatch = variables.find(v => {
        if (v.name === requestedToken) return true;
        if (normalizeToken(v.name) === normalizedReq) return true;
        return false;
    });

    if (exactMatch) {
        return {
            variableId: exactMatch.id,
            foundVariable: exactMatch,
            confidence: 1.0,
            tier: 1,
            method: 'exact',
            reasoning: 'Exact name match'
        };
    }

    // --- TIER 2: SEMANTIC ALIAS MATCH ---
    const knownAliases = SEMANTIC_ALIASES[requestedToken] || [];

    // Also try to find aliases for the normalized version if not found directly
    // e.g. requested "colors-primary" might map to "colors/primary" aliases
    // For now, rely on direct map.

    if (knownAliases.length > 0) {
        for (const alias of knownAliases) {
            const aliasMatch = variables.find(v => normalizeToken(v.name) === normalizeToken(alias));
            if (aliasMatch) {
                return {
                    variableId: aliasMatch.id,
                    foundVariable: aliasMatch,
                    confidence: 0.85,
                    tier: 2,
                    method: 'alias',
                    reasoning: `Matched via alias '${alias}'`
                };
            }
        }
    }

    // --- TIER 3: AI SEMANTIC MATCH ---
    // Try to match using AI if previous tiers failed
    const candidateNames = variables.map(v => v.name);

    // Check if we should use AI (costly, so maybe only on demand or fallback)
    // Here we invoke it if available
    try {
        const aiResult = await classificationService.analyzeVariableMatch(requestedToken, candidateNames);
        if (aiResult && aiResult.bestMatch && aiResult.confidence >= 0.75) {
            const aiMatchVar = variables.find(v => v.name === aiResult.bestMatch);
            if (aiMatchVar) {
                return {
                    variableId: aiMatchVar.id,
                    foundVariable: aiMatchVar,
                    confidence: aiResult.confidence,
                    tier: 3,
                    method: 'ai-reasoning',
                    reasoning: aiResult.reasoning || 'AI inferred match'
                };
            }
        }
    } catch (e) {
        // AI failed, proceed to next tier
    }

    // --- TIER 4: CIELAB PROXIMITY (Colors Only) ---
    // (See resolveVariableWithContext for proximity implementation)
    // The base function generally handles name/semantic matching.

    return {
        confidence: 0,
        tier: 0,
        method: 'none',
        reasoning: 'No match found'
    };
}

/**
 * Resolve with visual context (Tier 4 enabled) and Frequency Weighting
 */
export async function resolveVariableWithContext(
    requestedToken: string,
    referenceColorHex: string | undefined, // The color value we are looking for (e.g. from the design)
    inventory: DesignSystemInventory
): Promise<VariableResolutionResult> {

    // Run normal resolution first (Tiers 1, 2, 3)
    let result = await resolveVariable(requestedToken, inventory);

    // Apply Frequency Weighting Bonus to non-exact matches
    if (result.foundVariable && result.tier > 1) {
        // Logarithmic boost based on usage: 0 usage = +0, 10 usage = +0.05, 100 usage = +0.10
        const usage = result.foundVariable.usageCount || 0;
        if (usage > 0) {
            // max bonus 0.15
            const bonus = Math.min(0.15, Math.log10(usage + 1) * 0.05);
            result.confidence = Math.min(0.99, result.confidence + bonus);
            result.reasoning += ` (+${bonus.toFixed(2)} usage bonus)`;
        }
    }

    if (result.confidence >= 0.8) {
        return result;
    }

    // If no good match, try Proximity (Tier 4)
    if (referenceColorHex && inventory.variables) {
        // Filter variables that are colors
        const colorVars = inventory.variables.filter(v => v.resolvedType === 'COLOR' && v.value);

        if (colorVars.length > 0) {
            try {
                const targetRGB = hexToRGB(referenceColorHex);
                const targetLAB = rgbToCIELAB(targetRGB);

                let bestMatch: VariableInfo | undefined;
                let minDeltaE = Infinity;

                for (const v of colorVars) {
                    // v.value is typically { r, g, b, a } or similar from Figma
                    const vVal = v.value as any;
                    if (typeof vVal === 'object' && 'r' in vVal) {
                        const vRGB: RGB = { r: vVal.r, g: vVal.g, b: vVal.b };
                        const vLAB = rgbToCIELAB(vRGB);
                        const dE = calculateDeltaE(targetLAB, vLAB);

                        if (dE < minDeltaE) {
                            minDeltaE = dE;
                            bestMatch = v;
                        }
                    }
                }

                if (bestMatch && minDeltaE < 10) {
                    let confidence = 0.65;
                    if (minDeltaE < 2) confidence = 0.95;
                    else if (minDeltaE < 5) confidence = 0.80;

                    // FREQUENCY WEIGHTING FOR PROXIMITY
                    // If we had multiple matches within small delta, we'd pick by frequency.
                    // Here we just boost the single best match found by proximity.
                    const usage = bestMatch.usageCount || 0;
                    if (usage > 0) {
                        const bonus = Math.min(0.1, Math.log10(usage + 1) * 0.05);
                        confidence = Math.min(0.99, confidence + bonus);
                    }

                    // Only take proximity if it's better than what we had
                    if (confidence > result.confidence) {
                        return {
                            variableId: bestMatch.id,
                            foundVariable: bestMatch,
                            confidence: confidence,
                            tier: 4,
                            method: 'proximity',
                            deltaE: minDeltaE,
                            reasoning: `Proximity match (Delta E: ${minDeltaE.toFixed(2)})`
                        };
                    }
                }

            } catch (e) {
                console.warn('Error in proximity calculation', e);
            }
        }
    }

    return result;
}

