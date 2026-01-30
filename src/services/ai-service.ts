import { RSNT_Node } from '../types/rsnt';
import { DesignSystemInventory } from './auto-discovery';

const MODEL_NAME = 'gemini-2.5-flash';

/**
 * Generate smart prompt based on discovered inventory
 */
function generateSmartPrompt(intent: string, inventory: DesignSystemInventory): string {
    const hasComponents = inventory.components.length > 0;
    const hasVariables = inventory.variables.length > 0;

    return `You are creating a Figma design structure. You must use ONLY the assets available in this specific file.

AVAILABLE COMPONENTS (${inventory.components.length}):
${inventory.components.map(c => `
- ID: "${c.id}"
  Name: "${c.name}"
  Type: ${c.type}
  ${c.variantProperties ? `Properties: ${JSON.stringify(c.variantProperties, null, 2)}` : 'No variants'}
  ${c.description ? `Description: ${c.description}` : ''}
`).join('\n')}

AVAILABLE VARIABLES (${inventory.variables.length}):
${inventory.variables.map(v => `
- ID: "${v.id}"
  Name: "${v.name}"
  Type: ${v.resolvedType}
  Value: ${JSON.stringify(v.value)}
`).join('\n')}

USER REQUEST: "${intent}"

CRITICAL INSTRUCTIONS:
1. Use ONLY component IDs from the list above
1. Use type: "FRAME", "TEXT", or "COMPONENT_INSTANCE"
2. Use ONLY variable IDs from the list above for colors, spacing, etc.
3. If using absolute colors, use hex format: "#RRGGBB"
4. Component properties must EXACTLY match the variant property names above
5. Return ONLY valid JSON, no markdown, no explanations, no code fences
6. Omit optional fields if they are empty or default (like padding 0) to save space
7. Do NOT truncate the JSON - return the complete structure

EXPECTED OUTPUT FORMAT EXAMPLE:
{
  "rsnt": {
    "id": "root",
    "type": "FRAME" | "COMPONENT_INSTANCE",
    "componentId": "exact-component-id-from-above",
    "properties": { "PropertyName": "value" },
    "layoutMode": "VERTICAL" | "HORIZONTAL",
    "itemSpacing": 16,
    "padding": { "top": 24, "right": 24, "bottom": 24, "left": 24 },
    "fills": [{ "type": "VARIABLE", "variableId": "exact-variable-id" }],
    "children": [
      {
        "id": "child-1",
        "type": "COMPONENT_INSTANCE",
        "componentId": "exact-component-id",
        "properties": { "Variant": "value" }
      }
    ]
  },
  "confidence": 0.85,
  "explanation": "Brief explanation of decisions"
}

${hasComponents ? 'PRIORITIZE using existing components over creating frames.' : 'No components found - build everything with frames and variables.'}
${hasVariables ? 'PRIORITIZE binding to variables for colors, spacing, etc.' : 'No variables found - use hardcoded values as fallback.'}

IMPORTANT: Return COMPLETE valid JSON without any markdown formatting or truncation.`;
}

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
        return JSON.parse(jsonString);
    } catch (error: any) {
        // Log the problematic JSON for debugging
        console.error('Failed to parse JSON:', jsonString);
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

    const prompt = generateSmartPrompt(userIntent, inventory);

    console.log('Sending to AI:', {
        intent: userIntent,
        componentsAvailable: inventory.components.length,
        variablesAvailable: inventory.variables.length
    });

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1/models/${MODEL_NAME}:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 8192 // Increased from 4096 to allow larger responses
                    }
                })
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error:', errorText);

            if (response.status === 429) {
                throw new Error('RATE_LIMIT: API quota exceeded. Please wait and try again.');
            } else if (response.status === 403) {
                throw new Error('INVALID_API_KEY: API key is invalid or lacks permissions.');
            } else if (response.status === 400) {
                throw new Error('BAD_REQUEST: Invalid request format. Check console for details.');
            }

            throw new Error(`API_ERROR: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        // Check for API-level errors
        if (data.error) {
            throw new Error(`API Error: ${data.error.message}`);
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            console.error('Unexpected API response structure:', JSON.stringify(data, null, 2));
            throw new Error('API returned empty response. Check console for details.');
        }

        console.log('AI Response received, length:', text.length, 'characters');
        console.log('First 300 chars:', text.substring(0, 300));
        console.log('Last 100 chars:', text.substring(text.length - 100));

        // Extract and parse JSON
        const parsed = extractJSON(text);

        if (!parsed.rsnt) {
            console.error('Parsed response:', JSON.stringify(parsed, null, 2));
            throw new Error('Response missing rsnt property. Check console for parsed response.');
        }

        console.log('Successfully parsed RSNT with',
            parsed.rsnt.children ? parsed.rsnt.children.length : 0,
            'children'
        );

        return parsed.rsnt as RSNT_Node;

    } catch (error: any) {
        console.error('AI Generation Error:', error);

        // Provide more helpful error messages
        if (error.message.includes('JSON')) {
            throw new Error(`Failed to parse AI response. The AI may have returned incomplete JSON. Try a simpler request or check your API key quota.`);
        }

        throw new Error(`AI_FAILURE: ${error.message}`);
    }
}
