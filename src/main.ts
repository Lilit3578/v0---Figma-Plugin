import { getOrDiscoverInventory, refreshInventory, incrementalDiscovery, DesignSystemInventory } from './services/auto-discovery';
import { validateRSNT } from './types/rsnt';
import { renderRSNT } from './services/rendering';
import { formatError } from './types/errors';
import { generateRSNT } from './services/ai-service';
import { historyManager } from './services/history-manager';
import { conversationManager } from './services/conversation-manager';
import { analytics } from './services/analytics';

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
    figma.ui.postMessage({
      type: 'error',
      message: `Discovery failed: ${error.message}`
    });
  }
})();

// Handle messages from UI
figma.ui.onmessage = async (msg) => {

  // Generate design
  if (msg.type === 'generate') {
    const { intent, rsnt } = msg;

    try {
      if (!rsnt) {
        throw new Error('No RSNT data received from UI');
      }

      console.log('Rendering RSNT:', rsnt);

      // Build validation context from current inventory
      const validationContext = {
        availableComponents: new Set(currentInventory?.components.map(c => c.id) || []),
        availableVariables: new Set(currentInventory?.variables.map(v => v.id) || [])
      };

      // Validate
      const validation = validateRSNT(rsnt, validationContext);
      if (!validation.valid) {
        figma.ui.postMessage({
          type: 'error',
          message: `Validation failed: ${validation.errors.join(', ')}`
        });
        return;
      }

      // Show warnings if any
      if (validation.warnings.length > 0) {
        console.warn('Validation warnings:', validation.warnings);
      }

      // Add to history
      historyManager.addEntry(intent, rsnt);

      // Add to conversation
      conversationManager.addTurn(intent, rsnt, 'v1.0');

      // Track analytics
      analytics.trackGeneration();

      // Render
      figma.ui.postMessage({ type: 'status', status: 'loading', message: 'Creating design...' });

      const renderResult = await renderRSNT(rsnt);
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

      figma.currentPage.appendChild(rootNode);
      figma.currentPage.selection = [rootNode];
      figma.viewport.scrollAndZoomIntoView([rootNode]);

      const successMessage = renderResult.errors.length > 0 || renderResult.warnings.length > 0
        ? `✓ Design generated with ${renderResult.warnings.length} warnings and ${renderResult.errors.length} errors`
        : '✓ Design generated successfully!';

      figma.ui.postMessage({
        type: 'complete',
        message: successMessage
      });

      // Send updated history state
      figma.ui.postMessage({
        type: 'history-update',
        ...historyManager.getHistoryState()
      });

    } catch (error: any) {
      console.error('Generation failed:', error);

      // Use formatError to provide user-friendly error messages
      const userError = formatError(error, {
        componentId: error.message?.match(/Component ([^ ]+) not found/)?.[1],
        variableId: error.message?.match(/Variable ([^ ]+) not found/)?.[1]
      });

      figma.ui.postMessage({
        type: 'error',
        error: userError
      });
    }
  }

  // Refresh inventory
  if (msg.type === 'refresh-inventory') {
    try {
      figma.ui.postMessage({ type: 'status', status: 'loading', message: 'Refreshing...' });

      // Use incremental discovery if we have a previous inventory
      if (currentInventory) {
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
      figma.ui.postMessage({
        type: 'error',
        message: `Refresh failed: ${error.message}`
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