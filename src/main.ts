import { getOrDiscoverInventory, refreshInventory, DesignSystemInventory } from './services/auto-discovery';
import { validateRSNT } from './types/rsnt';
import { renderRSNT } from './services/rendering';

figma.showUI(__html__, { width: 440, height: 600, themeColors: true });

// Track current inventory
let currentInventory: DesignSystemInventory | null = null;

// Auto-discover on plugin start
(async () => {
  try {
    figma.ui.postMessage({ type: 'status', status: 'loading', message: 'Discovering design system...' });

    const inventory = await getOrDiscoverInventory();
    currentInventory = inventory;

    console.log('Discovered:', {
      components: inventory.components.length,
      variables: inventory.variables.length
    });

    // Send COMPLETE inventory to UI
    figma.ui.postMessage({
      type: 'inventory-ready',
      inventory: inventory  // ← SEND THE ENTIRE INVENTORY!
    });

    figma.ui.postMessage({
      type: 'status',
      status: 'success',
      message: `✓ Found ${inventory.components.length} components, ${inventory.variables.length} variables`
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

      // Validate
      const validation = validateRSNT(rsnt);
      if (!validation.valid) {
        figma.ui.postMessage({
          type: 'error',
          message: `Validation failed: ${validation.errors.join(', ')}`
        });
        return;
      }

      // Render
      figma.ui.postMessage({ type: 'status', status: 'loading', message: 'Creating design...' });

      const rootNode = await renderRSNT(rsnt);

      // Position on canvas
      rootNode.x = figma.viewport.center.x - rootNode.width / 2;
      rootNode.y = figma.viewport.center.y - rootNode.height / 2;

      figma.currentPage.appendChild(rootNode);
      figma.currentPage.selection = [rootNode];
      figma.viewport.scrollAndZoomIntoView([rootNode]);

      figma.ui.postMessage({
        type: 'complete',
        message: '✓ Design generated successfully!'
      });

    } catch (error: any) {
      console.error('Generation failed:', error);
      figma.ui.postMessage({
        type: 'error',
        message: error.message || 'Generation failed'
      });
    }
  }

  // Refresh inventory
  if (msg.type === 'refresh-inventory') {
    try {
      figma.ui.postMessage({ type: 'status', status: 'loading', message: 'Refreshing...' });

      const inventory = await refreshInventory();
      currentInventory = inventory;

      // Send COMPLETE inventory to UI
      figma.ui.postMessage({
        type: 'inventory-ready',
        inventory: inventory  // ← SEND THE ENTIRE INVENTORY!
      });

      figma.ui.postMessage({
        type: 'complete',
        message: `✓ Refreshed: ${inventory.components.length} components, ${inventory.variables.length} variables`
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
};