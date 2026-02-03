import { ComponentInfo, VariableInfo } from '../services/auto-discovery';

/**
 * Fingerprint for a component to detect changes
 */
export interface ComponentFingerprint {
    id: string;
    lastModified: string; // ISO timestamp from Figma node.lastModified
    structureHash?: string; // Optional additional hash (e.g. from anatomy)
}

/**
 * Stats for the discovery process
 */
export interface DiscoveryStats {
    scanDuration: number;
    totalComponents: number;
    cachedComponents: number;
    scannedComponents: number;
    hitRate: number; // 0-1
    cacheAge: number; // ms
}

/**
 * Main cache structure
 */
export interface DiscoveryCache {
    version: string; // Schema version for the cache itself
    fileKey: string; // Figma file key to prevent cross-file pollution
    fileStructureHash: string; // Hash of pages/frames to detect structural changes
    timestamp: number; // When this cache was created
    ttl: number; // TTL in ms

    // Core Data
    componentFingerprints: Record<string, ComponentFingerprint>; // Map<id, Fingerprint>
    components: Record<string, ComponentInfo>; // Map<id, ComponentInfo> - The actual cached data

    variableInventory: Record<string, VariableInfo>; // Map<id, VariableInfo>
    approvedMappings: Record<string, string>; // semanticRole -> componentId
}
