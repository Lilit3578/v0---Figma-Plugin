"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const json_utils_1 = require("../utils/json-utils");
// Mock CompilerError since we can't easily import it without full project context setup in this standalone test
class MockCompilerError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}
// Mock createAIError
jest.mock('../types/errors', () => ({
    ErrorCode: {
        INVALID_JSON_RESPONSE: 2002
    },
    createAIError: (code, details, message) => new MockCompilerError(code, message)
}));
describe('json-utils', () => {
    describe('repairJSON', () => {
        it('should return valid JSON as is', () => {
            const input = '{"key": "value"}';
            expect((0, json_utils_1.repairJSON)(input)).toBe(input);
        });
        it('should close unclosed braces', () => {
            const input = '{"key": "value"';
            expect((0, json_utils_1.repairJSON)(input)).toBe('{"key": "value"}');
        });
        it('should close unclosed nested braces', () => {
            const input = '{"key": {"nested": "value"';
            expect((0, json_utils_1.repairJSON)(input)).toBe('{"key": {"nested": "value"}}');
        });
        it('should close unclosed arrays', () => {
            const input = '["item1", "item2"';
            expect((0, json_utils_1.repairJSON)(input)).toBe('["item1", "item2"]');
        });
        it('should close unclosed strings', () => {
            const input = '{"key": "val';
            expect((0, json_utils_1.repairJSON)(input)).toBe('{"key": "val"}');
        });
        it('should handle mixture of unclosed structures', () => {
            const input = '{"list": [{"name": "item1"';
            expect((0, json_utils_1.repairJSON)(input)).toBe('{"list": [{"name": "item1"}]}');
        });
    });
    describe('extractJSON', () => {
        it('should extract JSON from markdown code blocks', () => {
            const input = 'Here is the JSON:\n```json\n{\n  "key": "value"\n}\n```';
            const result = (0, json_utils_1.extractJSON)(input);
            expect(result).toEqual({ key: 'value' });
        });
        it('should extract JSON from plain text wrapper', () => {
            const input = 'Sure, here is the result: {"key": "value"} hope it helps.';
            const result = (0, json_utils_1.extractJSON)(input);
            expect(result).toEqual({ key: 'value' });
        });
        it('should repair and parse truncated JSON', () => {
            const input = '{"key": "val';
            const result = (0, json_utils_1.extractJSON)(input);
            expect(result).toEqual({ key: 'val' });
        });
        it('should throw INVALID_JSON_RESPONSE if no JSON found', () => {
            const input = 'Just some text without JSON brackets.';
            expect(() => (0, json_utils_1.extractJSON)(input)).toThrow();
        });
        it('should parse valid JSON successfully', () => {
            const input = '{"valid": true}';
            expect((0, json_utils_1.extractJSON)(input)).toEqual({ valid: true });
        });
    });
});
