import { getOrDiscoverInventory, refreshInventory, incrementalDiscovery, DesignSystemInventory } from './services/auto-discovery';
import { validateRSNT } from './types/rsnt';
import { renderRSNT } from './services/rendering';
import { formatError, createAIError, ErrorCode } from './types/errors';
import { generateRSNT } from './services/ai-service';
import { historyManager } from './services/history-manager';
import { conversationManager } from './services/conversation-manager';
import { analytics } from './services/analytics';
import { resolutionTracker } from './services/resolution-tracker';

figma.showUI(__html__, { width: 440, height: 600, themeColors: true });

// Track current inventory
let currentInventory: DesignSystemInventory | null = null;

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

  // Approval Thresholds
  const HIGH_CONFIDENCE_THRESHOLD = 0.9;
  const MEDIUM_CONFIDENCE_THRESHOLD = 0.6;

  // Track ghost nodes for approval flow
  let ghostNodes: SceneNode[] = [];
  let ghostRSNT: any = null;
  let ghostIntent: string = '';

  // Generate design
  if (msg.type === 'generate') {
    const { intent, rsnt } = msg;

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

  // Handle Approval Actions
  if (msg.type === 'approve-design') {
    try {
      // Unlock and fix opacity
      if (ghostNodes.length > 0) {
        for (const node of ghostNodes) {
          try {
            // Check if node still exists (not removed)
            if (node.parent === null && node.removed) continue;

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

        // Clear ghost state
        ghostNodes = [];
        ghostRSNT = null;
        ghostIntent = '';
      }
    } catch (e: any) {
      console.error('Approval failed:', e);
      figma.ui.postMessage({ type: 'error', message: 'Failed to approve design' });
    }
  }

  if (msg.type === 'reject-design') {
    // Delete ghost nodes
    if (ghostNodes.length > 0) {
      for (const node of ghostNodes) {
        try {
          node.remove();
        } catch (e) {
          // Ignore if already removed
        }
      }
      ghostNodes = [];
    }
    ghostRSNT = null;
    ghostIntent = '';

    figma.ui.postMessage({
      type: 'status',
      status: 'success', // Just clear status
      message: 'Design rejected'
    });
  }

  // --- Helper Functions ---

  async function handleAutoExecute(intent: string, rsnt: any, startTime: number) {
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

  async function handleGhostPreview(intent: string, rsnt: any, startTime: number) {
    // Create a ghost version of RSNT or just modify render properties
    // Since renderRSNT takes RSNT, let's clone it and modify root properties if possible, 
    // OR just render and then modify the nodes.
    // Modifying nodes after render is safer/easier.

    const result = await performRender(rsnt, intent, startTime);

    if (result && result.rootNode) {
      const root = result.rootNode;

      // Apply Ghost Effects
      if ('opacity' in root) {
        (root as any).opacity = 0.6;
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

  function handleClarification(intent: string, rsnt: any) {
    // Do not render
    figma.ui.postMessage({
      type: 'show-clarification-dialog',
      confidence: rsnt.metadata?.confidence,
      uncertainties: rsnt.metadata?.uncertainties,
      questions: [] // Generated questions (can be added later)
    });
  }

  async function performRender(rsnt: any, intent: string, startTime: number) {
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

    // Add to conversation
    conversationManager.addTurn(intent, rsnt, 'v1.0');

    // Track analytics
    analytics.trackGeneration();

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

    // Position on canvas
    rootNode.x = figma.viewport.center.x - rootNode.width / 2;
    rootNode.y = figma.viewport.center.y - rootNode.height / 2;

    // Generate Resolution Summary
    const summary = resolutionTracker.createSummary();

    // Attach summary to root node
    rootNode.setPluginData('resolution-summary', JSON.stringify(summary));

    // Send summary to UI
    figma.ui.postMessage({
      type: 'show-summary',
      summary
    });

    figma.currentPage.appendChild(rootNode);
    figma.currentPage.selection = [rootNode];
    figma.viewport.scrollAndZoomIntoView([rootNode]);

    const successMessage = renderResult.errors.length > 0 || renderResult.warnings.length > 0
      ? `✓ Design generated with ${renderResult.warnings.length} warnings and ${renderResult.errors.length} errors (${duration}ms)`
      : `✓ Design generated successfully (${duration}ms)`;

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
};

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