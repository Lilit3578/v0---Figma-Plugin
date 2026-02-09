import { ComponentInfo } from './auto-discovery';
import { classificationService } from './classification';
import { PropertyAnalysis, PropertyType, ValueMapping, AppliedMapping } from '../types/classification';
import { findBestMatch, stringSimilarity } from '../utils/string-similarity';

const MAPPING_CACHE_KEY = 'property_mappings_v2';

export class PropertyMappingService {
    private mappingCache: Map<string, Record<string, PropertyAnalysis>> = new Map();
    private semanticLookupCache: Map<string, Record<string, { compProp: string, valueMap: Record<string, string> }>> = new Map();

    /**
     * Load mappings from storage
     */
    async loadMappings() {
        try {
            const cached = await figma.clientStorage.getAsync(MAPPING_CACHE_KEY);
            if (cached) {
                // Deserialize map
                Object.entries(cached).forEach(([compId, mappings]) => {
                    this.mappingCache.set(compId, mappings as Record<string, PropertyAnalysis>);
                });
            }
        } catch (e) {
            console.warn('Failed to load property mappings', e);
        }
    }

    /**
     * Save mappings to storage
     */
    async saveMappings() {
        try {
            const serialized: Record<string, any> = {};
            this.mappingCache.forEach((value, key) => {
                serialized[key] = value;
            });
            await figma.clientStorage.setAsync(MAPPING_CACHE_KEY, serialized);
        } catch (e) {
            console.warn('Failed to save property mappings', e);
        }
    }

    /**
     * Analyze properties for a component using AI
     */
    async analyzeComponentProperties(component: ComponentInfo, shouldSave: boolean = true): Promise<Record<string, PropertyAnalysis>> {
        const results: Record<string, PropertyAnalysis> = {};

        // Skip if no variant properties
        if (!component.variantProperties) return results;

        // Check cache first
        if (this.mappingCache.has(component.id)) {
            return this.mappingCache.get(component.id)!;
        }

        console.log(`Analyzing properties for ${component.name}...`);

        // Collect properties to analyze
        const propertiesToAnalyze: { name: string, values: string[] }[] = [];
        for (const [propName, propDef] of Object.entries(component.variantProperties)) {
            // We could skip known non-variants here, but let's let AI decide
            if (propDef.values && propDef.values.length > 0) {
                propertiesToAnalyze.push({ name: propName, values: propDef.values });
            }
        }

        if (propertiesToAnalyze.length > 0) {
            try {
                // Batch Analysis
                const batchResults = await classificationService.analyzeComponentPropertiesBatch({
                    componentName: component.name,
                    properties: propertiesToAnalyze
                });

                // Process results
                Object.entries(batchResults).forEach(([propName, analysis]) => {
                    // Filter low confidence mappings
                    const validMappings = analysis.valueMappings.filter((m: ValueMapping) => m.confidence >= 0.7);

                    if (validMappings.length > 0) {
                        analysis.valueMappings = validMappings;
                        results[propName] = analysis;
                    }
                });

            } catch (e) {
                console.warn(`Failed to analyze properties for ${component.name}`, e);
            }
        }

        // Cache results
        this.mappingCache.set(component.id, results);
        console.log(`[PropertyMapping] Analysis complete for "${component.name}":`, results);

        if (shouldSave) {
            await this.saveMappings();
        }

        return results;
    }

    /**
     * Apply property mappings to RSNT props
     * Converts semantic props (e.g. { variant: 'primary' }) to component props (e.g. { Emphasis: 'High' })
     */
    applyPropertyMapping(
        componentId: string,
        rsntProps: Record<string, any>,
        fallbackToRaw = true
    ): Record<string, any> {
        const mappings = this.mappingCache.get(componentId);
        const resultProps: Record<string, any> = { ...rsntProps };

        if (!mappings) return resultProps;

        // Check lookup cache first
        if (this.semanticLookupCache.has(componentId)) {
            const semanticLookup = this.semanticLookupCache.get(componentId)!;
            // LOGGING
            console.log(`[PropertyMapping] Checking semantics for ${componentId}. Input:`, rsntProps);

            // Iterate through RSNT props to apply mappings
            Object.entries(rsntProps).forEach(([k, v]) => {
                const searchKey = k.toLowerCase();
                const searchValue = String(v).toLowerCase();

                // 1. Check if the key and value already match a definition exactly (Case-insensitive)
                // If they do, we use them as-is and don't try to map semantically.
                let exactMatchFound = false;
                for (const [defName, analysis] of Object.entries(mappings)) {
                    const typedAnalysis = analysis as any;
                    if (defName.toLowerCase() === searchKey) {
                        // Key matches. Does the value match an option?
                        const validOptions = typedAnalysis.valueMappings?.map((m: any) => m.clientValue) || [];
                        const match = validOptions.find((opt: any) => opt.toLowerCase() === searchValue);
                        if (match) {
                            resultProps[defName] = match; // Use the properly-cased Figma name
                            exactMatchFound = true;
                            break;
                        }
                    }
                }

                if (exactMatchFound) return; // Skip semantic mapping for this prop if exact match found

                // 2. Fall back to semantic lookup for things like "variant" or "size"
                Object.entries(semanticLookup).forEach(([semanticKey, mapData]) => {
                    if (semanticKey.toLowerCase() === searchKey) {
                        const searchValueRaw = String(v).toLowerCase();
                        // Find value match
                        const match = Object.entries(mapData.valueMap).find(
                            ([semVal, cliVal]) => semVal.toLowerCase() === searchValueRaw
                        );
                        if (match) {
                            resultProps[mapData.compProp] = match[1];
                            console.log(`[PropertyMapping] Mapped ${semanticKey}="${rsntProps[k]}" -> ${mapData.compProp}="${match[1]}"`);
                        } else {
                            // If semantic key matches but value doesn't, it's a skipped prop
                            // We don't have a 'skippedProps' array in this method, so we'll just leave it as is in resultProps
                            // or remove it if it's a semantic prop that couldn't be mapped.
                            // For now, it remains in resultProps if it was there initially.
                        }
                    }
                });
            });
            return resultProps;
        }

        const semanticLookup: Record<string, { compProp: string, valueMap: Record<string, string> }> = {};

        Object.entries(mappings).forEach(([compProp, analysis]) => {
            let semanticKey = '';

            switch (analysis.propertyType) {
                case PropertyType.SEMANTIC_VARIANT: semanticKey = 'variant'; break;
                case PropertyType.SEMANTIC_SIZE: semanticKey = 'size'; break;
                case PropertyType.SEMANTIC_STATE: semanticKey = 'state'; break;
                case PropertyType.SEMANTIC_STYLE: semanticKey = 'style'; break;
            }

            if (semanticKey) {
                const values: Record<string, string> = {};
                analysis.valueMappings.forEach(m => {
                    values[m.semanticValue] = m.clientValue;
                });

                semanticLookup[semanticKey] = {
                    compProp,
                    valueMap: values
                };
            }
        });

        // Cache for future use
        this.semanticLookupCache.set(componentId, semanticLookup);

        // Now apply mappings
        Object.entries(semanticLookup).forEach(([semanticKey, mapData]) => {
            if (rsntProps[semanticKey]) {
                const semanticValue = rsntProps[semanticKey];
                const clientValue = mapData.valueMap[semanticValue];

                if (clientValue) {
                    // Set the component property
                    resultProps[mapData.compProp] = clientValue;
                    // Optionally remove the semantic prop if it's not a real prop on the component
                    // But keeping it might be safer for now, or we delete it?
                    // Usually RSNT props are generic, we want to convert them to specific.
                    // Let's keep both for now, or just set the specific one.
                }
            }
        });

        return resultProps;
    }

    /**
     * Get mappings for a specific component
     */
    getMappings(componentId: string) {
        return this.mappingCache.get(componentId);
    }

    /**
     * Calculate overall confidence from property analyses
     * Returns average confidence across all value mappings
     */
    calculateOverallConfidence(mappings: Record<string, PropertyAnalysis> | undefined): number {
        if (!mappings || Object.keys(mappings).length === 0) {
            return 0;
        }

        let totalConfidence = 0;
        let count = 0;

        for (const analysis of Object.values(mappings)) {
            if (analysis.valueMappings && Array.isArray(analysis.valueMappings)) {
                for (const mapping of analysis.valueMappings) {
                    if (typeof mapping.confidence === 'number') {
                        totalConfidence += mapping.confidence;
                        count++;
                    }
                }
            }
        }

        return count > 0 ? totalConfidence / count : 0;
    }

    /**
     * Calculate what percentage of RSNT props can be mapped
     * Returns value between 0 and 1
     */
    calculateMappablePercentage(
        rsntProps: Record<string, any>,
        mappings: Record<string, PropertyAnalysis> | undefined
    ): number {
        if (!mappings || Object.keys(rsntProps).length === 0) {
            return 0;
        }

        const semanticLookup = this.buildSemanticLookup(mappings);
        let mappableCount = 0;

        for (const rsntProp of Object.keys(rsntProps)) {
            // Check if this RSNT prop can be mapped
            if (semanticLookup[rsntProp]) {
                mappableCount++;
            } else {
                // Try fuzzy matching
                const fuzzyMatch = this.fuzzyMatchProperty(rsntProp, mappings);
                if (fuzzyMatch) {
                    mappableCount++;
                }
            }
        }

        return mappableCount / Object.keys(rsntProps).length;
    }

    /**
     * Try to find a fuzzy match for a property name
     * Uses Levenshtein distance to find similar property names
     */
    fuzzyMatchProperty(
        rsntProp: string,
        mappings: Record<string, PropertyAnalysis> | undefined
    ): { match: string; score: number } | null {
        if (!mappings) return null;

        // Build list of semantic keys
        const semanticKeys: string[] = [];
        for (const analysis of Object.values(mappings)) {
            let semanticKey = '';
            switch (analysis.propertyType) {
                case PropertyType.SEMANTIC_VARIANT: semanticKey = 'variant'; break;
                case PropertyType.SEMANTIC_SIZE: semanticKey = 'size'; break;
                case PropertyType.SEMANTIC_STATE: semanticKey = 'state'; break;
                case PropertyType.SEMANTIC_STYLE: semanticKey = 'style'; break;
            }
            if (semanticKey && !semanticKeys.includes(semanticKey)) {
                semanticKeys.push(semanticKey);
            }
        }

        // Find best match with threshold of 0.6
        return findBestMatch(rsntProp, semanticKeys, 0.6);
    }

    /**
     * Enhanced version of applyPropertyMapping that returns detailed results
     * Includes warnings, skipped properties, and fuzzy matching fallback
     */
    applyMappingWithWarnings(
        componentId: string,
        rsntProps: Record<string, any>
    ): AppliedMapping {
        const mappings = this.mappingCache.get(componentId);
        const result: AppliedMapping = {
            componentProperties: {},
            skippedProps: [],
            warnings: []
        };

        if (!mappings) {
            result.warnings.push('No property mappings found for this component');
            result.skippedProps = Object.keys(rsntProps);
            return result;
        }

        // Calculate overall metrics
        const overallConfidence = this.calculateOverallConfidence(mappings);
        const mappablePercentage = this.calculateMappablePercentage(rsntProps, mappings);

        // Warn if below thresholds
        if (overallConfidence < 0.70) {
            result.warnings.push(`Low overall confidence: ${(overallConfidence * 100).toFixed(0)}% (threshold: 70%)`);
        }
        if (mappablePercentage < 0.70) {
            result.warnings.push(`Low mappability: ${(mappablePercentage * 100).toFixed(0)}% (threshold: 70%)`);
        }

        // Build semantic lookup
        const semanticLookup = this.buildSemanticLookup(mappings);

        // Apply mappings
        for (const [rsntProp, rsntValue] of Object.entries(rsntProps)) {
            const mapData = semanticLookup[rsntProp];

            if (mapData) {
                // Direct mapping found
                const componentValue = mapData.valueMap[rsntValue];
                if (componentValue) {
                    result.componentProperties[mapData.compProp] = componentValue;
                    this.logMappingTransparency(rsntProp, mapData.compProp, rsntValue, componentValue);
                } else {
                    result.warnings.push(`Value "${rsntValue}" for property "${rsntProp}" has no mapping`);
                    result.skippedProps.push(rsntProp);
                }
            } else {
                // Try fuzzy matching
                const fuzzyMatch = this.fuzzyMatchProperty(rsntProp, mappings);
                if (fuzzyMatch && fuzzyMatch.score >= 0.6) {
                    const fuzzyMapData = semanticLookup[fuzzyMatch.match];
                    if (fuzzyMapData) {
                        const componentValue = fuzzyMapData.valueMap[rsntValue];
                        if (componentValue) {
                            result.componentProperties[fuzzyMapData.compProp] = componentValue;
                            result.warnings.push(`Fuzzy matched "${rsntProp}" → "${fuzzyMatch.match}" (${(fuzzyMatch.score * 100).toFixed(0)}% similar)`);
                            this.logMappingTransparency(rsntProp, fuzzyMapData.compProp, rsntValue, componentValue, fuzzyMatch.score);
                        } else {
                            result.skippedProps.push(rsntProp);
                        }
                    }
                } else {
                    result.warnings.push(`Could not map property "${rsntProp}"`);
                    result.skippedProps.push(rsntProp);
                }
            }
        }

        return result;
    }

    /**
     * Build semantic lookup table from property analyses
     * Internal helper method
     */
    private buildSemanticLookup(
        mappings: Record<string, PropertyAnalysis>
    ): Record<string, { compProp: string; valueMap: Record<string, string> }> {
        const semanticLookup: Record<string, { compProp: string; valueMap: Record<string, string> }> = {};

        for (const [compProp, analysis] of Object.entries(mappings)) {
            let semanticKey = '';

            // 1. Name-based override (High Priority)
            const propNameLower = compProp.toLowerCase();
            if (propNameLower === 'variant' || propNameLower === 'type') {
                semanticKey = 'variant';
            } else if (propNameLower === 'size') {
                semanticKey = 'size';
            } else {
                // 2. AI Classification Fallback
                switch (analysis.propertyType) {
                    case PropertyType.SEMANTIC_VARIANT: semanticKey = 'variant'; break;
                    case PropertyType.SEMANTIC_SIZE: semanticKey = 'size'; break;
                    case PropertyType.SEMANTIC_STATE: semanticKey = 'state'; break;
                    case PropertyType.SEMANTIC_STYLE: semanticKey = 'style'; break;
                    // Map Custom to variant if not claimed by name override
                    case PropertyType.SEMANTIC_CUSTOM:
                        if (!semanticLookup['variant']) semanticKey = 'variant';
                        break;
                }
            }

            if (semanticKey) {
                const valueMap: Record<string, string> = {};
                analysis.valueMappings.forEach(m => {
                    valueMap[m.semanticValue] = m.clientValue;
                });

                // If key already exists, only overwrite if it's a "better" match? 
                // For now, let's just use the first valid one or the name-based one.
                if (!semanticLookup[semanticKey] || (propNameLower === semanticKey)) {
                    semanticLookup[semanticKey] = {
                        compProp,
                        valueMap
                    };
                }
            }
        }

        return semanticLookup;
    }

    /**
     * Log property mapping for transparency
     * Shows designer how properties were mapped
     */
    private logMappingTransparency(
        rsntProp: string,
        componentProp: string,
        rsntValue: string,
        componentValue: string,
        fuzzyScore?: number
    ): void {
        const fuzzyNote = fuzzyScore ? ` (fuzzy: ${(fuzzyScore * 100).toFixed(0)}%)` : '';
        console.log(`  ✓ Mapped ${rsntProp}:${rsntValue} → ${componentProp}:${componentValue}${fuzzyNote}`);
    }
}

export const propertyMappingService = new PropertyMappingService();
