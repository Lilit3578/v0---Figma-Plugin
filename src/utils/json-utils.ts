import { createAIError, ErrorCode } from '../types/errors';

/**
 * Attempt to repair truncated JSON
 */
export function repairJSON(jsonString: string): string {
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
export function extractJSON(text: string): any {
    let cleaned = text.trim();

    // Remove markdown code blocks if present (```json ... ```)
    const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
        cleaned = codeBlockMatch[1].trim();
    }

    // Try to match a JSON object {...} or a JSON array [...]
    const objectMatch = cleaned.match(/\{[\s\S]*\}/);
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);

    if (objectMatch && arrayMatch) {
        // Both found — use whichever appears first in the text
        cleaned = objectMatch.index! <= arrayMatch.index! ? objectMatch[0] : arrayMatch[0];
    } else if (objectMatch) {
        cleaned = objectMatch[0];
    } else if (arrayMatch) {
        cleaned = arrayMatch[0];
    } else {
        // Fallback: find first { or [ and use everything from there
        const firstBrace = cleaned.indexOf('{');
        const firstBracket = cleaned.indexOf('[');
        const starts = [firstBrace, firstBracket].filter(i => i !== -1);
        if (starts.length > 0) {
            cleaned = cleaned.substring(Math.min(...starts));
        } else {
            throw createAIError(ErrorCode.INVALID_JSON_RESPONSE, { text }, 'No JSON object or array found in response');
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
    // Basic structural validation can go here if needed globally
    // For now we just return the parsed object
    // Specific validation (like "has rsnt property") should be done by the caller
    // or passed as a validator function if we want to make this generic
    return parsed;
}
