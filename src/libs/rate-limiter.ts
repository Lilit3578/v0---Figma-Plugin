/**
 * Rate limiting utility to prevent API quota exhaustion
 */

export class RateLimiter {
    private lastCall: number = 0;
    private minInterval: number;
    private maxRetries: number;
    private initialBackoff: number;

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
     * Execute a function with rate limiting, retries, and exponential backoff
     */
    async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
        let attempt = 0;

        while (true) {
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

                // Check if we should retry
                const isRateLimit = this.isRateLimitError(error);

                if (!isRateLimit && attempt > this.maxRetries) {
                    throw error;
                }

                if (isRateLimit || attempt <= this.maxRetries) {
                    // If it's a rate limit, use the retry-after header if available, or exponential backoff
                    let delay = this.initialBackoff * Math.pow(2, attempt - 1);

                    // Add jitter
                    delay += Math.random() * 1000;

                    // Parse retry delay from error message if available (specific to Gemini/Google APIs)
                    const errorMsg = error.message || '';
                    const retryMatch = errorMsg.match(/"retryDelay":\s*"([\d.]+)s"/);
                    if (retryMatch) {
                        const seconds = parseFloat(retryMatch[1]);
                        if (!isNaN(seconds)) {
                            delay = Math.max(delay, seconds * 1000 + 1000); // Add buffer
                        }
                    }

                    console.warn(`Rate limit hit (attempt ${attempt}). Waiting ${Math.round(delay)}ms before retry...`);

                    // Cap max delay to 60s
                    delay = Math.min(delay, 60000);

                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }

                throw error;
            }
        }
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
export const globalRateLimiter = new RateLimiter(2000, 5, 2000);

