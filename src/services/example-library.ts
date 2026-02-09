/**
 * Few-shot example library for prompt engineering
 */

import { PromptExample } from './prompt-builder';

export const EXAMPLE_LIBRARY: PromptExample[] = [
    {
        intent: 'Create a simple login form',
        tags: ['form', 'login', 'simple', 'input', 'button'],
        explanation: 'Vertical card with title, two inputs that STRETCH to fill the card width, and a submit button. Inputs use counterAxisSizingMode STRETCH; the button does not (it hugs its label).',
        rsnt: {
            id: 'root',
            type: 'FRAME',
            width: 1440,
            height: 816,
            layoutMode: 'VERTICAL',
            primaryAxisAlignItems: 'CENTER',
            counterAxisAlignItems: 'CENTER',
            padding: { top: 48, right: 120, bottom: 48, left: 120 },
            children: [
                {
                    id: 'login-card',
                    type: 'FRAME',
                    width: 400,
                    layoutMode: 'VERTICAL',
                    itemSpacing: 24,
                    padding: { top: 32, right: 32, bottom: 32, left: 32 },
                    fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }],
                    cornerRadius: 8,
                    children: [
                        {
                            id: 'title',
                            type: 'TEXT',
                            characters: 'Welcome back',
                            fontSize: 24
                        },
                        {
                            id: 'subtitle',
                            type: 'TEXT',
                            characters: 'Sign in to your account',
                            fontSize: 14,
                            fills: [{ type: 'SOLID', color: { r: 0.4, g: 0.4, b: 0.4 } }]
                        },
                        {
                            id: 'email-input',
                            type: 'COMPONENT_INSTANCE',
                            componentId: 'input-component-id',
                            characters: 'Email',
                            properties: { "label": "true" }
                        },
                        {
                            id: 'password-input',
                            type: 'COMPONENT_INSTANCE',
                            componentId: 'input-component-id',
                            characters: 'Password',
                            properties: { "label": "true" }
                        },
                        {
                            id: 'submit-btn',
                            type: 'COMPONENT_INSTANCE',
                            componentId: 'button-component-id',
                            characters: 'Sign In',
                            properties: { "Style": "primary" }
                        }
                    ]
                }
            ]
        }
    },
    {
        intent: 'Create both desktop and mobile signup pages',
        tags: ['multi-page', 'responsive', 'signup', 'form'],
        explanation: 'Root frame is HORIZONTAL to hold two pages side by side. Each page has explicit width+height. Inner form card has fixed width and VERTICAL layout.',
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
                    fills: [{ type: 'SOLID', color: { r: 0.97, g: 0.97, b: 0.97 } }],
                    children: [
                        {
                            id: 'signup-card',
                            type: 'FRAME',
                            width: 440,
                            layoutMode: 'VERTICAL',
                            itemSpacing: 20,
                            padding: { top: 40, right: 32, bottom: 40, left: 32 },
                            fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }],
                            cornerRadius: 8,
                            children: [
                                { id: 'desktop-heading', type: 'TEXT', characters: 'Create account', fontSize: 24 },
                                { id: 'desktop-sub', type: 'TEXT', characters: 'Fill in the details below', fontSize: 14, fills: [{ type: 'SOLID', color: { r: 0.4, g: 0.4, b: 0.4 } }] },
                                { id: 'desktop-name', type: 'COMPONENT_INSTANCE', componentId: 'input-component-id', characters: 'Full name' },
                                { id: 'desktop-email', type: 'COMPONENT_INSTANCE', componentId: 'input-component-id', characters: 'Email' },
                                { id: 'desktop-submit', type: 'COMPONENT_INSTANCE', componentId: 'button-component-id', characters: 'Sign Up', properties: { "Style": "primary" } }
                            ]
                        }
                    ]
                },
                {
                    id: 'mobile-page',
                    type: 'FRAME',
                    width: 375,
                    height: 812,
                    layoutMode: 'VERTICAL',
                    padding: { top: 64, right: 20, bottom: 32, left: 20 },
                    fills: [{ type: 'SOLID', color: { r: 0.97, g: 0.97, b: 0.97 } }],
                    children: [
                        { id: 'mobile-heading', type: 'TEXT', characters: 'Create account', fontSize: 24 },
                        { id: 'mobile-sub', type: 'TEXT', characters: 'Fill in the details below', fontSize: 14, fills: [{ type: 'SOLID', color: { r: 0.4, g: 0.4, b: 0.4 } }] },
                        { id: 'mobile-name', type: 'COMPONENT_INSTANCE', componentId: 'input-component-id', characters: 'Full name' },
                        { id: 'mobile-email', type: 'COMPONENT_INSTANCE', componentId: 'input-component-id', characters: 'Email' },
                        { id: 'mobile-submit', type: 'COMPONENT_INSTANCE', componentId: 'button-component-id', characters: 'Sign Up', properties: { "Style": "primary" } }
                    ]
                }
            ]
        }
    },
    {
        intent: 'Create a dashboard with 3 cards in a row',
        tags: ['dashboard', 'cards', 'grid', 'layout'],
        explanation: 'Root desktop frame. Inner row is HORIZONTAL with 3 card FRAMEs. Each card uses counterAxisSizingMode STRETCH so they fill equal height. Cards have internal padding and a title + body with different font sizes.',
        rsnt: {
            id: 'root',
            type: 'FRAME',
            width: 1440,
            height: 816,
            layoutMode: 'VERTICAL',
            padding: { top: 48, right: 120, bottom: 48, left: 120 },
            fills: [{ type: 'SOLID', color: { r: 0.96, g: 0.96, b: 0.96 } }],
            children: [
                {
                    id: 'page-header',
                    type: 'TEXT',
                    characters: 'Dashboard',
                    fontSize: 32
                },
                {
                    id: 'cards-row',
                    type: 'FRAME',
                    layoutMode: 'HORIZONTAL',
                    counterAxisSizingMode: 'AUTO',
                    itemSpacing: 24,
                    children: [
                        {
                            id: 'card-1',
                            type: 'FRAME',
                            layoutMode: 'VERTICAL',
                            counterAxisSizingMode: 'AUTO',
                            itemSpacing: 8,
                            padding: { top: 24, right: 24, bottom: 24, left: 24 },
                            fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }],
                            cornerRadius: 8,
                            children: [
                                { id: 'card-1-title', type: 'TEXT', characters: 'Total Users', fontSize: 14, fills: [{ type: 'SOLID', color: { r: 0.4, g: 0.4, b: 0.4 } }] },
                                { id: 'card-1-value', type: 'TEXT', characters: '2,847', fontSize: 32 }
                            ]
                        },
                        {
                            id: 'card-2',
                            type: 'FRAME',
                            layoutMode: 'VERTICAL',
                            counterAxisSizingMode: 'AUTO',
                            itemSpacing: 8,
                            padding: { top: 24, right: 24, bottom: 24, left: 24 },
                            fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }],
                            cornerRadius: 8,
                            children: [
                                { id: 'card-2-title', type: 'TEXT', characters: 'Revenue', fontSize: 14, fills: [{ type: 'SOLID', color: { r: 0.4, g: 0.4, b: 0.4 } }] },
                                { id: 'card-2-value', type: 'TEXT', characters: '$12,400', fontSize: 32 }
                            ]
                        },
                        {
                            id: 'card-3',
                            type: 'FRAME',
                            layoutMode: 'VERTICAL',
                            counterAxisSizingMode: 'AUTO',
                            itemSpacing: 8,
                            padding: { top: 24, right: 24, bottom: 24, left: 24 },
                            fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }],
                            cornerRadius: 8,
                            children: [
                                { id: 'card-3-title', type: 'TEXT', characters: 'Conversion', fontSize: 14, fills: [{ type: 'SOLID', color: { r: 0.4, g: 0.4, b: 0.4 } }] },
                                { id: 'card-3-value', type: 'TEXT', characters: '3.2%', fontSize: 32 }
                            ]
                        }
                    ]
                }
            ]
        }
    },
    {
        intent: 'Create a settings page with checkboxes',
        tags: ['settings', 'checkbox', 'list', 'vertical'],
        explanation: 'Root desktop frame with a section heading (large) and a sub-label (small) to show hierarchy. Checkbox components sit in a vertical list with consistent 16px gaps.',
        rsnt: {
            id: 'root',
            type: 'FRAME',
            width: 1440,
            height: 816,
            layoutMode: 'VERTICAL',
            padding: { top: 48, right: 120, bottom: 48, left: 120 },
            children: [
                {
                    id: 'settings-heading',
                    type: 'TEXT',
                    characters: 'Settings',
                    fontSize: 32
                },
                {
                    id: 'settings-sub',
                    type: 'TEXT',
                    characters: 'Manage your preferences',
                    fontSize: 14,
                    fills: [{ type: 'SOLID', color: { r: 0.4, g: 0.4, b: 0.4 } }]
                },
                {
                    id: 'notifications-section',
                    type: 'FRAME',
                    layoutMode: 'VERTICAL',
                    counterAxisSizingMode: 'AUTO',
                    itemSpacing: 16,
                    padding: { top: 24, right: 24, bottom: 24, left: 24 },
                    fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }],
                    cornerRadius: 8,
                    children: [
                        { id: 'section-label', type: 'TEXT', characters: 'Notifications', fontSize: 20 },
                        { id: 'option-1', type: 'COMPONENT_INSTANCE', componentId: 'checkbox-component-id', characters: 'Email notifications' },
                        { id: 'option-2', type: 'COMPONENT_INSTANCE', componentId: 'checkbox-component-id', characters: 'Push notifications' },
                        { id: 'option-3', type: 'COMPONENT_INSTANCE', componentId: 'checkbox-component-id', characters: 'SMS alerts' }
                    ]
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
