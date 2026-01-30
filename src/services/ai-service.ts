import { RSNT_Node } from '../types/rsnt';
import { DesignSystemInventory } from './auto-discovery';
import { componentSelector } from './component-selector';
import { promptBuilder } from './prompt-builder';
import { selectRelevantExamples } from './example-library';
import { promptManager } from './prompt-manager';
import { conversationManager } from './conversation-manager';

const MODEL_NAME = 'gemini-2.5-flash';

/**
 * Extract JSON from AI response (handles markdown code blocks)
 */
function extractJSON(text: string): any {
    // Clean up response: remove potential markdown fences if extractJSON is called on raw text
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
        const lines = cleaned.split('\n');
        if (lines[0].startsWith('```')) lines.shift();
        if (lines[lines.length - 1].startsWith('```')) lines.pop();
        cleaned = lines.join('\n').trim();
    }

    // Find the first { and last } to isolate the JSON object
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1) {
        throw new Error('No JSON object found in response');
    }

    const jsonString = cleaned.substring(firstBrace, lastBrace + 1);

    // Try to parse
    try {
        const parsed = JSON.parse(jsonString);

        // Validate structure
        if (!parsed.rsnt) {
            throw new Error('Response missing "rsnt" property');
        }

        // Check if rsnt is incorrectly an array
        if (Array.isArray(parsed.rsnt)) {
            console.error('AI returned rsnt as array instead of object:', parsed.rsnt);
            throw new Error('Invalid response: "rsnt" must be an object, not an array. The AI may have misunderstood the format.');
        }

        // Check if rsnt is an object
        if (typeof parsed.rsnt !== 'object' || parsed.rsnt === null) {
            throw new Error('Invalid response: "rsnt" must be an object');
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
            throw new Error(
                `JSON is incomplete/truncated. ` +
                `Braces: ${openBraces} open vs ${closeBraces} close. ` +
                `Brackets: ${openBrackets} open vs ${closeBrackets} close. ` +
                `The AI response was cut off. Try a simpler request.`
            );
        }

        throw new Error(`JSON parsing failed: ${error.message}. Check console for details.`);
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
        throw new Error('INVALID_API_KEY: Please provide a valid Gemini API key');
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

    // 4. Build prompt using active version
    const version = promptManager.getActiveVersion();
    const prompt = version.builder.build(
        userIntent,
        inventory,
        selection.selected,
        examples,
        conversationContext  // NEW: Add conversation context
    );

    console.log(`Prompt version: ${version.version}`);
    console.log(`Prompt size: ${prompt.length} characters`);
    console.log(`Prompt tokens estimate: ${Math.ceil(prompt.length / 4)}`);

    // 4. Call AI
    const response = await fetch(
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
                    maxOutputTokens: 8192
                }
            })
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        console.error('AI API error:', errorText);

        if (response.status === 400) {
            throw new Error('INVALID_REQUEST: The request was malformed. Check your API key and try again.');
        } else if (response.status === 429) {
            throw new Error('RATE_LIMIT: Too many requests. Please wait a moment and try again.');
        } else if (response.status === 403) {
            throw new Error('INVALID_API_KEY: API key is invalid or doesn\'t have access to Gemini API.');
        }

        throw new Error(`AI_ERROR: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    console.log('AI Response received:', {
        candidates: data.candidates?.length || 0,
        finishReason: data.candidates?.[0]?.finishReason
    });

    if (!data.candidates || data.candidates.length === 0) {
        throw new Error('AI_NO_RESPONSE: The AI did not generate any response. Try rephrasing your request.');
    }

    const candidate = data.candidates[0];

    if (candidate.finishReason === 'SAFETY') {
        throw new Error('SAFETY_FILTER: The AI blocked this request due to safety filters. Try a different description.');
    }

    if (!candidate.content?.parts?.[0]?.text) {
        throw new Error('AI_EMPTY_RESPONSE: The AI response was empty. Try again or rephrase your request.');
    }

    const aiText = candidate.content.parts[0].text;
    console.log('AI generated text length:', aiText.length);

    // Parse the JSON response
    const parsed = extractJSON(aiText);
    console.log('Parsed RSNT successfully');

    return parsed.rsnt;
}