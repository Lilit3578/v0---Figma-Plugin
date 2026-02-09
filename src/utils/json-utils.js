"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.repairJSON = repairJSON;
exports.extractJSON = extractJSON;
const errors_1 = require("../types/errors");
/**
 * Attempt to repair truncated JSON
 */
function repairJSON(jsonString) {
    let repaired = jsonString.trim();
    const stack = [];
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
            }
            else if (char === '[') {
                stack.push(']');
            }
            else if (char === '}' || char === ']') {
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
function extractJSON(text) {
    let cleaned = text.trim();
    // Remove markdown code blocks if present
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    // If we found a block, use it. If not, maybe it's truncated, so use the whole text starting from first {
    if (jsonMatch) {
        cleaned = jsonMatch[0];
    }
    else {
        const firstBrace = cleaned.indexOf('{');
        if (firstBrace !== -1) {
            cleaned = cleaned.substring(firstBrace);
        }
        else {
            throw (0, errors_1.createAIError)(errors_1.ErrorCode.INVALID_JSON_RESPONSE, { text }, 'No JSON object found in response');
        }
    }
    // Try to parse
    try {
        const parsed = JSON.parse(cleaned);
        return validateParsedJSON(parsed);
    }
    catch (error) {
        console.warn('JSON parse failed, attempting repair...');
        try {
            const repaired = repairJSON(cleaned);
            console.log('Repaired JSON length:', repaired.length);
            const parsed = JSON.parse(repaired);
            return validateParsedJSON(parsed);
        }
        catch (repairError) {
            // Log the problematic JSON for debugging
            console.error('Failed to parse JSON even after repair:', cleaned);
            console.error('Repair error:', repairError.message);
            // Check if JSON appears incomplete
            const openBraces = (cleaned.match(/{/g) || []).length;
            const closeBraces = (cleaned.match(/}/g) || []).length;
            const openBrackets = (cleaned.match(/\[/g) || []).length;
            const closeBrackets = (cleaned.match(/]/g) || []).length;
            if (openBraces !== closeBraces || openBrackets !== closeBrackets) {
                throw (0, errors_1.createAIError)(errors_1.ErrorCode.INVALID_JSON_RESPONSE, { openBraces, closeBraces, openBrackets, closeBrackets }, `JSON is incomplete/truncated and could not be repaired.`);
            }
            throw (0, errors_1.createAIError)(errors_1.ErrorCode.INVALID_JSON_RESPONSE, { originalError: error.message }, `JSON parsing failed: ${error.message}`);
        }
    }
}
function validateParsedJSON(parsed) {
    // Basic structural validation can go here if needed globally
    // For now we just return the parsed object
    // Specific validation (like "has rsnt property") should be done by the caller
    // or passed as a validator function if we want to make this generic
    return parsed;
}
