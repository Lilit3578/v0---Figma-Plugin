import { getOrDiscoverInventory, refreshInventory, incrementalDiscovery, DesignSystemInventory } from './services/auto-discovery';
import { validateRSNT, RSNT_Node } from './types/rsnt';
import { renderRSNT } from './services/rendering';
import { formatError, createAIError, ErrorCode } from './types/errors';
import { historyManager } from './services/history-manager';
import { conversationManager } from './services/conversation-manager';
import { analytics } from './services/analytics';
import { resolutionTracker } from './services/resolution-tracker';
import { rsntConversionService } from './services/rsnt-conversion';
import { resolveNode } from './services/resolution';
import { runDesignAudit } from './services/design-audit';
import { fixDesign } from './services/design-fixer';
import { createAntigravityPipeline, formatReasoningForUI } from './services/antigravity-pipeline';
import { makeAICall } from './services/ai-service';

// Confidence thresholds - centralized constants
const HIGH_CONFIDENCE_THRESHOLD = 0.9;
const MEDIUM_CONFIDENCE_THRESHOLD = 0.6;

figma.showUI(__html__, { width: 440, height: 600, themeColors: true });

// Track current inventory
let currentInventory: DesignSystemInventory | null = null;

// Ghost state for approval flow (must be module-scoped, not inside onmessage)
let ghostNodes: SceneNode[] = [];
let ghostRSNT: RSNT_Node | null = null;
let ghostIntent: string = '';

// Modification context (stored when user has a selection)
let pendingModificationContext: { nodeId: string; position: { x: number; y: number; width: number; height: number }; parentId: string | null } | null = null;

/**
 * Cleanup ghost nodes - removes references and optionally deletes nodes from canvas
 */
function cleanupGhostState(deleteNodes: boolean = false): void {
  if (deleteNodes) {
    for (const node of ghostNodes) {
      try {
        if (!node.removed) {
          node.remove();
        }
      } catch (e) {
        // Node may have been deleted by user already
      }
    }
  }
  ghostNodes = [];
  ghostRSNT = null;
  ghostIntent = '';
}

// Cleanup ghost state when plugin closes
figma.on('close', () => {
  cleanupGhostState(true);
});

// Auto-discover on plugin start
(async () => {
  try {
    figma.ui.postMessage({
      type: 'progress',
      step: 'Discovering design system...',
      progress: 0
    });

    // Load analytics
    await analytics.load();

    const inventory = await getOrDiscoverInventory((step, progress) => {
      figma.ui.postMessage({ type: 'progress', step, progress });
    });

    currentInventory = inventory;

    console.log('Discovered:', {
      components: inventory.components.length,
      variables: inventory.variables.length
    });

    figma.ui.postMessage({
      type: 'inventory-ready',
      inventory: inventory
    });

    figma.ui.postMessage({
      type: 'complete',
      message: `✓ Found ${inventory.components.length} components, ${inventory.variables.length} variables`
    });

    // Send initial history state
    figma.ui.postMessage({
      type: 'history-update',
      ...historyManager.getHistoryState()
    });

  } catch (error: any) {
    console.error('Discovery error:', error);
    const userError = formatError(error);
    figma.ui.postMessage({
      type: 'error',
      error: userError
    });
  }
})();

// Handle messages from UI
let cancellationRequested = false;

figma.ui.onmessage = async (msg) => {

  if (msg.type === 'cancel-generation') {
    cancellationRequested = true;
    return;
  }

  // Generate design
  if (msg.type === 'generate') {
    const { intent, rsnt, selectionContext } = msg;

    // Check if we're in read-only mode (Dev Mode / Inspect)
    if (figma.editorType === 'dev') {
      figma.ui.postMessage({
        type: 'error',
        error: {
          code: 0,
          title: 'Read-Only Mode',
          message: 'Cannot generate designs in Dev Mode. Please switch to Figma Edit Mode.',
          guidance: 'Open this file in Figma Design mode to create designs. Dev Mode is read-only.',
          suggestions: ['Switch to Figma Design mode (not Dev Mode)'],
          category: 'READ_ONLY',
          recoverable: false
        }
      });
      return;
    }

    // Store modification context if user had a selection
    if (selectionContext && selectionContext.nodeId) {
      pendingModificationContext = {
        nodeId: selectionContext.nodeId,
        position: selectionContext.position,
        parentId: selectionContext.parentId
      };
    } else {
      pendingModificationContext = null;
    }

    try {
      cancellationRequested = false;
      const startTime = Date.now();
      resolutionTracker.reset(); // Reset resolution statistics

      if (!rsnt) {
        throw createAIError(ErrorCode.INVALID_JSON_RESPONSE, { intent }, 'No RSNT data received from UI');
      }

      console.log('Received RSNT:', rsnt);

      // Get confidence score (default to 1.0 if missing to allow testing/legacy)
      const confidence = rsnt.metadata?.confidence?.score ?? 1.0;
      console.log(`Confidence Score: ${confidence}`);

      // --- DECISION TREE ---

      // 1. High Confidence -> Auto-Execute
      if (confidence >= HIGH_CONFIDENCE_THRESHOLD) {
        console.log('Path: Auto-Execute (High Confidence)');
        await handleAutoExecute(intent, rsnt, startTime);
      }

      // 2. Medium Confidence -> Ghost Preview
      else if (confidence >= MEDIUM_CONFIDENCE_THRESHOLD) {
        console.log('Path: Ghost Preview (Medium Confidence)');
        await handleGhostPreview(intent, rsnt, startTime);
      }

      // 3. Low Confidence -> Clarification
      else {
        console.log('Path: Clarification (Low Confidence)');
        handleClarification(intent, rsnt);
      }

    } catch (error: any) {
      handleGenerationError(error);
    }
  }

  // Generate using Antigravity Pipeline (multi-step reasoning)
  if (msg.type === 'generate-antigravity') {
    const { intent, apiKey, selectionContext } = msg;

    // Check if we're in read-only mode (Dev Mode / Inspect)
    if (figma.editorType === 'dev') {
      figma.ui.postMessage({
        type: 'error',
        error: {
          code: 0,
          title: 'Read-Only Mode',
          message: 'Cannot generate designs in Dev Mode. Please switch to Figma Edit Mode.',
          guidance: 'Open this file in Figma Design mode to create designs. Dev Mode is read-only.',
          suggestions: ['Switch to Figma Design mode (not Dev Mode)'],
          category: 'READ_ONLY',
          recoverable: false
        }
      });
      return;
    }

    // Store modification context if user had a selection
    if (selectionContext && selectionContext.nodeId) {
      pendingModificationContext = {
        nodeId: selectionContext.nodeId,
        position: selectionContext.position,
        parentId: selectionContext.parentId
      };
    } else {
      pendingModificationContext = null;
    }

    try {
      cancellationRequested = false;
      const startTime = Date.now();
      resolutionTracker.reset();

      if (!currentInventory) {
        throw new Error('No design system inventory available. Please refresh first.');
      }

      if (!apiKey) {
        throw new Error('No API key configured. Please add your Gemini API key.');
      }

      figma.ui.postMessage({ type: 'status', status: 'loading', message: 'Running Antigravity pipeline...' });

      // Create AI call wrapper that includes API key
      const aiCall = (prompt: string, systemPrompt: string) => makeAICall(prompt, systemPrompt, apiKey);

      // Create and run pipeline
      const pipeline = createAntigravityPipeline(currentInventory, aiCall, {
        verbose: true,
        onProgress: (phase, message) => {
          figma.ui.postMessage({ type: 'status', status: 'loading', message: `[${phase}] ${message}` });
        }
      });

      const result = await pipeline.run(intent, selectionContext);

      if (!result.success || !result.rsnt) {
        const errorMsg = result.reasoning.warnings[0] || 'Pipeline failed';
        figma.ui.postMessage({
          type: 'error',
          error: {
            code: 0,
            title: 'Antigravity Pipeline Failed',
            message: errorMsg,
            guidance: 'Try simplifying your request or using standard generation mode.',
            suggestions: ['Try a simpler prompt', 'Switch to standard mode'],
            technicalDetails: JSON.stringify(result.phases, null, 2),
            category: 'PIPELINE_ERROR',
            recoverable: true
          }
        });
        return;
      }

      // Send reasoning to UI
      figma.ui.postMessage({
        type: 'antigravity-reasoning',
        reasoning: result.reasoning,
        formattedReasoning: formatReasoningForUI(result.reasoning),
        phases: {
          intentTime: result.phases.intent.timeMs,
          decisionTime: result.phases.decision.timeMs,
          buildTime: result.phases.build.timeMs,
          totalTime: result.totalTimeMs
        }
      });

      console.log('Antigravity pipeline completed:', result);
      console.log('Reasoning:', formatReasoningForUI(result.reasoning));

      // Continue with normal rendering flow
      const rsnt = result.rsnt;

      // Add metadata for confidence-based routing
      if (!rsnt.metadata) {
        rsnt.metadata = {};
      }
      rsnt.metadata.confidence = {
        score: result.reasoning.overallConfidence,
        factors: { pipeline: 'antigravity' },
        breakdown: result.reasoning.componentSelections.map(c => `${c.requirement}: ${c.selection} (${(c.confidence * 100).toFixed(0)}%)`)
      };

      // Route based on confidence
      const confidence = result.reasoning.overallConfidence;

      if (confidence >= HIGH_CONFIDENCE_THRESHOLD) {
        console.log('Antigravity: Auto-Execute (High Confidence)');
        await handleAutoExecute(intent, rsnt, startTime);
      } else if (confidence >= MEDIUM_CONFIDENCE_THRESHOLD) {
        console.log('Antigravity: Ghost Preview (Medium Confidence)');
        await handleGhostPreview(intent, rsnt, startTime);
      } else {
        console.log('Antigravity: Low confidence, but proceeding with ghost preview');
        // For Antigravity, we still show the result even at low confidence
        // since the reasoning is transparent
        await handleGhostPreview(intent, rsnt, startTime);
      }

    } catch (error: any) {
      console.error('Antigravity pipeline error:', error);
      figma.ui.postMessage({
        type: 'error',
        error: {
          code: 0,
          title: 'Antigravity Pipeline Error',
          message: error.message || 'Unknown error',
          guidance: 'Check the console for details.',
          suggestions: ['Try again', 'Switch to standard mode'],
          technicalDetails: error.stack || '',
          category: 'PIPELINE_ERROR',
          recoverable: true
        }
      });
    }
  }

  // Handle Approval Actions
  if (msg.type === 'approve-design') {
    try {
      // Unlock and fix opacity
      if (ghostNodes.length > 0) {
        for (const node of ghostNodes) {
          try {
            // Check if node still exists (not removed by user)
            if (node.removed) continue;

            node.locked = false;
            if ('opacity' in node) {
              (node as any).opacity = 1;
            }
            if (node.name.startsWith('👻 ')) {
              node.name = node.name.substring(3);
            }
          } catch (err) {
            // Node likely deleted by user
            console.warn('Could not update ghost node:', err);
          }
        }

        // Finalize
        figma.ui.postMessage({
          type: 'complete',
          message: '✓ Design approved and finalized'
        });

        // Add to history now that it's approved
        if (ghostIntent && ghostRSNT) {
          historyManager.addEntry(ghostIntent, ghostRSNT);
          figma.ui.postMessage({
            type: 'history-update',
            ...historyManager.getHistoryState()
          });
        }

        // Clear ghost state (don't delete nodes since they're now approved)
        cleanupGhostState(false);
      }
    } catch (e: unknown) {
      console.error('Approval failed:', e);
      figma.ui.postMessage({ type: 'error', message: 'Failed to approve design' });
    }
  }

  if (msg.type === 'reject-design') {
    // Delete ghost nodes and clear state
    cleanupGhostState(true);

    figma.ui.postMessage({
      type: 'status',
      status: 'success', // Just clear status
      message: 'Design rejected'
    });
  }

  // --- Helper Functions ---

  async function handleAutoExecute(intent: string, rsnt: RSNT_Node, startTime: number) {
    const result = await performRender(rsnt, intent, startTime);

    if (result) {
      // Show success with Undo option
      figma.ui.postMessage({
        type: 'complete',
        message: result.message,
        showUndo: true // Tell UI to show special Undo toast if needed
      });

      // Add to history
      historyManager.addEntry(intent, rsnt);
      figma.ui.postMessage({
        type: 'history-update',
        ...historyManager.getHistoryState()
      });
    }
  }

  async function handleGhostPreview(intent: string, rsnt: RSNT_Node, startTime: number) {
    // Create a ghost version of RSNT or just modify render properties
    // Since renderRSNT takes RSNT, let's clone it and modify root properties if possible,
    // OR just render and then modify the nodes.
    // Modifying nodes after render is safer/easier.

    const result = await performRender(rsnt, intent, startTime);

    if (result && result.rootNode) {
      const root = result.rootNode;

      // Apply Ghost Effects
      if ('opacity' in root) {
        (root as BlendMixin).opacity = 0.6;
      }
      root.locked = true;
      root.name = "👻 " + root.name;

      // Store for later access
      ghostNodes = [root];
      ghostRSNT = rsnt;
      ghostIntent = intent;

      // Send Approval Dialog Request
      figma.ui.postMessage({
        type: 'show-approval-dialog',
        confidence: rsnt.metadata?.confidence,
        reasoning: rsnt.metadata?.reasoning,
        designDecisions: rsnt.metadata?.designDecisions,
        warnings: rsnt.metadata?.warnings || [] // Logic might need to be added to extract warnings
      });
    }
  }

  function handleClarification(_intent: string, rsnt: RSNT_Node) {
    // Do not render
    figma.ui.postMessage({
      type: 'show-clarification-dialog',
      confidence: rsnt.metadata?.confidence,
      uncertainties: rsnt.metadata?.uncertainties,
      questions: [] // Generated questions (can be added later)
    });
  }

  async function performRender(rsnt: RSNT_Node, intent: string, startTime: number) {
    // Build validation context from current inventory
    const validationContext = {
      availableComponents: new Set(currentInventory?.components.map(c => c.id) || []),
      availableVariables: new Set(currentInventory?.variables.map(v => v.id) || [])
    };

    // Validate
    const validation = validateRSNT(rsnt, validationContext);
    if (!validation.valid) {
      // Collect all errors into a user-friendly format
      const errorDetails = validation.errors.map(e => `[${e.code}] ${e.message} (${e.location})`).join('\n');

      figma.ui.postMessage({
        type: 'error',
        error: {
          code: validation.errors[0]?.code || 0,
          title: 'RSNT Validation Failed',
          message: 'The design structure contains errors.',
          guidance: validation.errors[0]?.guidance || 'Validation failed.',
          suggestions: validation.errors[0]?.code ? [validation.errors[0].code === 1004 ? 'Try a simpler request' : 'Check technical details'] : ['Retry generation'],
          technicalDetails: errorDetails,
          category: 'RSNT_VALIDATION',
          recoverable: true
        }
      });
      return null;
    }

    // Show warnings if any
    if (validation.warnings.length > 0) {
      console.warn('Validation warnings:', validation.warnings);
    }

    // Track analytics
    analytics.trackGeneration();

    // --- Resolution Pre-Pass ---
    // Walk the RSNT tree and resolve any COMPONENT_INSTANCE nodes
    // with invalid/missing componentIds using the 5-tier fallback system
    if (currentInventory) {
      figma.ui.postMessage({ type: 'status', status: 'loading', message: 'Resolving components...' });
      await resolveRSNTTree(rsnt, currentInventory);
    }

    // --- Design Audit ---
    // Check for common design mistakes before rendering
    const auditWarnings = currentInventory ? runDesignAudit(rsnt, currentInventory) : [];
    if (auditWarnings.length > 0) {
      console.log('Design audit warnings:', auditWarnings);
    }

    // --- Design Fixer ---
    // Apply post-generation corrections to fix common AI mistakes
    if (currentInventory?.guidelines) {
      figma.ui.postMessage({ type: 'status', status: 'loading', message: 'Applying design fixes...' });
      const fixReport = fixDesign(rsnt, {
        guidelines: currentInventory.guidelines,
        targetWidth: 1440,
        targetHeight: 900,
        minPadding: 16
      });
      if (fixReport.totalFixes > 0) {
        console.log(`Design fixer applied ${fixReport.totalFixes} fixes:`, fixReport.fixesApplied);
      }
    }

    // Render
    figma.ui.postMessage({ type: 'status', status: 'loading', message: 'Creating design...' });

    // Call renderRSNT with progress and cancellation callbacks
    const renderResult = await renderRSNT(
      rsnt,
      undefined,
      (progress) => {
        const percentage = Math.round((progress.current / progress.total) * 100);
        figma.ui.postMessage({
          type: 'generation-progress',
          current: progress.current,
          total: progress.total,
          percentage
        });
      },
      () => cancellationRequested
    );

    const duration = Date.now() - startTime;
    console.log(`Generation completed in ${duration}ms`);

    const rootNode = renderResult.node;

    // Track component usage from RSNT
    trackComponentsInRSNT(rootNode, intent);

    // Save analytics
    await analytics.save();

    // Check for rendering errors
    if (renderResult.errors.length > 0) {
      console.error('Rendering errors:', renderResult.errors);
      figma.ui.postMessage({
        type: 'render-errors',
        errors: renderResult.errors
      });
    }

    // Show warnings if any
    if (renderResult.warnings.length > 0) {
      console.warn('Rendering warnings:', renderResult.warnings);
      figma.ui.postMessage({
        type: 'render-warnings',
        warnings: renderResult.warnings
      });
    }

    // --- Append to canvas and position ---
    // If modifying an existing frame, place side-by-side. Otherwise center on viewport.
    let isModification = false;
    if (pendingModificationContext) {
      const originalNode = figma.currentPage.findOne(n => n.id === pendingModificationContext!.nodeId);

      if (originalNode) {
        isModification = true;
        const pos = pendingModificationContext.position;

        // Insert into same parent if original is inside a frame
        if (pendingModificationContext.parentId) {
          const parent = figma.currentPage.findOne(n => n.id === pendingModificationContext!.parentId);
          if (parent && 'appendChild' in parent) {
            (parent as FrameNode).appendChild(rootNode);
          } else {
            figma.currentPage.appendChild(rootNode);
          }
        } else {
          figma.currentPage.appendChild(rootNode);
        }

        // Place to the right of the original with 24px gap
        rootNode.x = pos.x + pos.width + 24;
        rootNode.y = pos.y;

        // Select both for easy comparison
        figma.currentPage.selection = [originalNode, rootNode];
        figma.viewport.scrollAndZoomIntoView([originalNode, rootNode]);

        // Clear modification context
        pendingModificationContext = null;
      } else {
        // Original was deleted — fall back to normal placement
        pendingModificationContext = null;
      }
    }

    if (!isModification) {
      // Default: center on viewport
      rootNode.x = figma.viewport.center.x - rootNode.width / 2;
      rootNode.y = figma.viewport.center.y - rootNode.height / 2;

      figma.currentPage.appendChild(rootNode);
      figma.currentPage.selection = [rootNode];
      figma.viewport.scrollAndZoomIntoView([rootNode]);
    }

    // Generate Resolution Summary (merge audit warnings)
    const summary = resolutionTracker.createSummary();
    if (auditWarnings.length > 0 && summary.warnings && summary.warnings.categorized) {
      summary.warnings.categorized.push({
        category: 'DESIGN_AUDIT' as any,
        count: auditWarnings.length,
        examples: auditWarnings.map((w: any) => w.message).slice(0, 3)
      });
      summary.warnings.total = (summary.warnings.total || 0) + auditWarnings.length;
    }

    // Attach summary to root node
    rootNode.setPluginData('resolution-summary', JSON.stringify(summary));

    // Send summary to UI
    figma.ui.postMessage({
      type: 'show-summary',
      summary
    });

    let successMessage = renderResult.errors.length > 0 || renderResult.warnings.length > 0
      ? `✓ Design generated with ${renderResult.warnings.length} warnings and ${renderResult.errors.length} errors (${duration}ms)`
      : `✓ Design generated successfully (${duration}ms)`;

    if (isModification) {
      successMessage = `✓ Modified version placed to the right. Compare and delete whichever you don't need. (${duration}ms)`;
    }

    return { message: successMessage, rootNode };
  }

  function handleGenerationError(error: any) {
    if (error.message === 'Operation cancelled') {
      console.log('Generation cancelled by user');
      figma.ui.postMessage({
        type: 'error',
        error: {
          title: 'Generation Cancelled',
          message: 'The design generation was cancelled by your request.',
          code: ErrorCode.GENERATION_CANCELLED,
          guidance: '',
          suggestions: [],
          category: 'EXECUTION',
          recoverable: true
        }
      });
      return;
    }

    console.error('Generation failed:', error);

    // Use formatError to provide user-friendly error messages
    const userError = formatError(error, {
      componentId: error.details?.componentId,
      variableId: error.details?.variableId
    });

    figma.ui.postMessage({
      type: 'error',
      error: userError
    });
  }

  // Refresh inventory
  if (msg.type === 'refresh-inventory' || msg.type === 'force-refresh-inventory') {
    try {
      figma.ui.postMessage({ type: 'status', status: 'loading', message: 'Refreshing...' });

      // Force refresh if requested
      if (msg.type === 'force-refresh-inventory') {
        currentInventory = null; // Reset current
        await refreshInventory((step, progress) => { // This explicitly clears cache
          figma.ui.postMessage({ type: 'progress', step, progress });
        });
      }

      // Use incremental discovery if we have a previous inventory (and not forcing)
      else if (currentInventory) {
        const result = await incrementalDiscovery(
          currentInventory,
          (step, progress) => {
            figma.ui.postMessage({
              type: 'progress',
              step,
              progress
            });
          }
        );

        currentInventory = result.inventory;

        // Show diff summary
        const { added, removed, modified, unchanged } = result.diff;
        const totalChanges = added.components.length + added.variables.length +
          removed.componentIds.length + removed.variableIds.length +
          modified.components.length + modified.variables.length;

        const message = totalChanges > 0
          ? `✓ Updated: +${added.components.length + added.variables.length} added, -${removed.componentIds.length + removed.variableIds.length} removed, ~${modified.components.length + modified.variables.length} modified, ${unchanged} unchanged`
          : `✓ No changes detected (${currentInventory.components.length} components, ${currentInventory.variables.length} variables)`;

        figma.ui.postMessage({
          type: 'complete',
          message
        });
      } else {
        // Full discovery if no previous inventory
        const inventory = await refreshInventory((step, progress) => {
          figma.ui.postMessage({ type: 'progress', step, progress });
        });
        currentInventory = inventory;

        figma.ui.postMessage({
          type: 'complete',
          message: `✓ Refreshed: ${inventory.components.length} components, ${inventory.variables.length} variables`
        });
      }

      // Send updated inventory to UI
      figma.ui.postMessage({
        type: 'inventory-ready',
        inventory: currentInventory
      });

    } catch (error: any) {
      const userError = formatError(error);
      figma.ui.postMessage({
        type: 'error',
        error: userError
      });
    }
  }

  // Send inventory to UI (on request)
  if (msg.type === 'get-inventory') {
    if (currentInventory) {
      figma.ui.postMessage({
        type: 'inventory-ready',
        inventory: currentInventory
      });
    } else {
      // Trigger discovery
      const inventory = await getOrDiscoverInventory();
      currentInventory = inventory;

      figma.ui.postMessage({
        type: 'inventory-ready',
        inventory: inventory
      });
    }
  }

  // API Key operations
  if (msg.type === 'get-api-key') {
    const key = await figma.clientStorage.getAsync('gemini_api_key');
    figma.ui.postMessage({ type: 'api-key-loaded', key });
  }

  if (msg.type === 'set-api-key') {
    await figma.clientStorage.setAsync('gemini_api_key', msg.key);
    figma.ui.postMessage({ type: 'complete', message: '✓ API key saved' });
  }

  if (msg.type === 'undo') {
    try {
      const entry = historyManager.undo();
      if (entry) {
        // Re-render previous design
        const result = await renderRSNT(entry.rsnt);
        const rootNode = result.node;

        // Position on canvas
        rootNode.x = figma.viewport.center.x - rootNode.width / 2;
        rootNode.y = figma.viewport.center.y - rootNode.height / 2;

        figma.currentPage.appendChild(rootNode);
        figma.currentPage.selection = [rootNode];
        figma.viewport.scrollAndZoomIntoView([rootNode]);

        figma.ui.postMessage({
          type: 'complete',
          message: `✓ Undo: "${entry.userIntent}"`
        });

        // Send updated history state
        figma.ui.postMessage({
          type: 'history-update',
          ...historyManager.getHistoryState()
        });
      } else {
        figma.ui.postMessage({
          type: 'error',
          message: 'Nothing to undo'
        });
      }
    } catch (error: any) {
      figma.ui.postMessage({
        type: 'error',
        message: `Undo failed: ${error.message}`
      });
    }
  }

  if (msg.type === 'redo') {
    try {
      const entry = historyManager.redo();
      if (entry) {
        // Re-render next design
        const result = await renderRSNT(entry.rsnt);
        const rootNode = result.node;

        // Position on canvas
        rootNode.x = figma.viewport.center.x - rootNode.width / 2;
        rootNode.y = figma.viewport.center.y - rootNode.height / 2;

        figma.currentPage.appendChild(rootNode);
        figma.currentPage.selection = [rootNode];
        figma.viewport.scrollAndZoomIntoView([rootNode]);

        figma.ui.postMessage({
          type: 'complete',
          message: `✓ Redo: "${entry.userIntent}"`
        });

        // Send updated history state
        figma.ui.postMessage({
          type: 'history-update',
          ...historyManager.getHistoryState()
        });
      } else {
        figma.ui.postMessage({
          type: 'error',
          message: 'Nothing to redo'
        });
      }
    } catch (error: any) {
      figma.ui.postMessage({
        type: 'error',
        message: `Redo failed: ${error.message}`
      });
    }
  }

  if (msg.type === 'clear-conversation') {
    conversationManager.clearConversation();
    figma.ui.postMessage({
      type: 'complete',
      message: '✓ Conversation cleared'
    });
  }

  if (msg.type === 'get-analytics') {
    const stats = analytics.getStatistics();
    const mostUsed = analytics.getMostUsedComponents(5);

    figma.ui.postMessage({
      type: 'analytics-data',
      stats,
      mostUsed
    });
  }
  if (msg.type === 'get-selection-context') {
    try {
      if (figma.currentPage.selection.length > 0) {
        const selection = figma.currentPage.selection[0];

        // Walk up to find the nearest Frame or Section to use as scope
        let scopeNode = selection;
        let currentNode: BaseNode | null = selection;

        while (currentNode) {
          if (currentNode.type === 'FRAME' || currentNode.type === 'SECTION') {
            scopeNode = currentNode as SceneNode;
            // Don't go higher than the immediate legitimate container
            // If the selection IS a frame, we might want to check if it's a "root" frame or a nested one
            // For now, let's treat the nearest Frame/Section as the scope
            break;
          }
          currentNode = currentNode.parent;
          if (currentNode?.type === 'PAGE' || currentNode?.type === 'DOCUMENT') {
            break;
          }
        }

        console.log(`Context scope: "${scopeNode.name}" (${scopeNode.type}) for target "${selection.name}"`);

        const contextRSNT = rsntConversionService.convertNodeToRSNT(scopeNode);

        // Capture positioning metadata for side-by-side modification
        // We use the SCOPE node for positioning (placing next to the whole frame)
        // But we track the TARGET node ID so the AI knows what to modify
        const context = {
          rsnt: contextRSNT,
          nodeId: scopeNode.id, // The ID of the container we are sending
          targetNodeId: selection.id, // The ID of the specific element selected
          position: {
            x: scopeNode.x,
            y: scopeNode.y,
            width: scopeNode.width,
            height: scopeNode.height
          },
          parentId: scopeNode.parent?.type === 'FRAME' || scopeNode.parent?.type === 'SECTION' || scopeNode.parent?.type === 'PAGE'
            ? scopeNode.parent.id
            : null
        };

        figma.ui.postMessage({
          type: 'selection-context',
          context
        });
      } else {
        figma.ui.postMessage({
          type: 'selection-context',
          context: null
        });
      }
    } catch (error: any) {
      console.error('Failed to get selection context:', error);
      figma.ui.postMessage({
        type: 'selection-context',
        context: null
      });
    }
  }
};

/**
 * Resolution pre-pass: walk the RSNT tree and resolve any COMPONENT_INSTANCE nodes
 * whose componentId is missing or not found in the inventory.
 * Mutates the tree in place before rendering.
 */
async function resolveRSNTTree(node: any, inventory: DesignSystemInventory): Promise<void> {
  const componentIds = new Set(inventory.components.map(c => c.id));
  const componentKeys = new Map(inventory.components.filter(c => c.key).map(c => [c.key, c.id]));

  console.log(`[Resolver] Inventory IDs:`, Array.from(componentIds));
  console.log(`[Resolver] Inventory Keys:`, Array.from(componentKeys.keys()));

  async function walk(n: any): Promise<void> {
    if (!n) return;

    if (n.type === 'COMPONENT_INSTANCE') {
      // 1. Precise match by ID
      if (n.componentId && componentIds.has(n.componentId)) {
        // Already valid, no resolution needed
      }
      // 2. Precise match by Key (for library components)
      else if (n.componentKey && componentKeys.has(n.componentKey)) {
        console.log(`Resolving node "${n.name || n.id}" by key "${n.componentKey}"`);
        n.componentId = componentKeys.get(n.componentKey);
      }
      else {
        // Resolution path: componentId missing or invalid
        console.log(`Resolving node "${n.name || n.id}" — componentId "${n.componentId}" not in inventory and no key match`);
        try {
          const result = await resolveNode(n, inventory);

          if (result.success && result.instructions) {
            if (result.instructions.type === 'INSTANTIATE_COMPONENT') {
              // Tier 1 or 2: update to the resolved component
              n.componentId = result.instructions.componentId;
              if (result.instructions.properties) {
                n.properties = { ...(n.properties || {}), ...result.instructions.properties };
              }
              console.log(`  → Resolved to component "${result.instructions.componentId}" (Tier ${result.tier})`);
            } else if (result.instructions.type === 'CREATE_FRAME') {
              // Tier 3, 4, or 5: convert to a FRAME with styling
              n.type = 'FRAME';
              delete n.componentId;

              const styling = result.instructions.styling || {};
              if (styling.fills) n.fills = styling.fills;
              if (styling.padding) {
                n.padding = styling.padding;
                n.layoutMode = n.layoutMode || 'VERTICAL';
              }
              if (styling.cornerRadius !== undefined) n.cornerRadius = styling.cornerRadius;

              // Apply variable bindings if available
              if (result.instructions.variableBindings) {
                const bindings = result.instructions.variableBindings;
                if (bindings.fill) {
                  n.fills = [{ type: 'VARIABLE', variableId: bindings.fill }];
                }
                if (bindings.padding) {
                  n.padding = {
                    top: { variableId: bindings.padding },
                    right: { variableId: bindings.padding },
                    bottom: { variableId: bindings.padding },
                    left: { variableId: bindings.padding }
                  };
                }
                if (bindings.cornerRadius) {
                  n.cornerRadius = { variableId: bindings.cornerRadius };
                }
                if (bindings.itemSpacing) {
                  n.itemSpacing = { variableId: bindings.itemSpacing };
                }
              }

              console.log(`  → Built as frame with variables (Tier ${result.tier})`);
            }
          }
        } catch (e) {
          console.warn(`  → Resolution failed for "${n.name || n.id}":`, e);
        }
      }
    }

    // Recurse into children
    if (n.children && Array.isArray(n.children)) {
      for (const child of n.children) {
        await walk(child);
      }
    }
  }

  await walk(node);
}

/**
 * Track components used in RSNT tree
 */
function trackComponentsInRSNT(node: any, userIntent: string): void {
  if (node.type === 'COMPONENT_INSTANCE' && node.componentId) {
    // Get component name from inventory
    const component = currentInventory?.components.find(c => c.id === node.componentId);
    if (component) {
      analytics.trackComponentUsage(node.componentId, component.name, userIntent);
    }
  }

  if (node.children) {
    for (const child of node.children) {
      trackComponentsInRSNT(child, userIntent);
    }
  }
}