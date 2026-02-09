/**
 * Antigravity Pipeline - Multi-step AI reasoning for design generation
 *
 * Instead of asking AI to do everything at once (prompt → RSNT), this pipeline
 * decomposes the work into discrete phases with explicit reasoning:
 *
 * Phase 1: Intent Parsing
 *   - Parse user prompt into structured DesignIntent
 *   - Extract components, layout requirements, constraints
 *
 * Phase 2: Decision Making
 *   - Select components from design system (or plan primitives)
 *   - Decide layout, styling, hierarchy with reasoning
 *
 * Phase 3: RSNT Building
 *   - Convert decisions into valid RSNT tree
 *   - Apply design system tokens where available
 *
 * Phase 4: Audit & Fix (existing, runs after)
 *   - Run design audit to catch mistakes
 *   - Apply auto-fixes for common issues
 *
 * Benefits:
 * - Transparent reasoning at each step
 * - Better component matching (dedicated decision phase)
 * - Easier debugging (can inspect each phase)
 * - More consistent output (structured intermediate representations)
 */

import { RSNT_Node } from '../types/rsnt';
import { DesignSystemInventory } from './auto-discovery';
import { IntentParser, DesignIntent, createIntentParser } from './intent-parser';
import { DecisionEngine, DesignDecision, createDecisionEngine } from './decision-engine';
import { RSNTBuilder, BuildResult, createRSNTBuilder } from './rsnt-builder';
import { promptBuilder } from './prompt-builder';
import { componentSelector } from './component-selector';
import { selectRelevantExamples } from './example-library';
import { extractJSON } from '../utils/json-utils';

export interface PipelineResult {
    success: boolean;
    rsnt: RSNT_Node | null;
    phases: {
        intent: PhaseResult<DesignIntent>;
        decision: PhaseResult<DesignDecision>;
        build: PhaseResult<BuildResult>;
    };
    totalTimeMs: number;
    reasoning: PipelineReasoning;
    originalPrompt?: string;      // Added for context tracking
    usedContext?: boolean;        // Track if we used selection context
    error?: string;
}


export interface PhaseResult<T> {
    success: boolean;
    data: T | null;
    timeMs: number;
    error?: string;
}

export interface PipelineReasoning {
    intentSummary: string;
    componentSelections: ComponentSelectionSummary[];
    layoutRationale: string;
    overallConfidence: number;
    warnings: string[];
}

export interface ComponentSelectionSummary {
    requirement: string;
    selection: string;
    confidence: number;
    reasoning: string;
}

export interface PipelineOptions {
    /** Show detailed logging */
    verbose?: boolean;
    /** Callback for progress updates */
    onProgress?: (phase: string, message: string) => void;
}

// ============================================================================
// ANTIGRAVITY PIPELINE
// ============================================================================

export class AntigravityPipeline {
    private intentParser: IntentParser;
    private decisionEngine: DecisionEngine;
    private rsntBuilder: RSNTBuilder;

    constructor(
        private inventory: DesignSystemInventory,
        private aiCall: (prompt: string, systemPrompt: string) => Promise<string>,
        private options: PipelineOptions = {}
    ) {
        this.intentParser = createIntentParser(inventory, aiCall);
        this.decisionEngine = createDecisionEngine(inventory, aiCall);
        this.rsntBuilder = createRSNTBuilder(inventory);
    }

    /**
     * Run the complete pipeline
     */
    async run(userPrompt: string, selectionContext?: RSNT_Node): Promise<PipelineResult> {
        if (selectionContext) {
            return this.runRefactoring(userPrompt, selectionContext);
        }

        const startTime = Date.now();
        const warnings: string[] = [];

        this.progress('Starting', 'Antigravity pipeline initiated');

        // Phase 1: Parse Intent
        this.progress('Phase 1', 'Parsing user intent...');
        const intentResult = await this.runPhase('intent', async () => {
            return await this.intentParser.parse(userPrompt);
        });

        if (!intentResult.success || !intentResult.data) {
            return this.createFailureResult(startTime, intentResult, 'Intent parsing failed');
        }

        const intent = intentResult.data;
        this.log(`Intent parsed: ${intent.type} with ${intent.components.length} components`);
        this.log(`Confidence: ${(intent.confidence * 100).toFixed(0)}%`);
        this.log(`Reasoning: ${intent.reasoning}`);

        // Phase 2: Make Decisions
        this.progress('Phase 2', 'Making design decisions...');
        const decisionResult = await this.runPhase('decision', async () => {
            return await this.decisionEngine.makeDecisions(intent);
        });

        if (!decisionResult.success || !decisionResult.data) {
            return this.createFailureResult(startTime, intentResult, 'Decision making failed', decisionResult);
        }

        const decision = decisionResult.data;
        this.log(`Decisions made for ${decision.components.length} components`);
        this.log(`Overall confidence: ${(decision.overallConfidence * 100).toFixed(0)}%`);
        this.log(`Design rationale: ${decision.designRationale}`);

        // Log component selections
        for (const comp of decision.components) {
            const selection = comp.selectedComponent
                ? `${comp.selectedComponent.name} (${comp.selectedComponent.type})`
                : `Primitive fallback: ${comp.fallback}`;
            this.log(`  - ${comp.requirement.type}: ${selection} [${(comp.confidence * 100).toFixed(0)}%]`);
        }

        // Phase 3: Build RSNT
        this.progress('Phase 3', 'Building RSNT tree...');
        const buildResult = await this.runPhase('build', async () => {
            return this.rsntBuilder.build(decision);
        });

        if (!buildResult.success || !buildResult.data) {
            return this.createFailureResult(startTime, intentResult, 'RSNT building failed', decisionResult, buildResult);
        }

        const build = buildResult.data;
        this.log(`RSNT tree built with ${build.buildLog.length} operations`);
        warnings.push(...build.warnings);

        // Log build actions
        for (const entry of build.buildLog) {
            this.log(`  [${entry.phase}] ${entry.action}: ${entry.details}`);
        }

        // Create reasoning summary
        const reasoning = this.createReasoningSummary(intent, decision, build, warnings);

        this.progress('Complete', `Pipeline finished in ${Date.now() - startTime}ms`);

        return {
            success: true,
            rsnt: build.rsnt,
            phases: {
                intent: intentResult,
                decision: decisionResult,
                build: buildResult
            },
            totalTimeMs: Date.now() - startTime,
            reasoning,
            originalPrompt: userPrompt,
            usedContext: false
        };
    }

    /**
     * Run refactoring/modification pipeline
     */
    private async runRefactoring(userPrompt: string, selectionContext: any): Promise<PipelineResult> {
        const startTime = Date.now();
        this.progress('Refactoring', 'Generating modification...');

        try {
            // 1. Select components (for context)
            const selection = componentSelector.selectComponents(userPrompt, this.inventory, 10);
            const examples = selectRelevantExamples(userPrompt, 2);

            // 2. Build prompt
            const prompt = promptBuilder.build(
                userPrompt,
                this.inventory,
                selection.selected,
                examples,
                undefined,
                selectionContext
            );

            this.log(`Refactoring prompt length: ${prompt.length}`);
            if (this.options.verbose) {
                console.log('[Antigravity] Generated Refactoring Prompt:', prompt);
            }

            // 3. Call AI
            // System prompt is empty as PromptBuilder includes it
            const aiResponse = await this.aiCall(prompt, "");
            console.log('[Antigravity] Raw refactor response:', aiResponse);
            const parsed = extractJSON(aiResponse);

            // Validate response structure
            const rsnt = parsed.rsnt || parsed;
            console.log('[Antigravity] Extracted RSNT for rendering:', rsnt);

            // Log properties of component instances in the output
            if (rsnt && rsnt.children) {
                rsnt.children.forEach((c: any) => {
                    if (c.type === 'COMPONENT_INSTANCE') {
                        console.log(`[Antigravity]   - Component Instance "${c.name}": componentId="${c.componentId}", properties=`, c.properties);
                    }
                });
            }

            return {
                success: true,
                rsnt,
                phases: {
                    intent: { success: true, data: { type: 'refactor', components: [], confidence: 1.0, reasoning: 'Modification request', constraints: { platform: 'web' }, layout: { direction: 'vertical', alignment: 'start', spacing: 'normal' } } as any, timeMs: 0 },
                    decision: { success: true, data: { components: [], layout: {} as any, styling: {} as any, hierarchy: {} as any, overallConfidence: 1.0, designRationale: 'Refactoring existing content' } as any, timeMs: 0 },
                    build: { success: true, data: { rsnt, warnings: [], buildLog: [] }, timeMs: Date.now() - startTime }
                },
                totalTimeMs: Date.now() - startTime,
                reasoning: {
                    intentSummary: 'Refactoring request',
                    componentSelections: [],
                    layoutRationale: 'Existing layout',
                    overallConfidence: 1.0,
                    warnings: []
                },
                originalPrompt: userPrompt,
                usedContext: true
            };

        } catch (error: any) {
            console.error('Refactoring failed:', error);
            return {
                success: false,
                rsnt: null,
                phases: {
                    intent: { success: false, data: null, timeMs: 0, error: 'Skipped' },
                    decision: { success: false, data: null, timeMs: 0, error: 'Skipped' },
                    build: { success: false, data: null, timeMs: Date.now() - startTime, error: error.message }
                },
                totalTimeMs: Date.now() - startTime,
                reasoning: {
                    intentSummary: 'Failed',
                    componentSelections: [],
                    layoutRationale: 'Failed',
                    overallConfidence: 0,
                    warnings: [error.message]
                },
                originalPrompt: userPrompt,
                usedContext: true,
                error: error.message
            };
        }
    }

    /**
     * Run a single phase with timing and error handling
     */
    private async runPhase<T>(
        phaseName: string,
        fn: () => Promise<T>
    ): Promise<PhaseResult<T>> {
        const startTime = Date.now();

        try {
            const data = await fn();
            return {
                success: true,
                data,
                timeMs: Date.now() - startTime
            };
        } catch (error: any) {
            this.log(`Phase "${phaseName}" failed: ${error.message}`);
            return {
                success: false,
                data: null,
                timeMs: Date.now() - startTime,
                error: error.message
            };
        }
    }

    /**
     * Create a failure result
     */
    private createFailureResult(
        startTime: number,
        intentResult: PhaseResult<DesignIntent>,
        errorMessage: string,
        decisionResult?: PhaseResult<DesignDecision>,
        buildResult?: PhaseResult<BuildResult>
    ): PipelineResult {
        return {
            success: false,
            rsnt: null,
            phases: {
                intent: intentResult,
                decision: decisionResult || { success: false, data: null, timeMs: 0 },
                build: buildResult || { success: false, data: null, timeMs: 0 }
            },
            totalTimeMs: Date.now() - startTime,
            reasoning: {
                intentSummary: errorMessage,
                componentSelections: [],
                layoutRationale: '',
                overallConfidence: 0,
                warnings: [errorMessage]
            }
        };
    }

    /**
     * Create human-readable reasoning summary
     */
    private createReasoningSummary(
        intent: DesignIntent,
        decision: DesignDecision,
        build: BuildResult,
        warnings: string[]
    ): PipelineReasoning {
        // Summarize intent
        const intentSummary = `Creating a ${intent.type} with ${intent.components.length} components. ` +
            `Layout: ${intent.layout.direction}, spacing: ${intent.layout.spacing}. ` +
            `Purpose: ${intent.constraints.purpose} (${intent.constraints.context}).`;

        // Summarize component selections
        const componentSelections: ComponentSelectionSummary[] = decision.components.map(comp => ({
            requirement: `${comp.requirement.type}${comp.requirement.label ? `: "${comp.requirement.label}"` : ''}`,
            selection: comp.selectedComponent
                ? comp.selectedComponent.name
                : 'Built from primitives',
            confidence: comp.confidence,
            reasoning: comp.reasoning
        }));

        // Layout rationale
        const layoutRationale = decision.layout.reasoning;

        return {
            intentSummary,
            componentSelections,
            layoutRationale,
            overallConfidence: decision.overallConfidence,
            warnings
        };
    }

    /**
     * Log message if verbose mode enabled
     */
    private log(message: string): void {
        if (this.options.verbose) {
            console.log(`[Antigravity] ${message}`);
        }
    }

    /**
     * Report progress
     */
    private progress(phase: string, message: string): void {
        this.log(`${phase}: ${message}`);
        this.options.onProgress?.(phase, message);
    }
}

/**
 * Factory function
 */
export function createAntigravityPipeline(
    inventory: DesignSystemInventory,
    aiCall: (prompt: string, systemPrompt: string) => Promise<string>,
    options?: PipelineOptions
): AntigravityPipeline {
    return new AntigravityPipeline(inventory, aiCall, options);
}

/**
 * Format pipeline reasoning for display in UI
 */
export function formatReasoningForUI(reasoning: PipelineReasoning): string {
    const lines: string[] = [];

    lines.push('## Design Reasoning\n');
    lines.push(reasoning.intentSummary);
    lines.push('');

    lines.push('### Component Selections\n');
    for (const comp of reasoning.componentSelections) {
        const confidence = (comp.confidence * 100).toFixed(0);
        lines.push(`- **${comp.requirement}** → ${comp.selection} (${confidence}% confidence)`);
        lines.push(`  _${comp.reasoning}_`);
    }
    lines.push('');

    lines.push('### Layout\n');
    lines.push(reasoning.layoutRationale);
    lines.push('');

    if (reasoning.warnings.length > 0) {
        lines.push('### Warnings\n');
        for (const warning of reasoning.warnings) {
            lines.push(`- ${warning}`);
        }
    }

    lines.push('');
    lines.push(`**Overall Confidence:** ${(reasoning.overallConfidence * 100).toFixed(0)}%`);

    return lines.join('\n');
}
