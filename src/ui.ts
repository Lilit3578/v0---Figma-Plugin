import { conversationManager } from './services/conversation-manager';
import { DesignSystemInventory } from './services/auto-discovery';
import { RateLimiter } from './libs/rate-limiter';
import { UserFacingError, RenderError, formatError } from './types/errors';
import { ResolutionSummary } from './types/resolution-types';

const intentInput = document.getElementById('intent-input') as HTMLInputElement;
const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement;
const refreshBtn = document.getElementById('refresh-inventory') as HTMLButtonElement;
const statusArea = document.getElementById('status-area') as HTMLDivElement;
const apiKeyInput = document.getElementById('api-key') as HTMLInputElement;
const saveKeyBtn = document.getElementById('save-key') as HTMLButtonElement;
const charCounter = document.getElementById('char-counter') as HTMLDivElement;
const cooldownTimer = document.getElementById('cooldown-timer') as HTMLDivElement;
const undoBtn = document.getElementById('undo-btn') as HTMLButtonElement;
const redoBtn = document.getElementById('redo-btn') as HTMLButtonElement;
const clearConvBtn = document.getElementById('clear-conv-btn') as HTMLButtonElement;
const undoChangeBtn = document.getElementById('undo-change-btn') as HTMLButtonElement;
const forceRefreshBtn = document.getElementById('force-refresh-btn') as HTMLButtonElement;
const cacheStats = document.getElementById('cache-stats') as HTMLDivElement;

// Antigravity dialog elements
const antigravityDialog = document.getElementById('antigravity-dialog') as HTMLDivElement;
const closeAntigravityBtn = document.getElementById('close-antigravity-btn') as HTMLButtonElement;
const dismissAntigravityBtn = document.getElementById('dismiss-antigravity-btn') as HTMLButtonElement;

let currentInventory: DesignSystemInventory | null = null;
const rateLimiter = new RateLimiter(2000); // 2 second minimum interval

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Character counter
if (intentInput && charCounter) {
    intentInput.addEventListener('input', () => {
        const length = intentInput.value.length;
        charCounter.textContent = `${length} / 500 characters`;
    });
}

// Request API key on load
parent.postMessage({ pluginMessage: { type: 'get-api-key' } }, '*');

// Request inventory on load
parent.postMessage({ pluginMessage: { type: 'get-inventory' } }, '*');

// Save API key
if (saveKeyBtn && apiKeyInput) {
    saveKeyBtn.onclick = () => {
        let key = apiKeyInput.value.trim();
        // Remove leading '#' if present
        key = key.replace(/^#/, '');

        if (key) {
            parent.postMessage({ pluginMessage: { type: 'set-api-key', key } }, '*');
        } else {
            showStatus('error', 'Please enter a valid API key');
        }
    };
}

function showResolutionSummary(summary: ResolutionSummary) {
    const dialog = document.getElementById('summary-dialog');
    if (!dialog) return;

    // Quality Badge
    const badge = document.getElementById('quality-badge');
    if (badge) {
        badge.textContent = `Quality: ${summary.quality} (Avg Compliance: ${(summary.stats.averageConfidence * 100).toFixed(0)}%)`;
        badge.className = `quality-badge ${summary.quality.toLowerCase()}`;
    }

    // Tier Breakdown
    const tierDiv = document.getElementById('tier-breakdown');
    if (tierDiv) {
        let html = '';
        const tiers = summary.stats.tierCounts;
        if (tiers[1] > 0) html += `<div class="tier-item success">✓ ${escapeHtml(String(tiers[1]))} nodes used library components (Tier 1)</div>`;
        if (tiers[2] > 0) html += `<div class="tier-item success">✓ ${escapeHtml(String(tiers[2]))} nodes used base components (Tier 2)</div>`;
        if (tiers[3] > 0) html += `<div class="tier-item warning">⚠ ${escapeHtml(String(tiers[3]))} nodes built with variables (Tier 3)</div>`;
        if (tiers[4] > 0) html += `<div class="tier-item warning">⚠ ${escapeHtml(String(tiers[4]))} nodes used approximations (Tier 4)</div>`;
        if (tiers[5] > 0) html += `<div class="tier-item crit">❌ ${escapeHtml(String(tiers[5]))} nodes used system defaults (Tier 5)</div>`;
        tierDiv.innerHTML = html;
    }

    // Warnings
    const warnList = document.getElementById('warnings-list');
    const warnCount = document.getElementById('total-warnings-count');
    if (warnCount) warnCount.textContent = summary.stats.totalWarnings.toString();

    if (warnList) {
        // Use categorized warnings
        const items = summary.warnings.categorized.map(c =>
            `<li class="warning-li"><b>${escapeHtml(String(c.count))}</b> ${escapeHtml(c.category.toLowerCase().replace('_', ' '))} issues</li>`
        ).join('');
        warnList.innerHTML = items || '<li class="success">No warnings</li>';
    }

    // Recommendations
    const recList = document.getElementById('recommendations-list');
    if (recList) {
        const items = summary.recommendations.map(r => `<li>• ${escapeHtml(r)}</li>`).join('');
        recList.innerHTML = items || '<li>No specific recommendations.</li>';
    }

    dialog.style.display = 'flex';

    // Button Listeners - with null checks
    const closeSummaryBtn = document.getElementById('close-summary-btn');
    const dismissSummaryBtn = document.getElementById('dismiss-summary-btn');
    const viewDetailsBtn = document.getElementById('view-details-btn');

    if (closeSummaryBtn) {
        closeSummaryBtn.onclick = () => dialog.style.display = 'none';
    }
    if (dismissSummaryBtn) {
        dismissSummaryBtn.onclick = () => dialog.style.display = 'none';
    }
    if (viewDetailsBtn) {
        viewDetailsBtn.onclick = () => {
            // Show detailed breakdown in a scrollable area
            const detailsSection = document.getElementById('summary-details-expanded');
            if (detailsSection) {
                detailsSection.style.display = detailsSection.style.display === 'none' ? 'block' : 'none';
                viewDetailsBtn.textContent = detailsSection.style.display === 'none' ? 'View Details' : 'Hide Details';
            }
        };
    }
}

// Add after saveKeyBtn.onclick
if (refreshBtn) {
    refreshBtn.onclick = () => {
        showStatus('loading', 'Refreshing inventory...');
        parent.postMessage({ pluginMessage: { type: 'refresh-inventory' } }, '*');
    };
}

if (forceRefreshBtn) {
    forceRefreshBtn.onclick = () => {
        if (confirm('Are you sure you want to clear the discovery cache? This will force a full rescan which may take a few seconds.')) {
            showStatus('loading', 'Clearing cache & rescanning...');
            parent.postMessage({ pluginMessage: { type: 'force-refresh-inventory' } }, '*');
        }
    };
}

undoBtn.onclick = () => {
    parent.postMessage({ pluginMessage: { type: 'undo' } }, '*');
};

redoBtn.onclick = () => {
    parent.postMessage({ pluginMessage: { type: 'redo' } }, '*');
};

clearConvBtn.onclick = () => {
    conversationManager.clearConversation();
    updateIterationInfo();
    parent.postMessage({ pluginMessage: { type: 'clear-conversation' } }, '*');
};

undoChangeBtn.onclick = async () => {
    const removedTurn = conversationManager.undoTurn();
    if (removedTurn) {
        updateIterationInfo();
        showStatus('loading', 'Reverting to previous version...');

        // Get the PREVIOUS turn (now current)
        const currentConv = conversationManager.getCurrentConversation();
        let rsntToRender = null;
        let intentToRender = '';

        if (currentConv && currentConv.turns.length > 0) {
            const lastTurn = currentConv.turns[currentConv.turns.length - 1];
            rsntToRender = lastTurn.rsnt;
            intentToRender = lastTurn.userIntent;
        } else {
            showStatus('success', 'Reverted conversation context.');
            return;
        }

        if (rsntToRender) {
            parent.postMessage({
                pluginMessage: {
                    type: 'generate', // Use generate to render RSNT directly
                    intent: intentToRender,
                    rsnt: rsntToRender
                }
            }, '*');
        }
    }
};

function updateIterationInfo() {
    const infoEl = document.getElementById('iteration-info');
    const conv = conversationManager.getCurrentConversation();

    if (conv && conv.turns.length > 0) {
        if (infoEl) {
            infoEl.textContent = `Iteration ${conv.turns.length} of 5`;
            infoEl.style.display = 'block';
        }
        if (undoChangeBtn) {
            undoChangeBtn.style.display = conv.turns.length > 1 ? 'inline-block' : 'none';
        }
    } else {
        if (infoEl) infoEl.style.display = 'none';
        if (undoChangeBtn) undoChangeBtn.style.display = 'none';
    }
}

// Generate button with rate limiting
if (generateBtn) {
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
                // 1. Get Selection Context from Figma (if any)
                const selectionContext = await new Promise<any>((resolve) => {
                    const handler = (event: MessageEvent) => {
                        const msg = event.data.pluginMessage;
                        if (msg.type === 'selection-context') {
                            window.removeEventListener('message', handler);
                            resolve(msg.context);
                        }
                    };
                    window.addEventListener('message', handler);
                    parent.postMessage({ pluginMessage: { type: 'get-selection-context' } }, '*');

                    // Timeout fallback after 1s
                    setTimeout(() => {
                        window.removeEventListener('message', handler);
                        resolve(undefined);
                    }, 1000);
                });

                if (selectionContext) {
                    console.log('Using selection context:', selectionContext);
                }

                // Always use Antigravity pipeline (multi-step reasoning)
                console.log('Using Antigravity pipeline');
                showStatus('loading', 'Analyzing intent and making design decisions...');

                // Send to plugin for Antigravity generation
                parent.postMessage({
                    pluginMessage: {
                        type: 'generate-antigravity',
                        intent,
                        apiKey,
                        selectionContext: selectionContext || null
                    }
                }, '*');

            } catch (error: any) {
                console.error('Generation error:', error);
                const userError = formatError(error);
                showStructuredError(userError);
                generateBtn.disabled = false;
            }
        });

        // Start cooldown timer
        startCooldownTimer();
    };
}

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

            // Display Cache Stats
            if (currentInventory.discoveryStats && cacheStats) {
                const stats = currentInventory.discoveryStats;
                const hitRate = Math.round((stats.cachedComponents / stats.totalComponents) * 100) || 0;

                // Format age
                let ageText = 'Fresh scan';
                if (stats.cacheAge > 1000) {
                    const minutes = Math.floor(stats.cacheAge / 60000);
                    if (minutes < 60) ageText = `${minutes}m old`;
                    else ageText = `${Math.floor(minutes / 60)}h old`;
                }

                if (stats.cachedComponents > 0) {
                    cacheStats.textContent = `Using cached data (${ageText}, ${hitRate}% hit rate)`;
                    cacheStats.style.display = 'block';
                } else {
                    cacheStats.textContent = `Full scan completed (${stats.scannedComponents} components analyzed)`;
                    cacheStats.style.display = 'block';
                }
            }
        }
    }

    if (msg.type === 'status') {
        showStatus(msg.status, msg.message);
    }

    if (msg.type === 'complete') {
        // Check if we should show undo toast
        if (msg.showUndo) {
            showUndoToast(msg.message);
        } else {
            showStatus('success', msg.message);
        }
        generateBtn.disabled = false;
    }

    if (msg.type === 'show-approval-dialog') {
        showApprovalDialog(msg);
    }

    if (msg.type === 'show-clarification-dialog') {
        showClarificationDialog(msg);
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

    if (msg.type === 'generation-progress') {
        showGenerationProgress(msg.current, msg.total, msg.percentage);
    }

    if (msg.type === 'history-update') {
        undoBtn.disabled = !msg.canUndo;
        redoBtn.disabled = !msg.canRedo;
    }

    if (msg.type === 'show-summary') {
        showResolutionSummary(msg.summary);
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
            <h3>${escapeHtml(error.title)}</h3>
            <p>${escapeHtml(error.message)}</p>
            ${error.suggestions.length > 0 ? `
                <div class="suggestions">
                    <strong>Suggestions:</strong>
                    <ul>
                        ${error.suggestions.map(s => `<li>${escapeHtml(s)}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
            ${error.technicalDetails ? `
                <details class="technical-details">
                    <summary>Technical Details</summary>
                    <pre>${escapeHtml(error.technicalDetails)}</pre>
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

    const banner = document.createElement('div');
    banner.className = 'render-issue-banner error';
    banner.innerHTML = `
        <div class="render-issue-header">⚠ ${escapeHtml(String(errors.length))} element${errors.length > 1 ? 's' : ''} failed to render</div>
        <ul class="render-issue-list">
            ${errors.map(e => `<li>${escapeHtml(e.nodeId || 'unknown')}: ${escapeHtml(e.message)}</li>`).join('')}
        </ul>
    `;
    statusArea.prepend(banner);
    statusArea.style.display = 'block';
}

function showRenderWarnings(warnings: RenderError[]) {
    if (warnings.length === 0) return;

    console.warn('Render warnings:', warnings);

    const banner = document.createElement('div');
    banner.className = 'render-issue-banner warning';
    banner.innerHTML = `
        <div class="render-issue-header">ℹ ${escapeHtml(String(warnings.length))} rendering note${warnings.length > 1 ? 's' : ''}</div>
        <ul class="render-issue-list">
            ${warnings.map(w => `<li>${escapeHtml(w.nodeId || 'unknown')}: ${escapeHtml(w.message)}</li>`).join('')}
        </ul>
    `;
    statusArea.prepend(banner);
    statusArea.style.display = 'block';
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
            <div class="progress-text">${escapeHtml(step)}</div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${progress}%"></div>
            </div>
            <div class="progress-percent">${Math.round(progress)}%</div>
        </div>
    `;
    statusArea.className = 'loading';
    statusArea.style.display = 'block';
}
function showGenerationProgress(current: number, total: number, percentage: number) {
    statusArea.innerHTML = `
        <div class="progress-container">
            <div class="progress-text">Creating ${escapeHtml(String(current))} of ${escapeHtml(String(total))} elements...</div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${percentage}%"></div>
            </div>
            <div class="progress-percent">${percentage}%</div>
            <button id="cancel-gen-btn" class="secondary small" style="margin-top: 8px; width: 100%;">Cancel Generation</button>
        </div>
    `;
    statusArea.className = 'loading';
    statusArea.style.display = 'block';

    const cancelBtn = document.getElementById('cancel-gen-btn');
    if (cancelBtn) {
        cancelBtn.onclick = () => {
            parent.postMessage({ pluginMessage: { type: 'cancel-generation' } }, '*');
            cancelBtn.textContent = 'Cancelling...';
            (cancelBtn as HTMLButtonElement).disabled = true;
        };
    }
}

// --- APP ROVAL & CLARIFICATION ---

interface ApprovalDialogData {
    confidence?: { score?: number };
    reasoning?: { layoutChoice?: string };
    designDecisions?: Array<{ element?: string; decision: string }>;
}

function showApprovalDialog(data: ApprovalDialogData) {
    const dialog = document.getElementById('approval-dialog');
    if (!dialog) return;

    // Confidence
    const score = Math.round((data.confidence?.score || 0) * 100);
    const confidenceScore = document.getElementById('approval-confidence-score');
    const confidenceFill = document.getElementById('approval-confidence-fill') as HTMLElement | null;
    const reasoningEl = document.getElementById('approval-reasoning');

    if (confidenceScore) confidenceScore.textContent = `${score}%`;
    if (confidenceFill) confidenceFill.style.width = `${score}%`;

    // Reasoning
    if (reasoningEl) {
        reasoningEl.textContent = data.reasoning?.layoutChoice || 'AI chose this layout based on your intent.';
    }

    // Decisions
    const decisionsList = document.getElementById('approval-decisions');
    if (decisionsList) {
        const decisions = data.designDecisions || [];
        decisionsList.innerHTML = decisions.map((d) =>
            `<li><b>${escapeHtml(d.element || 'Element')}</b>: ${escapeHtml(d.decision)}</li>`
        ).join('') || '<li>Standard layout patterns applied.</li>';
    }

    dialog.style.display = 'flex';
    statusArea.style.display = 'none'; // Hide loading status
    generateBtn.disabled = false; // Re-enable generation button

    // Handlers - with null checks
    const approveBtn = document.getElementById('approve-design-btn');
    const rejectBtn = document.getElementById('reject-design-btn');

    if (approveBtn) {
        approveBtn.onclick = () => {
            dialog.style.display = 'none';
            parent.postMessage({ pluginMessage: { type: 'approve-design' } }, '*');
        };
    }

    if (rejectBtn) {
        rejectBtn.onclick = () => {
            dialog.style.display = 'none';
            parent.postMessage({ pluginMessage: { type: 'reject-design' } }, '*');
        };
    }
}

interface ClarificationQuestion {
    id: string;
    text: string;
    type: 'freeform' | 'multiple-choice' | 'multi-select';
    options?: string[];
}

interface ClarificationRequest {
    questions: ClarificationQuestion[];
    confidenceScore?: number;
    originalIntent?: string;
}

let currentClarificationRequest: ClarificationRequest | null = null;

function showClarificationDialog(data: ClarificationRequest) {
    currentClarificationRequest = data;
    const dialog = document.getElementById('clarification-dialog');
    if (!dialog) return;

    const score = Math.round((data.confidenceScore || 0) * 100);
    const scoreEl = document.getElementById('clarification-score');
    if (scoreEl) scoreEl.textContent = `${score}%`;

    const container = document.getElementById('clarification-questions');
    if (container) {
        container.innerHTML = ''; // Clear previous

        // Group by category if needed, for now just list them
        data.questions.forEach((q) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'question-wrapper';
            wrapper.style.marginBottom = '16px';

            const label = document.createElement('label');
            label.textContent = q.text;
            label.style.fontWeight = 'bold';
            label.style.display = 'block';
            label.style.marginBottom = '8px';
            wrapper.appendChild(label);

            if (q.type === 'freeform') {
                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'clarification-input';
                input.dataset.qid = q.id;
                input.style.width = '100%';
                input.placeholder = 'Type your answer...';
                wrapper.appendChild(input);
            } else if (q.type === 'multiple-choice' || q.type === 'multi-select') {
                const optionsGroup = document.createElement('div');
                optionsGroup.style.display = 'flex';
                optionsGroup.style.flexDirection = 'column';
                optionsGroup.style.gap = '8px';

                q.options?.forEach((opt) => {
                    const optLabel = document.createElement('label');
                    optLabel.style.display = 'flex';
                    optLabel.style.alignItems = 'center';
                    optLabel.style.gap = '8px';
                    optLabel.style.fontWeight = 'normal';

                    const input = document.createElement('input');
                    input.type = q.type === 'multiple-choice' ? 'radio' : 'checkbox';
                    input.name = q.id;
                    input.value = opt;
                    input.dataset.qid = q.id;

                    optLabel.appendChild(input);
                    optLabel.appendChild(document.createTextNode(opt));
                    optionsGroup.appendChild(optLabel);
                });
                wrapper.appendChild(optionsGroup);
            }

            container.appendChild(wrapper);
        });
    }

    dialog.style.display = 'flex';
    statusArea.style.display = 'none';
    generateBtn.disabled = false;

    // Remove old listeners - with null checks
    const btn = document.getElementById('close-clarification-btn');
    if (btn && btn.parentNode) {
        const newBtn = btn.cloneNode(true) as HTMLButtonElement;
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.textContent = 'Submit Clarifications';
        newBtn.onclick = () => submitClarifications();
    }
}

async function submitClarifications() {
    if (!currentClarificationRequest) return;

    // Collect answers
    const clarifications: string[] = [];
    const questions = currentClarificationRequest.questions;

    questions.forEach((q) => {
        if (q.type === 'freeform') {
            const input = document.querySelector(`input[data-qid="${q.id}"]`) as HTMLInputElement | null;
            if (input && input.value.trim()) {
                clarifications.push(`${q.text} Answer: ${input.value.trim()}`);
            }
        } else {
            const inputs = document.querySelectorAll(`input[name="${q.id}"]:checked`);
            if (inputs.length > 0) {
                const values = Array.from(inputs).map((i) => (i as HTMLInputElement).value).join(', ');
                clarifications.push(`${q.text} Preference: ${values}`);
            }
        }
    });

    const clarificationDialog = document.getElementById('clarification-dialog');

    if (clarifications.length === 0) {
        // User didn't answer anything, just close
        if (clarificationDialog) clarificationDialog.style.display = 'none';
        return;
    }

    if (clarificationDialog) clarificationDialog.style.display = 'none';

    // Construct enhanced intent
    const separation = "\n\nUser Clarifications:\n";
    const originalIntent = currentClarificationRequest.originalIntent || '';
    const enhancedIntent = originalIntent + separation + clarifications.join('\n');

    showStatus('loading', 'Refining design with your feedback...');
    generateBtn.disabled = true;

    try {
        const apiKeyEl = document.getElementById('api-key') as HTMLInputElement | null;
        const apiKey = apiKeyEl?.value.trim() || '';

        if (!apiKey || !currentInventory) {
            showStatus('error', 'Missing API key or inventory');
            generateBtn.disabled = false;
            return;
        }

        // Use Antigravity pipeline for refined generation
        showStatus('loading', 'Refining design with enhanced context...');

        parent.postMessage({
            pluginMessage: {
                type: 'generate-antigravity',
                intent: enhancedIntent,
                apiKey,
                selectionContext: null
            }
        }, '*');

    } catch (error: unknown) {
        console.error('Refinement error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        showStatus('error', 'Refinement failed: ' + errorMessage);
        generateBtn.disabled = false;
    }
}

let undoTimeout: ReturnType<typeof setTimeout> | null = null;

function showUndoToast(message: string) {
    const toast = document.getElementById('undo-toast');
    if (!toast) return;

    const timerFill = document.getElementById('undo-timer-fill') as HTMLElement | null;
    const undoMessage = document.querySelector('.undo-message') as HTMLElement | null;

    // Reset
    toast.style.display = 'flex';
    if (undoMessage) undoMessage.textContent = message;
    if (timerFill) timerFill.style.width = '100%';

    if (undoTimeout) clearTimeout(undoTimeout);

    // Animate timer (30s)
    if (timerFill) {
        timerFill.style.transition = 'none';
        timerFill.style.width = '100%';
        setTimeout(() => {
            timerFill.style.transition = 'width 30s linear';
            timerFill.style.width = '0%';
        }, 10);
    }

    undoTimeout = setTimeout(() => {
        toast.style.display = 'none';
    }, 30000); // 30s

    const toastUndoBtn = document.getElementById('toast-undo-btn');
    const toastCloseBtn = document.getElementById('toast-close-btn');

    if (toastUndoBtn) {
        toastUndoBtn.onclick = () => {
            if (undoTimeout) clearTimeout(undoTimeout);
            toast.style.display = 'none';
            parent.postMessage({ pluginMessage: { type: 'undo' } }, '*');
        };
    }

    if (toastCloseBtn) {
        toastCloseBtn.onclick = () => {
            if (undoTimeout) clearTimeout(undoTimeout);
            toast.style.display = 'none';
        };
    }
}

// ============================================================================
// ANTIGRAVITY REASONING DIALOG
// ============================================================================

// Dialog close handlers
closeAntigravityBtn.addEventListener('click', () => {
    antigravityDialog.style.display = 'none';
});

dismissAntigravityBtn.addEventListener('click', () => {
    antigravityDialog.style.display = 'none';
});

interface AntigravityReasoning {
    intentSummary: string;
    componentSelections: Array<{
        requirement: string;
        selection: string;
        confidence: number;
        reasoning: string;
    }>;
    layoutRationale: string;
    overallConfidence: number;
    warnings: string[];
}

function showAntigravityDialog(reasoning: AntigravityReasoning, phases: { intentTime: number; decisionTime: number; buildTime: number; totalTime: number }) {
    // Intent summary
    const intentEl = document.getElementById('antigravity-intent');
    if (intentEl) intentEl.textContent = reasoning.intentSummary;

    // Component selections
    const componentsEl = document.getElementById('antigravity-components');
    if (componentsEl) {
        componentsEl.innerHTML = reasoning.componentSelections.map(c => `
            <li>
                <strong>${escapeHtml(c.requirement)}</strong> → ${escapeHtml(c.selection)}
                <span class="confidence-badge" style="font-size: 10px; padding: 2px 6px; border-radius: 10px; background: ${c.confidence >= 0.8 ? 'var(--figma-color-bg-success)' : c.confidence >= 0.5 ? 'var(--figma-color-bg-warning)' : 'var(--figma-color-bg-danger)'};">
                    ${(c.confidence * 100).toFixed(0)}%
                </span>
                <div class="text-xs text-secondary" style="margin-top: 2px;">${escapeHtml(c.reasoning)}</div>
            </li>
        `).join('');
    }

    // Layout rationale
    const layoutEl = document.getElementById('antigravity-layout');
    if (layoutEl) layoutEl.textContent = reasoning.layoutRationale;

    // Warnings
    const warningsSection = document.getElementById('antigravity-warnings-section');
    const warningsEl = document.getElementById('antigravity-warnings');
    if (warningsSection && warningsEl) {
        if (reasoning.warnings.length > 0) {
            warningsSection.style.display = 'block';
            warningsEl.innerHTML = reasoning.warnings.map(w => `<li>${escapeHtml(w)}</li>`).join('');
        } else {
            warningsSection.style.display = 'none';
        }
    }

    // Confidence
    const confidenceEl = document.getElementById('antigravity-confidence');
    const confidenceFill = document.getElementById('antigravity-confidence-fill');
    if (confidenceEl) confidenceEl.textContent = `${(reasoning.overallConfidence * 100).toFixed(0)}%`;
    if (confidenceFill) {
        const pct = reasoning.overallConfidence * 100;
        (confidenceFill as HTMLElement).style.width = `${pct}%`;
        (confidenceFill as HTMLElement).style.backgroundColor = pct >= 80 ? 'var(--figma-color-bg-success)' : pct >= 50 ? 'var(--figma-color-bg-warning)' : 'var(--figma-color-bg-danger)';
    }

    // Timing
    const timingIntent = document.getElementById('timing-intent');
    const timingDecision = document.getElementById('timing-decision');
    const timingBuild = document.getElementById('timing-build');
    const timingTotal = document.getElementById('timing-total');
    if (timingIntent) timingIntent.textContent = String(phases.intentTime);
    if (timingDecision) timingDecision.textContent = String(phases.decisionTime);
    if (timingBuild) timingBuild.textContent = String(phases.buildTime);
    if (timingTotal) timingTotal.textContent = String(phases.totalTime);

    // Show dialog
    antigravityDialog.style.display = 'flex';
}

// Handle Antigravity reasoning messages (extends main message handler)
const originalOnMessage = window.onmessage;
window.onmessage = (event) => {
    // Call original handler first
    if (originalOnMessage) {
        originalOnMessage.call(window, event);
    }

    const msg = event.data.pluginMessage;
    if (!msg) return;

    // Handle Antigravity reasoning
    if (msg.type === 'antigravity-reasoning') {
        console.log('Received Antigravity reasoning:', msg.reasoning);
        showAntigravityDialog(msg.reasoning, msg.phases);
    }
};
