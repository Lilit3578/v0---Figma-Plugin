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

/** A single surgical edit instruction for the Clone & Delta protocol */
export interface DeltaInstruction {
    action: 'MODIFY' | 'ADD' | 'REMOVE';
    targetId: string;
    targetDescription: string;
    changes: Record<string, any>;
    insertAt?: string;
    insertIndex?: number;
    reasoning?: string;
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

        // Phase 2: Make Decisions (now includes reasoning)
        this.progress('Phase 2', 'Making design decisions with reasoning...');
        const decisionResult = await this.runPhase('decision', async () => {
            return await this.decisionEngine.makeDecisions(intent);
        });

        if (!decisionResult.success || !decisionResult.data) {
            return this.createFailureResult(startTime, intentResult, 'Decision making failed', decisionResult);
        }

        const decision = decisionResult.data;

        // Log reasoning
        if (decision.reasoning) {
            this.log(`Reasoning: ${decision.reasoning.explanation}`);
            this.log(`Pattern: ${decision.pattern?.name || 'None detected'}`);
        }

        // Phase 3: Build RSNT (with reasoning and pattern)
        this.progress('Phase 3', 'Building RSNT tree with spatial rules...');
        const buildResult = await this.runPhase('build', async () => {
            return this.rsntBuilder.build(
                decision,
                decision.reasoning,
                decision.pattern
            );
        });

        if (!buildResult.success || !buildResult.data) {
            return this.createFailureResult(startTime, intentResult, 'RSNT building failed', decisionResult, buildResult);
        }

        const build = buildResult.data;
        warnings.push(...build.warnings);

        // Create reasoning summary
        const reasoning = this.createReasoningSummaryWithReasoning(
            intent,
            decision,
            build,
            warnings
        );

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
     * Run refactoring/modification pipeline using Clone & Delta approach.
     *
     * Instead of rebuilding from scratch (which breaks layouts), this:
     * 1. Deep-clones the existing RSNT tree
     * 2. Asks AI to identify WHICH nodes need to change and WHAT the delta is
     * 3. Applies only the targeted changes to the clone
     * 4. Falls back to full regeneration only if delta approach fails
     */
    private async runRefactoring(userPrompt: string, selectionContext: RSNT_Node): Promise<PipelineResult> {
        const startTime = Date.now();
        this.progress('Refactoring', 'Clone & Delta modification pipeline...');

        try {
            // ═══════════════════════════════════════════════════════════
            // STEP 1: Deep clone the existing RSNT tree
            // ═══════════════════════════════════════════════════════════
            this.progress('Phase 1', 'Deep-cloning existing design...');
            const clonedTree: RSNT_Node = JSON.parse(JSON.stringify(selectionContext));
            this.log(`Cloned tree: ${this.countNodesInTree(clonedTree)} nodes`);

            // Build a concise structural summary for the AI
            const treeDescription = this.describeTreeForAI(selectionContext);

            // ═══════════════════════════════════════════════════════════
            // STEP 2: Ask AI to identify target nodes and their deltas
            // ═══════════════════════════════════════════════════════════
            this.progress('Phase 2', 'Identifying modification targets...');
            const deltaResult = await this.runPhase('intent', async () => {
                return await this.identifyDelta(userPrompt, treeDescription, selectionContext);
            });

            if (!deltaResult.success || !deltaResult.data) {
                // Fallback to full regeneration if delta identification fails
                this.log('Delta identification failed — falling back to full regeneration');
                return this.runFullRegeneration(userPrompt, selectionContext, startTime);
            }

            const deltas = deltaResult.data;
            this.log(`Identified ${deltas.length} delta(s) to apply`);

            // ═══════════════════════════════════════════════════════════
            // STEP 3: Apply deltas to cloned tree
            // ═══════════════════════════════════════════════════════════
            this.progress('Phase 3', `Applying ${deltas.length} surgical edit(s)...`);
            const buildResult = await this.runPhase('build', async () => {
                const warnings: string[] = [];
                let appliedCount = 0;

                for (const delta of deltas) {
                    const applied = this.applyDeltaToTree(clonedTree, delta, warnings);
                    if (applied) appliedCount++;
                }

                if (appliedCount === 0) {
                    warnings.push('No deltas could be applied — tree may be unchanged');
                }

                return {
                    rsnt: clonedTree,
                    warnings,
                    buildLog: [{
                        phase: 'component' as const,
                        action: 'Delta application',
                        details: `${appliedCount}/${deltas.length} deltas applied`
                    }]
                };
            });

            if (!buildResult.success || !buildResult.data) {
                return this.createFailureResult(startTime,
                    deltaResult as any,
                    'Delta application failed',
                    undefined,
                    buildResult as any
                );
            }

            const build = buildResult.data;

            // Create reasoning summary
            const reasoning: PipelineReasoning = {
                intentSummary: `Surgical modification: "${userPrompt}"\n\nApplied ${deltas.length} change(s) to cloned tree. Original layout preserved.`,
                componentSelections: deltas.map(d => ({
                    requirement: `${d.action} on "${d.targetDescription}"`,
                    selection: d.action === 'ADD' ? 'New node' : 'Existing node modified',
                    confidence: 0.9,
                    reasoning: d.reasoning || 'Delta applied'
                })),
                layoutRationale: 'Layout preserved from original design (clone & delta)',
                overallConfidence: 0.9,
                warnings: build.warnings
            };

            return {
                success: true,
                rsnt: build.rsnt,
                phases: {
                    intent: deltaResult as any,
                    decision: { success: true, data: null, timeMs: 0 },
                    build: buildResult as any
                },
                totalTimeMs: Date.now() - startTime,
                reasoning,
                originalPrompt: userPrompt,
                usedContext: true
            };

        } catch (error: any) {
            console.error('Clone & Delta refactoring failed:', error);
            // Fallback to full regeneration
            this.log('Exception in Clone & Delta — falling back to full regeneration');
            try {
                return await this.runFullRegeneration(userPrompt, selectionContext, startTime);
            } catch (fallbackError: any) {
                return {
                    success: false,
                    rsnt: null,
                    phases: {
                        intent: { success: false, data: null, timeMs: 0, error: 'Skipped' },
                        decision: { success: false, data: null, timeMs: 0, error: 'Skipped' },
                        build: { success: false, data: null, timeMs: Date.now() - startTime, error: fallbackError.message }
                    },
                    totalTimeMs: Date.now() - startTime,
                    reasoning: {
                        intentSummary: 'Failed',
                        componentSelections: [],
                        layoutRationale: 'Failed',
                        overallConfidence: 0,
                        warnings: [error.message, fallbackError.message]
                    },
                    originalPrompt: userPrompt,
                    usedContext: true,
                    error: fallbackError.message
                };
            }
        }
    }

    // ========================================================================
    // CLONE & DELTA HELPERS
    // ========================================================================

    /**
     * Ask AI to identify what to change and produce delta instructions
     */
    private async identifyDelta(
        userPrompt: string,
        treeDescription: string,
        _originalTree: RSNT_Node
    ): Promise<DeltaInstruction[]> {
        const prompt = `You are modifying an existing Figma design. The user wants a SURGICAL edit — change ONLY what they asked for, preserve everything else.

EXISTING DESIGN TREE:
${treeDescription}

USER REQUEST: "${userPrompt}"

INSTRUCTIONS:
1. Identify which node(s) in the tree need to change
2. Determine the MINIMAL set of property changes needed
3. Return a JSON array of delta instructions

DELTA INSTRUCTION FORMAT:
[
  {
    "action": "MODIFY" | "ADD" | "REMOVE",
    "targetId": "the node ID to modify (from tree above)",
    "targetDescription": "human-readable description of what's being changed",
    "changes": {
      // Only include properties that CHANGE. Omit everything that stays the same.
      // For MODIFY: the new property values
      // For ADD: the full new node to insert
      // For REMOVE: leave empty
    },
    "insertAt": "parentId to insert under (for ADD only)",
    "insertIndex": 0,
    "reasoning": "Why this change is needed"
  }
]

RULES:
- NEVER change nodes the user didn't ask about
- For "change button color" → only change the button's fills, nothing else
- For "add a checkbox" → add a new node, don't touch existing nodes
- For "remove the divider" → remove that node, don't touch siblings
- The targetId MUST match an actual ID from the tree above
- Return ONLY valid JSON array. No markdown.

AVAILABLE PROPERTY KEYS for changes:
- fills: [{ type: "SOLID", color: { r, g, b } }]  (values 0-1)
- characters: "new text"
- fontSize: number
- cornerRadius: number
- padding: { top, right, bottom, left }
- itemSpacing: number
- properties: { variant: "secondary" } (for component instances)
- name: "new name"
- layoutMode: "VERTICAL" | "HORIZONTAL"
- visible: true/false`;

        const systemPrompt = `You are a precise design modification assistant. You identify the MINIMUM set of changes needed to fulfill a user request. You never regenerate entire designs — you apply surgical deltas.`;

        const response = await this.aiCall(prompt, systemPrompt);
        const deltas = extractJSON(response);

        // Validate: must be an array
        if (!Array.isArray(deltas)) {
            throw new Error('Delta response was not an array');
        }

        // Validate each delta has required fields
        return deltas.filter((d: any) =>
            d && d.action && (d.targetId || d.action === 'ADD') && typeof d === 'object'
        );
    }

    /**
     * Apply a single delta instruction to the RSNT tree (mutates in place)
     */
    private applyDeltaToTree(tree: RSNT_Node, delta: DeltaInstruction, warnings: string[]): boolean {
        switch (delta.action) {
            case 'MODIFY': {
                const target = this.findNodeById(tree, delta.targetId);
                if (!target) {
                    // Try by name as fallback
                    const byName = this.findNodeByName(tree, delta.targetDescription || delta.targetId);
                    if (!byName) {
                        warnings.push(`Could not find node "${delta.targetId}" to modify`);
                        return false;
                    }
                    return this.mergeChanges(byName, delta.changes, warnings);
                }
                return this.mergeChanges(target, delta.changes, warnings);
            }

            case 'ADD': {
                const parent = delta.insertAt
                    ? (this.findNodeById(tree, delta.insertAt) || tree)
                    : tree;

                if (!parent.children) parent.children = [];

                const newNode: RSNT_Node = {
                    id: `added-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    type: 'FRAME',
                    name: delta.targetDescription || 'new-element',
                    ...delta.changes
                };

                const insertIdx = typeof delta.insertIndex === 'number'
                    ? Math.min(delta.insertIndex, parent.children.length)
                    : parent.children.length;

                parent.children.splice(insertIdx, 0, newNode);
                this.log(`Added node "${newNode.name}" at index ${insertIdx} in "${parent.name}"`);
                return true;
            }

            case 'REMOVE': {
                const removed = this.removeNodeById(tree, delta.targetId);
                if (!removed) {
                    warnings.push(`Could not find node "${delta.targetId}" to remove`);
                    return false;
                }
                this.log(`Removed node "${delta.targetId}"`);
                return true;
            }

            default:
                warnings.push(`Unknown delta action: ${delta.action}`);
                return false;
        }
    }

    /**
     * Merge property changes into a node (only overwrite specified keys)
     */
    private mergeChanges(node: RSNT_Node, changes: Record<string, any>, warnings: string[]): boolean {
        if (!changes || typeof changes !== 'object') {
            warnings.push('Delta had no changes object');
            return false;
        }

        for (const [key, value] of Object.entries(changes)) {
            if (key === 'properties' && node.properties) {
                // Merge component properties (don't replace entire object)
                Object.assign(node.properties, value);
            } else if (key === 'padding' && node.padding && typeof value === 'object') {
                // Merge padding (allow changing just one side)
                Object.assign(node.padding, value);
            } else if (key === 'fills' || key === 'strokes' || key === 'effects') {
                // Replace arrays entirely (fills, strokes, effects)
                (node as any)[key] = value;
            } else {
                // Direct property override
                (node as any)[key] = value;
            }
        }

        this.log(`Modified node "${node.name || node.id}": ${Object.keys(changes).join(', ')}`);
        return true;
    }

    /**
     * Find a node by ID anywhere in the tree
     */
    private findNodeById(tree: RSNT_Node, id: string): RSNT_Node | null {
        if (tree.id === id) return tree;
        if (tree.children) {
            for (const child of tree.children) {
                const found = this.findNodeById(child, id);
                if (found) return found;
            }
        }
        return null;
    }

    /**
     * Find a node by name (case-insensitive, partial match)
     */
    private findNodeByName(tree: RSNT_Node, name: string): RSNT_Node | null {
        const lower = name.toLowerCase();
        if (tree.name?.toLowerCase().includes(lower)) return tree;
        if (tree.children) {
            for (const child of tree.children) {
                const found = this.findNodeByName(child, name);
                if (found) return found;
            }
        }
        return null;
    }

    /**
     * Remove a node by ID from the tree, returning whether it was found
     */
    private removeNodeById(tree: RSNT_Node, id: string): boolean {
        if (!tree.children) return false;
        const idx = tree.children.findIndex(c => c.id === id);
        if (idx >= 0) {
            tree.children.splice(idx, 1);
            return true;
        }
        for (const child of tree.children) {
            if (this.removeNodeById(child, id)) return true;
        }
        return false;
    }

    /**
     * Build a concise structural description of the RSNT tree for AI context
     */
    private describeTreeForAI(node: RSNT_Node, depth: number = 0): string {
        const indent = '  '.repeat(depth);
        const parts: string[] = [];

        // Node header
        let header = `${indent}[${node.id}] ${node.type}`;
        if (node.name) header += ` name="${node.name}"`;

        // Key properties
        const props: string[] = [];
        if (node.type === 'COMPONENT_INSTANCE') {
            if (node.componentId) props.push(`componentId="${node.componentId}"`);
            if (node.properties) props.push(`props=${JSON.stringify(node.properties)}`);
        }
        if (node.type === 'TEXT') {
            if (node.characters) props.push(`text="${node.characters.substring(0, 50)}"`);
            if (node.fontSize) props.push(`fontSize=${node.fontSize}`);
        }
        if (node.type === 'FRAME') {
            if (node.layoutMode) props.push(`layout=${node.layoutMode}`);
            if (node.width) props.push(`w=${Math.round(node.width)}`);
            if (node.height) props.push(`h=${Math.round(node.height)}`);
            if (node.itemSpacing) props.push(`gap=${node.itemSpacing}`);
            if (node.padding) {
                const p = node.padding;
                props.push(`pad=${p.top}/${p.right}/${p.bottom}/${p.left}`);
            }
        }
        if (node.fills && node.fills.length > 0) {
            const fill = node.fills[0];
            if (fill.color) {
                props.push(`fill=rgb(${(fill.color.r * 255).toFixed(0)},${(fill.color.g * 255).toFixed(0)},${(fill.color.b * 255).toFixed(0)})`);
            }
        }
        if (node.cornerRadius) props.push(`radius=${node.cornerRadius}`);

        if (props.length > 0) header += ` {${props.join(', ')}}`;
        parts.push(header);

        // Children
        if (node.children && node.children.length > 0) {
            for (const child of node.children) {
                parts.push(this.describeTreeForAI(child, depth + 1));
            }
        }

        return parts.join('\n');
    }

    /**
     * Count total nodes in a tree
     */
    private countNodesInTree(node: RSNT_Node): number {
        let count = 1;
        if (node.children) {
            for (const child of node.children) {
                count += this.countNodesInTree(child);
            }
        }
        return count;
    }

    /**
     * Fallback: full regeneration (original approach) when delta fails.
     * Uses the extract + merge strategy as a last resort.
     */
    private async runFullRegeneration(
        userPrompt: string,
        selectionContext: RSNT_Node,
        startTime: number
    ): Promise<PipelineResult> {
        this.progress('Fallback', 'Running full regeneration...');

        const existingComponents = this.extractRequirementsFromContext(selectionContext);
        this.log(`Fallback: Extracted ${existingComponents.length} existing components`);

        const intentResult = await this.runPhase('intent', async () => {
            return await this.intentParser.parse(userPrompt);
        });

        if (!intentResult.success || !intentResult.data) {
            return this.createFailureResult(startTime, intentResult, 'Intent parsing failed during fallback');
        }

        const newIntent = intentResult.data;
        const mergedIntent = {
            ...newIntent,
            components: [...existingComponents, ...newIntent.components],
            constraints: { ...newIntent.constraints, context: 'refactor' },
            title: selectionContext.name || newIntent.title || 'Untitled'
        };

        const decisionResult = await this.runPhase('decision', async () => {
            return await this.decisionEngine.makeDecisions(mergedIntent);
        });

        if (!decisionResult.success || !decisionResult.data) {
            return this.createFailureResult(startTime, intentResult, 'Decision making failed', decisionResult);
        }

        const decision = decisionResult.data;
        const buildResult = await this.runPhase('build', async () => {
            return this.rsntBuilder.build(decision, decision.reasoning, decision.pattern);
        });

        if (!buildResult.success || !buildResult.data) {
            return this.createFailureResult(startTime, intentResult, 'Build failed', decisionResult, buildResult);
        }

        const build = buildResult.data;
        const reasoning = this.createReasoningSummaryWithReasoning(mergedIntent, decision, build, build.warnings);
        reasoning.warnings.push('Used full regeneration fallback (delta approach failed)');

        return {
            success: true,
            rsnt: build.rsnt,
            phases: { intent: intentResult, decision: decisionResult, build: buildResult },
            totalTimeMs: Date.now() - startTime,
            reasoning,
            originalPrompt: userPrompt,
            usedContext: true
        };
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

    private createReasoningSummaryWithReasoning(
        intent: DesignIntent,
        decision: DesignDecision,
        build: BuildResult,
        warnings: string[]
    ): PipelineReasoning {
        // Use existing summary logic
        const base = this.createReasoningSummary(intent, decision, build, warnings);

        // Enhance with deep reasoning if available
        if (decision.reasoning) {
            base.intentSummary += `\n\n**Design Goal:** ${decision.reasoning.goal}`;
            base.layoutRationale = `**Strategy:** ${decision.reasoning.layoutStrategy} (${decision.pattern?.name || 'No pattern'})\n\n${base.layoutRationale}\n\n**Reasoning:** ${decision.reasoning.explanation}`;
        }

        return base;
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

    /**
     * Recursively extract requirements from existing RSNT context
     */
    private extractRequirementsFromContext(node: RSNT_Node): any[] {
        const reqs: any[] = [];
        const name = node.name ? node.name.toLowerCase() : '';
        const nodeType = node.type as string;

        // Extract from current node
        if (nodeType === 'COMPONENT_INSTANCE' || nodeType === 'INSTANCE') {
            // It's a component!
            // Try to infer type from name or properties
            let type = 'custom';
            if (name.includes('button')) type = 'button';
            else if (name.includes('input') || name.includes('field')) type = 'input';
            else if (name.includes('check') || name.includes('toggle')) type = 'checkbox';
            else if (name.includes('avatar')) type = 'avatar';
            else if (name.includes('image')) type = 'image';
            else if (name.includes('card')) type = 'card';

            // Construct requirement
            const req: any = {
                type,
                label: node.name, // Use name as label fallback
                // We'd ideally read props here, but RSNT might be raw. 
                // For now, rely on name and type inference.
                // If we have access to node.properties, we could be smarter.
            };

            // Check properties if available (RefactorContext usually provides them)
            if (node.properties) {
                if (node.properties.label) req.label = node.properties.label;
                if (node.properties.text) req.text = node.properties.text;
                // Try to infer variant
                if (node.properties.variant) req.variant = node.properties.variant.toLowerCase();

                // Try to infer inputType from variant
                if (req.type === 'input') {
                    if (req.variant === 'emailaddress') req.inputType = 'email';
                    if (req.variant === 'password') req.inputType = 'password';
                }
            } else {
                // Fallback: check name for inputType hints
                if (name.includes('email')) req.inputType = 'email';
                if (name.includes('password')) req.inputType = 'password';
            }

            reqs.push(req);
        }
        else if (node.type === 'TEXT') {
            // Text node
            const isHeading = (node.fontSize && node.fontSize > 20) || name.includes('heading') || name.includes('title');
            reqs.push({
                type: isHeading ? 'heading' : 'text',
                text: node.characters || 'Text',
                level: isHeading ? 2 : undefined
            });
        }

        // Recursively check children
        if (node.children) {
            for (const child of node.children) {
                reqs.push(...this.extractRequirementsFromContext(child));
            }
        }

        return reqs;
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
