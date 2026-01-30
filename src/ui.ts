import { generateRSNT } from './services/ai-service';

const intentInput = document.getElementById('intent') as HTMLTextAreaElement;
const generateBtn = document.getElementById('generate') as HTMLButtonElement;
const statusArea = document.getElementById('status-area') as HTMLDivElement;
const resultsPanel = document.getElementById('results-panel') as HTMLDivElement;
const resultsList = document.getElementById('results-list') as HTMLDivElement;
const apiKeyInput = document.getElementById('api-key') as HTMLInputElement;
const saveKeyBtn = document.getElementById('save-key') as HTMLButtonElement;

// ========== QUOTA PROTECTION MECHANISMS ==========

// Input validation constants
const MAX_INPUT_LENGTH = 500;
const DEBOUNCE_DELAY = 500; // ms

// Rate limiting
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;
let requestTimestamps: number[] = [];

// Request caching (prevent duplicate API calls)
const requestCache = new Map<string, any>();
const CACHE_DURATION = 300000; // 5 minutes

// Debounce timer
let debounceTimer: number | null = null;
let lastGenerateTime = 0;

// Character counter
const charCounter = document.getElementById('char-counter') as HTMLDivElement;
intentInput.addEventListener('input', () => {
    const length = intentInput.value.length;
    charCounter.textContent = `${length} / ${MAX_INPUT_LENGTH} characters`;
    if (length > MAX_INPUT_LENGTH * 0.9) {
        charCounter.style.color = '#ff6b6b';
    } else if (length > MAX_INPUT_LENGTH * 0.7) {
        charCounter.style.color = '#ffa500';
    } else {
        charCounter.style.color = '#666';
    }
});

// ========== COMPONENT MAPPING UI ==========

const discoverBtn = document.getElementById('discover-btn') as HTMLButtonElement;
const mappingPanel = document.getElementById('mapping-panel') as HTMLDivElement;
const mappingList = document.getElementById('mapping-list') as HTMLDivElement;
const saveMappingsBtn = document.getElementById('save-mappings-btn') as HTMLButtonElement;

// Semantic roles that can be mapped
const SEMANTIC_ROLES = [
    'PrimaryButton',
    'SecondaryButton',
    'GhostButton',
    'Card',
    'Container',
    'Form',
    'FormField',
    'Input',
    'Label',
    'Heading',
    'Paragraph'
];

let currentInventory: { components: any[], suggestedMappings: Record<string, string> } | null = null;
let currentMappings: Record<string, string> = {};

// Discover components button
discoverBtn.onclick = () => {
    statusArea.textContent = 'Discovering components...';
    statusArea.className = 'loading';
    discoverBtn.disabled = true;

    parent.postMessage({ pluginMessage: { type: 'discover' } }, '*');
};

// Save mappings button
saveMappingsBtn.onclick = () => {
    // Collect mappings from dropdowns
    const mappings: Record<string, string> = {};
    SEMANTIC_ROLES.forEach(role => {
        const select = document.getElementById(`mapping-${role}`) as HTMLSelectElement;
        if (select && select.value && select.value !== 'none') {
            mappings[role] = select.value;
        }
    });

    parent.postMessage({
        pluginMessage: {
            type: 'save-mappings',
            mappings
        }
    }, '*');

    statusArea.textContent = '✓ Mappings saved!';
    statusArea.className = 'success';
    setTimeout(() => {
        if (statusArea.textContent === '✓ Mappings saved!') {
            statusArea.textContent = '';
            statusArea.className = '';
        }
    }, 3000);
};

// Function to populate mapping UI
function showMappingUI(inventory: { components: any[], suggestedMappings: Record<string, string> }) {
    const { components, suggestedMappings } = inventory;
    currentInventory = inventory;
    mappingList.innerHTML = '';

    if (components.length === 0) {
        mappingList.innerHTML = '<p class="help-text">No components found in this file.</p>';
        mappingPanel.classList.remove('hidden');
        return;
    }

    // Create a dropdown for each semantic role
    SEMANTIC_ROLES.forEach(role => {
        const row = document.createElement('div');
        row.className = 'mapping-row';

        const label = document.createElement('label');
        label.textContent = role;
        label.htmlFor = `mapping-${role}`;

        const select = document.createElement('select');
        select.id = `mapping-${role}`;

        // Add "None" option
        const noneOption = document.createElement('option');
        noneOption.value = 'none';
        noneOption.textContent = '-- None --';
        select.appendChild(noneOption);

        // Add component options
        components.forEach(comp => {
            const option = document.createElement('option');
            option.value = comp.id;
            option.textContent = comp.name;
            select.appendChild(option);
        });

        // Set mapping: current > suggested > none
        if (currentMappings[role]) {
            select.value = currentMappings[role];
        } else if (suggestedMappings[role]) {
            select.value = suggestedMappings[role];
            row.classList.add('suggested-mapping'); // Optional: visual cue
        }

        row.appendChild(label);
        row.appendChild(select);
        mappingList.appendChild(row);
    });

    mappingPanel.classList.remove('hidden');
}

// Load existing mappings on startup
parent.postMessage({ pluginMessage: { type: 'load-mappings' } }, '*');

// Request API Key from Main Thread (figma.clientStorage)
parent.postMessage({ pluginMessage: { type: 'get-api-key' } }, '*');

saveKeyBtn.onclick = () => {
    const key = apiKeyInput.value.trim();
    if (key) {
        parent.postMessage({ pluginMessage: { type: 'set-api-key', key } }, '*');
        statusArea.textContent = '✓ API Key saved securely';
        statusArea.className = 'success';
        setTimeout(() => {
            if (statusArea.textContent === '✓ API Key saved securely') {
                statusArea.textContent = '';
                statusArea.className = '';
            }
        }, 3000);
    }
};

// Helper: Check rate limit
function checkRateLimit(): { allowed: boolean; remainingRequests: number; resetIn: number } {
    const now = Date.now();
    // Remove timestamps older than the window
    requestTimestamps = requestTimestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW);

    const remainingRequests = MAX_REQUESTS_PER_WINDOW - requestTimestamps.length;
    const oldestTimestamp = requestTimestamps[0] || now;
    const resetIn = Math.max(0, RATE_LIMIT_WINDOW - (now - oldestTimestamp));

    return {
        allowed: requestTimestamps.length < MAX_REQUESTS_PER_WINDOW,
        remainingRequests: Math.max(0, remainingRequests),
        resetIn
    };
}

// Helper: Get cached response
function getCachedResponse(intent: string) {
    const cached = requestCache.get(intent);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
    }
    return null;
}

// Helper: Cache response
function cacheResponse(intent: string, data: any) {
    requestCache.set(intent, { data, timestamp: Date.now() });
    // Limit cache size
    if (requestCache.size > 50) {
        const firstKey = requestCache.keys().next().value as string;
        if (firstKey) {
            requestCache.delete(firstKey);
        }
    }
}

generateBtn.onclick = async () => {
    const intent = intentInput.value.trim();
    const apiKey = apiKeyInput.value.trim();

    // ========== INPUT VALIDATION ==========
    if (!intent) {
        statusArea.textContent = 'Please enter a design description.';
        statusArea.className = 'error';
        return;
    }

    if (intent.length > MAX_INPUT_LENGTH) {
        statusArea.textContent = `Input too long! Maximum ${MAX_INPUT_LENGTH} characters (current: ${intent.length}).`;
        statusArea.className = 'error';
        return;
    }

    if (!apiKey) {
        statusArea.textContent = 'Please enter an API Key in settings first.';
        statusArea.className = 'error';
        const settings = document.querySelector('details');
        if (settings) settings.open = true;
        return;
    }

    // ========== RATE LIMITING ==========
    const rateLimitStatus = checkRateLimit();
    if (!rateLimitStatus.allowed) {
        const secondsRemaining = Math.ceil(rateLimitStatus.resetIn / 1000);
        statusArea.textContent = `⏱️ Rate limit reached. Please wait ${secondsRemaining}s before trying again.`;
        statusArea.className = 'error';
        return;
    }

    // ========== DEBOUNCING ==========
    const now = Date.now();
    if (now - lastGenerateTime < DEBOUNCE_DELAY) {
        statusArea.textContent = 'Please wait a moment before generating again...';
        statusArea.className = 'error';
        return;
    }
    lastGenerateTime = now;

    // ========== CHECK CACHE ==========
    const cachedRsnt = getCachedResponse(intent);
    if (cachedRsnt) {
        statusArea.textContent = '✓ Using cached result (saves quota!)';
        statusArea.className = 'success';

        // Send cached result to main.ts
        parent.postMessage({
            pluginMessage: {
                type: 'generate',
                intent: intent,
                rsnt: cachedRsnt
            }
        }, '*');
        return;
    }

    // Set loading state
    statusArea.textContent = `AI is architecting your design... (${rateLimitStatus.remainingRequests} requests remaining)`;
    statusArea.className = 'loading';
    generateBtn.disabled = true;
    resultsPanel.classList.remove('visible');

    try {
        // Record request timestamp for rate limiting
        requestTimestamps.push(Date.now());

        // Step 1: AI Generation in UI Thread (Safe for Fetch API)
        const rsnt = await generateRSNT(intent, apiKey);

        // Cache the result
        cacheResponse(intent, rsnt);

        // Step 2: Send to main.ts for Figma rendering
        parent.postMessage({
            pluginMessage: {
                type: 'generate',
                intent: intent,
                rsnt: rsnt
            }
        }, '*');
    } catch (error: any) {
        // Remove the failed request from rate limit counter
        requestTimestamps.pop();

        statusArea.textContent = error.message || 'AI Generation failed.';
        statusArea.className = 'error';
        generateBtn.disabled = false;
        console.error('AI Service Error:', error);
    }
};

window.onmessage = (event) => {
    const message = event.data.pluginMessage;

    if (message.type === 'api-key-loaded') {
        if (message.key) {
            apiKeyInput.value = message.key;
        }
    }

    if (message.type === 'complete') {
        statusArea.textContent = message.message;
        statusArea.className = 'success';
        generateBtn.disabled = false;

        // Handle discovery results
        if (message.data && message.data.components) {
            discoverBtn.disabled = false;
            showMappingUI(message.data);
            return;
        }

        // Show results
        resultsPanel.classList.add('visible');
        const item = document.createElement('div');
        item.className = 'result-item';
        item.innerHTML = `<strong>${message.message}</strong><br><small>Created in Figma</small>`;
        resultsList.prepend(item);
    }

    if (message.type === 'mappings-loaded') {
        currentMappings = message.mappings || {};
        // If we already have discovered components, refresh the UI
        if (currentInventory) {
            showMappingUI(currentInventory);
        }
    }

    if (message.type === 'error') {
        statusArea.textContent = message.message;
        statusArea.className = 'error';
        generateBtn.disabled = false;
        discoverBtn.disabled = false;
    }

    // REPLACE LINES 323-342 WITH:
    if (message.type === 'validation-error') {
        const hasErrors = message.errors && message.errors.length > 0;
        const hasWarnings = message.warnings && message.warnings.length > 0;

        let html = `<div style="margin-bottom: 8px;"><strong>${message.message}</strong></div>`;

        if (hasErrors) {
            const errorList = message.errors.map((err: any) =>
                `<span style="color: #f24822;">⚠</span> ${err.message}`
            ).join('<br>');
            html += `<div style="font-size: 10px; margin-bottom: 8px; padding: 8px; background: #fff1f0; border-radius: 4px;">${errorList}</div>`;
        }

        if (hasWarnings) {
            const warnList = message.warnings.map((warn: any) =>
                `<span style="color: #ffa500;">⚠</span> ${warn.message}`
            ).join('<br>');
            html += `<div style="font-size: 10px; margin-bottom: 8px; padding: 8px; background: #fff9e6; border-radius: 4px;"><strong>Warnings (won't block):</strong><br>${warnList}</div>`;
        }

        html += `
            <button id="force-generate" class="secondary" style="width: auto; padding: 4px 8px; font-size: 10px;">
                ${hasErrors ? 'Generate Anyway' : 'Continue'}
            </button>
        `;

        statusArea.innerHTML = html;
        statusArea.className = 'error';
        generateBtn.disabled = false;

        const forceBtn = document.getElementById('force-generate');
        if (forceBtn) {
            forceBtn.onclick = () => {
                parent.postMessage({
                    pluginMessage: {
                        type: 'generate-force',
                        rsnt: message.rsnt
                    }
                }, '*');
                statusArea.innerHTML = 'Force generating...';
                statusArea.className = 'loading';
                generateBtn.disabled = true;
            };
        }
    }

    if (message.type === 'status') {
        statusArea.textContent = message.message;
        statusArea.className = message.status === 'loading' ? 'loading' : '';
    }
};
