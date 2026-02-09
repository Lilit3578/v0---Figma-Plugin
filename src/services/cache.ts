import { DiscoveryCache, ComponentFingerprint } from '../types/cache';
import { ComponentInfo, VariableInfo } from './auto-discovery';

const CACHE_KEY_PREFIX = 'discovery-cache-v1-';
const CACHE_TTL_DEFAULT = 24 * 60 * 60 * 1000; // 24 hours

export class CacheService {
    private fileKey: string;

    constructor() {
        // In Figma plugin, fileKey is stable for the file
        // Fallback to 'local' if undefined (though it should be defined for saved files)
        this.fileKey = figma.fileKey || 'local';
    }

    /**
     * Calculate a lightweight hash of the file structure
     * Used to detect gross changes (page added/removed, top-level frame added/removed)
     */
    private calculateFileStructureHash(): string {
        let structureString = '';

        // Traverse pages only - including top-level frames makes cache strict and fragile
        // (e.g. adding a design to the page invalidates the component cache, which is unnecessary)
        for (const page of figma.root.children) {
            if (page.type !== 'PAGE') continue;
            structureString += `${page.id}:${page.name}|`;
        }

        // Simple hash function (DJB2 or similar simple string hash)
        let hash = 0;
        for (let i = 0; i < structureString.length; i++) {
            const char = structureString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString(16);
    }

    /**
     * Load cache from clientStorage
     */
    async loadCache(): Promise<DiscoveryCache | null> {
        const storageKey = CACHE_KEY_PREFIX + this.fileKey;

        try {
            const rawCache = await figma.clientStorage.getAsync(storageKey);
            if (!rawCache) return null;

            // Type cast and basic validation
            const cache = rawCache as DiscoveryCache;

            // 1. Check TTL
            if (Date.now() - cache.timestamp > cache.ttl) {
                console.log('Cache expired (TTL)');
                return null;
            }

            // 2. Check File Version / structural integrity
            // If we are in the same file session, fileKey checks out.
            // But if the user opened the file 2 days later, fileKey is same, but structure might differ.
            // The hash check helps here.
            const currentHash = this.calculateFileStructureHash();
            if (cache.fileStructureHash !== currentHash) {
                console.log('Cache expired (Structure changed)');
                // We could return null, BUT for incremental updates, strictly invalidating on ANY structure change 
                // might be too aggressive if they just added a new page but touched no components.
                // However, the user requirements say: "Check 3: Has structure changed? ... If any check fails: invalidate cache"
                // So we will stick to requirements.
                return null;
            }

            return cache;

        } catch (e) {
            console.error('Failed to load cache', e);
            // If corruption, return null to force rescan
            return null;
        }
    }

    /**
     * Save cache to clientStorage
     */
    async saveCache(
        components: ComponentInfo[],
        variables: VariableInfo[],
        approvedMappings: Record<string, string>
    ): Promise<void> {
        const storageKey = CACHE_KEY_PREFIX + this.fileKey;

        // Build fingerprints
        const fingerprintMap: Record<string, ComponentFingerprint> = {};
        const componentMap: Record<string, ComponentInfo> = {};

        components.forEach(c => {
            componentMap[c.id] = c;

            // We need to look up the node to get lastModified
            // BUT getting node by ID is expensive if we do it for all.
            // The ComponentInfo doesn't strictly have lastModified unless we add it.
            // OPTIMIZATION: We should have captured lastModified during discovery?
            // Or we fetch it now. Since we are saving AFTER discovery, we likely have access or can fetch.
            // Current Discovery returns ComponentInfo.
            // Let's assume we can fast lookup or we accept a small perf hit here to ensure cache integrity.
            const node = figma.getNodeById(c.id);
            // NOTE: figma.getNodeById on a deleted node returns null.

            if (node) {
                // Cast to any because lastModified exists on SceneNode but TS might complain depending on version
                const lastMod = (node as any).lastModified ? (node as any).lastModified : new Date().toISOString();

                fingerprintMap[c.id] = {
                    id: c.id,
                    lastModified: lastMod
                    // we skip structureHash for now until we have anatomy hash readily available
                };
            }
        });

        const variableInventoryMap: Record<string, VariableInfo> = {};
        variables.forEach(v => {
            variableInventoryMap[v.id] = v;
        });

        const cache: DiscoveryCache = {
            version: '1.0',
            fileKey: this.fileKey,
            fileStructureHash: this.calculateFileStructureHash(),
            timestamp: Date.now(),
            ttl: CACHE_TTL_DEFAULT,
            componentFingerprints: fingerprintMap,
            components: componentMap,
            variableInventory: variableInventoryMap,
            approvedMappings: approvedMappings || {}
        };

        try {
            await figma.clientStorage.setAsync(storageKey, cache);
            console.log('Cache saved successfully');
        } catch (e) {
            console.error('Failed to save cache', e);
        }
    }

    async clearCache(): Promise<void> {
        const storageKey = CACHE_KEY_PREFIX + this.fileKey;
        await figma.clientStorage.deleteAsync(storageKey);
    }

    /**
     * Helper to check if a single component has changed relative to cache
     */
    isComponentModified(componentId: string, cache: DiscoveryCache): boolean {
        const fingerprint = cache.componentFingerprints[componentId];
        if (!fingerprint) return true; // New component

        const node = figma.getNodeById(componentId);
        if (!node) return true; // Shouldn't happen if we found it in scan

        const currentLastMod = (node as any).lastModified;
        if (!currentLastMod) return true;

        // String comparison of ISO timestamps
        return currentLastMod !== fingerprint.lastModified;
    }
}

export const cacheService = new CacheService();
