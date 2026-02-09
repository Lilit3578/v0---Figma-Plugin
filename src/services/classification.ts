import { ComponentAnatomy } from './anatomy';
import { ComponentInfo } from './auto-discovery';
import { createAIError, ErrorCode } from '../types/errors';
import { AIClassificationResponse, ClassificationBatchResult } from '../types/classification';
import { globalRateLimiter } from '../libs/rate-limiter';

const MODEL_NAME = 'gemini-2.5-flash';
const BATCH_SIZE = 10;

/**
 * Service to classify components using AI
 */
export class ClassificationService {
    private apiKey: string = '';

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    /**
     * Set API Key
     */
    setApiKey(key: string) {
        this.apiKey = key;
    }

    /**
     * Classify a single component (mostly for testing/fallback)
     */
    async classifyComponent(component: ComponentInfo): Promise<AIClassificationResponse> {
        if (!this.apiKey) {
            throw createAIError(ErrorCode.API_REQUEST_FAILED, {}, 'Missing API Key');
        }

        const prompt = this.buildPrompt([component]);
        const response = await this.callAI(prompt);

        // Response is expected to be an array for batch, but here we expect one
        if (Array.isArray(response) && response.length > 0) {
            return response[0];
        }

        throw createAIError(ErrorCode.INVALID_JSON_RESPONSE, { response }, 'Invalid AI Response format');
    }

    /**
     * Classify a batch of components
     */
    async classifyBatch(components: ComponentInfo[]): Promise<ClassificationBatchResult[]> {
        if (!this.apiKey || !this.apiKey.trim()) {
            return components.map(c => ({
                componentId: c.id,
                result: null,
                error: 'Missing API Key'
            }));
        }

        if (components.length === 0) return [];

        const prompt = this.buildPrompt(components);

        try {
            const aiResults = await this.callAI(prompt);

            return components.map(component => {
                const match = aiResults.find((r: any) => r.componentId === component.id);
                if (match) {
                    return {
                        componentId: component.id,
                        result: {
                            semanticRole: match.semanticRole,
                            confidence: match.confidence,
                            reasoning: match.reasoning
                        }
                    };
                }
                return {
                    componentId: component.id,
                    result: null,
                    error: 'No classification returned for this component'
                };
            });

        } catch (error: any) {
            console.error('Batch classification failed:', error);
            return components.map(c => ({
                componentId: c.id,
                result: null,
                error: error.message || 'Batch failed'
            }));
        }
    }

    /**
     * Orchestrate classification for all components
     */
    async classifyAll(components: ComponentInfo[], onProgress?: (progress: number) => void): Promise<Map<string, AIClassificationResponse>> {
        const results = new Map<string, AIClassificationResponse>();
        const batches = [];

        for (let i = 0; i < components.length; i += BATCH_SIZE) {
            batches.push(components.slice(i, i + BATCH_SIZE));
        }

        const CONCURRENCY_LIMIT = 3; // Stay safe with Gemini rate limits
        let processed = 0;

        for (let i = 0; i < batches.length; i += CONCURRENCY_LIMIT) {
            const currentBatches = batches.slice(i, i + CONCURRENCY_LIMIT);

            const chunkResults = await Promise.all(currentBatches.map(batch =>
                this.classifyBatch(batch)
            ));

            chunkResults.flat().forEach(res => {
                if (res.result) {
                    results.set(res.componentId, res.result);
                }
            });

            processed += currentBatches.reduce((acc, b) => acc + b.length, 0);
            if (onProgress) {
                onProgress(processed / components.length);
            }
        }

        return results;
    }

    private buildPrompt(components: ComponentInfo[]): string {
        return `
Analyze the following Figma components and determine their semantic purpose.

Allowed Semantic Roles:
Button, Input, Card, Badge, Avatar, Checkbox, Radio, Select, Switch, Textarea, Alert, Toast, Dialog, Popover, Tooltip, Tabs, Navigation, Header, Footer, Sidebar, Container, Section, Label, Heading, Paragraph, Icon, Image, Divider, Spinner, Progress, Skeleton, Table, List, Grid

Return a JSON array where each object contains:
- "componentId": The ID provided
- "semanticRole": One of the allowed roles
- "confidence": number between 0 and 1
- "reasoning": Brief explanation

Components to analyze:
// Include keys of properties and variants to help AI decide        ${JSON.stringify(components.map(c => {
            // Prune variant properties to essential info
            const prunedVariants: Record<string, string[]> = {};
            if (c.variantProperties) {
                Object.entries(c.variantProperties).forEach(([k, v]) => {
                    // Only send up to 5 values per variant to save tokens
                    prunedVariants[k] = v.values.slice(0, 5);
                });
            }

            return {
                componentId: c.id,
                name: c.name,
                description: c.description ? c.description.slice(0, 100) : '', // Prune long descriptions
                variantProperties: prunedVariants,
                properties: c.properties ? Object.keys(c.properties).slice(0, 10) : [], // Only first 10 props
                structure: c.anatomy?.structureSignature,
                dimensions: c.anatomy ? {
                    w: Math.round(c.anatomy.dimensionInfo.width),
                    h: Math.round(c.anatomy.dimensionInfo.height)
                } : undefined,
                hasIcon: c.anatomy?.hasIcon,
                hasLabel: c.anatomy?.hasLabel
            };
        }), null, 2)}
`;
    }

    private async callAI(prompt: string): Promise<any> {
        let response;
        try {
            response = await globalRateLimiter.executeWithRetry(async () => {
                const res = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${this.apiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{
                                parts: [{ text: prompt }]
                            }],
                            generationConfig: {
                                temperature: 0.2,
                                responseMimeType: "application/json",
                                maxOutputTokens: 8192
                            }
                        })
                    }
                );

                // Force retry on 429 (Rate Limit) or 5xx (Server Error)
                if (res.status === 429 || res.status >= 500) {
                    const text = await res.text();
                    throw new Error(`AI_API_RETRY: ${res.status} ${text}`);
                }

                return res;
            });
        } catch (error: any) {
            console.error('Classification AI call failed:', error);
            throw error;
        }

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`AI API Failed: ${response.status} ${text}`);
        }

        const data = await response.json();
        const candidate = data.candidates?.[0];

        if (!candidate?.content?.parts?.[0]?.text) {
            throw new Error('Empty AI response');
        }

        const textResponse = candidate.content.parts[0].text;

        try {
            return JSON.parse(textResponse);
        } catch (e) {
            // Fallback for rare cases where markdown fences might still appear
            const jsonMatch = textResponse.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            throw e;
        }
    }

    /**
     * Analyze multiple properties for a component to determine their semantic mapping
     */
    async analyzeComponentPropertiesBatch(request: { componentName: string, properties: { name: string, values: string[] }[] }): Promise<Record<string, import('../types/classification').PropertyAnalysis>> {
        if (!this.apiKey) {
            throw createAIError(ErrorCode.API_REQUEST_FAILED, {}, 'Missing API Key');
        }

        const prompt = this.buildPropertyAnalysisBatchPrompt(request);
        const result = await this.callAI(prompt);

        // Result should be an object keyed by propertyName with PropertyAnalysis value
        // Validate result format briefly
        if (typeof result !== 'object') {
            throw createAIError(ErrorCode.INVALID_JSON_RESPONSE, { result }, 'Invalid AI Response format for property batch');
        }
        return result;
    }

    private buildPropertyAnalysisBatchPrompt(request: { componentName: string, properties: { name: string, values: string[] }[] }): string {
        return `
Analyze these Figma component properties and classify them.

Component: ${request.componentName}
Properties:
${JSON.stringify(request.properties, null, 2)}

For each property, determine its type:
- SEMANTIC_VARIANT: Visual style variations (e.g., primary/secondary/outline/destructive). Default choice for properties named "Type" or "Variant".
- SEMANTIC_SIZE: Size variations (e.g., small/medium/large/xl)
- SEMANTIC_STATE: Interaction states (e.g., default/hover/disabled/focus)
- SEMANTIC_STYLE: Fill variations (e.g., filled/outline/ghost)
- SEMANTIC_CUSTOM: Domain-specific variants (e.g., success/warning/error)

And map each value to its semantic equivalent.

Return JSON where keys are property names:
{
  "PropertyName": {
    "propertyType": "SEMANTIC_VARIANT",
    "reasoning": "Values represent importance hierarchy",
    "valueMappings": [
      { "clientValue": "High", "semanticValue": "primary", "confidence": 0.88 },
      { "clientValue": "Medium", "semanticValue": "secondary", "confidence": 0.85 }
    ]
  },
  "AnotherProperty": { ... }
}
`;
    }

    /**
     * Analyze which variable best matches a requested token (Tier 3)
     */
    async analyzeVariableMatch(requestedToken: string, candidateVariables: string[]): Promise<{ bestMatch: string, confidence: number, reasoning: string } | null> {
        if (!this.apiKey) return null;

        const prompt = `
I am looking for a variable that semantically matches: "${requestedToken}"
Available variables: ${JSON.stringify(candidateVariables)}

Which variable is the most likely semantic equivalent?
Consider variable naming patterns, common design system conventions, and color theory.

Return JSON:
{
  "bestMatch": "variable-name-from-list",
  "confidence": number, // 0-1
  "reasoning": "brief explanation"
}
If no good match exists, set confidence to 0 and bestMatch to null.
`;

        try {
            return await this.callAI(prompt);
        } catch (e) {
            console.warn('AI Variable Match failed', e);
            return null;
        }
    }
}

export const classificationService = new ClassificationService('');
