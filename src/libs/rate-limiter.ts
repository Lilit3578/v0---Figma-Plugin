/**
 * Rate limiting utility to prevent API quota exhaustion
 * Supports Priority Queue (HIGH/LOW) and Smart 429 Backoff
 */

export enum QueuePriority {
    HIGH = 0, // User interactions (Generate, Refine)
    LOW = 1   // Background tasks (Auto-discovery, Classification)
}

interface QueueItem {
    fn: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (error: any) => void;
    priority: QueuePriority;
    retryCount: number;
}

export class RateLimiter {
    private lastCall: number = 0;
    private minInterval: number;
    private maxRetries: number;
    private initialBackoff: number;

    // Priority Queues
    private highPriorityQueue: QueueItem[] = [];
    private lowPriorityQueue: QueueItem[] = [];

    private isProcessing: boolean = false;
    private isPaused: boolean = false;
    private pauseUntil: number = 0;
    private watchdogTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(minIntervalMs: number = 2000, maxRetries: number = 5, initialBackoff: number = 2000) {
        this.minInterval = minIntervalMs;
        this.maxRetries = maxRetries;
        this.initialBackoff = initialBackoff;
    }

    /**
     * Throttle a function call with priority
     */
    async throttle<T>(fn: () => Promise<T>, priority: QueuePriority = QueuePriority.HIGH): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const item: QueueItem = { fn, resolve, reject, priority, retryCount: 0 };

            if (priority === QueuePriority.HIGH) {
                this.highPriorityQueue.push(item);
            } else {
                this.lowPriorityQueue.push(item);
            }

            this.processQueue();
        });
    }

    /**
     * Backward compatibility wrapper
     */
    async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
        return this.throttle(fn, QueuePriority.HIGH);
    }

    /**
     * Process the queue (High priority first)
     */
    private async processQueue(): Promise<void> {
        if (this.isProcessing || this.isPaused) {
            return;
        }

        // Check backoff pause
        const now = Date.now();
        if (this.pauseUntil > now) {
            const waitTime = this.pauseUntil - now;
            console.log(`[RateLimiter] Queue paused for ${Math.ceil(waitTime / 1000)}s due to 429...`);
            setTimeout(() => this.processQueue(), waitTime);
            return;
        } else {
            this.isPaused = false;
        }

        // Select item: High priority first
        let item: QueueItem | undefined;
        if (this.highPriorityQueue.length > 0) {
            item = this.highPriorityQueue.shift();
        } else if (this.lowPriorityQueue.length > 0) {
            item = this.lowPriorityQueue.shift();
        }

        if (!item) return;

        this.isProcessing = true;

        try {
            // Min Interval Wait
            const timeSinceLastCall = Date.now() - this.lastCall;
            if (timeSinceLastCall < this.minInterval) {
                const wait = this.minInterval - timeSinceLastCall;
                await new Promise(r => setTimeout(r, wait));
            }

            this.lastCall = Date.now();
            const result = await item.fn();
            item.resolve(result);

        } catch (error: any) {
            // Handle Errors
            if (this.isRetryableError(error) && item.retryCount < this.maxRetries) {
                item.retryCount++;
                const isRateLimit = this.isRateLimitError(error);

                // Calculate Delay
                let delay = this.initialBackoff * Math.pow(2, item.retryCount - 1);
                // Add Jitter
                delay += Math.random() * 1000;

                // Handle 429 explicitly - PAUSE THE QUEUE
                if (isRateLimit) {
                    console.warn(`[RateLimiter] 429 Detected! Pausing queue. (Attempt ${item.retryCount}/${this.maxRetries})`);

                    // Extract retry-after header if possible (fetched via error message usually)
                    // Gemini errors often include "retryDelay" in JSON message
                    const retryMatch = (error.message || '').match(/"retryDelay":\s*"([\d.]+)s"/);
                    if (retryMatch) {
                        const seconds = parseFloat(retryMatch[1]);
                        if (!isNaN(seconds)) delay = Math.max(delay, (seconds * 1000) + 1000);
                    }

                    // Cap at 32s
                    delay = Math.min(delay, 32000);

                    // Set global pause
                    this.pauseUntil = Date.now() + delay;
                    this.isPaused = true;

                    // Re-queue item at the FRONT
                    if (item.priority === QueuePriority.HIGH) {
                        this.highPriorityQueue.unshift(item);
                    } else {
                        this.lowPriorityQueue.unshift(item);
                    }

                    // Watchdog: Force unpause after delay + 5s just in case
                    if (this.watchdogTimer) clearTimeout(this.watchdogTimer);
                    this.watchdogTimer = setTimeout(() => {
                        this.isPaused = false;
                        this.processQueue();
                    }, delay + 5000);

                    // Retry will happen when processQueue is called again after timeout
                    setTimeout(() => {
                        this.isPaused = false;
                        this.processQueue();
                    }, delay);

                    this.isProcessing = false;
                    return;
                }

                // For non-429 retryable errors (network), just wait and retry this item
                console.warn(`[RateLimiter] Network error. Retrying in ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));

                // Re-queue at front
                if (item.priority === QueuePriority.HIGH) {
                    this.highPriorityQueue.unshift(item);
                } else {
                    this.lowPriorityQueue.unshift(item);
                }
            } else {
                // Fatal error or Retries exhausted
                console.error('[RateLimiter] Request failed permanently:', error);
                item.reject(error);
            }
        }

        this.isProcessing = false;

        // Process next
        if (this.highPriorityQueue.length > 0 || this.lowPriorityQueue.length > 0) {
            this.processQueue(); // Async recursion
        }
    }

    private isRetryableError(error: any): boolean {
        return this.isRateLimitError(error) || this.isNetworkError(error);
    }

    private isRateLimitError(error: any): boolean {
        const msg = (error.message || '').toLowerCase();
        return (
            msg.includes('429') ||
            msg.includes('rate limit') ||
            msg.includes('quota') ||
            msg.includes('too many requests')
        );
    }

    private isNetworkError(error: any): boolean {
        const msg = (error.message || '').toLowerCase();
        return (
            msg.includes('failed to fetch') ||
            msg.includes('timed out') ||
            msg.includes('err_timed_out') ||
            msg.includes('network') ||
            msg.includes('econnreset') ||
            error instanceof TypeError
        );
    }

    /**
     * Get readiness status
     */
    getTimeUntilNext(): number {
        if (this.isPaused) {
            return Math.max(0, this.pauseUntil - Date.now());
        }
        const now = Date.now();
        const timeSinceLastCall = now - this.lastCall;
        return Math.max(0, this.minInterval - timeSinceLastCall);
    }
}

// Global Singleton
// Gemini Flash Limit: ~15 RPM (1 req / 4s)
// We set minInterval to 2s but rely on queue to handle bursts
export const globalRateLimiter = new RateLimiter(2000, 5, 2000);

