/**
 * Intent Parser - Converts natural language to structured requirements
 *
 * This is Phase 2 of the Antigravity approach: Parse user prompts into
 * a structured DesignIntent before making design decisions.
 */

import { extractJSON } from '../utils/json-utils';
import { DesignSystemInventory, ComponentInfo } from './auto-discovery';

// ============================================================================
// TYPES
// ============================================================================

export type IntentType = 'form' | 'card' | 'modal' | 'page' | 'section' | 'list' | 'navigation' | 'dashboard';

export interface ComponentRequirement {
    type: 'input' | 'button' | 'text' | 'heading' | 'image' | 'icon' | 'divider' | 'card' | 'list' | 'checkbox' | 'radio' | 'select' | 'toggle' | 'avatar' | 'badge' | 'tag' | 'custom';
    label?: string;
    placeholder?: string;
    inputType?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search' | 'date';
    variant?: 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'destructive';
    required?: boolean;
    text?: string;
    level?: 1 | 2 | 3 | 4 | 5 | 6; // For headings
    items?: string[]; // For lists, selects
    defaultValue?: string;
}

export interface LayoutRequirement {
    direction: 'vertical' | 'horizontal' | 'grid';
    spacing: 'tight' | 'normal' | 'relaxed';
    alignment: 'start' | 'center' | 'end' | 'stretch';
    maxWidth?: number;
    columns?: number; // For grid
    wrap?: boolean;
}

export interface ConstraintRequirement {
    purpose: string; // e.g., 'authentication', 'data-entry', 'display'
    context: string; // e.g., 'login', 'signup', 'checkout'
    platform?: 'desktop' | 'mobile' | 'responsive';
    style?: 'minimal' | 'detailed' | 'compact';
}

export interface DesignIntent {
    type: IntentType;
    title?: string;
    description?: string;
    components: ComponentRequirement[];
    layout: LayoutRequirement;
    constraints: ConstraintRequirement;
    sections?: {
        title: string;
        components: ComponentRequirement[];
    }[];
    confidence: number;
    reasoning: string;
    // Iteration support
    isIteration?: boolean;
    iterationTarget?: string;
    iterationAction?: string; // 'style' | 'layout' | 'content' | 'add' | 'remove'
}

// ============================================================================
// INTENT PARSER
// ============================================================================

export class IntentParser {
    constructor(
        private inventory: DesignSystemInventory,
        private aiCall: (prompt: string, systemPrompt: string) => Promise<string>
    ) { }

    /**
     * Parse a user prompt into structured DesignIntent
     */
    async parse(userPrompt: string): Promise<DesignIntent> {
        // 2. Initial regex-based intent classification
        const iterationCheck = this.isIterationRequest(userPrompt);

        // 3. Construct prompt for the LLM
        const systemPrompt = this.buildSystemPrompt();
        const userMessage = this.buildUserMessage(userPrompt);

        const response = await this.aiCall(userMessage, systemPrompt);

        try {
            // Extract JSON from response (robustly handling markdown/conversational text)
            const parsed = extractJSON(response);

            return this.validateAndEnrich(parsed, userPrompt);
        } catch (error) {
            console.error('Failed to parse intent:', error);
            // Fallback: return a basic intent
            return this.createFallbackIntent(userPrompt);
        }
    }

    private buildSystemPrompt(): string {
        // Get available component types from inventory
        const componentTypes = this.getComponentTypes();

        return `You are an expert UI/UX designer who parses user requests into structured design requirements.

AVAILABLE DESIGN SYSTEM:
- Component Types: ${componentTypes.join(', ')}
- Spacing Scale: ${this.inventory.guidelines?.spacing.scale.join(', ') || '4, 8, 12, 16, 24, 32, 48'}
- Font Sizes: ${this.inventory.guidelines?.typography.sizes?.join(', ') || '12, 14, 16, 18, 20, 24, 32'}

YOUR TASK:
Parse the user's request into a structured JSON format. Extract:
1. The type of UI element (form, card, modal, page, section, list, navigation, dashboard)
2. Required components (inputs, buttons, text, headings, etc.)
3. Layout requirements (direction, spacing, alignment)
4. Constraints (purpose, context, platform)

RESPONSE FORMAT (JSON only, no explanation):
{
    "type": "form|card|modal|page|section|list|navigation|dashboard",
    "title": "optional title",
    "components": [
        {
            "type": "input|button|text|heading|image|icon|divider|card|list|checkbox|radio|select|toggle|avatar|badge|tag",
            "label": "field label",
            "inputType": "text|email|password|number|tel|url|search|date",
            "variant": "primary|secondary|tertiary|ghost|destructive",
            "required": true|false,
            "text": "for text/heading content",
            "level": 1-6 (for headings)
        }
    ],
    "layout": {
        "direction": "vertical|horizontal|grid",
        "spacing": "tight|normal|relaxed",
        "alignment": "start|center|end|stretch",
        "maxWidth": number (optional),
        "columns": number (for grid)
    },
    "constraints": {
        "purpose": "authentication|data-entry|display|action|navigation",
        "context": "specific context like login, signup, checkout",
        "platform": "desktop|mobile|responsive",
        "style": "minimal|detailed|compact"
    },
    "confidence": 0.0-1.0,
    "reasoning": "brief explanation of your interpretation"
}

RULES:
1. Be thorough - extract ALL components mentioned or implied
2. Infer missing details from context (login form needs email + password + submit button)
3. Set confidence based on how clear the request is
4. Include reasoning to explain your interpretation
5. For ambiguous requests, choose sensible defaults but lower confidence`;
    }

    private buildUserMessage(prompt: string): string {
        return `Parse this UI request into structured requirements:

"${prompt}"

Return ONLY valid JSON matching the schema. No explanation outside JSON.`;
    }

    private getComponentTypes(): string[] {
        const types = new Set<string>();

        for (const comp of this.inventory.components) {
            // Extract component type from name (e.g., "Button/Primary" -> "Button")
            const baseName = comp.name.split('/')[0].split(' ')[0].toLowerCase();
            types.add(baseName);
        }

        // Add standard types
        ['input', 'button', 'text', 'heading', 'card', 'modal', 'form'].forEach(t => types.add(t));

        return Array.from(types);
    }

    private validateAndEnrich(parsed: any, originalPrompt: string): DesignIntent {
        // Ensure required fields exist with defaults
        const intent: DesignIntent = {
            type: parsed.type || this.inferType(originalPrompt),
            title: parsed.title,
            description: parsed.description,
            components: this.validateComponents(parsed.components || []),
            layout: {
                direction: parsed.layout?.direction || 'vertical',
                spacing: parsed.layout?.spacing || 'normal',
                alignment: parsed.layout?.alignment || 'stretch',
                maxWidth: parsed.layout?.maxWidth,
                columns: parsed.layout?.columns,
                wrap: parsed.layout?.wrap,
            },
            constraints: {
                purpose: parsed.constraints?.purpose || 'display',
                context: parsed.constraints?.context || 'general',
                platform: parsed.constraints?.platform || 'desktop',
                style: parsed.constraints?.style || 'detailed',
            },
            sections: parsed.sections,
            confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.7,
            reasoning: parsed.reasoning || 'Parsed from user request',
        };

        // Check for iteration if not explicitly handled by AI
        const iterationCheck = this.isIterationRequest(originalPrompt);
        if (iterationCheck.isIteration) {
            intent.isIteration = true;
            intent.iterationTarget = iterationCheck.targetElement;
            intent.iterationAction = iterationCheck.modification;
        }

        // Enrich with inferred components if missing
        intent.components = this.enrichComponents(intent);

        return intent;
    }

    private isIterationRequest(prompt: string): { isIteration: boolean; targetElement?: string; modification?: string } {
        const iterationPatterns = [
            /make (?:the )?(\w+) (?:button|element) (\w+)/i,  // "make the 2nd button secondary"
            /change (?:the )?(\w+) to (\w+)/i,                 // "change the button to secondary"
            /update (?:the )?(\w+)/i,                          // "update the heading"
            /remove (?:the )?(\w+)/i,                          // "remove the image"
            /add (?:a )?(\w+)/i,                               // "add a button"
        ];

        for (const pattern of iterationPatterns) {
            const match = prompt.match(pattern);
            if (match) {
                return {
                    isIteration: true,
                    targetElement: match[1],
                    modification: match[0], // Store full command for now, or match[2] for property
                };
            }
        }

        return { isIteration: false };
    }

    private validateComponents(components: any[]): ComponentRequirement[] {
        if (!Array.isArray(components)) return [];

        return components.map(c => ({
            type: c.type || 'text',
            label: c.label,
            placeholder: c.placeholder,
            inputType: c.inputType,
            variant: c.variant,
            required: c.required,
            text: c.text,
            level: c.level,
            items: c.items,
            defaultValue: c.defaultValue,
        }));
    }

    private inferType(prompt: string): IntentType {
        const lower = prompt.toLowerCase();

        if (lower.includes('form') || lower.includes('login') || lower.includes('signup') || lower.includes('register')) {
            return 'form';
        }
        if (lower.includes('card')) return 'card';
        if (lower.includes('modal') || lower.includes('dialog') || lower.includes('popup')) return 'modal';
        if (lower.includes('page') || lower.includes('screen')) return 'page';
        if (lower.includes('nav') || lower.includes('menu') || lower.includes('sidebar')) return 'navigation';
        if (lower.includes('dashboard') || lower.includes('overview')) return 'dashboard';
        if (lower.includes('list') || lower.includes('table')) return 'list';

        return 'section';
    }

    private enrichComponents(intent: DesignIntent): ComponentRequirement[] {
        const components = [...intent.components];

        // Infer missing components based on type and context
        if (intent.type === 'form') {
            // Ensure form has a submit button
            const hasButton = components.some(c => c.type === 'button');
            if (!hasButton) {
                components.push({
                    type: 'button',
                    label: this.inferButtonLabel(intent.constraints.context),
                    variant: 'primary',
                });
            }

            // Add title if missing for specific contexts
            const hasHeading = components.some(c => c.type === 'heading');
            if (!hasHeading && intent.title) {
                components.unshift({
                    type: 'heading',
                    text: intent.title,
                    level: 2,
                });
            }
        }

        // Login forms need email and password
        if (intent.constraints.context === 'login') {
            const hasEmail = components.some(c => c.inputType === 'email' || c.label?.toLowerCase().includes('email'));
            const hasPassword = components.some(c => c.inputType === 'password' || c.label?.toLowerCase().includes('password'));

            if (!hasEmail) {
                const insertIdx = components.findIndex(c => c.type === 'button');
                components.splice(insertIdx >= 0 ? insertIdx : components.length, 0, {
                    type: 'input',
                    label: 'Email',
                    inputType: 'email',
                    required: true,
                });
            }
            if (!hasPassword) {
                const insertIdx = components.findIndex(c => c.type === 'button');
                components.splice(insertIdx >= 0 ? insertIdx : components.length, 0, {
                    type: 'input',
                    label: 'Password',
                    inputType: 'password',
                    required: true,
                });
            }
        }

        return components;
    }

    private inferButtonLabel(context: string): string {
        const labels: Record<string, string> = {
            login: 'Log In',
            signin: 'Sign In',
            signup: 'Sign Up',
            register: 'Create Account',
            checkout: 'Complete Purchase',
            contact: 'Send Message',
            search: 'Search',
            filter: 'Apply Filters',
            save: 'Save',
            submit: 'Submit',
        };

        return labels[context.toLowerCase()] || 'Submit';
    }

    private createFallbackIntent(prompt: string): DesignIntent {
        return {
            type: this.inferType(prompt),
            components: [],
            layout: {
                direction: 'vertical',
                spacing: 'normal',
                alignment: 'stretch',
            },
            constraints: {
                purpose: 'display',
                context: 'general',
                platform: 'desktop',
            },
            confidence: 0.3,
            reasoning: 'Fallback intent - could not parse AI response',
        };
    }
}

/**
 * Create a singleton-like parser factory
 */
export function createIntentParser(
    inventory: DesignSystemInventory,
    aiCall: (prompt: string, systemPrompt: string) => Promise<string>
): IntentParser {
    return new IntentParser(inventory, aiCall);
}
