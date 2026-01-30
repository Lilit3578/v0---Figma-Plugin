/**
 * Few-shot example library for prompt engineering
 */

import { PromptExample } from './prompt-builder';

export const EXAMPLE_LIBRARY: PromptExample[] = [
    {
        intent: 'Create a simple login form',
        tags: ['form', 'login', 'simple', 'input', 'button'],
        explanation: 'Simple vertical form with email, password, and submit button',
        rsnt: {
            id: 'login-form',
            type: 'FRAME',
            layoutMode: 'VERTICAL',
            itemSpacing: 16,
            padding: { top: 32, right: 32, bottom: 32, left: 32 },
            fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }],
            children: [
                {
                    id: 'title',
                    type: 'TEXT',
                    characters: 'Login',
                    fontSize: 24,
                    fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1 } }]
                },
                {
                    id: 'email-input',
                    type: 'COMPONENT_INSTANCE',
                    componentId: 'input-component-id',
                    properties: { "label": "true", "helperText": "true" }
                },
                {
                    id: 'password-input',
                    type: 'COMPONENT_INSTANCE',
                    componentId: 'input-component-id',
                    properties: { "label": "true", "helperText": "false" }
                },
                {
                    id: 'submit-btn',
                    type: 'COMPONENT_INSTANCE',
                    componentId: 'button-component-id',
                    properties: { "state": "default", "size": "large" }
                }
            ]
        }
    },
    {
        intent: 'Create both desktop and mobile signup pages',
        tags: ['multi-page', 'responsive', 'signup', 'form'],
        explanation: 'Multi-page layout with desktop (1440x1024) and mobile (375x812) versions',
        rsnt: {
            id: 'pages-container',
            type: 'FRAME',
            layoutMode: 'HORIZONTAL',
            itemSpacing: 48,
            padding: { top: 48, right: 48, bottom: 48, left: 48 },
            children: [
                {
                    id: 'desktop-page',
                    type: 'FRAME',
                    width: 1440,
                    height: 1024,
                    layoutMode: 'VERTICAL',
                    primaryAxisAlignItems: 'CENTER',
                    counterAxisAlignItems: 'CENTER',
                    children: [
                        {
                            id: 'signup-form',
                            type: 'FRAME',
                            layoutMode: 'VERTICAL',
                            itemSpacing: 16,
                            children: []
                        }
                    ]
                },
                {
                    id: 'mobile-page',
                    type: 'FRAME',
                    width: 375,
                    height: 812,
                    layoutMode: 'VERTICAL',
                    children: []
                }
            ]
        }
    },
    {
        intent: 'Create a dashboard with 3 cards in a row',
        tags: ['dashboard', 'cards', 'grid', 'layout'],
        explanation: 'Horizontal layout with 3 card components using auto-layout',
        rsnt: {
            id: 'dashboard',
            type: 'FRAME',
            layoutMode: 'HORIZONTAL',
            itemSpacing: 24,
            padding: { top: 24, right: 24, bottom: 24, left: 24 },
            children: [
                {
                    id: 'card-1',
                    type: 'COMPONENT_INSTANCE',
                    componentId: 'card-component-id'
                },
                {
                    id: 'card-2',
                    type: 'COMPONENT_INSTANCE',
                    componentId: 'card-component-id'
                },
                {
                    id: 'card-3',
                    type: 'COMPONENT_INSTANCE',
                    componentId: 'card-component-id'
                }
            ]
        }
    },
    {
        intent: 'Create a settings page with checkboxes',
        tags: ['settings', 'checkbox', 'list', 'vertical'],
        explanation: 'Vertical list of checkbox components with labels',
        rsnt: {
            id: 'settings-page',
            type: 'FRAME',
            layoutMode: 'VERTICAL',
            itemSpacing: 12,
            padding: { top: 24, right: 24, bottom: 24, left: 24 },
            children: [
                {
                    id: 'title',
                    type: 'TEXT',
                    characters: 'Settings',
                    fontSize: 20
                },
                {
                    id: 'option-1',
                    type: 'COMPONENT_INSTANCE',
                    componentId: 'checkbox-component-id'
                },
                {
                    id: 'option-2',
                    type: 'COMPONENT_INSTANCE',
                    componentId: 'checkbox-component-id'
                },
                {
                    id: 'option-3',
                    type: 'COMPONENT_INSTANCE',
                    componentId: 'checkbox-component-id'
                }
            ]
        }
    }
];

/**
 * Select most relevant examples based on intent
 */
export function selectRelevantExamples(intent: string, count: number = 3): PromptExample[] {
    const intentLower = intent.toLowerCase();
    const intentWords = intentLower.split(/\s+/);

    // Score each example based on tag matches
    const scored = EXAMPLE_LIBRARY.map(example => {
        let score = 0;

        for (const tag of example.tags) {
            if (intentLower.includes(tag)) {
                score += 10;
            }

            for (const word of intentWords) {
                if (tag.includes(word) || word.includes(tag)) {
                    score += 5;
                }
            }
        }

        return { example, score };
    });

    // Sort by score and return top N
    const selected = scored
        .sort((a, b) => b.score - a.score)
        .slice(0, count)
        .map(s => s.example);

    console.log(`Selected ${selected.length} examples: ${selected.map(e => e.intent).join(', ')}`);

    return selected;
}
