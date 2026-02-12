/**
 * Design Pattern Library
 * Encodes common UI patterns and their spatial rules
 */

import { DesignSystemInventory } from './auto-discovery';
import { RSNT_Node } from '../types/rsnt';

export interface DesignPattern {
    name: string;
    triggers: string[];              // Keywords that activate this pattern
    layout: {
        mode: 'VERTICAL' | 'HORIZONTAL' | 'NONE';
        distribution: string;           // "equal" | "70-30" | "sidebar-main"
        wrapping: boolean;
    };
    hierarchy: {
        heroElement: boolean;
        contentFirst: boolean;          // Content before actions?
        ctaPlacement: 'top' | 'bottom' | 'inline' | 'floating';
    };
    spacing: {
        internal: string;               // Token tier (xs, sm, md, lg, xl)
        external: string;
        priority: 'compact' | 'standard' | 'generous';
    };
    validationRules: string[];        // Things to check/enforce
}

export const PATTERN_LIBRARY: DesignPattern[] = [
    {
        name: 'F-Pattern Form',
        triggers: ['form', 'login', 'signup', 'register', 'checkout', 'contact'],
        layout: {
            mode: 'VERTICAL',
            distribution: 'equal',
            wrapping: false
        },
        hierarchy: {
            heroElement: false,
            contentFirst: true,
            ctaPlacement: 'bottom'
        },
        spacing: {
            internal: 'md',
            external: 'lg',
            priority: 'standard'
        },
        validationRules: [
            'All inputs must have labels',
            'Primary CTA must be at bottom',
            'No more than one primary CTA'
        ]
    },

    {
        name: 'Z-Pattern Landing',
        triggers: ['landing', 'hero', 'marketing', 'splash', 'home'],
        layout: {
            mode: 'VERTICAL',
            distribution: 'hero-features-cta',
            wrapping: false
        },
        hierarchy: {
            heroElement: true,
            contentFirst: true,
            ctaPlacement: 'inline'
        },
        spacing: {
            internal: 'xl',
            external: '2xl',
            priority: 'generous'
        },
        validationRules: [
            'Must have hero section at top',
            'CTAs inline with content',
            'Large spacing between sections'
        ]
    },

    {
        name: 'Grid Gallery',
        triggers: ['gallery', 'products', 'catalog', 'browse', 'shop', 'items'],
        layout: {
            mode: 'HORIZONTAL',
            distribution: 'equal',
            wrapping: true
        },
        hierarchy: {
            heroElement: false,
            contentFirst: false,
            ctaPlacement: 'bottom'
        },
        spacing: {
            internal: 'lg',
            external: 'lg',
            priority: 'standard'
        },
        validationRules: [
            'Items should have equal visual weight',
            'Consistent spacing between items',
            'Should wrap to multiple rows'
        ]
    },

    {
        name: 'Dashboard Split',
        triggers: ['dashboard', 'analytics', 'admin', 'overview', 'stats'],
        layout: {
            mode: 'HORIZONTAL',
            distribution: '20-80',
            wrapping: false
        },
        hierarchy: {
            heroElement: false,
            contentFirst: false,
            ctaPlacement: 'top'
        },
        spacing: {
            internal: 'lg',
            external: 'xl',
            priority: 'standard'
        },
        validationRules: [
            'Sidebar should be 20-25% width',
            'Main content area should be flexible',
            'Key metrics should be prominent'
        ]
    },

    {
        name: 'Settings List',
        triggers: ['settings', 'preferences', 'account', 'profile', 'options'],
        layout: {
            mode: 'VERTICAL',
            distribution: 'equal',
            wrapping: false
        },
        hierarchy: {
            heroElement: false,
            contentFirst: true,
            ctaPlacement: 'bottom'
        },
        spacing: {
            internal: 'md',
            external: 'lg',
            priority: 'compact'
        },
        validationRules: [
            'Group related settings together',
            'Use sections with headings',
            'Save button at bottom'
        ]
    }
];

/**
 * Detect which pattern best matches the user intent
 */
export function detectPattern(intent: string): DesignPattern | null {
    const lower = intent.toLowerCase();

    // Find pattern with most matching triggers
    let bestMatch: { pattern: DesignPattern; score: number } | null = null;

    for (const pattern of PATTERN_LIBRARY) {
        const matches = pattern.triggers.filter(trigger => lower.includes(trigger));
        const score = matches.length;

        if (score > 0 && (!bestMatch || score > bestMatch.score)) {
            bestMatch = { pattern, score };
        }
    }

    if (bestMatch) {
        console.log(`[Pattern] Detected: ${bestMatch.pattern.name} (${bestMatch.score} matches)`);
        return bestMatch.pattern;
    }

    console.log('[Pattern] No pattern detected, using default');
    return null;
}

/**
 * Validate RSNT against pattern rules
 */
export function validateAgainstPattern(
    rsnt: RSNT_Node,
    pattern: DesignPattern,
    intent: any
): { valid: boolean; violations: string[] } {
    const violations: string[] = [];

    for (const rule of pattern.validationRules) {
        // Check "All inputs must have labels"
        if (rule.includes('inputs must have labels')) {
            const inputs = findNodesByType(rsnt, 'input');
            for (const input of inputs) {
                if (!input.properties?.label && !input.characters) {
                    violations.push(`Input "${input.name}" missing label`);
                }
            }
        }

        // Check "Primary CTA must be at bottom"
        if (rule.includes('Primary CTA must be at bottom')) {
            const buttons = findNodesByType(rsnt, 'button');
            const primaryButton = buttons.find(b =>
                b.properties?.variant === 'primary' ||
                b.properties?.Style === 'primary'
            );

            if (primaryButton && rsnt.children) {
                const lastChild = rsnt.children[rsnt.children.length - 1];
                if (lastChild.id !== primaryButton.id) {
                    violations.push('Primary CTA not at bottom (should be last child)');
                }
            }
        }

        // Check "No more than one primary CTA"
        if (rule.includes('No more than one primary CTA')) {
            const primaryButtons = findPrimaryButtons(rsnt);
            if (primaryButtons.length > 1) {
                violations.push(`Found ${primaryButtons.length} primary CTAs (should be 1)`);
            }
        }
    }

    return {
        valid: violations.length === 0,
        violations
    };
}

/**
 * Auto-fix pattern violations
 */
export function fixPatternViolations(
    rsnt: RSNT_Node,
    pattern: DesignPattern,
    intent: any
): { fixed: RSNT_Node; fixes: string[] } {
    const fixes: string[] = [];
    // Deep clone to avoid mutating the original tree (spread is shallow and shares children by reference)
    const fixed: RSNT_Node = JSON.parse(JSON.stringify(rsnt));

    // Fix: Move primary CTA to bottom
    if (pattern.hierarchy.ctaPlacement === 'bottom' && fixed.children) {
        const primaryButtons = findPrimaryButtons(fixed);
        if (primaryButtons.length > 0) {
            const primaryButton = primaryButtons[0];

            // Remove from current position
            fixed.children = fixed.children.filter(c => c.id !== primaryButton.id);

            // Add to end
            fixed.children.push(primaryButton);
            fixes.push(`Moved primary CTA "${primaryButton.name}" to bottom`);
        }
    }

    // Fix: Demote extra primary CTAs to secondary
    const primaryButtons = findPrimaryButtons(fixed);
    if (primaryButtons.length > 1) {
        for (let i = 1; i < primaryButtons.length; i++) {
            const button = primaryButtons[i];
            if (button.properties) {
                button.properties.variant = 'secondary';
                button.properties.Style = 'secondary';
                fixes.push(`Demoted "${button.name}" to secondary (only one primary allowed)`);
            }
        }
    }

    return { fixed, fixes };
}

// Helper functions

function findNodesByType(node: RSNT_Node, type: string): RSNT_Node[] {
    const results: RSNT_Node[] = [];

    function traverse(n: RSNT_Node) {
        if (n.type === type || n.name?.toLowerCase().includes(type)) {
            results.push(n);
        }
        n.children?.forEach(traverse);
    }

    traverse(node);
    return results;
}

function findPrimaryButtons(node: RSNT_Node): RSNT_Node[] {
    const results: RSNT_Node[] = [];

    function traverse(n: RSNT_Node) {
        if (n.type === 'COMPONENT_INSTANCE' || n.name?.toLowerCase().includes('button')) {
            if (n.properties?.variant === 'primary' || n.properties?.Style === 'primary') {
                results.push(n);
            }
        }
        n.children?.forEach(traverse);
    }

    traverse(node);
    return results;
}

/**
 * Validate and fix RSNT against patterns (convenience method)
 */
export function validateAndFix(
    rsnt: RSNT_Node,
    intent: any
): { fixedRoot: RSNT_Node; violations: string[] } {
    // Detect pattern first
    const pattern = detectPattern(intent.description || intent.type);

    if (!pattern) {
        return { fixedRoot: rsnt, violations: [] };
    }

    const validation = validateAgainstPattern(rsnt, pattern, intent);

    if (validation.valid) {
        return { fixedRoot: rsnt, violations: [] };
    }

    // Try to fix
    const { fixed } = fixPatternViolations(rsnt, pattern, intent);

    return {
        fixedRoot: fixed,
        violations: validation.violations
    };
}

export const designPatternService = {
    detectPattern,
    validateAgainstPattern,
    fixPatternViolations,
    validateAndFix
};
