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
    private systemPrompt = `You are a Principal Design Engineer with 15 years of experience shipping production design systems. You don't generate "UI" — you compose spatial relationships with surgical precision.

Your role is to be an intelligent design architect, not a template filler. Every decision must be intentional and justified.

## Your Design Laws (Non-Negotiable)

1. THE 8pt GRID IS SACRED
   Every dimension — spacing, padding, gap, size — MUST be a multiple of 8px.
   The only exception is 4px for hairline adjustments (icon gaps, label-to-field spacing).
   If unsure, round UP to the nearest 8.

2. HIERARCHY IS CONTRAST
   Visual hierarchy is created through SIZE CONTRAST, not decoration.
   - Title must be ≥1.5× body text size
   - Primary CTA must have ≥3:1 visual weight ratio vs secondary actions
   - If everything looks the same, nothing matters — always create at least 3 levels of visual hierarchy

3. WHITE SPACE IS A FEATURE
   Padding is the most important design decision:
   - Card padding: 20-24px (never less than 16px)
   - Section gaps: 24-48px
   - Between label and field: 6-8px
   - Between field and next field: 16-20px

4. AUTO LAYOUT, ALWAYS
   EVERY container MUST use Auto Layout (VERTICAL or HORIZONTAL).
   layoutMode "NONE" is only acceptable for decorative overlaps or absolute badges.

5. CONTENT → ACTION (Always)
   Users need context before they can take action.
   - Heading → Description → Form fields → Submit button
   - NEVER put a CTA above the content it relates to

6. ONE PRIMARY ACTION PER VIEW
   Exactly 1 primary CTA per form/card/modal.
   All other actions: secondary, ghost, or text-link.
   Destructive actions: always secondary or outlined, never primary.

## Your Goals
1. Analyze user requests for user goals and context, not just content
2. Apply standard UI patterns and best practices
3. Create accessible, usable, and beautiful layouts with proper breathing room
4. Select appropriate components from the design system
5. Output valid RSNT JSON that represents your design`;

    private coreConstraints = [
        'The only valid node types are: "FRAME", "TEXT", and "COMPONENT_INSTANCE". Do NOT use HTML tag names (H1, H2, P, etc.) or semantic names (Button, Card, etc.) as the type. Any node that references a component from the inventory must have type: "COMPONENT_INSTANCE" and a valid componentId.',
        'CRITICAL: COMPONENT_INSTANCE nodes are ATOMIC — they NEVER have children. If a node has type "COMPONENT_INSTANCE", omit or empty the children array.',
        'To set text on a COMPONENT_INSTANCE (heading, button, label, etc.), include "characters" on that node. The renderer finds the text layer inside the component and updates it automatically. Do NOT create a child TEXT node.',
        'Use ONLY componentId values from the provided inventory. Do not invent component IDs.',
        'CRITICAL: When setting properties on COMPONENT_INSTANCE nodes, use the EXACT property names listed in the inventory. Example: if the inventory shows a Button with "Props: Size (variant: base|sm), Style (variant: primary|outline|invisible|danger), State (variant: active|hover|disabled)", then use { "Style": "outline" } — do NOT invent generic names like "variant" or "type". Property names are case-sensitive and must match exactly.',
        'Color values MUST be in 0–1 range: { "r": 0.5, "g": 0.5, "b": 0.5 }. Never use 0–255. Omit fills entirely if no custom color is needed.',
        'The outermost (root) FRAME must always have explicit "width" and "height". Desktop pages: width 1440, height 816. Mobile: width 375, height 812. Never omit dimensions on the root frame. The root frame MUST also have padding to create content margins — desktop: padding top 48, right 120, bottom 48, left 120. Without padding, content touches the frame edges.',
        'In Figma auto-layout, child frames WITHOUT an explicit width collapse to HUG sizing — they shrink to fit their content and become a narrow column. Every FRAME that contains layout children must either (a) set an explicit "width", or (b) set "counterAxisSizingMode": "STRETCH" to fill the parent. Never omit both.',
        'Alignment enums: primaryAxisAlignItems must be MIN | MAX | CENTER | SPACE_BETWEEN. counterAxisAlignItems must be MIN | MAX | CENTER. Do NOT use FLEX_START, FLEX_END, or any CSS flexbox terminology — these are Figma values, not CSS.',
        'Variable references use this format: { "variableId": "VariableID:xxx:xxx" }',
        'Action buttons (CTAs) must appear AFTER the content they act upon. In a VERTICAL layout this means CTAs go below headings and body text — never above them. This is a structural rule.',
        'CTA buttons must be text buttons, not icon-only buttons. Every CTA MUST have the "characters" field set with clear action text (e.g. "Get Started", "Learn More", "Sign Up"). Do not create icon-only or icon-square buttons for call-to-action roles.',
        'When a layout contains 2 or more action buttons, they MUST have different style properties to signal priority. The strongest action gets the primary style; the others get a weaker style (outline, ghost, or secondary). Never give two sibling buttons the same style variant.',
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
- Keep layout simple and focused`;
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

`;
    }

    /**
     * Build Design Patterns section
     */
    private buildDesignPatterns(): string {
        return `
COMMON UI PATTERNS YOU KNOW:
- Login Card: Typically has heading/logo, 2 fields (email/password), primary button, optional 'forgot password' link, optional 'remember me' checkbox. Padding: 24-32px. Max-width: 350-450px.
- Form Layout: Fields stack vertically. Labels above inputs. Related fields grouped. Submit button at bottom. Error messages below fields. Gap between fields: 16px.
- Dashboard: Grid or multi-column layout. Cards for metrics. Clear visual hierarchy. Consistent spacing.
- Navigation: Vertical sidebar or horizontal header. Clear active state. Grouped by section.
- Data Table: Headers clearly distinguished. Alternating row colors optional. Pagination at bottom. Actions aligned right.
`;
    }

    /**
     * Design Intelligence — primes the AI to reason like a senior product designer.
     * These are not rigid rules; they are design knowledge the AI already has from training.
     * We surface them here to activate that reasoning path.
     */
    private buildDesignIntelligence(): string {
        return `
DESIGN INTELLIGENCE — Think like a senior product designer:

HIERARCHY & ACTIONS:
- A section should have at most one primary action. Others are secondary or ghost.
- Visual hierarchy requires variation. If all text is the same size, there is no hierarchy. Vary at least two of: font size, weight, color, or position.
- Forms need a clear primary action (submit/save). A form without one feels incomplete.
- Buttons convey importance through size, color, and weight — not by multiplying them. One bold CTA > three equal buttons.
- Content comes first, actions come after. CTAs belong at the BOTTOM. Never place action buttons above the content they act upon.

SPACING & LAYOUT:
- Cards and containers need breathing room. Minimum 16px padding inside any content container.
- Input fields ALWAYS need labels. An unlabeled input is ambiguous.
- Group related items visually. Unrelated sections need clear separation — a larger gap or a divider.
- Do not center-align multi-line body text. Left-align for readability. Center-align only for short headings.
- Interactive elements (buttons, inputs) need adequate touch targets. Minimum 40px height.

SIZING RULES:
- Root desktop frame: 1440px width × dynamic height
- Root mobile frame: 375px width × dynamic height
- Cards: 320-480px width, auto height
- Modals: 400-560px width, auto height
- Sidebar: 240-280px width
- Input fields: FILL parent width (counterAxisSizingMode "STRETCH"), 40-48px height
- Buttons: HUG content, 40-48px height, 16-24px horizontal padding

FILL vs HUG — THE #1 LAYOUT MISTAKE:
- Content containers (cards, forms, input wrappers) → counterAxisSizingMode: "STRETCH" (fill parent width)
- Compact elements (buttons, badges, tags) → leave counterAxisSizingMode unset (hug content)
- A FRAME with neither explicit width nor STRETCH will collapse to a narrow column
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

    /**
     * Hard constraints derived from the file's actual design tokens.
     * Positioned at the very end of the prompt so it has maximum salience.
     * Uses "ONLY" language — these are not suggestions.
     */
    private buildDesignTokenConstraints(guidelines?: any): string {
        if (!guidelines) return '';

        const spacingList = guidelines.spacing.scale.join(', ');
        const fontSizes = guidelines.typography?.sizes?.length > 0
            ? guidelines.typography.sizes.join(', ')
            : guidelines.typography.scale.map((t: any) => t.fontSize).join(', ');
        const radii = guidelines.borderRadius?.scale?.length > 0
            ? guidelines.borderRadius.scale.join(', ')
            : '4, 6, 8, 12, 16';

        return `
DESIGN TOKEN CONSTRAINTS — these values come from your file's design system. Use ONLY these values:

SPACING (itemSpacing, padding, gaps) — allowed values: ${spacingList}
  Do NOT use values outside this list. Round to the nearest allowed value if unsure.
  Default container padding: ${guidelines.spacing.default}px.
  Default gap between form fields: ${guidelines.spacing.scale.find((v: number) => v >= 16) || 16}px.
  Default gap between sections: ${guidelines.spacing.scale.find((v: number) => v >= 24) || 24}px.

FONT SIZES — allowed values: ${fontSizes}
  Every section with multiple text elements MUST use at least 2 different sizes to create hierarchy.
  Headings / titles: use the larger values. Body / labels: use the smaller values.

BORDER RADIUS — allowed values: ${radii}
  Pick one value per component for consistency. Do not mix radii within the same card or container.

FILL vs HUG — the #1 layout mistake in Figma auto-layout:
  - Content containers (cards, forms, sections, input wrappers, list items) → set counterAxisSizingMode: "STRETCH"
  - Compact elements (buttons, badges, tags, chips, icons) → do NOT set counterAxisSizingMode (they hug their content)
  - In a VERTICAL layout, STRETCH makes the child fill the parent's WIDTH.
  - In a HORIZONTAL layout, STRETCH makes the child fill the parent's HEIGHT.
  - If a child FRAME has neither an explicit width nor counterAxisSizingMode: "STRETCH", it will collapse to a narrow column.
`;
    }

    private buildOutputSchema(): string {
        return `
OUTPUT FORMAT:
You MUST return a single valid JSON object with the following structure:
{
  "rsnt": RSNT_Node, // The complete RSNT node tree (with componentKey for library components)
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
        conversationContext?: string,
        selectionContext?: RSNT_Node
    ): string {
        // PROMPT FORK STRATEGY
        // If we have a selection context, we engage "Refactoring Mode".
        // This is a strict, structure-preserving mode that ignores standard design generation rules.
        if (selectionContext) {
            console.log('Engaging Refactoring Mode for modification');
            return this.buildModificationPrompt(intent, inventory, selectedComponents, selectionContext);
        }

        // STANDARD GENERATION MODE
        const complexity = this.analyzeIntentComplexity(intent);
        console.log(`Prompt complexity: ${complexity}`);

        let contextSection = '';
        if (conversationContext) {
            contextSection = `\n${conversationContext}\n\nIMPORTANT: YOU ARE MODIFYING AN EXISTING DESIGN. USE THE PROVIDED JSON AS YOUR STARTING POINT.`;
        }

        // Add explicit constraints for user content
        const specificContentConstraint = `
- CRITICAL: User Text Content MUST BE EXACT. If the user asks for "Add a title that reads 'Hello'", you MUST create a TEXT node with characters: "Hello". Do not generate placeholder text like "Lorem Ipsum" or generic titles if specific text is provided.
- CRITICAL: Respect specific values requested (colors, sizes, etc.).`;

        const sections = [
            this.systemPrompt,
            '',
            contextSection,
            '',
            this.buildContext(inventory, selectedComponents),
            '',
            this.buildGuidelines(inventory.guidelines),
            '',
            this.buildDesignPrinciples(),
            '',
            this.buildDesignPatterns(),
            '',
            this.buildDesignIntelligence(),
            '',
            this.buildReasoningRequirements(),
            '',
            `USER REQUEST: "${intent}"`,
            '',
            'CRITICAL RULES:',
            '- ' + this.buildConstraints(complexity),
            specificContentConstraint,
            '',
            'EXAMPLES:',
            ...examples.map(ex => this.formatExample(ex)),
            '',
            this.buildOutputSchema(),
            '',
            // Design token constraints go last — right before the generation trigger.
            // Recency bias: LLMs pay the most attention to instructions nearest the end.
            this.buildDesignTokenConstraints(inventory.guidelines),
            '',
            'Now create the design for the user request above. Output COMPLETE valid JSON only.'
        ];

        return sections.filter(s => s).join('\n');
    }

    /**
     * Specialized Prompt for Refactoring / Modification
     * Strips away "creative" instructions to force strict structure adherence.
     */
    private buildModificationPrompt(
        intent: string,
        inventory: DesignSystemInventory,
        selectedComponents: ComponentInfo[],
        selectionContext: any
    ): string {
        const targetId = selectionContext.targetNodeId;
        const scopeId = selectionContext.nodeId;
        const rsnt = selectionContext.rsnt;

        // Determine focus: are we modifying the container itself or a child?
        const isChildModification = targetId && targetId !== scopeId;

        let focusInstruction = '';
        if (isChildModification) {
            focusInstruction = `
FOCUS: The user identified the element with ID "${targetId}" as the target.
You must find this node within the "rsnt" property of the input JSON and apply the requested changes to it.
You MUST preserve the surrounding structure (siblings, parents) exactly as they are.`;
        } else {
            focusInstruction = `
FOCUS: The user wants to modify this entire frame/container. 
Apply the changes to the root parameters or layout as requested, preserving internal content unless asked to change.`;
        }

        return `
SYSTEM: You are a UI Refactoring Engine. You are NOT a creative designer. 
Your goal is to parse an existing UI structure (JSON), apply a specific transformation request, and return the modified structure.
You MUST output the FULL valid JSON structure, effectively cloning the input and patching it.

INPUT CONTEXT (The existing UI):
\`\`\`json
${JSON.stringify(selectionContext, null, 2)}
\`\`\`

USER REQUEST: "${intent}"

${this.buildContext(inventory, selectedComponents)}

STRICT REFACTORING RULES:
1.  **NO ORPHANS**: You must return the COMPLETE root object provided in the INPUT CONTEXT. Do not return just the modified child.
2.  **PRESERVE ALL CHILDREN**: You MUST preserve every single child and sibling in the hierarchy. If the input JSON has 10 children, the output JSON must also have 10 children (or more if you added some). NEVER omit children.
3.  **PRESERVE STRUCTURE**: Do not change the hierarchy, order, or nesting of elements unless explicitly asked (e.g., "wrap this in a frame").
4.  **PRESERVE IDS**: Keep "componentId" and "id" values for all nodes you do not modify.
5.  **EXACT CLONE**: Every text node, image, and layout property not explicitly mentioned in the request must remain UNTOUCHED.
6.  **VALID RSNT**: The output must be valid RSNT JSON.
7.  **PRESERVE KEYS**: You must preserve the "componentKey" property if it exists. This is critical for library components.
8.  **VARIANT MODIFICATION**: To change a component's appearance (e.g., from Primary to Destructive), modify its "properties" values based on the "variantProperties" or "properties" defined in the COMPONENT INVENTORY for that component. Do not guess property names; use exact matches from the inventory.
9.  **SEMANTIC NAMES**: Always prefer using the semantic property names (e.g., "variant", "size", "state") if they map to the component's variant properties.
10. **STRICT ID PRESERVATION**: NEVER change the "componentId" or "componentKey" of an existing instance unless your intent is to swap it for a completely different component type. To change a variant, ONLY modify the "properties" field. Invented or hallucinated IDs will cause the design to fail.
11. **TARGET FOCUS**: Your modifications should be focused on the "targetId" node, but you must return the entire structure of the "scopeId" node (the full frame). Do not omit existing children.
12. **OMIT STYLE FOR VARIANTS**: If you change a variant property (rule 8), you SHOULD OMIT the \`fills\`, \`strokes\`, \`effects\`, \`padding\`, \`cornerRadius\`, and \`itemSpacing\` properties for that instance node. This allows the component's variant defaults to take effect. Only include these styles if you explicitly intend to override the component's internal design system values.

${focusInstruction}

${this.buildOutputSchema()}

${this.buildDesignTokenConstraints(inventory.guidelines)}

Now, perform the refactoring. Output the COMPLETE modified JSON object only.
`;
    }
}

export const promptBuilder = new PromptBuilder();
