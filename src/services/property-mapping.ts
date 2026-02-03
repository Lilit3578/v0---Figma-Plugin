import { ComponentInfo } from './auto-discovery';
import { classificationService } from './classification';
import { PropertyAnalysis, PropertyType, ValueMapping } from '../types/classification';

const MAPPING_CACHE_KEY = 'property_mappings_v1';

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
    async analyzeComponentProperties(component: ComponentInfo): Promise<Record<string, PropertyAnalysis>> {
        const results: Record<string, PropertyAnalysis> = {};

        // Skip if no variant properties
        if (!component.variantProperties) return results;

        // Check cache first
        if (this.mappingCache.has(component.id)) {
            return this.mappingCache.get(component.id)!;
        }

        console.log(`Analyzing properties for ${component.name}...`);

        for (const [propName, propDef] of Object.entries(component.variantProperties)) {
            // Skip boolean properties if we can detect them (usually "True/False" or "On/Off")
            // But sometimes they are variants, so we might want to check

            try {
                const analysis = await classificationService.analyzeProperty({
                    componentName: component.name,
                    propertyName: propName,
                    values: propDef.values
                });

                // Filter low confidence mappings
                const validMappings = analysis.valueMappings.filter((m: ValueMapping) => m.confidence >= 0.7);

                if (validMappings.length > 0) {
                    analysis.valueMappings = validMappings;
                    results[propName] = analysis;
                }
            } catch (e) {
                console.warn(`Failed to analyze property ${propName} for ${component.name}`, e);
            }
        }

        // Cache results
        this.mappingCache.set(component.id, results);
        await this.saveMappings();

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
            Object.entries(semanticLookup).forEach(([semanticKey, mapData]) => {
                if (rsntProps[semanticKey]) {
                    const clientValue = mapData.valueMap[rsntProps[semanticKey]];
                    if (clientValue) resultProps[mapData.compProp] = clientValue;
                }
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
}

export const propertyMappingService = new PropertyMappingService();
