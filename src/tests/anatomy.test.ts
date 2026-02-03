import { analyzeComponentAnatomy, ComponentAnatomy, KNOWN_PATTERNS, LayerNode, matchPatternConfidence } from '../services/anatomy';

// Simple Test Runner
// To run: npx esbuild src/tests/anatomy.test.ts --bundle --platform=node | node

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
        toBeTruthy: () => {
            if (!actual) throw new Error(`Expected truthy, but got ${actual}`);
        },
        toBeGreaterThan: (n: number) => {
            if (actual <= n) throw new Error(`Expected > ${n}, but got ${actual}`);
        },
        toContain: (item: string) => {
            if (typeof actual === 'string' && !actual.includes(item)) {
                throw new Error(`Expected string to contain "${item}", but got "${actual}"`);
            }
        }
    };
}

// --- Mocks ---

const mockButton: LayerNode = {
    id: '1',
    name: 'Button/Primary',
    type: 'COMPONENT',
    width: 120,
    height: 48,
    layoutMode: 'HORIZONTAL',
    children: [
        {
            id: '2',
            name: 'Icon',
            type: 'INSTANCE',
            width: 24,
            height: 24,
            mainComponent: { name: 'Icons/Check' }
        },
        {
            id: '3',
            name: 'Label',
            type: 'TEXT',
            width: 60,
            height: 20
        }
    ]
};

const mockCard: LayerNode = {
    id: '10',
    name: 'Card',
    type: 'COMPONENT',
    width: 300,
    height: 200,
    layoutMode: 'VERTICAL',
    children: [
        {
            id: '11',
            name: 'Image',
            type: 'RECTANGLE',
            width: 300,
            height: 150,
            fills: [{ type: 'IMAGE' }]
        },
        {
            id: '12',
            name: 'Title',
            type: 'TEXT',
            width: 280,
            height: 24
        },
        {
            id: '13',
            name: 'Description',
            type: 'TEXT',
            width: 280,
            height: 40
        }
    ]
};

// --- Tests ---

describe('Anatomy Analysis', () => {

    it('should correctly analyze a Button component', () => {
        const anatomy = analyzeComponentAnatomy(mockButton);

        expect(anatomy.hasIcon).toBeTruthy();
        expect(anatomy.hasLabel).toBeTruthy();
        expect(anatomy.layerCount).toBe(2);
        expect(anatomy.structureSignature).toContain('C>(I+T)');
    });

    it('should correctly analyze a Card component', () => {
        const anatomy = analyzeComponentAnatomy(mockCard);

        expect(anatomy.hasImage).toBeTruthy();
        expect(anatomy.textNodeCount).toBe(2);
        expect(anatomy.layoutInfo.mode).toBe('VERTICAL');
    });

});

describe('Pattern Matching', () => {

    it('should identify a Button as ActionableElement', () => {
        const anatomy = analyzeComponentAnatomy(mockButton);
        const pattern = KNOWN_PATTERNS.find(p => p.name === 'ActionableElement')!;

        const match = matchPatternConfidence(anatomy, pattern);
        // Expect high confidence: hasIcon (30) + hasLabel (30) + height match 48 in 32-56 (15) + Horizontal (15) = ~90/100 -> 0.9
        expect(match.confidence).toBeGreaterThan(0.8);
    });

    it('should not identify Card as InputElement', () => {
        const anatomy = analyzeComponentAnatomy(mockCard);
        const pattern = KNOWN_PATTERNS.find(p => p.name === 'InputElement')!;

        const match = matchPatternConfidence(anatomy, pattern);
        // Expect low confidence: Card height 200 > 48 (-10), Card has multiple text (-20 maybe implied?), Input expects label false (Card has label, -20)
        // Score likely < 0.5
        // Actual calculation:
        // hasLabel: Input=false vs Card=true -> -20
        // height: Input max 48 vs Card 200 -> -10
        // Total negative

        // Actually matchPatternConfidence caps at 0
        if (match.confidence > 0.3) {
            throw new Error(`Confidence too high for Card as Input: ${match.confidence}`);
        }
    });

});
