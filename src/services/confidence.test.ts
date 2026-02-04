import { calculateConfidence } from './confidence';
import { RSNT_Node, ValidationResult } from '../types/rsnt';
import { describe, it, expect } from '../utils/simple-test';

// Mock Validation Result factory
function createValidationResult(valid: boolean, warnings = 0, errors = 0): ValidationResult {
    return {
        valid,
        warnings: Array(warnings).fill({ message: 'warning' } as any),
        errors: Array(errors).fill({ message: 'error' } as any)
    };
}

// Mock RSNT Node factory
function createRSNTNode(
    id: string,
    type: 'FRAME' | 'TEXT' | 'COMPONENT_INSTANCE' = 'FRAME',
    semanticRole = 'container',
    layoutPrimitive = 'auto-layout',
    children: RSNT_Node[] = []
): RSNT_Node {
    return {
        id,
        type,
        semanticRole,
        layoutPrimitive,
        children
    };
}

describe('Confidence Calculation Service', () => {

    describe('Factor 1: Validation', () => {
        const baseIntent = "create a button";
        const baseRSNT = createRSNTNode('root');

        it('should give 1.0 for valid result with no warnings', () => {
            const result = calculateConfidence(baseIntent, baseRSNT, createValidationResult(true, 0, 0));
            expect(result.factors.validation).toBe(1.0);
        });

        it('should give 0.8 base - penalty for warnings', () => {
            const resultWith1Warning = calculateConfidence(baseIntent, baseRSNT, createValidationResult(true, 1, 0));
            // 0.8 - (1 * 0.05) = 0.75
            expect(resultWith1Warning.factors.validation).toBeCloseTo(0.75);

            const resultWithMinScore = calculateConfidence(baseIntent, baseRSNT, createValidationResult(true, 10, 0));
            // 0.8 - 0.5 = 0.3, but floor is 0.5 for valid
            expect(resultWithMinScore.factors.validation).toBe(0.5);
        });

        it('should give 0.3 base - penalty for errors', () => {
            const resultWithError = calculateConfidence(baseIntent, baseRSNT, createValidationResult(false, 0, 1));
            // 0.3 - (1 * 0.1) = 0.2
            expect(resultWithError.factors.validation).toBeCloseTo(0.2);

            const resultWithManyErrors = calculateConfidence(baseIntent, baseRSNT, createValidationResult(false, 0, 5));
            // 0.3 - 0.5 = -0.2, floor at 0.1
            expect(resultWithManyErrors.factors.validation).toBe(0.1);
        });
    });

    describe('Factor 2: Ambiguity', () => {
        const baseRSNT = createRSNTNode('root');

        it('should give 1.0 for clear specific intent', () => {
            const intent = "create a red primary button with rounded corners";
            const result = calculateConfidence(intent, baseRSNT, createValidationResult(true));
            expect(result.factors.ambiguity).toBe(1.0);
        });

        it('should penalize vague terms', () => {
            const intent = "create a something nice and modern";
            const result = calculateConfidence(intent, baseRSNT, createValidationResult(true));
            // 'something', 'nice', 'modern' -> 3 * 0.1 = 0.3 penalty
            // 1.0 - 0.3 = 0.7
            expect(result.factors.ambiguity).toBeCloseTo(0.7);
        });

        it('should penalize very short intents', () => {
            const intent = "button";
            const result = calculateConfidence(intent, baseRSNT, createValidationResult(true));
            // Length < 3 words -> -0.3 penalty
            // 1.0 - 0.3 = 0.7
            expect(result.factors.ambiguity).toBeCloseTo(0.7);

            // "good button" -> "good" is vague (-0.1) AND length < 3 (-0.3) = 0.6
            const result2 = calculateConfidence("good button", baseRSNT, createValidationResult(true));
            expect(result2.factors.ambiguity).toBeCloseTo(0.6);
        });
    });

    describe('Factor 3: Complexity Match', () => {
        const simpleIntent = "simple box";
        const complexIntent = "detailed card with image, title, description, tags, footer, and buttons";

        // Simple RSNT (1 node)
        const simpleRSNT = createRSNTNode('root');

        // Complex RSNT (many nodes)
        const complexRSNT = createRSNTNode('root', 'FRAME', 'card', 'auto-layout', [
            createRSNTNode('child1'), createRSNTNode('child2'), createRSNTNode('child3'),
            createRSNTNode('child4'), createRSNTNode('child5'), createRSNTNode('child6')
        ]);

        it('should score high for simple intent + simple RSNT', () => {
            // Both complexities should be low and similar
            const result = calculateConfidence(simpleIntent, simpleRSNT, createValidationResult(true));
            // Ratio is 0.8 exactly (2 words=0.4 vs 1 node=0.5)
            expect(result.factors.complexityMatch).toBeGreaterThan(0.79);
        });

        it('should score reasonable match for complex intent + complex RSNT', () => {
            // "detailed card..." is ~11-13 words -> ~2.2-2.6 complexity
            // RSNT is 7 nodes -> 3.5 complexity
            // Ratio is approx 0.6-0.75
            const result = calculateConfidence(complexIntent, complexRSNT, createValidationResult(true));
            expect(result.factors.complexityMatch).toBeGreaterThan(0.5);
        });

        it('should score lower for mismatch', () => {
            // Simple intent (should be low score) vs Complex RSNT (higher score)
            // Ratio will extend further from 1
            const result = calculateConfidence(simpleIntent, complexRSNT, createValidationResult(true));
            // 0.4 vs 3.5 -> ratio ~0.11
            expect(result.factors.complexityMatch).toBeLessThan(0.3);
        });
    });

    describe('Factor 4: Unknown Elements', () => {
        const baseIntent = "test intent for unknown elements"; // Long enough to avoid ambiguity penalty

        it('should give 1.0 for all known roles and primitives', () => {
            const rsnt = createRSNTNode('root', 'FRAME', 'button', 'auto-layout');
            const result = calculateConfidence(baseIntent, rsnt, createValidationResult(true));
            expect(result.factors.unknownElements).toBe(1.0);
        });

        it('should penalize unknown semantic roles', () => {
            const rsnt = createRSNTNode('root', 'FRAME', 'weird-role', 'auto-layout');
            const result = calculateConfidence(baseIntent, rsnt, createValidationResult(true));
            // 1.0 - 0.2 = 0.8
            expect(result.factors.unknownElements).toBeCloseTo(0.8);
        });

        it('should penalize unknown layout primitives', () => {
            const rsnt = createRSNTNode('root', 'FRAME', 'button', 'invalid-layout');
            const result = calculateConfidence(baseIntent, rsnt, createValidationResult(true));
            // 1.0 - 0.15 = 0.85
            expect(result.factors.unknownElements).toBeCloseTo(0.85);
        });
    });

    describe('Factor 5: Nesting Depth', () => {
        const baseIntent = "test intent for nesting depth";

        it('should verify depth scoring', () => {
            // Depth 1
            const d1 = createRSNTNode('root');
            expect(calculateConfidence(baseIntent, d1, createValidationResult(true)).factors.nestingDepth).toBe(1.0);

            // Depth 4 (root -> c1 -> c2 -> c3)
            const d4 = createRSNTNode('root', 'FRAME', 'c', 'l', [
                createRSNTNode('c1', 'FRAME', 'c', 'l', [
                    createRSNTNode('c2', 'FRAME', 'c', 'l', [
                        createRSNTNode('c3')
                    ])
                ])
            ]);
            // 1->2->3->4. Depth 4 falls into 4-5 range (0.95)
            expect(calculateConfidence(baseIntent, d4, createValidationResult(true)).factors.nestingDepth).toBe(0.95);
        });
    });

    describe('Factor 6: AI Self-Assessment & Final Score', () => {
        const baseIntent = "test"; // Short intent triggers ambiguity penalty (-0.3) -> Ambiguity = 0.7
        const baseRSNT = createRSNTNode('root');
        const validation = createValidationResult(true);

        it('should use AI score if it is LOWER than objective score (safety check)', () => {
            // Let's assume objective score is high (~1.0)
            // AI says 0.5
            const result = calculateConfidence(baseIntent, baseRSNT, validation, 0.5);
            expect(result.finalScore).toBe(0.5);
            expect(result.breakdown[6]).toContain('Safety Check');
        });

        it('should ignore AI score if it is HIGHER than objective score', () => {
            // Create a bad scenario to lower objective score
            // Invalid validation result (- large penalty)
            const badValidation = createValidationResult(false, 0, 5); // Score ~0.1

            // AI says 0.9 (overconfident)
            const result = calculateConfidence(baseIntent, baseRSNT, badValidation, 0.9);

            // Expected Calculation:
            // Val: 0.1 (floor) * 0.3 = 0.03
            // Amb: 0.7 (penalty for "test") * 0.2 = 0.14
            // Cpx: 0.4 (0.2/0.5 ratio) * 0.25 = 0.10
            // Unk: 1.0 * 0.15 = 0.15
            // Dep: 1.0 * 0.10 = 0.10
            // Sum: 0.52

            expect(result.finalScore).toBeCloseTo(0.52);
        });
    });

    describe('Breakdown Generation', () => {
        it('should generate human-readable breakdown', () => {
            const result = calculateConfidence("test", createRSNTNode('root'), createValidationResult(true));
            expect(result.breakdown).toHaveLength(7);
            expect(result.breakdown[0]).toContain('Final Score');
            expect(result.breakdown[1]).toContain('Validation');
        });
    });
});
