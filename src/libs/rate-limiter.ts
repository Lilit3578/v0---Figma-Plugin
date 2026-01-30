/**
 * Rate limiting utility to prevent API quota exhaustion
 */

export class RateLimiter {
    private lastCall: number = 0;
    private minInterval: number;

    constructor(minIntervalMs: number = 2000) {
        this.minInterval = minIntervalMs;
    }

    /**
     * Throttle a function call to respect minimum interval
     */
    async throttle<T>(fn: () => Promise<T>): Promise<T> {
        const now = Date.now();
        const timeSinceLastCall = now - this.lastCall;

        if (timeSinceLastCall < this.minInterval) {
            const waitTime = this.minInterval - timeSinceLastCall;
            console.log(`Rate limiting: waiting ${waitTime}ms before next call`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        this.lastCall = Date.now();
        return fn();
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
