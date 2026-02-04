import { RSNT_Node, ValidationResult } from '../types/rsnt';
import { ConfidenceResult, ConfidenceFactors } from '../types/confidence';
import { APPROVED_SEMANTIC_ROLES, APPROVED_LAYOUT_PRIMITIVES } from '../types/rsnt-constants';

/**
 * Calculate the confidence score for a generated RSNT based on 6 factors.
 */
export function calculateConfidence(
    userIntent: string,
    rsnt: RSNT_Node,
    validationResult: ValidationResult,
    aiSelfAssessment: number = 0 // Default to 0 if not provided
): ConfidenceResult {
    // 1. Validation Factor (30%)
    const validationFactor = calculateValidationFactor(validationResult);

    // 2. Ambiguity Detection (20%)
    const ambiguityFactor = calculateAmbiguityFactor(userIntent);

    // 3. Complexity Match (25%)
    const complexityFactor = calculateComplexityFactor(userIntent, rsnt);

    // 4. Unknown Elements (15%)
    const unknownFactor = calculateUnknownFactor(rsnt);

    // 5. Nesting Depth (10%)
    const depthFactor = calculateDepthFactor(rsnt);

    // 6. AI Self-Assessment (Bonus/Safety Check)
    // Logic: If AI is less confident than objective score, trust AI (it knows it guessed).
    // If AI is more confident than objective score, trust objective (AI is often overconfident).
    // This doesn't go into the weighted sum directly but caps the final result.

    // Calculate Weighted Score
    let weightedScore =
        (validationFactor * 0.30) +
        (ambiguityFactor * 0.20) +
        (complexityFactor * 0.25) +
        (unknownFactor * 0.15) +
        (depthFactor * 0.10);

    // Apply Floor and Ceiling
    // Even perfect validation has uncertainty, so we floor at 0.3 unless it's catastrophic
    weightedScore = Math.max(0.3, Math.min(1.0, weightedScore));

    // Apply AI Safety Check
    // If AI self-assessment is provided and valid (between 0 and 1)
    let finalScore = weightedScore;
    if (aiSelfAssessment > 0 && aiSelfAssessment <= 1) {
        finalScore = Math.min(weightedScore, aiSelfAssessment);
    }

    // Generate Breakdown
    const factors: ConfidenceFactors = {
        validation: validationFactor,
        ambiguity: ambiguityFactor,
        complexityMatch: complexityFactor,
        unknownElements: unknownFactor,
        nestingDepth: depthFactor,
        aiSelfAssessment: aiSelfAssessment
    };

    const breakdown = generateBreakdown(factors, finalScore);

    return {
        finalScore,
        factors,
        breakdown
    };
}

// Factor 1: Validation Success
function calculateValidationFactor(result: ValidationResult): number {
    if (result.valid && result.warnings.length === 0) return 1.0;

    // Start at 1.0 (or 0.8 if valid but has warnings)
    let score = result.valid ? 0.8 : 0.3;

    // Penalize for errors (though usually valid=false means errors exist)
    // If we have errors, the score is already low (0.3). 
    // We can further penalize, but 0.3 is a good floor for "broken but potentially parsable".
    // If purely warnings:
    if (result.valid) {
        // Decrease by 0.05 per warning, floor at 0.5
        score -= (result.warnings.length * 0.05);
        return Math.max(0.5, score);
    }

    // If invalid
    // Decrease by 0.1 per error, floor at 0.1
    score -= (result.errors.length * 0.1);
    return Math.max(0.1, score);
}

// Factor 2: Ambiguity Detection
function calculateAmbiguityFactor(intent: string): number {
    const vagueTerms = [
        "nice", "cool", "modern", "clean", "friendly", "professional",
        "something", "whatever", "good", "simple"
    ];

    const lowerIntent = intent.toLowerCase();
    let score = 1.0;

    // Check for vague terms
    let vagueCount = 0;
    vagueTerms.forEach(term => {
        if (lowerIntent.includes(term)) vagueCount++;
    });

    score -= (vagueCount * 0.1);

    // Check for specificities (bonus) or lack thereof (penalty)
    // Missing size, color, etc. is hard to check reliably with just regex, 
    // but we can check for VERY short prompts.
    if (intent.split(' ').length < 3) {
        score -= 0.3; // "Make a button" is very ambiguous
    }

    return Math.max(0.2, score);
}

// Factor 3: Complexity Match
function calculateComplexityFactor(intent: string, rsnt: RSNT_Node): number {
    // Estimate intent complexity (word count / 10 is a rough heuristic)
    const intentComplexity = Math.min(10, intent.split(' ').length / 5); // 0-10 scale essentially

    // Estimate RSNT complexity
    // Count total nodes
    let nodeCount = 0;
    let maxDepth = 0;

    function traverse(node: RSNT_Node, depth: number) {
        nodeCount++;
        maxDepth = Math.max(maxDepth, depth);
        if (node.children) {
            node.children.forEach(c => traverse(c, depth + 1));
        }
    }
    traverse(rsnt, 0);

    // Normalize RSNT complexity to roughly 0-10 scale
    // Assume 20 nodes is "complex" (score 10)
    const rsntComplexity = Math.min(10, nodeCount / 2);

    // Compare
    const ratio = Math.min(intentComplexity, rsntComplexity) / Math.max(intentComplexity, rsntComplexity);

    // Perfect match = 1.0. 
    // If intent is simple (2) and result is complex (8), ratio is 0.25 (bad match).

    // Just handling the 0 case
    if (intentComplexity === 0 || rsntComplexity === 0) return 0.5;

    return ratio;
}

// Factor 4: Unknown Elements
function calculateUnknownFactor(rsnt: RSNT_Node): number {
    let unknownRoles = 0;
    let unknownPrimitives = 0;
    let totalNodes = 0;

    function traverse(node: RSNT_Node) {
        totalNodes++;
        if (node.semanticRole && !APPROVED_SEMANTIC_ROLES.has(node.semanticRole)) {
            unknownRoles++;
        }
        if (node.layoutPrimitive && !APPROVED_LAYOUT_PRIMITIVES.has(node.layoutPrimitive)) {
            unknownPrimitives++;
        }
        if (node.children) {
            node.children.forEach(traverse);
        }
    }
    traverse(rsnt);

    if (totalNodes === 0) return 1.0;

    let score = 1.0;
    score -= (unknownRoles * 0.2);
    score -= (unknownPrimitives * 0.15);

    return Math.max(0.0, score);
}

// Factor 5: Nesting Depth
function calculateDepthFactor(rsnt: RSNT_Node): number {
    let maxDepth = 0;

    function traverse(node: RSNT_Node, depth: number) {
        maxDepth = Math.max(maxDepth, depth);
        if (node.children) {
            node.children.forEach(c => traverse(c, depth + 1));
        }
    }
    traverse(rsnt, 1);

    if (maxDepth <= 3) return 1.0;
    if (maxDepth <= 5) return 0.95;
    if (maxDepth <= 7) return 0.85;
    return 0.7; // 8+ is very complex/risky
}

function generateBreakdown(factors: ConfidenceFactors, finalScore: number): string[] {
    return [
        `Final Score: ${finalScore.toFixed(2)}`,
        `Validation: ${factors.validation.toFixed(2)} (30%)`,
        `Ambiguity: ${factors.ambiguity.toFixed(2)} (20%)`,
        `Complexity Match: ${factors.complexityMatch.toFixed(2)} (25%)`,
        `Unknown Elements: ${factors.unknownElements.toFixed(2)} (15%)`,
        `Nesting Depth: ${factors.nestingDepth.toFixed(2)} (10%)`,
        `AI Self-Assessment: ${factors.aiSelfAssessment.toFixed(2)} (Safety Check)`
    ];
}
