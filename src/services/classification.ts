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
        if (!this.apiKey) {
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

        let processed = 0;

        for (const batch of batches) {
            const batchResults = await this.classifyBatch(batch);

            batchResults.forEach(res => {
                if (res.result) {
                    results.set(res.componentId, res.result);
                }
            });

            processed += batch.length;
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
${JSON.stringify(components.map(c => ({
            componentId: c.id,
            name: c.name,
            structure: c.anatomy?.structureSignature,
            dimensions: c.anatomy?.dimensionInfo,
            layout: c.anatomy?.layoutInfo,
            hasIcon: c.anatomy?.hasIcon,
            hasLabel: c.anatomy?.hasLabel
        })), null, 2)}
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
                                responseMimeType: "application/json"
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
     * Analyze a single property to determine its semantic mapping
     */
    async analyzeProperty(request: { componentName: string, propertyName: string, values: string[] }): Promise<import('../types/classification').PropertyAnalysis> {
        if (!this.apiKey) {
            throw createAIError(ErrorCode.API_REQUEST_FAILED, {}, 'Missing API Key');
        }

        const prompt = this.buildPropertyAnalysisPrompt(request);
        return await this.callAI(prompt);
    }

    private buildPropertyAnalysisPrompt(request: { componentName: string, propertyName: string, values: string[] }): string {
        return `
Analyze this Figma component variant property and classify it.

Component: ${request.componentName}
Property Name: ${request.propertyName}
Property Values: ${JSON.stringify(request.values)}

What type of property is this?
- SEMANTIC_VARIANT: Visual style variations (e.g., primary/secondary/outline/destructive)
- SEMANTIC_SIZE: Size variations (e.g., small/medium/large/xl)
- SEMANTIC_STATE: Interaction states (e.g., default/hover/disabled/focus)
- SEMANTIC_STYLE: Fill variations (e.g., filled/outline/ghost)
- SEMANTIC_CUSTOM: Domain-specific variants (e.g., success/warning/error)

For each value, map to the most likely semantic equivalent:
- If SEMANTIC_VARIANT → map to: primary, secondary, ghost, destructive, outline, link
- If SEMANTIC_SIZE → map to: xs, sm, md, lg, xl
- If SEMANTIC_STATE → map to: default, hover, focus, active, disabled
- If SEMANTIC_STYLE → map to: filled, outline, ghost

Return JSON:
{
  "propertyType": "SEMANTIC_VARIANT",
  "reasoning": "Values represent importance hierarchy",
  "valueMappings": [
    { "clientValue": "High", "semanticValue": "primary", "confidence": 0.88 },
    { "clientValue": "Medium", "semanticValue": "secondary", "confidence": 0.85 }
  ]
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
