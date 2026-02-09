import {
    analyzeComponentAnatomy,
    ComponentAnatomy,
    PatternMatch,
    KNOWN_PATTERNS,
    matchPatternConfidence,
    LayerNode
} from './anatomy';
import { classificationService } from './classification';
import { propertyMappingService } from './property-mapping';
import { AIClassificationResponse, PropertyAnalysis } from '../types/classification';
import { cacheService } from './cache'; // Import CacheService
import { DiscoveryCache } from '../types/cache'; // Import DiscoveryCache type

export interface ComponentInfo {
    id: string;
    key: string;
    name: string;
    type: 'COMPONENT' | 'COMPONENT_SET';
    description?: string;
    properties?: Record<string, {
        type: 'VARIANT' | 'BOOLEAN' | 'TEXT' | 'INSTANCE_SWAP';
        values?: string[];
        defaultValue?: any;
    }>;
    variantProperties?: Record<string, { values: string[] }>;
    semanticType?: 'button' | 'input' | 'checkbox' | 'card' | 'text' | 'container' | 'icon' | 'unknown';
    inferredPurpose?: string;
    suggestedRole?: string; // RSNT semantic role (PrimaryButton, Card, Input, etc.)
    anatomy?: ComponentAnatomy;
    patternMatches?: PatternMatch[];
    aiClassification?: AIClassificationResponse;
    propertyMappings?: Record<string, PropertyAnalysis>;
}

export interface VariableInfo {
    id: string;
    name: string;
    resolvedType: string;
    value: any;
    scopes: string[];
    usageCount?: number; // Number of times this variable is used in the file
    semanticTokens?: string[]; // Potential semantic aliases for this variable
}

export interface DesignSystemInventory {
    components: ComponentInfo[];
    variables: VariableInfo[];
    fileKey: string;
    scannedAt: number;
    guidelines?: DesignSystemGuidelines;
    suggestedMappings?: Record<string, string>; // semanticRole -> componentId
    discoveryStats?: {
        scanDuration: number;
        totalComponents: number;
        scannedComponents: number;
        cachedComponents: number;
        cacheAge: number;
    };
}

export interface DesignSystemGuidelines {
    spacing: {
        scale: number[];
        default: number;
    };
    typography: {
        scale: Array<{ level: string; fontSize: number; usage: string }>;
        sizes: number[]; // Deduplicated font sizes extracted from file variables
    };
    borderRadius: {
        scale: number[]; // Extracted from file variables, or defaults
    };
    layout: {
        maxContentWidth: number;
        defaultPadding: number;
    };
}

export interface InventoryDiff {
    added: {
        components: ComponentInfo[];
        variables: VariableInfo[];
    };
    removed: {
        componentIds: string[];
        variableIds: string[];
    };
    modified: {
        components: ComponentInfo[];
        variables: VariableInfo[];
    };
    unchanged: number;
}

/**
 * Classify component based on name and properties
 */
function classifyComponent(component: ComponentNode | ComponentSetNode): ComponentInfo['semanticType'] {
    const name = component.name.toLowerCase();

    // Button detection
    if (name.includes('button') || name.includes('btn') || name.includes('cta')) {
        return 'button';
    }

    // Input detection
    if (name.includes('input') || name.includes('field') || name.includes('textfield') ||
        name.includes('text field') || name.includes('textarea')) {
        return 'input';
    }

    // Checkbox detection
    if (name.includes('checkbox') || name.includes('check') || name.includes('toggle') ||
        name.includes('switch')) {
        return 'checkbox';
    }

    // Card detection
    if (name.includes('card') || name.includes('panel')) {
        return 'card';
    }

    // Text/Typography detection
    if (name.includes('text') || name.includes('label') || name.includes('heading') ||
        name.includes('title') || name.includes('paragraph') || name.includes('typography')) {
        return 'text';
    }

    // Icon detection
    if (name.includes('icon') || name.includes('svg')) {
        return 'icon';
    }

    // Container detection
    if (name.includes('layout') || name.includes('grid') || name.includes('stack') ||
        name.includes('wrapper') || name.includes('container') || name.includes('box')) {
        return 'container';
    }

    return 'unknown';
}

/**
 * Suggest RSNT semantic role based on component name
 */
function suggestSemanticRole(component: ComponentNode | ComponentSetNode): string | undefined {
    const name = component.name.toLowerCase();

    // Button variants
    if (name.match(/(button|btn).*(primary|main|cta)/)) return 'PrimaryButton';
    if (name.match(/(button|btn).*(secondary|ghost|outline|subtle)/)) return 'SecondaryButton';
    if (name.match(/(button|btn)/)) return 'PrimaryButton'; // Default to primary

    // Input/Form fields
    if (name.match(/(input|field|textfield|text field)/)) return 'Input';
    if (name.match(/form/)) return 'Form';

    // Card/Container
    if (name.match(/card/)) return 'Card';
    if (name.match(/(container|wrapper|box)/)) return 'Container';

    // Typography
    if (name.match(/(heading|title|h[1-6])/)) return 'Heading';
    if (name.match(/(paragraph|body|text)/)) return 'Paragraph';
    if (name.match(/(label|caption)/)) return 'Label';

    return undefined;
}

/**
 * Infer design system guidelines from variables
 */
function inferGuidelines(variables: VariableInfo[]): DesignSystemGuidelines {
    // Helper: extract unique sorted numeric values from a filtered variable list.
    // Prefers v.value (the actual token value); falls back to parsing a number from the name.
    const extractNumericValues = (
        vars: VariableInfo[],
        minVal: number,
        maxVal: number
    ): number[] => {
        const values = vars.map(v => {
            if (typeof v.value === 'number') return v.value;
            // Fallback: parse trailing number from name (e.g. "spacing/16" → 16)
            const match = v.name.match(/(\d+(?:\.\d+)?)(?:\s*$|[^a-zA-Z]|$)/);
            return match ? parseFloat(match[1]) : 0;
        });
        return [...new Set(values.filter(n => n >= minVal && n <= maxVal))].sort((a, b) => a - b);
    };

    // --- Spacing ---
    const spacingVars = variables.filter(v =>
        v.resolvedType === 'FLOAT' && (
            v.name.toLowerCase().includes('spacing') ||
            v.name.toLowerCase().includes('space') ||
            v.name.toLowerCase().includes('gap') ||
            v.name.toLowerCase().includes('padding')
        )
    );
    const spacingScale = extractNumericValues(spacingVars, 1, 200);

    // --- Typography (font sizes) ---
    const fontVars = variables.filter(v =>
        v.resolvedType === 'FLOAT' && (
            v.name.toLowerCase().includes('font-size') ||
            v.name.toLowerCase().includes('fontsize') ||
            v.name.toLowerCase().includes('font size') ||
            v.name.toLowerCase().includes('text-size') ||
            v.name.toLowerCase().includes('heading') ||
            v.name.toLowerCase().includes('body') ||
            v.name.toLowerCase().includes('caption') ||
            v.name.toLowerCase().includes('display') ||
            v.name.toLowerCase().includes('title') ||
            v.name.toLowerCase().includes('label') ||
            v.name.toLowerCase().includes('paragraph') ||
            v.name.toLowerCase().includes('typography') ||
            v.name.toLowerCase().match(/\btext\b/) !== null
        )
    );
    const fontSizes = extractNumericValues(fontVars, 8, 120);

    // --- Border Radius ---
    const radiusVars = variables.filter(v =>
        v.resolvedType === 'FLOAT' && (
            v.name.toLowerCase().includes('radius') ||
            v.name.toLowerCase().includes('rounded') ||
            v.name.toLowerCase().includes('corner')
        )
    );
    const radiusScale = extractNumericValues(radiusVars, 0, 100);

    // Build structured typography scale from extracted sizes (or defaults)
    const typographyScale = fontSizes.length >= 2
        ? buildTypographyScale(fontSizes)
        : [
            { level: 'h1', fontSize: 32, usage: 'Page titles' },
            { level: 'h2', fontSize: 24, usage: 'Section headers' },
            { level: 'body', fontSize: 16, usage: 'Body text' },
            { level: 'small', fontSize: 14, usage: 'Captions' }
        ];

    return {
        spacing: {
            scale: spacingScale.length > 0 ? spacingScale : [4, 8, 16, 24, 32, 48, 64],
            default: 16
        },
        typography: {
            scale: typographyScale,
            sizes: fontSizes.length > 0 ? fontSizes : [12, 14, 16, 20, 24, 32, 40]
        },
        borderRadius: {
            scale: radiusScale.length > 0 ? radiusScale : [4, 6, 8, 12, 16]
        },
        layout: {
            maxContentWidth: 1200,
            defaultPadding: 24
        }
    };
}

/**
 * Map a sorted array of font sizes to labelled typography levels.
 * Assigns labels bottom-up: smallest → small/caption, largest → h1/display.
 */
function buildTypographyScale(sizes: number[]): Array<{ level: string; fontSize: number; usage: string }> {
    const labels = [
        { level: 'caption', usage: 'Captions, fine print' },
        { level: 'small', usage: 'Secondary labels' },
        { level: 'body', usage: 'Body text' },
        { level: 'h3', usage: 'Sub-section headers' },
        { level: 'h2', usage: 'Section headers' },
        { level: 'h1', usage: 'Page titles' },
        { level: 'display', usage: 'Hero / display text' },
    ];

    // Spread sizes evenly across labels
    const result: Array<{ level: string; fontSize: number; usage: string }> = [];
    const step = Math.max(1, sizes.length / labels.length);

    for (let i = 0; i < labels.length; i++) {
        const idx = Math.min(Math.round(i * step), sizes.length - 1);
        result.push({ ...labels[i], fontSize: sizes[idx] });
    }

    return result;
}

/**
 * Orchestrate AI classification for components
 */
async function classifyComponentsOrchestrator(
    components: ComponentInfo[],
    lastInventory: DesignSystemInventory | null,
    onProgress?: (step: string, progress: number) => void
): Promise<ComponentInfo[]> {

    // Get API Key
    // Get API Key
    try {
        let apiKey = await figma.clientStorage.getAsync('gemini_api_key');

        // Robust check: Ensure it's a non-empty string
        if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
            console.warn('Skipping AI classification: No valid API key found', apiKey);
            // Notify user via progress callback
            onProgress?.('AI classification skipped (no API key)', 0);
            return components;
        }

        // SANITIZATION: Remove leading '#' if present (common paste error from .env)
        apiKey = apiKey.trim().replace(/^#/, '');

        if (apiKey === '') {
            console.warn('Skipping AI classification: API key was only comments/whitespace');
            return components;
        }

        classificationService.setApiKey(apiKey);
    } catch (e) {
        console.warn('Failed to retrieve API key for classification', e);
        // Notify user via progress callback
        onProgress?.('AI classification skipped (API key error)', 0);
        return components;
    }

    onProgress?.('Classifying components with AI...', 0);

    // Identify components needing classification
    const componentsToClassify: ComponentInfo[] = [];
    const classificationMap = new Map<string, AIClassificationResponse>();

    // 1. Recover existing classifications
    if (lastInventory) {
        lastInventory.components.forEach(c => {
            if (c.aiClassification) {
                classificationMap.set(c.id, c.aiClassification);
            }
        });
    }

    // Load property mappings from cache
    await propertyMappingService.loadMappings();

    // 2. Filter components
    const finalComponents = components.map(c => {
        // If we have a cached classification
        const cached = classificationMap.get(c.id);

        if (cached) {
            // Check if structure matches to validate cache
            const lastComp = lastInventory?.components.find(lc => lc.id === c.id);
            if (lastComp?.anatomy?.structureSignature === c.anatomy?.structureSignature) {
                return { ...c, aiClassification: cached };
            }
        }

        componentsToClassify.push(c);
        return c;
    });

    // If no new classification needed, still check for property analysis on ALL applicable components
    // BUT we should avoid re-analyzing properties if they haven't changed.
    // Ideally propertyMappingService handles caching.

    // We will analyze properties for ALL components that have valid classifications (cached or new)
    // The service itself checks cache.

    // 3. Batched AI Call for Classification
    if (componentsToClassify.length > 0) {
        console.log(`Classifying ${componentsToClassify.length} components using AI...`);
        const results = await classificationService.classifyAll(
            componentsToClassify,
            (p) => onProgress?.(`Classifying components (${Math.round(p * 100)}%)...`, p)
        );

        // Merge results
        finalComponents.forEach((c, index) => {
            if (results.has(c.id)) {
                const aiRes = results.get(c.id)!;
                if (aiRes.confidence >= 0.5) {
                    finalComponents[index] = {
                        ...c,
                        aiClassification: aiRes,
                        suggestedRole: aiRes.semanticRole
                    };
                }
            }
        });
    }

    // 4. Analyze Properties for relevant components
    // We only analyze properties for components that look like they have semantic variants
    // e.g. Buttons, Inputs, etc. or where we have variant properties.
    const componentsForPropertyAnalysis = finalComponents.filter(c =>
        c.variantProperties && Object.keys(c.variantProperties).length > 0 &&
        (c.semanticType !== 'unknown' || c.suggestedRole)
    );

    if (componentsForPropertyAnalysis.length > 0) {
        onProgress?.('Analyzing component properties...', 0.9);
        console.log(`Analyzing properties for ${componentsForPropertyAnalysis.length} components`);

        // This runs sequentially or effectively parallel inside? The service iterates.
        // We might want to promise.all but let's be careful with rate limits.
        // The service currently does one by one internally per component (iterating props).
        // We should probably iterate components.

        let pCount = 0;
        for (const comp of componentsForPropertyAnalysis) {
            // Pass false for shouldSave to avoid writing to storage on every iteration
            const mappings = await propertyMappingService.analyzeComponentProperties(comp, false);
            if (Object.keys(mappings).length > 0) {
                comp.propertyMappings = mappings;
            }
            if (pCount % 5 === 0) onProgress?.('Analyzing properties...', 0.9 + (pCount / componentsForPropertyAnalysis.length * 0.1));
        }

        // ✅ FIX 1: Save all property mappings to storage
        await propertyMappingService.saveMappings();
        console.log('Property mappings saved to storage');
    }

    return finalComponents;
}

/**
 * Discover all components in the current file, using cache to skip unmodified ones
 */
function discoverComponents(cache: DiscoveryCache | null): { components: ComponentInfo[], newlyScannedCount: number } {
    const allNodes = (figma.root.findAll(node =>
        node.type === 'COMPONENT' || node.type === 'COMPONENT_SET'
    ) as (ComponentNode | ComponentSetNode)[])
        .filter(node => {
            // Exclude variants (components that are children of a Component Set)
            if (node.type === 'COMPONENT' && node.parent?.type === 'COMPONENT_SET') {
                return false;
            }
            return true;
        });

    let newlyScannedCount = 0;

    const components = allNodes.map(component => {
        console.log(`[Discovery] Analyzing component: "${component.name}" (ID: ${component.id}, Type: ${component.type})`);

        // INCREMENTAL CHECK:
        // If we have cache and component is not modified, use cached version
        if (cache && !cacheService.isComponentModified(component.id, cache)) {
            const cachedInfo = cache.components[component.id];
            if (cachedInfo) {
                return cachedInfo;
            }
        }

        // Slow Path: Full Analysis
        newlyScannedCount++;

        // Cast to LayerNode (runtime compatibility assumed for utilized props)
        const anatomy = analyzeComponentAnatomy(component as unknown as LayerNode);

        // Match against known patterns
        const patternMatches = KNOWN_PATTERNS.map(pattern =>
            matchPatternConfidence(anatomy, pattern)
        ).filter(match => match.confidence > 0.4) // Filter low confidence
            .sort((a, b) => b.confidence - a.confidence);

        const bestMatch = patternMatches[0];

        const info: ComponentInfo = {
            id: component.id,
            key: component.key,
            name: component.name,
            type: component.type as 'COMPONENT' | 'COMPONENT_SET',
            description: component.description || undefined,
            semanticType: classifyComponent(component),
            suggestedRole: suggestSemanticRole(component),
            anatomy,
            patternMatches
        };

        // Extract component properties (Variants, Booleans, Text, Swaps)
        const props: Record<string, { type: 'VARIANT' | 'BOOLEAN' | 'TEXT' | 'INSTANCE_SWAP'; values?: string[]; defaultValue?: any }> = {};

        // Helper to process properties
        const processDefinitions = (definitions: ComponentPropertyDefinitions) => {
            Object.entries(definitions).forEach(([key, def]) => {
                // Skip hidden properties (convention: starting with _)
                if (key.startsWith('_')) return;

                if (def.type === 'VARIANT') {
                    console.log(`[Discovery]   Variant Prop: "${key}", Values:`, def.variantOptions);
                    props[key] = {
                        type: 'VARIANT',
                        values: def.variantOptions || [],
                        defaultValue: def.defaultValue
                    };
                } else if (def.type === 'BOOLEAN') {
                    props[key] = {
                        type: 'BOOLEAN',
                        defaultValue: def.defaultValue
                    };
                } else if (def.type === 'TEXT') {
                    props[key] = {
                        type: 'TEXT',
                        defaultValue: def.defaultValue
                    };
                } else if (def.type === 'INSTANCE_SWAP') {
                    props[key] = {
                        type: 'INSTANCE_SWAP',
                        defaultValue: def.defaultValue
                    };
                }
            });
        };

        if (component.type === 'COMPONENT_SET') {
            processDefinitions(component.componentPropertyDefinitions);

            // Backward compatibility for existing prompts until update
            const variantProps: Record<string, { values: string[] }> = {};
            Object.entries(props).forEach(([key, p]) => {
                if (p.type === 'VARIANT') {
                    variantProps[key] = { values: p.values || [] };
                } else if (p.type === 'BOOLEAN') {
                    // Treat booleans as variants with True/False options so validVariantProperty can find them
                    variantProps[key] = { values: ['True', 'False'] };
                }
            });
            info.variantProperties = variantProps;

        } else if (component.type === 'COMPONENT') {
            processDefinitions(component.componentPropertyDefinitions);
        }

        info.properties = props;

        // Use anatomy to refine semantic role if name-based failed or is generic
        if ((!info.suggestedRole || info.suggestedRole === 'Container') && bestMatch) {
            if (bestMatch.pattern === 'ActionableElement') info.suggestedRole = 'Button'; // Fallback
            // Improve heuristic map later
        }

        return info;
    });

    return { components, newlyScannedCount };
}

/**
 * Discover all variables in the current file
 */
function discoverVariables(): VariableInfo[] {
    const localVariables = figma.variables.getLocalVariables();

    return localVariables.map(variable => {
        const collection = figma.variables.getVariableCollectionById(variable.variableCollectionId);
        const defaultMode = collection?.defaultModeId || Object.keys(variable.valuesByMode)[0];
        const value = variable.valuesByMode[defaultMode];

        return {
            id: variable.id,
            name: variable.name,
            resolvedType: variable.resolvedType,
            value: value,
            scopes: variable.scopes,
            usageCount: 0, // Will be calculated during component scanning if needed
            semanticTokens: [] // Will be populated by variable resolver if needed
        };
    });
}

/**
 * Get cached inventory or perform fresh discovery
 */
export async function getOrDiscoverInventory(
    onProgress?: (step: string, progress: number) => void
): Promise<DesignSystemInventory> {

    onProgress?.('Checking cache...', 10);

    // Try cache first
    const cache = await cacheService.loadCache();
    const usingCache = !!cache;

    if (usingCache) {
        console.log('Valid cache found. Performing incremental update.');
        onProgress?.('Cache valid. Scanning for changes...', 20);
    } else {
        console.log('No valid cache. Performing full scan.');
        onProgress?.('Full scan started...', 20);
    }

    // Perform discovery (incremental if cache exists)
    onProgress?.('Scanning components...', 30);

    // Pass cache to discoverComponents
    const { components, newlyScannedCount } = discoverComponents(cache);

    console.log(`Scan complete. ${newlyScannedCount} components analyzed. ${components.length - newlyScannedCount} from cache.`);

    // Integrate AI Classification and Property Mapping
    // We pass the old inventory (from cache) so classification orchestrator can also skip AI calls
    const lastInventory: DesignSystemInventory | null = cache ? {
        components: Object.values(cache.components),
        variables: Object.values(cache.variableInventory),
        fileKey: cache.fileKey,
        scannedAt: cache.timestamp,
        guidelines: undefined,
        suggestedMappings: cache.approvedMappings
    } : null;

    const enrichedComponents = await classifyComponentsOrchestrator(components, lastInventory, (msg, p) => {
        // Map progress 0-1 to 30-60 range roughly
        onProgress?.(msg, 30 + (p * 0.3 * 100)); // 30-60
    });

    onProgress?.('Scanning variables...', 60);
    const variables = discoverVariables();

    onProgress?.('Inferring guidelines...', 75);
    const guidelines = inferGuidelines(variables);

    onProgress?.('Building suggested mappings...', 80);
    // Build suggestedMappings: semanticRole -> componentId
    // If we have cached mappings, we might want to preserve them?
    // Current logic rebuilds from 'suggestedRole', which is fine as long as suggestedRole is stable.
    const suggestedMappings: Record<string, string> = cache ? { ...cache.approvedMappings } : {};

    for (const component of enrichedComponents) {
        if (component.suggestedRole) {
            // Update mapping logic:
            // If mapping doesn't exist, add it.
            // If it exists, should we override? Only if the current component is arguably "better"
            // For now, simple first-come (or first in this list) wins, or overwrite if we allow re-suggestions.
            if (!suggestedMappings[component.suggestedRole]) {
                suggestedMappings[component.suggestedRole] = component.id;
            }
        }
    }

    onProgress?.('Building inventory...', 90);
    const inventory: DesignSystemInventory = {
        components: enrichedComponents,
        variables,
        fileKey: figma.fileKey || 'local',
        scannedAt: Date.now(),
        guidelines,
        suggestedMappings,
        discoveryStats: {
            scanDuration: 0, // Will be updated
            totalComponents: components.length,
            scannedComponents: newlyScannedCount,
            cachedComponents: components.length - newlyScannedCount,
            cacheAge: cache ? (Date.now() - cache.timestamp) : 0
        }
    };

    // Cache the result using new CacheService
    onProgress?.('Saving to cache...', 90);
    await cacheService.saveCache(enrichedComponents, variables, suggestedMappings);

    onProgress?.('Complete', 100);
    return inventory;
}

/**
 * Force refresh the inventory
 */
export async function refreshInventory(
    onProgress?: (step: string, progress: number) => void
): Promise<DesignSystemInventory> {

    // Clear cache using service
    await cacheService.clearCache();

    // Rediscover
    return getOrDiscoverInventory(onProgress);
}

/**
 * Perform incremental discovery - only scan changes
 * NOTE: getOrDiscoverInventory now handles this automatically via CacheService.
 * We keep this function signature for backward compatibility but it just calls getOrDiscover.
 */
export async function incrementalDiscovery(
    lastInventory: DesignSystemInventory, // Deprecated/Unused in new logic but kept for sig
    onProgress?: (step: string, progress: number) => void
): Promise<{ inventory: DesignSystemInventory; diff: InventoryDiff }> {

    // Helper: calculate diff
    // Since getOrDiscoverInventory does the smart thing, we just call it.
    // However, to compute DIFF, we need the "before" state.
    // If caller passed lastInventory, use it.

    const newInventory = await getOrDiscoverInventory(onProgress);

    // Compute Diff roughly
    const diff: InventoryDiff = {
        added: { components: [], variables: [] },
        removed: { componentIds: [], variableIds: [] },
        modified: { components: [], variables: [] },
        unchanged: 0
    };

    if (lastInventory) {
        const lastCompMap = new Map(lastInventory.components.map(c => [c.id, c]));
        const newCompMap = new Map(newInventory.components.map(c => [c.id, c]));

        // Added
        newInventory.components.forEach(c => {
            if (!lastCompMap.has(c.id)) diff.added.components.push(c);
            else {
                const last = lastCompMap.get(c.id)!;
                // Modified?
                if (last.name !== c.name || last.description !== c.description || JSON.stringify(last.properties) !== JSON.stringify(c.properties)) {
                    diff.modified.components.push(c);
                } else {
                    diff.unchanged++;
                }
            }
        });

        // Removed
        lastInventory.components.forEach(c => {
            if (!newCompMap.has(c.id)) diff.removed.componentIds.push(c.id);
        });

        // Variables diffs... (omitted for brevity, focus on components)
    }

    return { inventory: newInventory, diff };
}