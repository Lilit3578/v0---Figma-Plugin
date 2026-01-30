/**
 * Component usage analytics and tracking
 */

export interface ComponentUsage {
    componentId: string;
    componentName: string;
    usageCount: number;
    lastUsed: number;
    contexts: string[];  // User intents where it was used
}

export class Analytics {
    private componentUsage: Map<string, ComponentUsage> = new Map();
    private totalGenerations: number = 0;

    /**
     * Track component usage
     */
    trackComponentUsage(componentId: string, componentName: string, userIntent: string): void {
        const existing = this.componentUsage.get(componentId);

        if (existing) {
            existing.usageCount++;
            existing.lastUsed = Date.now();
            existing.contexts.push(userIntent);

            // Limit contexts to last 10
            if (existing.contexts.length > 10) {
                existing.contexts = existing.contexts.slice(-10);
            }
        } else {
            this.componentUsage.set(componentId, {
                componentId,
                componentName,
                usageCount: 1,
                lastUsed: Date.now(),
                contexts: [userIntent]
            });
        }

        console.log(`Analytics: Tracked usage of ${componentName} (total: ${this.componentUsage.get(componentId)!.usageCount})`);
    }

    /**
     * Track generation
     */
    trackGeneration(): void {
        this.totalGenerations++;
    }

    /**
     * Get most used components
     */
    getMostUsedComponents(limit: number = 10): ComponentUsage[] {
        return Array.from(this.componentUsage.values())
            .sort((a, b) => b.usageCount - a.usageCount)
            .slice(0, limit);
    }

    /**
     * Get component usage for specific component
     */
    getComponentUsage(componentId: string): ComponentUsage | undefined {
        return this.componentUsage.get(componentId);
    }

    /**
     * Get usage statistics
     */
    getStatistics(): {
        totalGenerations: number;
        uniqueComponentsUsed: number;
        averageComponentsPerGeneration: number;
        mostUsedComponent: ComponentUsage | null;
    } {
        const mostUsed = this.getMostUsedComponents(1)[0] || null;
        const totalUsage = Array.from(this.componentUsage.values())
            .reduce((sum, usage) => sum + usage.usageCount, 0);

        return {
            totalGenerations: this.totalGenerations,
            uniqueComponentsUsed: this.componentUsage.size,
            averageComponentsPerGeneration: this.totalGenerations > 0
                ? totalUsage / this.totalGenerations
                : 0,
            mostUsedComponent: mostUsed
        };
    }

    /**
     * Save analytics to storage
     */
    async save(): Promise<void> {
        try {
            const data = {
                componentUsage: Array.from(this.componentUsage.entries()),
                totalGenerations: this.totalGenerations
            };
            await figma.clientStorage.setAsync('analytics', data);
            console.log('Analytics: Saved to storage');
        } catch (error) {
            console.error('Analytics: Failed to save', error);
        }
    }

    /**
     * Load analytics from storage
     */
    async load(): Promise<void> {
        try {
            const data = await figma.clientStorage.getAsync('analytics') as {
                componentUsage: Array<[string, ComponentUsage]>;
                totalGenerations: number;
            } | null;

            if (data) {
                this.componentUsage = new Map(data.componentUsage);
                this.totalGenerations = data.totalGenerations || 0;
                console.log(`Analytics: Loaded ${this.componentUsage.size} component usage records`);
            }
        } catch (error) {
            console.error('Analytics: Failed to load', error);
        }
    }

    /**
     * Clear analytics
     */
    clear(): void {
        this.componentUsage.clear();
        this.totalGenerations = 0;
        console.log('Analytics: Cleared');
    }
}

export const analytics = new Analytics();
