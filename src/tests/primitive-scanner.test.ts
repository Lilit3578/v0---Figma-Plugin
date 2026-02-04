import {
    findClosestColor,
    findClosestSpacing,
    findClosestRadius,
    generateColorWarning,
    generateSpacingWarning,
    generateRadiusWarning
} from '../services/primitive-scanner';

// Simple Test Runner
function describe(name: string, fn: () => void) {
    console.log(`\n📦 ${name}`);
    fn();
}

function it(name: string, fn: () => void) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
    } catch (e) {
        console.error(`  ❌ ${name}`);
        console.error(e);
    }
}

function expect(actual: any) {
    return {
        toBe: (expected: any) => {
            if (actual !== expected) {
                throw new Error(`Expected ${expected}, but got ${actual}`);
            }
        },
        toBeCloseTo: (expected: number, precision: number = 2) => {
            if (Math.abs(actual - expected) > Math.pow(10, -precision)) {
                throw new Error(`Expected ${expected} (close to), but got ${actual}`);
            }
        },
        toBeTruthy: () => {
            if (!actual) throw new Error(`Expected truthy, but got ${actual}`);
        },
        toBeNull: () => {
            if (actual !== null) throw new Error(`Expected null, but got ${actual}`);
        }
    };
}

// --- Tests ---

describe('Primitive Scanner - Proximity Matching', () => {

    const colorInventory = new Map<string, number>([
        ['#FF0000', 50],  // Red (High Freq)
        ['#00FF00', 10],  // Green
        ['#0000FF', 5],   // Blue
        ['#FF0505', 2]    // Slightly off Red (Low Freq)
    ]);

    const spacingInventory = new Map<number, number>([
        [16, 50],  // Standard spacing (High Freq)
        [24, 20],
        [8, 10],
        [4, 5],
        [17, 2]    // 17px (Low Freq)
    ]);

    const radiusInventory = new Map<number, number>([
        [4, 20],
        [8, 10],
        [0, 50]
    ]);


    // Color Matching Tests
    it('finds exact color match', () => {
        const match = findClosestColor('#FF0000', colorInventory);

        expect(match).toBeTruthy();
        expect(match?.color).toBe('#FF0000');
        expect(match?.deltaE).toBe(0);
        expect(match?.frequency).toBe(50);
        // Confidence should be high (deltaE < 2 -> 0.8) + freq boost (+0.05) + max freq boost +0.10 => 0.95
        // Wait, maxFrequency logic: max in provided map is 50.
        // 0.8 + 0.05 + 0.10 = 0.95.
        // Actually logic is Math.min(..., 1.0)
        expect(match!.confidence).toBeCloseTo(0.95);
    });

    it('prefers high frequency color over slightly closer low frequency color', () => {
        // Target is #FF0202
        // Distance to #FF0000 (Freq 50) is very, very small
        // Distance to #FF0505 (Freq 2) is also small
        // Weighted distance should prefer #FF0000 due to high freq
        const match = findClosestColor('#FF0202', colorInventory);

        expect(match).toBeTruthy();
        expect(match?.color).toBe('#FF0000');
    });

    it('returns null for colors exceeding deltaE threshold', () => {
        // Black #000000 - far from R, G, B
        const match = findClosestColor('#000000', colorInventory);
        expect(match).toBeNull();
    });

    // Spacing Matching Tests
    it('finds exact spacing match', () => {
        const match = findClosestSpacing(16, spacingInventory);
        expect(match).toBeTruthy();
        expect(match?.value).toBe(16);
        expect(match?.distance).toBe(0);
        expect(match?.frequency).toBe(50);
        // Confidence: 0.9 (exact) + 0.05 (freq >= 20) + 0.05 (max freq) = 1.0
        expect(match?.confidence).toBe(1.0);
    });

    it('finds closest spacing match', () => {
        // Target 15. should match 16
        const match = findClosestSpacing(15, spacingInventory);
        expect(match).toBeTruthy();
        expect(match?.value).toBe(16);
        expect(match?.distance).toBe(1);
    });

    it('prefers frequent spacing values', () => {
        // Target 16.5
        // 16 is dist 0.5, freq 50
        // 17 is dist 0.5, freq 2
        // Weighted distance:
        // 16: 0.5 / log(52) ~= 0.5 / 3.95 = 0.12
        // 17: 0.5 / log(4) ~= 0.5 / 1.38 = 0.36
        // Should pick 16
        const match = findClosestSpacing(16.5, spacingInventory);
        expect(match?.value).toBe(16);
    });

    // Radius Matching Tests
    it('finds closest radius match', () => {
        const match = findClosestRadius(5, radiusInventory);
        // 4 (dist 1) vs 8 (dist 3)
        expect(match?.value).toBe(4);
    });

});

describe('Primitive Scanner - Warnings', () => {
    it('generates correct color warning', () => {
        const match = { color: '#FF0000', deltaE: 2.5, frequency: 10, confidence: 0.7 };
        const warning = generateColorWarning('#FF0022', match);
        expect(warning).toBe('Color approximated: using #FF0000 instead of #FF0022 (ΔE = 2.5, used 10 times)');
    });

    it('generates correct spacing warning (exact)', () => {
        const match = { value: 16, distance: 0, frequency: 10, confidence: 1.0 };
        const warning = generateSpacingWarning(16, match, 'Padding top');
        expect(warning).toBe('Padding top: exact match 16px (used 10 times)');
    });

    it('generates correct spacing warning (approx)', () => {
        const match = { value: 20, distance: 4, frequency: 10, confidence: 0.7 };
        const warning = generateSpacingWarning(16, match, 'Padding top');
        expect(warning).toBe('Padding top approximated: using 20px instead of 16px (closest available, used 10 times)');
    });
});
