import { RSNT_Node, validateRSNT } from '../types/rsnt';
import { ClarificationRequest, generateClarifyingQuestions } from './clarification';
import { calculateConfidence } from './confidence';
import { DesignSystemInventory } from './auto-discovery';
import { componentSelector } from './component-selector';
import { promptBuilder } from './prompt-builder';
import { selectRelevantExamples } from './example-library';
import { conversationManager } from './conversation-manager';
import { createAIError, ErrorCode } from '../types/errors';
import { globalRateLimiter } from '../libs/rate-limiter';
import { createIntentParser, DesignIntent } from './intent-parser';
import { createDecisionEngine, DesignDecision } from './decision-engine';
import { extractJSON } from '../utils/json-utils';
import { designPatternService } from './design-patterns';

const MODEL_NAME = 'gemini-2.5-flash';

// Enable multi-step reasoning (Antigravity approach)
const USE_MULTI_STEP_REASONING = true;

/**
 * Helper to validate the parsed JSON specifically for RSNT structure
 */
function validateRSNTResponse(parsed: any): any {
    console.log('[AIService] Validating RSNT Response:', JSON.stringify(parsed).substring(0, 200) + '...');

    // Validate structure
    if (!parsed.rsnt) {
        // Fallback: Maybe the root object IS the rsnt if the AI forgot the wrapper?
        if (parsed.id && parsed.type) {
            console.warn('[AIService] Response missing "rsnt" wrapper, assuming root is RSNT');
            return { rsnt: parsed };
        }
        console.error('[AIService] Validation Failed: Missing "rsnt" property', parsed);
        throw createAIError(ErrorCode.INVALID_JSON_RESPONSE, { parsed }, 'Response missing "rsnt" property');
    }

    // Check if rsnt is incorrectly an array
    if (Array.isArray(parsed.rsnt)) {
        console.error('[AIService] Validation Failed: RSNT is an array:', parsed.rsnt);
        throw createAIError(ErrorCode.INVALID_JSON_RESPONSE, { rsnt: parsed.rsnt }, 'Invalid response: "rsnt" must be an object, not an array.');
    }

    // Check if rsnt is an object
    if (typeof parsed.rsnt !== 'object' || parsed.rsnt === null) {
        console.error('[AIService] Validation Failed: RSNT is not an object:', parsed.rsnt);
        throw createAIError(ErrorCode.INVALID_JSON_RESPONSE, { rsnt: parsed.rsnt }, 'Invalid response: "rsnt" must be an object');
    }

    return parsed;
}

/**
 * Generate RSNT from user intent using discovered inventory
 *
 * Supports two modes:
 * 1. Multi-step reasoning (Antigravity approach) - Parse intent → Make decisions → Generate RSNT
 * 2. Single-shot generation - Direct prompt to RSNT (legacy)
 */
export async function generateRSNT(
    userIntent: string,
    apiKey: string,
    inventory: DesignSystemInventory,
    selectionContext?: RSNT_Node
): Promise<RSNT_Node | ClarificationRequest> {

    if (!apiKey || !apiKey.startsWith('AIza')) {
        throw createAIError(ErrorCode.API_REQUEST_FAILED, { apiKey }, 'INVALID_API_KEY: Please provide a valid Gemini API key');
    }

    console.log('=== AI Generation Start ===');
    console.log('Intent:', userIntent);

    // Use multi-step reasoning for simple/medium complexity requests
    // Skip for refinements (which need conversation context) and complex requests
    const isRefinement = conversationManager.isRefinement(userIntent);
    const isComplex = userIntent.length > 200 || userIntent.includes('page') || userIntent.includes('dashboard');

    if (USE_MULTI_STEP_REASONING && !isRefinement && !isComplex) {
        try {
            console.log('Using multi-step reasoning (Antigravity approach)');
            const result = await generateRSNTWithDecisions(userIntent, apiKey, inventory, selectionContext);

            // Check confidence for clarification
            if (result.decisions.overallConfidence < 0.5) {
                console.log('Multi-step confidence low, generating clarification questions...');
                const questions = generateClarifyingQuestions(
                    userIntent,
                    result.decisions.overallConfidence,
                    {
                        validation: 1.0,
                        ambiguity: 1 - result.intent.confidence,
                        complexityMatch: 1.0,
                        unknownElements: 0,
                        nestingDepth: 1.0,
                        aiSelfAssessment: result.intent.confidence
                    },
                    []
                );

                if (questions.length > 0) {
                    return {
                        questions,
                        confidenceScore: result.decisions.overallConfidence,
                        originalIntent: userIntent,
                        uncertainties: []
                    };
                }
            }

            // Add to conversation history
            conversationManager.addTurn(userIntent, result.rsnt, 'v1.0');

            return result.rsnt;
        } catch (error: any) {
            // CRITICAL: If this is a Rate Limit error, DO NOT FALLBACK to single-shot.
            // We must let the RateLimiter pause and retry the high-quality multi-step pipeline.
            if (error.message?.includes('429') || error.message?.includes('Rate Limit') || error.message?.includes('AI_API_RETRY')) {
                console.warn('Multi-step reasoning hit Rate Limit. Propagating error to trigger Backoff/Retry.');
                throw error;
            }

            console.warn('Multi-step generation failed (non-rate-limit), falling back to single-shot:', error.message);
            // Fall through to single-shot generation
        }
    }
    console.log('Inventory:', {
        components: inventory.components.length,
        variables: inventory.variables.length,
        hasGuidelines: !!inventory.guidelines
    });

    // 1. Select relevant components (max 20)
    const selection = componentSelector.selectComponents(userIntent, inventory, 20);

    console.log(`Component selection: ${selection.selected.length} selected, ${selection.excluded} excluded (strategy: ${selection.selectionStrategy})`);

    // 2. Select relevant examples (3 most similar)
    const examples = selectRelevantExamples(userIntent, 3);

    console.log(`Selected examples: ${examples.map(e => e.intent).join(', ')}`);

    // 3. Get conversation context
    const conversationContext = conversationManager.getContext(userIntent);

    if (conversationContext) {
        console.log('Using conversation context (refinement mode)');
    }

    // 4. Build prompt
    const prompt = promptBuilder.build(
        userIntent,
        inventory,
        selection.selected,
        examples,
        conversationContext,
        selectionContext
    );

    console.log(`Prompt size: ${prompt.length} characters`);
    console.log(`Prompt tokens estimate: ${Math.ceil(prompt.length / 4)}`);

    // 4. Call AI
    let response;
    try {
        // Use HIGH priority for user requests
        response = await globalRateLimiter.throttle(async () => {
            const res = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{ text: prompt }]
                        }],
                        generationConfig: {
                            temperature: 0.2,
                            maxOutputTokens: 8192,
                            responseMimeType: "application/json"
                        }
                    })
                }
            );

            // Force retry on 429 (Rate Limit) or 5xx (Server Error)
            // fetch doesn't throw on these, so we must check status and throw to trigger RateLimiter retry
            if (res.status === 429 || res.status >= 500) {
                const text = await res.text();
                // Include retryDelay in error message if possible to help RateLimiter
                throw new Error(`AI_API_RETRY: ${res.status} ${text}`);
            }

            return res;
        }, 0 /* QueuePriority.HIGH */);
    } catch (error: any) {
        // If we get here, retries are exhausted (max 5)
        if (error.message?.includes('429') || error.message?.includes('Rate Limit')) {
            throw createAIError(ErrorCode.API_REQUEST_FAILED, { status: 429, originalError: error.message }, 'RATE_LIMIT: Too many requests. Please wait a moment.');
        }

        // Re-throw as AI error
        throw createAIError(ErrorCode.API_REQUEST_FAILED, { originalError: error.message }, `AI request failed: ${error.message}`);
    }

    if (!response.ok) {
        const errorText = await response.text();
        console.error('AI API error:', errorText);

        if (response.status === 400) {
            throw createAIError(ErrorCode.API_REQUEST_FAILED, { status: 400, errorText }, 'INVALID_REQUEST: The request was malformed.');
        } else if (response.status === 429) {
            throw createAIError(ErrorCode.API_REQUEST_FAILED, { status: 429, errorText }, 'RATE_LIMIT: Too many requests.');
        } else if (response.status === 403) {
            throw createAIError(ErrorCode.API_REQUEST_FAILED, { status: 403, errorText }, 'INVALID_API_KEY: API key is invalid.');
        }

        throw createAIError(ErrorCode.API_REQUEST_FAILED, { status: response.status, errorText }, `AI_ERROR: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    console.log('AI Response received:', {
        candidates: data.candidates?.length || 0,
        finishReason: data.candidates?.[0]?.finishReason
    });

    if (!data.candidates || data.candidates.length === 0) {
        throw createAIError(ErrorCode.INVALID_JSON_RESPONSE, { data }, 'AI_NO_RESPONSE: The AI did not generate any response.');
    }

    const candidate = data.candidates[0];

    if (candidate.finishReason === 'SAFETY') {
        throw createAIError(ErrorCode.API_REQUEST_FAILED, { finishReason: 'SAFETY' }, 'SAFETY_FILTER: The AI blocked this request due to safety filters.');
    }

    if (!candidate.content?.parts?.[0]?.text) {
        throw createAIError(ErrorCode.INVALID_JSON_RESPONSE, { candidate }, 'AI_EMPTY_RESPONSE: The AI response was empty.');
    }

    const aiText = candidate.content.parts[0].text;
    console.log('AI generated text length:', aiText.length);

    // Parse the JSON response
    const parsed = validateRSNTResponse(extractJSON(aiText));
    console.log('Parsed RSNT successfully');

    // Log design reasoning if available (new format)
    if (parsed.reasoning) {
        console.log('=== DESIGN REASONING ===');
        console.log('Goal:', parsed.reasoning.layoutChoice);
        console.log('Spacing:', parsed.reasoning.spacingChoice);
        console.log('Hierarchy:', parsed.reasoning.hierarchyChoice);
        console.log('Accessibility:', parsed.reasoning.accessibilityNotes);
    }

    if (parsed.designDecisions && parsed.designDecisions.length > 0) {
        console.log('=== KEY DECISIONS ===');
        parsed.designDecisions.forEach((d: any) => {
            console.log(`- [${d.element}]: ${d.decision} (${d.rationale})`);
        });
    }

    if (parsed.selfAssessedConfidence) {
        console.log(`AI Confidence: ${parsed.selfAssessedConfidence}`);
    }

    if (parsed.uncertainties && parsed.uncertainties.length > 0) {
        console.log('Uncertainties:', parsed.uncertainties);
    }

    // --- NEW: Calculate and attach confidence score ---
    try {
        // Create validation context from inventory
        const validationContext = {
            availableComponents: new Set(inventory.components.map(c => c.id)),
            availableVariables: new Set(inventory.variables.map(v => v.id))
        };

        // Run validation
        const validationResult = validateRSNT(parsed.rsnt, validationContext);

        // Calculate confidence
        const confidenceResult = calculateConfidence(
            userIntent,
            parsed.rsnt,
            validationResult,
            parsed.selfAssessedConfidence || 0
        );

        console.log('=== CONFIDENCE SCORE ===');
        console.log(`Final Score: ${confidenceResult.finalScore.toFixed(2)}`);
        confidenceResult.breakdown.forEach(line => console.log(`- ${line}`));

        // Store in metadata
        if (!parsed.rsnt.metadata) {
            parsed.rsnt.metadata = {};
        }
        parsed.rsnt.metadata.confidence = {
            score: confidenceResult.finalScore,
            factors: confidenceResult.factors,
            breakdown: confidenceResult.breakdown
        };

        // Attach reasoning and other metadata for UI
        parsed.rsnt.metadata.reasoning = parsed.reasoning;
        parsed.rsnt.metadata.designDecisions = parsed.designDecisions;
        parsed.rsnt.metadata.uncertainties = parsed.uncertainties;

        // --- CLARIFICATION LOGIC ---
        const isClarificationResponse = userIntent.includes('Clarifications:');

        if (confidenceResult.finalScore < 0.6 && !isClarificationResponse) {
            console.log('Confidence low (< 0.6), generating clarification questions...');

            const questions = generateClarifyingQuestions(
                userIntent,
                confidenceResult.finalScore,
                confidenceResult.factors,
                parsed.uncertainties || []
            );

            if (questions.length > 0) {
                console.log(`Generated ${questions.length} clarification questions.`);
                return {
                    questions,
                    confidenceScore: confidenceResult.finalScore,
                    originalIntent: userIntent,
                    uncertainties: parsed.uncertainties || []
                };
            }
        }

    } catch (e: unknown) {
        console.error('Failed to calculate confidence:', e);
        // Don't fail generation, but set a default confidence with warning
        if (!parsed.rsnt.metadata) {
            parsed.rsnt.metadata = {};
        }
        parsed.rsnt.metadata.confidence = {
            score: 0.7, // Default to medium confidence when calculation fails
            factors: {},
            breakdown: ['Confidence calculation failed - using default score'],
            calculationError: true
        };
        parsed.rsnt.metadata.warnings = [
            ...(parsed.rsnt.metadata.warnings || []),
            'Confidence calculation encountered an error'
        ];
    }

    // Add to conversation history
    conversationManager.addTurn(userIntent, parsed.rsnt, 'v1.0');

    return parsed.rsnt;
}

// ============================================================================
// MULTI-STEP REASONING (Antigravity Approach)
// ============================================================================

/**
 * Helper to make a raw AI call (used by intent parser and decision engine)
 * Exported for use by Antigravity pipeline
 */
export async function makeAICall(prompt: string, systemPrompt: string, apiKey: string): Promise<string> {
    const fullPrompt = `${systemPrompt}\n\n${prompt}`;

    const response = await globalRateLimiter.throttle(async () => {
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: fullPrompt }]
                    }],
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: 8192,
                        responseMimeType: "application/json"
                    }
                })
            }
        );

        if (res.status === 429 || res.status >= 500) {
            const text = await res.text();
            throw new Error(`AI_API_RETRY: ${res.status} ${text}`);
        }

        return res;
    }, 0 /* QueuePriority.HIGH */);

    if (!response.ok) {
        throw new Error(`AI call failed: ${response.status}`);
    }

    const data = await response.json();
    // Parse response
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty response from AI');

    console.log('[AIService] Raw AI Response:', text.substring(0, 200) + '...');

    // extractJSON parses the JSON for us
    const parsed = extractJSON(text);

    console.log('[AIService] Parsed Intent:', parsed.intent);
    console.log('[AIService] Generated RSNT Metadata:', parsed.rsnt?.metadata);

    return text;
}

export async function generateRSNTWithDecisions(
    userIntent: string,
    apiKey: string,
    inventory: DesignSystemInventory,
    selectionContext?: RSNT_Node
): Promise<{ rsnt: RSNT_Node; intent: DesignIntent; decisions: DesignDecision }> {

    console.log('=== Multi-Step Generation (Antigravity) ===');

    // Create parser and engine
    const aiCall = (prompt: string, systemPrompt: string) => makeAICall(prompt, systemPrompt, apiKey);
    const intentParser = createIntentParser(inventory, aiCall);
    const decisionEngine = createDecisionEngine(inventory, aiCall);

    // Step 1: Parse intent
    console.log('Step 1: Parsing intent...');
    const intent = await intentParser.parse(userIntent);
    console.log('Parsed intent:', {
        type: intent.type,
        components: intent.components.length,
        confidence: intent.confidence,
        reasoning: intent.reasoning
    });

    // Check confidence - if too low, we might need clarification
    if (intent.confidence < 0.5) {
        console.log('Intent confidence low, may need clarification');
    }

    // Step 2: Make design decisions
    console.log('Step 2: Making design decisions...');
    const decisions = await decisionEngine.makeDecisions(intent);
    console.log('Design decisions:', {
        components: decisions.components.length,
        layout: decisions.layout.layoutMode,
        overallConfidence: decisions.overallConfidence,
        rationale: decisions.designRationale
    });

    // Step 3: Generate RSNT from decisions
    console.log('Step 3: Generating RSNT from decisions...');
    let rsnt = generateRSNTFromDecisions(intent, decisions, inventory);

    // ✅ FIX 5: Validate and Fix Design Patterns
    try {
        const { fixedRoot, violations } = designPatternService.validateAndFix(rsnt, intent);
        if (violations.length > 0) {
            console.log('Design pattern violations fixed:', violations);
            rsnt = fixedRoot;
        }
    } catch (e) {
        console.error('Failed to validate design patterns:', e);
    }

    // Attach metadata
    if (!rsnt.metadata) {
        rsnt.metadata = {};
    }
    rsnt.metadata.intent = intent;
    rsnt.metadata.decisions = decisions;
    rsnt.metadata.confidence = {
        score: decisions.overallConfidence,
        factors: {
            intentClarity: intent.confidence,
            componentMatches: decisions.components.filter(c => c.selectedComponent).length / decisions.components.length,
        },
        breakdown: [
            `Intent confidence: ${intent.confidence.toFixed(2)}`,
            `Component match rate: ${(decisions.components.filter(c => c.selectedComponent).length / decisions.components.length * 100).toFixed(0)}%`,
            `Layout: ${decisions.layout.reasoning}`,
        ]
    };
    rsnt.metadata.reasoning = {
        layoutChoice: decisions.layout.reasoning,
        spacingChoice: `Using ${decisions.layout.itemSpacing}px spacing`,
        hierarchyChoice: decisions.hierarchy.reasoning,
    };
    rsnt.metadata.designDecisions = decisions.components.map(c => ({
        element: c.requirement.type,
        decision: c.selectedComponent ? `Use ${c.selectedComponent.name}` : c.fallback,
        rationale: c.reasoning
    }));

    return { rsnt, intent, decisions };
}

/**
 * Convert design decisions to RSNT structure
 */
function generateRSNTFromDecisions(
    intent: DesignIntent,
    decisions: DesignDecision,
    inventory: DesignSystemInventory
): RSNT_Node {
    const { layout, styling, hierarchy } = decisions;

    // Create root frame
    const root: RSNT_Node = {
        id: `root-${Date.now()}`,
        type: 'FRAME',
        name: intent.title || `${intent.type.charAt(0).toUpperCase() + intent.type.slice(1)}`,
        layoutMode: layout.layoutMode,
        primaryAxisSizingMode: layout.primaryAxisSizingMode,
        counterAxisSizingMode: layout.counterAxisSizingMode,
        primaryAxisAlignItems: layout.primaryAxisAlignItems,
        counterAxisAlignItems: layout.counterAxisAlignItems,
        itemSpacing: layout.itemSpacing,
        padding: layout.padding,
        width: layout.width,
        height: layout.height,
        fills: styling.fills,
        cornerRadius: styling.cornerRadius,
        children: []
    };

    // Add children based on hierarchy
    if (hierarchy.structure === 'grouped') {
        // Group components
        for (const group of hierarchy.groups) {
            if (group.hasContainer) {
                // Create a container frame for this group
                const container: RSNT_Node = {
                    id: `group-${group.name}-${Date.now()}`,
                    type: 'FRAME',
                    name: group.name,
                    layoutMode: 'VERTICAL',
                    counterAxisSizingMode: 'AUTO',
                    itemSpacing: layout.itemSpacing,
                    children: []
                };

                for (const componentIdx of group.components) {
                    const child = createNodeFromDecision(decisions.components[componentIdx], inventory);
                    container.children!.push(child);
                }

                root.children!.push(container);
            } else {
                // Add components directly
                for (const componentIdx of group.components) {
                    const child = createNodeFromDecision(decisions.components[componentIdx], inventory);
                    root.children!.push(child);
                }
            }
        }
    } else {
        // Flat structure - add all components directly
        for (const componentDecision of decisions.components) {
            const child = createNodeFromDecision(componentDecision, inventory);
            root.children!.push(child);
        }
    }

    return root;
}

/**
 * Create an RSNT node from a component decision
 */
function createNodeFromDecision(
    decision: any,
    inventory: DesignSystemInventory
): RSNT_Node {
    const req = decision.requirement;

    // If we have a matching component, use it
    if (decision.selectedComponent) {
        return {
            id: `${req.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'COMPONENT_INSTANCE',
            name: req.label || req.text || decision.selectedComponent.name,
            componentId: decision.selectedComponent.id,
            properties: decision.properties,
            characters: req.text || req.label,
        };
    }

    // Otherwise, create from primitives
    switch (req.type) {
        case 'heading':
            return createHeadingNode(req);
        case 'text':
            return createTextNode(req);
        case 'input':
            return createInputNode(req, inventory);
        case 'button':
            return createButtonNode(req, inventory);
        default:
            // Generic frame
            return {
                id: `${req.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                type: 'FRAME',
                name: req.label || req.type,
                layoutMode: 'VERTICAL',
                children: []
            };
    }
}

function createHeadingNode(req: any): RSNT_Node {
    const sizeByLevel: Record<number, number> = {
        1: 32, 2: 24, 3: 20, 4: 18, 5: 16, 6: 14
    };

    return {
        id: `heading-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'TEXT',
        name: 'Heading',
        characters: req.text || 'Heading',
        fontSize: sizeByLevel[req.level || 2] || 24,
        fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1 } }]
    };
}

function createTextNode(req: any): RSNT_Node {
    return {
        id: `text-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'TEXT',
        name: 'Text',
        characters: req.text || '',
        fontSize: 14,
        fills: [{ type: 'SOLID', color: { r: 0.3, g: 0.3, b: 0.3 } }]
    };
}

function createInputNode(req: any, inventory: DesignSystemInventory): RSNT_Node {
    // Try to find an input component
    const inputComponent = inventory.components.find(c =>
        c.name.toLowerCase().includes('input') ||
        c.name.toLowerCase().includes('textfield') ||
        c.name.toLowerCase().includes('text field')
    );

    if (inputComponent) {
        return {
            id: `input-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'COMPONENT_INSTANCE',
            name: req.label || 'Input',
            componentId: inputComponent.id,
            properties: { text: req.placeholder || '' },
            characters: req.placeholder || req.label || '',
        };
    }

    // Primitive fallback: create a frame with label and input field
    return {
        id: `input-field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'FRAME',
        name: `Input - ${req.label || 'Field'}`,
        layoutMode: 'VERTICAL',
        itemSpacing: 8,
        counterAxisSizingMode: 'AUTO',
        children: [
            {
                id: `label-${Date.now()}`,
                type: 'TEXT',
                name: 'Label',
                characters: req.label || 'Label',
                fontSize: 14,
                fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2 } }]
            },
            {
                id: `input-box-${Date.now()}`,
                type: 'FRAME',
                name: 'Input Box',
                width: 320,
                height: 44,
                cornerRadius: 8,
                fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }],
                strokes: [{ type: 'SOLID', color: { r: 0.85, g: 0.85, b: 0.85 } }],
                padding: { top: 12, right: 16, bottom: 12, left: 16 },
                children: [{
                    id: `placeholder-${Date.now()}`,
                    type: 'TEXT',
                    name: 'Placeholder',
                    characters: req.placeholder || `Enter ${req.label?.toLowerCase() || 'value'}...`,
                    fontSize: 14,
                    fills: [{ type: 'SOLID', color: { r: 0.6, g: 0.6, b: 0.6 } }]
                }]
            }
        ]
    };
}

function createButtonNode(req: any, inventory: DesignSystemInventory): RSNT_Node {
    // Try to find a button component
    const buttonComponent = inventory.components.find(c => {
        const nameLower = c.name.toLowerCase();
        return nameLower.includes('button') &&
            (req.variant ? nameLower.includes(req.variant) : true);
    });

    if (buttonComponent) {
        return {
            id: `button-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'COMPONENT_INSTANCE',
            name: req.label || 'Button',
            componentId: buttonComponent.id,
            characters: req.label || 'Button',
        };
    }

    // Primitive fallback
    const isPrimary = req.variant === 'primary' || !req.variant;

    return {
        id: `button-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'FRAME',
        name: `Button - ${req.label || 'Action'}`,
        layoutMode: 'HORIZONTAL',
        primaryAxisAlignItems: 'CENTER',
        counterAxisAlignItems: 'CENTER',
        padding: { top: 12, right: 24, bottom: 12, left: 24 },
        cornerRadius: 8,
        fills: [{ type: 'SOLID', color: isPrimary ? { r: 0.2, g: 0.4, b: 1 } : { r: 0.95, g: 0.95, b: 0.95 } }],
        counterAxisSizingMode: 'AUTO',
        children: [{
            id: `btn-text-${Date.now()}`,
            type: 'TEXT',
            name: 'Button Text',
            characters: req.label || 'Button',
            fontSize: 16,
            fills: [{ type: 'SOLID', color: isPrimary ? { r: 1, g: 1, b: 1 } : { r: 0.2, g: 0.2, b: 0.2 } }]
        }]
    };
}