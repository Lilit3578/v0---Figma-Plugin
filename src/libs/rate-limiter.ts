/**
 * Rate limiting utility to prevent API quota exhaustion
 */

export class RateLimiter {
    private lastCall: number = 0;
    private minInterval: number;
    private maxRetries: number;
    private initialBackoff: number;
    private queue: Array<{
        fn: () => Promise<any>;
        resolve: (value: any) => void;
        reject: (error: any) => void;
    }> = [];
    private isProcessing: boolean = false;

    constructor(minIntervalMs: number = 1000, maxRetries: number = 3, initialBackoff: number = 2000) {
        this.minInterval = minIntervalMs;
        this.maxRetries = maxRetries;
        this.initialBackoff = initialBackoff;
    }

    /**
     * Throttle a function call to respect minimum interval
     */
    async throttle<T>(fn: () => Promise<T>): Promise<T> {
        return this.executeWithRetry(fn);
    }

    /**
     * Execute a function with rate limiting, retries, and exponential backoff.
     * Uses a proper queue to serialize concurrent calls.
     */
    async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            this.queue.push({ fn, resolve, reject });
            this.processQueue();
        });
    }

    /**
     * Process the queue one item at a time
     */
    private async processQueue(): Promise<void> {
        if (this.isProcessing || this.queue.length === 0) {
            return;
        }

        this.isProcessing = true;

        while (this.queue.length > 0) {
            const item = this.queue.shift()!;

            try {
                const result = await this.executeWithRetryInternal(item.fn);
                item.resolve(result);
            } catch (error) {
                item.reject(error);
            }
        }

        this.isProcessing = false;
    }

    /**
     * Internal execution with retry logic
     */
    private async executeWithRetryInternal<T>(fn: () => Promise<T>): Promise<T> {
        let attempt = 0;

        while (attempt <= this.maxRetries) {
            // Rate limiting check
            const now = Date.now();
            const timeSinceLastCall = now - this.lastCall;

            if (timeSinceLastCall < this.minInterval) {
                const waitTime = this.minInterval - timeSinceLastCall;
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }

            try {
                this.lastCall = Date.now();
                return await fn();
            } catch (error: any) {
                attempt++;

                const retryable = this.isRetryableError(error);

                // Give up after maxRetries regardless of error type
                if (attempt > this.maxRetries) {
                    throw error;
                }

                // Only retry on rate limit or transient network errors
                if (!retryable) {
                    throw error;
                }

                let delay = this.initialBackoff * Math.pow(2, attempt - 1);

                // Add jitter
                delay += Math.random() * 1000;

                // Parse retry delay from error message if available (Gemini includes retryDelay)
                const errorMsg = error.message || '';
                const retryMatch = errorMsg.match(/"retryDelay":\s*"([\d.]+)s"/);
                if (retryMatch) {
                    const seconds = parseFloat(retryMatch[1]);
                    if (!isNaN(seconds)) {
                        delay = Math.max(delay, seconds * 1000 + 1000);
                    }
                }

                // Cap max delay to 60s
                delay = Math.min(delay, 60000);

                const reason = this.isRateLimitError(error) ? 'Rate limit' : 'Network error';
                console.warn(`${reason} (attempt ${attempt}/${this.maxRetries}). Waiting ${Math.round(delay)}ms before retry...`);

                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        // This should never be reached due to the throw in the loop, but TypeScript needs it
        throw new Error('Max retries exceeded');
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
            msg.includes('err_quic') ||
            msg.includes('network') ||
            msg.includes('econnreset') ||
            msg.includes('econnrefused') ||
            error instanceof TypeError // fetch throws TypeError on network failure
        );
    }

    /**
     * Check if we can proceed without waiting
     */
    canProceed(): boolean {
        const now = Date.now();
        const timeSinceLastCall = now - this.lastCall;
        return timeSinceLastCall >= this.minInterval;
    }

    /**
     * Get time in milliseconds until next call is allowed
     */
    getTimeUntilNext(): number {
        const now = Date.now();
        const timeSinceLastCall = now - this.lastCall;
        const remaining = this.minInterval - timeSinceLastCall;
        return Math.max(0, remaining);
    }

    /**
     * Reset the rate limiter (useful for testing)
     */
    reset(): void {
        this.lastCall = 0;
    }

    /**
     * Update the minimum interval
     */
    setMinInterval(intervalMs: number): void {
        this.minInterval = intervalMs;
    }
}

// Export a singleton for global rate limiting
// Gemini Free Tier limit is 15 RPM (1 request every 4 seconds)
// We set it to 4000ms to be safe.
export const globalRateLimiter = new RateLimiter(4000, 5, 4000);

