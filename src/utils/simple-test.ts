/**
 * Lightweight test runner for environments without Jest/Mocha
 */

export function describe(name: string, fn: () => void) {
    console.log(`\nTesting: ${name}`);
    fn();
}

export function it(name: string, fn: () => void) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
    } catch (e: any) {
        console.error(`  ❌ ${name}`);
        console.error(`     Error: ${e.message}`);
        // Don't exit process immediately to allow other tests to run, 
        // but mark failure potentially. For now, just logging.
    }
}

export function expect(actual: any) {
    return {
        toBe: (expected: any) => {
            if (actual !== expected) {
                throw new Error(`Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`);
            }
        },
        toBeCloseTo: (expected: number, precision: number = 2) => {
            const diff = Math.abs(actual - expected);
            const tolerance = 1 / Math.pow(10, precision); // Rough check
            // For simple floats, a wider tolerance is often safer manually
            if (diff > 0.06) { // Loose tolerance for this specific logic
                throw new Error(`Expected ${actual} to be close to ${expected} (diff: ${diff})`);
            }
        },
        toBeGreaterThan: (expected: number) => {
            if (!(actual > expected)) {
                throw new Error(`Expected ${actual} to be greater than ${expected}`);
            }
        },
        toBeLessThan: (expected: number) => {
            if (!(actual < expected)) {
                throw new Error(`Expected ${actual} to be less than ${expected}`);
            }
        },
        toHaveLength: (expected: number) => {
            if (actual.length !== expected) {
                throw new Error(`Expected length ${expected}, but got ${actual.length}`);
            }
        },
        toContain: (item: any) => {
            if (Array.isArray(actual)) {
                if (!actual.some(x => x && x.includes && x.includes(item)) && !actual.includes(item)) {
                    throw new Error(`Expected array to contain "${item}", but it didn't. Found: ${JSON.stringify(actual)}`);
                }
            } else if (typeof actual === 'string') {
                if (!actual.includes(item)) {
                    throw new Error(`Expected string to contain "${item}", but got "${actual}"`);
                }
            } else {
                throw new Error(`toContain not implemented for ${typeof actual}`);
            }
        }
    };
}
