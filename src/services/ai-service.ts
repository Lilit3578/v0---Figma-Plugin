import { RSNT_Node } from '../types/rsnt';
import { DesignSystemInventory } from './auto-discovery';
import { componentSelector } from './component-selector';
import { promptBuilder } from './prompt-builder';
import { selectRelevantExamples } from './example-library';
import { conversationManager } from './conversation-manager';
import { createAIError, ErrorCode } from '../types/errors';
import { globalRateLimiter } from '../libs/rate-limiter';

const MODEL_NAME = 'gemini-2.0-flash';

/**
 * Extract JSON from AI response
 */
function extractJSON(text: string): any {
    let cleaned = text.trim();

    // Remove markdown code blocks if present
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw createAIError(ErrorCode.INVALID_JSON_RESPONSE, { text }, 'No JSON object found in response');
    }

    const jsonString = jsonMatch[0];

    // Try to parse
    try {
        const parsed = JSON.parse(jsonString);

        // Validate structure
        if (!parsed.rsnt) {
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

    } catch (error: any) {
        // Log the problematic JSON for debugging
        console.error('Failed to parse JSON:', jsonString);
        console.error('Parse error:', error.message);

        // Check if JSON appears incomplete
        const openBraces = (jsonString.match(/{/g) || []).length;
        const closeBraces = (jsonString.match(/}/g) || []).length;
        const openBrackets = (jsonString.match(/\[/g) || []).length;
        const closeBrackets = (jsonString.match(/]/g) || []).length;

        if (openBraces !== closeBraces || openBrackets !== closeBrackets) {
            throw createAIError(
                ErrorCode.INVALID_JSON_RESPONSE,
                { openBraces, closeBraces, openBrackets, closeBrackets },
                `JSON is incomplete/truncated. The AI response was cut off.`
            );
        }

        throw createAIError(ErrorCode.INVALID_JSON_RESPONSE, { originalError: error.message }, `JSON parsing failed: ${error.message}`);
    }
}

/**
 * Generate RSNT from user intent using discovered inventory
 */
export async function generateRSNT(
    userIntent: string,
    apiKey: string,
    inventory: DesignSystemInventory
): Promise<RSNT_Node> {

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
    const conversationContext = conversationManager.getContext();
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
    const response = await globalRateLimiter.executeWithRetry(async () => {
        return fetch(
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
    });

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

    return parsed.rsnt;
}