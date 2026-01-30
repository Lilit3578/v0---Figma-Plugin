import { generateRSNT } from './services/ai-service';
import { DesignSystemInventory } from './services/auto-discovery';

const intentInput = document.getElementById('intent') as HTMLTextAreaElement;
const generateBtn = document.getElementById('generate') as HTMLButtonElement;
const statusArea = document.getElementById('status-area') as HTMLDivElement;
const apiKeyInput = document.getElementById('api-key') as HTMLInputElement;
const saveKeyBtn = document.getElementById('save-key') as HTMLButtonElement;
const charCounter = document.getElementById('char-counter') as HTMLDivElement;

let currentInventory: DesignSystemInventory | null = null;

// Character counter
intentInput.addEventListener('input', () => {
    const length = intentInput.value.length;
    charCounter.textContent = `${length} / 500 characters`;
});

// Request API key on load
parent.postMessage({ pluginMessage: { type: 'get-api-key' } }, '*');

// Request inventory on load
parent.postMessage({ pluginMessage: { type: 'get-inventory' } }, '*');

// Save API key
saveKeyBtn.onclick = () => {
    const key = apiKeyInput.value.trim();
    if (key) {
        parent.postMessage({ pluginMessage: { type: 'set-api-key', key } }, '*');
    }
};

// Add after saveKeyBtn.onclick
const refreshBtn = document.getElementById('refresh-inventory') as HTMLButtonElement;
if (refreshBtn) {
    refreshBtn.onclick = () => {
        showStatus('loading', 'Refreshing inventory...');
        parent.postMessage({ pluginMessage: { type: 'refresh-inventory' } }, '*');
    };
}

// Generate button
generateBtn.onclick = async () => {
    const intent = intentInput.value.trim();
    const apiKey = apiKeyInput.value.trim();

    if (!intent) {
        showStatus('error', 'Please enter a description');
        return;
    }

    if (!apiKey) {
        showStatus('error', 'Please enter your Gemini API key');
        const settingsDetails = document.querySelector('details');
        if (settingsDetails) settingsDetails.open = true;
        return;
    }

    if (!currentInventory) {
        showStatus('error', 'Design system not ready. Please wait for discovery to complete.');
        return;
    }

    console.log('Current inventory:', {
        components: currentInventory.components.length,
        variables: currentInventory.variables.length
    });

    showStatus('loading', `Generating with AI (${currentInventory.components.length} components, ${currentInventory.variables.length} variables)...`);
    generateBtn.disabled = true;

    try {
        // Generate RSNT using AI with FULL inventory
        const rsnt = await generateRSNT(intent, apiKey, currentInventory);

        console.log('Generated RSNT:', rsnt);

        showStatus('loading', 'Creating design in Figma...');

        // Send to plugin for rendering
        parent.postMessage({
            pluginMessage: {
                type: 'generate',
                intent,
                rsnt
            }
        }, '*');

    } catch (error: any) {
        console.error('Generation error:', error);
        showStatus('error', error.message || 'Generation failed');
        generateBtn.disabled = false;
    }
};

// Handle messages from plugin
window.onmessage = (event) => {
    const msg = event.data.pluginMessage;

    if (msg.type === 'api-key-loaded') {
        if (msg.key) {
            apiKeyInput.value = msg.key;
        }
    }

    if (msg.type === 'inventory-ready') {
        // Receive the COMPLETE inventory from main thread
        currentInventory = msg.inventory;

        // Add null check before accessing properties
        if (currentInventory) {
            console.log('Inventory received:', {
                components: currentInventory.components.length,
                variables: currentInventory.variables.length,
                firstComponent: currentInventory.components[0]?.name,
                firstVariable: currentInventory.variables[0]?.name
            });

            showStatus('success',
                `✓ Design system ready: ${currentInventory.components.length} components, ${currentInventory.variables.length} variables`
            );
        }
    }

    if (msg.type === 'status') {
        showStatus(msg.status, msg.message);
    }

    if (msg.type === 'complete') {
        showStatus('success', msg.message);
        generateBtn.disabled = false;
    }

    if (msg.type === 'error') {
        showStatus('error', msg.message);
        generateBtn.disabled = false;
    }
};

function showStatus(type: 'loading' | 'success' | 'error', message: string) {
    statusArea.textContent = message;
    statusArea.className = type;
    statusArea.style.display = 'block';

    if (type === 'success') {
        setTimeout(() => {
            statusArea.style.display = 'none';
        }, 3000);
    }
}