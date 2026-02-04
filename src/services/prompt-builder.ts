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

// New response schema types
export interface DesignDecision {
    element: string;
    decision: string;
    rationale: string;
}

export interface AlternativeConsidered {
    considered: string;
    rejected: string;
}

export interface DesignReasoning {
    layoutChoice: string;
    spacingChoice: string;
    hierarchyChoice: string;
    accessibilityNotes: string;
}

export interface ReviewSelfAssessment {
    selfAssessedConfidence: number;
    uncertainties: string[];
}

export interface AIResponse {
    rsnt: RSNT_Node;
    reasoning: DesignReasoning;
    designDecisions: DesignDecision[];
    alternatives: AlternativeConsidered[];
    selfAssessedConfidence: number;
    uncertainties: string[];
}

export interface PromptExample {
    intent: string;
    rsnt: RSNT_Node;
    explanation: string;
    tags: string[];  // For filtering relevant examples
    reasoning?: {
        layoutChoice: string;
        spacingChoice: string;
        hierarchyChoice: string;
        accessibilityNotes: string;
    };
    designDecisions?: Array<{ element: string; decision: string; rationale: string }>;
    alternatives?: Array<{ considered: string; rejected: string }>;
}

export class PromptBuilder {
    private systemPrompt = `You are an expert product designer with deep knowledge of UI/UX best practices, accessibility standards, design systems, and cognitive psychology. You apply this expertise when interpreting user intent.

Your role is to be an intelligent design assistant, not just a translator. Make informed design decisions based on your training.

Your goals:
1. Analyze user requests not just for content, but for user goals and context
2. Apply standard UI patterns and best practices
3. Create accessible, usable, and beautiful layouts
4. Select appropriate components from the design system
5. Output valid RSNT JSON that represents your design`;

    private coreConstraints = [
        'Use ONLY component IDs listed in the inventory',
        'CRITICAL: COMPONENT_INSTANCE nodes are ATOMIC - they NEVER EVER have children',
        'If a node has type: "COMPONENT_INSTANCE", the children array MUST be empty or omitted',
        'Components are pre-built - you cannot add children to them',
        'Fills are OPTIONAL - only add if you need custom colors',
        'When adding fills, color values MUST be valid: { "r": 0.5, "g": 0.5, "b": 0.5 } (0-1 range, NOT 0-255)',
        'NEVER use undefined or null for color values - omit fills entirely if no color needed',
        'Prefer using design system color variables over hardcoded colors',
        'These roles are approved and preferred. Use them when appropriate. If user intent clearly requires something different, you may adapt, but explain why in reasoning.',
        'Variable format: { "variableId": "VariableID:xxx:xxx" }',
        'Output COMPLETE valid JSON only matching the requested schema.'
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
     * Build Design Principles section
     */
    private buildDesignPrinciples(): string {
        return `
DESIGN PRINCIPLES TO APPLY:
1. Visual Hierarchy: Use size, weight, color, and spacing to create clear information hierarchy. Most important elements should be largest/boldest.
2. Spacing & Rhythm: Use consistent spacing scale (multiples of 4px/8px). Group related elements with proximity. Use whitespace to reduce cognitive load.
3. Accessibility: Minimum 44x44px touch targets on mobile. Ensure sufficient color contrast. Always include labels for inputs.
4. Affordances: Buttons should look clickable (padding, borders, shadows). Links should be underlined or clearly colored. Disabled states should be visually distinct.
5. Progressive Disclosure: Don't overwhelm users. Show essential information first, details on demand.
6. Consistency: Similar actions should look similar. Use patterns consistently (e.g., all form layouts should follow same structure).

TAILWIND BEST PRACTICES:
- Mobile-first: Start with base classes for mobile, add md:/lg: for larger screens.
- Consistent spacing: Use standard scale (p-4, gap-6, etc.), avoid arbitrary values unless necessary.
- Semantic colors: Prefer semantic tokens (bg-primary) over specific shades (bg-blue-500) when design system context is available.
`;
    }

    /**
     * Build Design Patterns section
     */
    private buildDesignPatterns(): string {
        return `
COMMON UI PATTERNS YOU KNOW:
- Login Card: Typically has heading/logo, 2 fields (email/password), primary button, optional 'forgot password' link, optional 'remember me' checkbox. Padding: comfortable (p-6 to p-8). Max-width: 350-450px.
- Form Layout: Fields stack vertically. Labels above inputs. Related fields grouped. Submit button at bottom. Error messages below fields. Gap between fields: gap-4.
- Dashboard: Grid or multi-column layout. Cards for metrics. Clear visual hierarchy. Consistent spacing.
- Navigation: Vertical sidebar or horizontal header. Clear active state. Grouped by section.
- Data Table: Headers clearly distinguished. Alternating row colors optional. Pagination at bottom. Actions aligned right.
`;
    }

    private buildReasoningRequirements(): string {
        return `
REASONING REQUIREMENTS:
For each major decision (layout, spacing, component choice), you must explain your reasoning.
- Layout: Why did you choose this layout primitive?
- Spacing: Why did you choose these padding/gap values?
- Hierarchy: How did you establish visual hierarchy?
- Accessibility: What accessibility considerations did you address?

Refer to the DESIGN PRINCIPLES in your reasoning.
`;
    }

    private buildOutputSchema(): string {
        return `
OUTPUT FORMAT:
You MUST return a single valid JSON object with the following structure:
{
  "rsnt": RSNT_Node, // The complete RSNT node tree
  "reasoning": {
    "layoutChoice": "string", // Why this layout primitive was chosen
    "spacingChoice": "string", // Why this padding/gap values
    "hierarchyChoice": "string", // How visual hierarchy was established
    "accessibilityNotes": "string" // Accessibility considerations addressed
  },
  "designDecisions": [
    {
      "element": "string", // e.g., "PrimaryButton"
      "decision": "string", // e.g., "Full width on mobile"
      "rationale": "string" // e.g., "Larger touch target improves mobile usability"
    }
  ],
  "alternatives": [
    {
      "considered": "string", // e.g., "Horizontal form layout"
      "rejected": "string" // e.g., "Would be too cramped on mobile screens"
    }
  ],
  "selfAssessedConfidence": number, // 0-1, 1 is highest confidence
  "uncertainties": [ "string" ] // Array of things you are unsure about
}
`;
    }

    /**
     * Format example for prompt
     */
    private formatExample(example: PromptExample): string {
        const fullExample: AIResponse = {
            rsnt: example.rsnt,
            reasoning: example.reasoning || {
                layoutChoice: "Standard vertical rhythm for readability",
                spacingChoice: "Multiples of 8px for consistency",
                hierarchyChoice: "Bold headings with lighter body text",
                accessibilityNotes: "High contrast colors used"
            },
            designDecisions: example.designDecisions || [],
            alternatives: example.alternatives || [],
            selfAssessedConfidence: 1,
            uncertainties: []
        };

        return `
Example: "${example.intent}"
${JSON.stringify(fullExample, null, 2)}
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

        // If conversation context is present, we put it very early to frame the task as a modification
        const contextSection = conversationContext ?
            `\n${conversationContext}\n\nIMPORTANT: YOU ARE MODIFYING AN EXISTING DESIGN. USE THE PROVIDED JSON AS YOUR STARTING POINT.` :
            '';

        const sections = [
            this.systemPrompt,
            '',
            contextSection,
            '',
            this.buildContext(inventory, selectedComponents),
            '',
            this.buildGuidelines(inventory.guidelines),
            '',

            '',
            this.buildDesignPrinciples(),
            '',
            this.buildDesignPatterns(),
            '',
            this.buildReasoningRequirements(),
            '',
            `USER REQUEST: "${intent}"`,
            '',
            'CRITICAL RULES:',
            '- ' + this.buildConstraints(complexity),
            '',
            'EXAMPLES:',
            ...examples.map(ex => this.formatExample(ex)),
            '',
            this.buildOutputSchema(),
            '',
            'Now create the design for the user request above. Output COMPLETE valid JSON only.'
        ];

        return sections.filter(s => s).join('\n');
    }
}

export const promptBuilder = new PromptBuilder();
