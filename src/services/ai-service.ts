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

const MODEL_NAME = 'gemini-2.5-flash';

/**
 * Extract JSON from AI response
 */
/**
 * Attempt to repair truncated JSON
 */
function repairJSON(jsonString: string): string {
    let repaired = jsonString.trim();
    const stack: string[] = [];
    let inString = false;
    let isEscaped = false;

    for (let i = 0; i < repaired.length; i++) {
        const char = repaired[i];

        if (isEscaped) {
            isEscaped = false;
            continue;
        }

        if (char === '\\') {
            isEscaped = true;
            continue;
        }

        if (char === '"') {
            inString = !inString;
            continue;
        }

        if (!inString) {
            if (char === '{') {
                stack.push('}');
            } else if (char === '[') {
                stack.push(']');
            } else if (char === '}' || char === ']') {
                if (stack.length > 0 && stack[stack.length - 1] === char) {
                    stack.pop();
                }
            }
        }
    }

    // If we are inside a string at the end, close it
    if (inString) {
        repaired += '"';
    }

    // Append missing closing brackets/braces in reverse order
    while (stack.length > 0) {
        repaired += stack.pop();
    }

    return repaired;
}

/**
 * Extract JSON from AI response
 */
function extractJSON(text: string): any {
    let cleaned = text.trim();

    // Remove markdown code blocks if present
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);

    // If we found a block, use it. If not, maybe it's truncated, so use the whole text starting from first {
    if (jsonMatch) {
        cleaned = jsonMatch[0];
    } else {
        const firstBrace = cleaned.indexOf('{');
        if (firstBrace !== -1) {
            cleaned = cleaned.substring(firstBrace);
        } else {
            throw createAIError(ErrorCode.INVALID_JSON_RESPONSE, { text }, 'No JSON object found in response');
        }
    }

    // Try to parse
    try {
        const parsed = JSON.parse(cleaned);
        return validateParsedJSON(parsed);
    } catch (error: any) {
        console.warn('JSON parse failed, attempting repair...');

        try {
            const repaired = repairJSON(cleaned);
            console.log('Repaired JSON length:', repaired.length);
            const parsed = JSON.parse(repaired);
            return validateParsedJSON(parsed);
        } catch (repairError: any) {
            // Log the problematic JSON for debugging
            console.error('Failed to parse JSON even after repair:', cleaned);
            console.error('Repair error:', repairError.message);

            // Check if JSON appears incomplete
            const openBraces = (cleaned.match(/{/g) || []).length;
            const closeBraces = (cleaned.match(/}/g) || []).length;
            const openBrackets = (cleaned.match(/\[/g) || []).length;
            const closeBrackets = (cleaned.match(/]/g) || []).length;

            if (openBraces !== closeBraces || openBrackets !== closeBrackets) {
                throw createAIError(
                    ErrorCode.INVALID_JSON_RESPONSE,
                    { openBraces, closeBraces, openBrackets, closeBrackets },
                    `JSON is incomplete/truncated and could not be repaired.`
                );
            }

            throw createAIError(ErrorCode.INVALID_JSON_RESPONSE, { originalError: error.message }, `JSON parsing failed: ${error.message}`);
        }
    }
}

function validateParsedJSON(parsed: any): any {
    // Validate structure
    if (!parsed.rsnt) {
        // Fallback: Maybe the root object IS the rsnt if the AI forgot the wrapper?
        if (parsed.id && parsed.type) {
            console.warn('Response missing "rsnt" wrapper, assuming root is RSNT');
            return { rsnt: parsed };
        }
        throw createAIError(ErrorCode.INVALID_JSON_RESPONSE, { parsed }, 'Response missing "rsnt" property');
    }

    // Check if rsnt is incorrectly an array
    if (Array.isArray(parsed.rsnt)) {
        console.error('AI returned rsnt as array instead of object:', parsed.rsnt);
        throw createAIError(ErrorCode.INVALID_JSON_RESPONSE, { rsnt: parsed.rsnt }, 'Invalid response: "rsnt" must be an object, not an array.');
    }

    // Check if rsnt is an object
    if (typeof parsed.rsnt !== 'object' || parsed.rsnt === null) {
        throw createAIError(ErrorCode.INVALID_JSON_RESPONSE, { rsnt: parsed.rsnt }, 'Invalid response: "rsnt" must be an object');
    }

    return parsed;
}

/**
 * Generate RSNT from user intent using discovered inventory
 */
export async function generateRSNT(
    userIntent: string,
    apiKey: string,
    inventory: DesignSystemInventory
): Promise<RSNT_Node | ClarificationRequest> {

    if (!apiKey || !apiKey.startsWith('AIza')) {
        throw createAIError(ErrorCode.API_REQUEST_FAILED, { apiKey }, 'INVALID_API_KEY: Please provide a valid Gemini API key');
    }

    console.log('=== AI Generation Start ===');
    console.log('Intent:', userIntent);
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
    const isRefinement = conversationManager.isRefinement(userIntent);

    if (conversationContext) {
        console.log('Using conversation context (refinement mode)');
    }

    // 4. Build prompt
    const prompt = promptBuilder.build(
        userIntent,
        inventory,
        selection.selected,
        examples,
        conversationContext
    );

    console.log(`Prompt size: ${prompt.length} characters`);
    console.log(`Prompt tokens estimate: ${Math.ceil(prompt.length / 4)}`);

    // 4. Call AI
    let response;
    try {
        response = await globalRateLimiter.executeWithRetry(async () => {
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
                throw new Error(`AI_API_RETRY: ${res.status} ${text}`);
            }

            return res;
        });
    } catch (error: any) {
        // If we get here, retries are exhausted or it's a network error
        if (error.message?.includes('429') || error.message?.includes('Rate Limit')) {
            throw createAIError(ErrorCode.API_REQUEST_FAILED, { status: 429, originalError: error.message }, 'RATE_LIMIT: Too many requests (retries exhausted).');
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
    const parsed = extractJSON(aiText);
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

    } catch (e: any) {
        console.error('Failed to calculate confidence:', e);
        // Don't fail generation, just proceed without confidence score
    }

    // Add to conversation history
    conversationManager.addTurn(userIntent, parsed.rsnt, 'v1.0');

    return parsed.rsnt;
}