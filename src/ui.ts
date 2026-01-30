import { generateRSNT } from './services/ai-service';
import { DesignSystemInventory } from './services/auto-discovery';
import { RateLimiter } from './libs/rate-limiter';
import { UserFacingError, RenderError } from './types/errors';

const intentInput = document.getElementById('intent-input') as HTMLInputElement;
const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement;
const refreshBtn = document.getElementById('refresh-btn') as HTMLButtonElement;
const statusArea = document.getElementById('status-area') as HTMLDivElement;
const apiKeyInput = document.getElementById('api-key') as HTMLInputElement;
const saveKeyBtn = document.getElementById('save-key') as HTMLButtonElement;
const charCounter = document.getElementById('char-counter') as HTMLDivElement;
const cooldownTimer = document.getElementById('cooldown-timer') as HTMLDivElement;
const undoBtn = document.getElementById('undo-btn') as HTMLButtonElement;
const redoBtn = document.getElementById('redo-btn') as HTMLButtonElement;
const clearConvBtn = document.getElementById('clear-conv-btn') as HTMLButtonElement;

let currentInventory: DesignSystemInventory | null = null;
const rateLimiter = new RateLimiter(2000); // 2 second minimum interval

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
if (refreshBtn) {
    refreshBtn.onclick = () => {
        showStatus('loading', 'Refreshing inventory...');
        parent.postMessage({ pluginMessage: { type: 'refresh-inventory' } }, '*');
    };
}

undoBtn.onclick = () => {
    parent.postMessage({ pluginMessage: { type: 'undo' } }, '*');
};

redoBtn.onclick = () => {
    parent.postMessage({ pluginMessage: { type: 'redo' } }, '*');
};

clearConvBtn.onclick = () => {
    parent.postMessage({ pluginMessage: { type: 'clear-conversation' } }, '*');
};

// Generate button with rate limiting
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

    // Apply rate limiting
    await rateLimiter.throttle(async () => {
        showStatus('loading', `Generating with AI (${currentInventory!.components.length} components, ${currentInventory!.variables.length} variables)...`);
        generateBtn.disabled = true;

        try {
            // Generate RSNT using AI with FULL inventory
            const rsnt = await generateRSNT(intent, apiKey, currentInventory!);

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
    });

    // Start cooldown timer
    startCooldownTimer();
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
        // Handle structured errors
        if (msg.error && typeof msg.error === 'object') {
            showStructuredError(msg.error as UserFacingError);
        } else {
            showStatus('error', msg.message || 'An error occurred');
        }
        generateBtn.disabled = false;
    }

    if (msg.type === 'render-errors') {
        showRenderErrors(msg.errors);
    }

    if (msg.type === 'render-warnings') {
        showRenderWarnings(msg.warnings);
    }

    if (msg.type === 'progress') {
        showProgress(msg.step, msg.progress);
    }

    if (msg.type === 'history-update') {
        undoBtn.disabled = !msg.canUndo;
        redoBtn.disabled = !msg.canRedo;
    }
};

function showStatus(type: 'loading' | 'success' | 'error', message: string) {
    statusArea.innerHTML = ''; // Clear previous content
    statusArea.textContent = message;
    statusArea.className = type;
    statusArea.style.display = 'block';

    if (type === 'success') {
        setTimeout(() => {
            statusArea.style.display = 'none';
        }, 3000);
    }
}

function showStructuredError(error: UserFacingError) {
    statusArea.innerHTML = `
        <div class="error-details">
            <h3>${error.title}</h3>
            <p>${error.message}</p>
            ${error.suggestions.length > 0 ? `
                <div class="suggestions">
                    <strong>Suggestions:</strong>
                    <ul>
                        ${error.suggestions.map(s => `<li>${s}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
            ${error.technicalDetails ? `
                <details class="technical-details">
                    <summary>Technical Details</summary>
                    <pre>${error.technicalDetails}</pre>
                </details>
            ` : ''}
        </div>
    `;
    statusArea.className = 'error';
    statusArea.style.display = 'block';
}

function showRenderErrors(errors: RenderError[]) {
    if (errors.length === 0) return;

    console.error('Render errors:', errors);
    const errorList = errors.map(e => `${e.nodeId}: ${e.message}`).join('\n');
    console.warn('Some elements had errors during rendering:', errorList);
}

function showRenderWarnings(warnings: RenderError[]) {
    if (warnings.length === 0) return;

    console.warn('Render warnings:', warnings);
    const warningList = warnings.map(w => `${w.nodeId}: ${w.message}`).join('\n');
    console.info('Rendering completed with warnings:', warningList);
}

function startCooldownTimer() {
    const updateTimer = () => {
        const timeRemaining = rateLimiter.getTimeUntilNext();

        if (timeRemaining > 0) {
            cooldownTimer.textContent = `Please wait ${Math.ceil(timeRemaining / 1000)}s before generating again`;
            cooldownTimer.style.display = 'block';
            generateBtn.disabled = true;
            setTimeout(updateTimer, 100);
        } else {
            cooldownTimer.style.display = 'none';
            if (!generateBtn.disabled) {
                generateBtn.disabled = false;
            }
        }
    };

    updateTimer();
}

function showProgress(step: string, progress: number) {
    statusArea.innerHTML = `
        <div class="progress-container">
            <div class="progress-text">${step}</div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${progress}%"></div>
            </div>
            <div class="progress-percent">${Math.round(progress)}%</div>
        </div>
    `;
    statusArea.className = 'loading';
    statusArea.style.display = 'block';
}