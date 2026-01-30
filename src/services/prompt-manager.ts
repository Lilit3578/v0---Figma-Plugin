/**
 * Prompt version management for A/B testing and rollback
 */

import { PromptBuilder } from './prompt-builder';

export interface PromptVersion {
    version: string;
    createdAt: number;
    description: string;
    builder: PromptBuilder;
}

export class PromptManager {
    private versions: Map<string, PromptVersion> = new Map();
    private activeVersion: string = 'v1.0';

    constructor() {
        // Register default version
        this.registerVersion({
            version: 'v1.0',
            createdAt: Date.now(),
            description: 'Initial structured prompt system',
            builder: new PromptBuilder()
        });
    }

    /**
     * Register a new prompt version
     */
    registerVersion(version: PromptVersion): void {
        this.versions.set(version.version, version);
        console.log(`Registered prompt version: ${version.version}`);
    }

    /**
     * Set active version
     */
    setActiveVersion(version: string): void {
        if (!this.versions.has(version)) {
            throw new Error(`Prompt version ${version} not found`);
        }
        this.activeVersion = version;
        console.log(`Active prompt version: ${version}`);
    }

    /**
     * Get active version
     */
    getActiveVersion(): PromptVersion {
        return this.versions.get(this.activeVersion)!;
    }

    /**
     * List all versions
     */
    listVersions(): PromptVersion[] {
        return Array.from(this.versions.values());
    }
}

export const promptManager = new PromptManager();
