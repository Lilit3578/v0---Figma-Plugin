/**
 * Structured prompt building system with templates
 */

import { DesignSystemInventory, ComponentInfo } from './auto-discovery';
import { RSNT_Node } from '../types/rsnt';

export interface PromptTemplate {
    system: string;           // Role and core instructions
    context: string;          // Design system inventory
    task: string;             // Specific user request
    constraints: string[];    // Format and validation rules
    examples: PromptExample[];      // Few-shot examples
}

export interface PromptExample {
    intent: string;
    rsnt: RSNT_Node;
    explanation: string;
    tags: string[];  // For filtering relevant examples
}

export class PromptBuilder {
    private systemPrompt = `You are an expert Figma designer who creates pixel-perfect designs using RSNT (React-Style Node Tree) format.

Your role:
1. Analyze user requests carefully
2. Select appropriate components from the design system
3. Create well-structured, accessible layouts
4. Follow design system guidelines strictly
5. Output valid RSNT JSON only`;

    private coreConstraints = [
        'Use ONLY component IDs listed in the inventory',
        'CRITICAL: COMPONENT_INSTANCE nodes are ATOMIC - they NEVER EVER have children',
        'If a node has type: "COMPONENT_INSTANCE", the children array MUST be empty or omitted',
        'Components are pre-built - you cannot add children to them',
        'Fills are OPTIONAL - only add if you need custom colors',
        'When adding fills, color values MUST be valid: { "r": 0.5, "g": 0.5, "b": 0.5 } (0-1 range, NOT 0-255)',
        'NEVER use undefined or null for color values - omit fills entirely if no color needed',
        'Prefer using design system color variables over hardcoded colors',
        'Variable format: { "variableId": "VariableID:xxx:xxx" }',
        'Output COMPLETE valid JSON only, no markdown'
    ];

    /**
     * Analyze intent complexity
     */
    private analyzeIntentComplexity(intent: string): 'simple' | 'standard' | 'multi_page' {
        const lower = intent.toLowerCase();

        if (lower.includes('both desktop and mobile') || lower.includes('responsive')) {
            return 'multi_page';
        }

        if (intent.split(' ').length < 10 && !lower.includes('form') && !lower.includes('page')) {
            return 'simple';
        }

        return 'standard';
    }

    /**
     * Build context section with component inventory
     */
    private buildContext(
        inventory: DesignSystemInventory,
        selectedComponents: ComponentInfo[]
    ): string {
        const limitedVariables = inventory.variables
            .filter(v => ['COLOR', 'FLOAT'].includes(v.resolvedType))
            .slice(0, 30);

        return `AVAILABLE COMPONENTS (${selectedComponents.length} most relevant):
${selectedComponents.map(c => {
            let propsInfo = '';
            if (c.properties) {
                const propsList = Object.entries(c.properties).map(([key, p]) => {
                    if (p.type === 'VARIANT') return `${key} (variant: ${p.values?.join('|')})`;
                    if (p.type === 'BOOLEAN') return `${key} (boolean, default: ${p.defaultValue})`;
                    if (p.type === 'TEXT') return `${key} (text, default: "${p.defaultValue}")`;
                    return `${key} (${p.type})`;
                });
                propsInfo = ` | Props: ${propsList.join(', ')}`;
            } else if (c.variantProperties) {
                // Fallback for backward compatibility
                propsInfo = ` | Props: ${Object.keys(c.variantProperties).join(', ')}`;
            }

            return `- "${c.id}": ${c.name}${c.semanticType ? ` [${c.semanticType}]` : ''}${propsInfo}`;
        }).join('\n')}

AVAILABLE VARIABLES (${limitedVariables.length} of ${inventory.variables.length}):
${limitedVariables.map(v => `- "${v.id}": ${v.name} (${v.resolvedType})`).join('\n')}`;
    }

    /**
     * Build constraints section based on complexity
     */
    private buildConstraints(complexity: 'simple' | 'standard' | 'multi_page'): string {
        const base = this.coreConstraints.join('\n- ');

        if (complexity === 'multi_page') {
            return `${base}
- Root frame uses layoutMode: "HORIZONTAL" to hold multiple pages
- Desktop page: width: 1440, height: 1024
- Mobile page: width: 375, height: 812
- Each page is a separate child frame with explicit dimensions`;
        }

        if (complexity === 'simple') {
            return `${base}
- Keep layout simple and focused
- Use standard spacing (8px, 16px, 24px, 32px)`;
        }

        return base;
    }

    /**
     * Build guidelines section
     */
    private buildGuidelines(guidelines?: any): string {
        if (!guidelines) return '';

        return `
DESIGN SYSTEM GUIDELINES:
- Spacing scale: ${guidelines.spacing.scale.join(', ')}px (use these values for padding, margins, gaps)
- Default spacing: ${guidelines.spacing.default}px
- Typography scale: ${guidelines.typography.scale.map((t: any) => `${t.level}: ${t.fontSize}px`).join(', ')}
- Max content width: ${guidelines.layout.maxContentWidth}px
- Default padding: ${guidelines.layout.defaultPadding}px

When creating layouts:
1. Use spacing values from the scale above
2. Follow typography hierarchy for text elements
3. Respect max content width for readability
4. Use default padding for containers
`;
    }

    /**
     * Format example for prompt
     */
    private formatExample(example: PromptExample): string {
        return `
Example: "${example.intent}"
${JSON.stringify({ rsnt: example.rsnt, explanation: example.explanation }, null, 2)}
`;
    }

    /**
     * Build complete prompt
     */
    build(
        intent: string,
        inventory: DesignSystemInventory,
        selectedComponents: ComponentInfo[],
        examples: PromptExample[],
        conversationContext?: string
    ): string {
        const complexity = this.analyzeIntentComplexity(intent);

        console.log(`Prompt complexity: ${complexity}`);

        const sections = [
            this.systemPrompt,
            '',
            conversationContext || '',  // NEW: Add conversation context
            '',
            this.buildContext(inventory, selectedComponents),
            '',
            this.buildGuidelines(inventory.guidelines),
            '',
            `USER REQUEST: "${intent}"`,
            '',
            'CRITICAL RULES:',
            '- ' + this.buildConstraints(complexity),
            '',
            'EXAMPLES:',
            ...examples.map(ex => this.formatExample(ex)),
            '',
            'Now create the design for the user request above. Output COMPLETE valid JSON only.'
        ];

        return sections.filter(s => s).join('\n');
    }
}

export const promptBuilder = new PromptBuilder();
