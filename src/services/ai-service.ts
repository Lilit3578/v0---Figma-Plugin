import { RSNT_Node } from '../types/rsnt';
import { RSNT_SYSTEM_PROMPT } from './prompts';

/**
 * AI Service using direct API calls
 */

// Use gemini-2.5-flash - confirmed available via API listing
// This is the latest stable model (June 2025) with proper free tier quotas
// gemini-2.0-flash-lite has 0 quota limit on free tier!
const MODEL_NAME = 'gemini-2.5-flash';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generates an RSNT structure from user intent using Gemini.
 */
export async function generateRSNT(userIntent: string, apiKey: string, retryCount = 0): Promise<RSNT_Node> {
    // Reduced from 3 to 2 to save quota
    const MAX_RETRIES = 2;

    if (!apiKey) {
        throw new Error('MISSING_API_KEY: Gemini API key is missing. Please add it to Settings.');
    }

    if (!apiKey.startsWith('AIza')) {
        throw new Error('INVALID_API_KEY: The API key format appears incorrect. Please check your key.');
    }

    try {
        const prompt = `System Instructions: ${RSNT_SYSTEM_PROMPT}\n\nUser Request: "${userIntent}"\nGenerate the RSNT JSON:`;

        // Direct API call using v1beta endpoint for JSON Mode support
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1/models/${MODEL_NAME}:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.6,
                        maxOutputTokens: 2048
                    }
                })
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error Response:', errorText);

            // Better error messages for common issues
            if (response.status === 429) {
                throw new Error(`RATE_LIMIT: You've exceeded the API quota. Free tier: 15 requests/min, 1M tokens/day.`);
            } else if (response.status === 403) {
                throw new Error(`INVALID_API_KEY: API key is invalid or doesn't have access to Gemini API.`);
            } else if (response.status === 404) {
                throw new Error(`MODEL_NOT_FOUND: Model "${MODEL_NAME}" not available. Check your API tier.`);
            }

            throw new Error(`API_ERROR: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        // Extract text from response
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            console.error('Unexpected API response structure:', data);
            throw new Error('API returned unexpected response structure');
        }

        console.log('Gemini response:', text);

        // Clean and parse JSON - improved regex
        let jsonString = text.trim();

        // Remove markdown code blocks
        jsonString = jsonString.replace(/```json\s*/g, '').replace(/```\s*/g, '');

        // Remove any leading/trailing text that's not JSON
        const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            jsonString = jsonMatch[0];
        }

        try {
            const parsed: RSNT_Node = JSON.parse(jsonString);

            // Basic schema validation
            if (!parsed.id || !parsed.semanticRole || !parsed.layoutPrimitive) {
                throw new Error('Missing required RSNT fields (id, semanticRole, or layoutPrimitive)');
            }

            return parsed;
        } catch (parseError) {
            console.error('Failed to parse JSON:', text);
            throw new Error(`INVALID_JSON: AI returned unparsable response.\n\nAI returned: "${text.substring(0, 200)}..."`);
        }

    } catch (error: any) {
        const isRateLimited = error.message?.includes('429') ||
            error.message?.includes('RATE_LIMIT') ||
            error.status === 429;
        const isQuotaError = error.message?.includes('quota') ||
            error.message?.includes('RESOURCE_EXHAUSTED');

        // Don't retry on quota/auth errors
        if (isQuotaError || error.message?.includes('INVALID_API_KEY')) {
            throw error;
        }

        if (retryCount < MAX_RETRIES) {
            // Exponential backoff with jitter (prevents thundering herd)
            const baseDelay = Math.pow(2, retryCount) * 1000;
            const jitter = Math.random() * 1000;
            const waitTime = isRateLimited ? baseDelay + jitter : 500 + jitter;

            console.warn(`Attempt ${retryCount + 1} failed. Retrying in ${Math.round(waitTime)}ms...`, error.message);

            await sleep(waitTime);
            return generateRSNT(userIntent, apiKey, retryCount + 1);
        }

        console.error('AI Generation Error after retries:', error);

        if (isRateLimited) {
            throw new Error(`RATE_LIMIT: Gemini API rate limit exceeded. Free tier allows 15 requests/minute. Please wait 60 seconds.`);
        }

        throw new Error(`AI_FAILURE: ${error.message}`);
    }
}