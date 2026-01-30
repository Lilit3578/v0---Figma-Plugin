/**
 * Automatic Design System Discovery
 * Scans the current Figma file and builds an inventory
 */

export interface ComponentInfo {
    id: string;
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
}

export interface VariableInfo {
    id: string;
    name: string;
    resolvedType: string;
    value: any;
    scopes: string[];
}

export interface DesignSystemInventory {
    components: ComponentInfo[];
    variables: VariableInfo[];
    fileKey: string;
    scannedAt: number;
    guidelines?: DesignSystemGuidelines;  // NEW
}

export interface DesignSystemGuidelines {
    spacing: {
        scale: number[];  // [4, 8, 16, 24, 32, 48, 64]
        default: number;  // 16
    };
    typography: {
        scale: Array<{ level: string; fontSize: number; usage: string }>;
    };
    layout: {
        maxContentWidth: number;  // 1200
        defaultPadding: number;   // 24
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

const CACHE_KEY_PREFIX = 'inventory-';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

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
 * Infer design system guidelines from variables
 */
function inferGuidelines(variables: VariableInfo[]): DesignSystemGuidelines {
    // Extract spacing scale from variables
    const spacingVars = variables.filter(v =>
        v.name.toLowerCase().includes('spacing') ||
        v.name.toLowerCase().includes('space') ||
        v.name.toLowerCase().includes('gap') ||
        v.name.toLowerCase().includes('padding')
    );

    const spacingScale = spacingVars
        .map(v => {
            const match = v.name.match(/\d+/);
            return match ? parseFloat(match[0]) : 0;
        })
        .filter(n => n > 0 && n < 200)  // Reasonable spacing values
        .sort((a, b) => a - b);

    // Remove duplicates
    const uniqueSpacing = [...new Set(spacingScale)];

    // Default spacing scale if none found
    const scale = uniqueSpacing.length > 0
        ? uniqueSpacing
        : [4, 8, 16, 24, 32, 48, 64];

    return {
        spacing: {
            scale,
            default: 16
        },
        typography: {
            scale: [
                { level: 'h1', fontSize: 32, usage: 'Page titles' },
                { level: 'h2', fontSize: 24, usage: 'Section headers' },
                { level: 'body', fontSize: 16, usage: 'Body text' },
                { level: 'small', fontSize: 14, usage: 'Captions' }
            ]
        },
        layout: {
            maxContentWidth: 1200,
            defaultPadding: 24
        }
    };
}

/**
 * Discover all components in the current file
 */
function discoverComponents(): ComponentInfo[] {
    const allComponents = figma.root.findAll(node =>
        node.type === 'COMPONENT' || node.type === 'COMPONENT_SET'
    ) as (ComponentNode | ComponentSetNode)[];

    return allComponents.map(component => {
        const info: ComponentInfo = {
            id: component.id,
            name: component.name,
            type: component.type as 'COMPONENT' | 'COMPONENT_SET',
            description: component.description || undefined,
            semanticType: classifyComponent(component)
        };

        // Extract component properties (Variants, Booleans, Text, Swaps)
        const props: Record<string, { type: 'VARIANT' | 'BOOLEAN' | 'TEXT' | 'INSTANCE_SWAP'; values?: string[]; defaultValue?: any }> = {};

        // Helper to process properties
        const processDefinitions = (definitions: ComponentPropertyDefinitions) => {
            Object.entries(definitions).forEach(([key, def]) => {
                // Skip hidden properties (convention: starting with _)
                if (key.startsWith('_')) return;

                if (def.type === 'VARIANT') {
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
                }
            });
            info.variantProperties = variantProps;

        } else if (component.type === 'COMPONENT') {
            processDefinitions(component.componentPropertyDefinitions);
        }

        info.properties = props;

        return info;
    });
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
            scopes: variable.scopes
        };
    });
}

/**
 * Get cached inventory or perform fresh discovery
 */
export async function getOrDiscoverInventory(
    onProgress?: (step: string, progress: number) => void
): Promise<DesignSystemInventory> {
    const fileKey = figma.fileKey || 'local';
    const cacheKey = CACHE_KEY_PREFIX + fileKey;

    onProgress?.('Checking cache...', 10);

    // Try cache first
    try {
        const cached = await figma.clientStorage.getAsync(cacheKey) as DesignSystemInventory | null;

        if (cached && (Date.now() - cached.scannedAt) < CACHE_TTL) {
            console.log('Using cached inventory');
            onProgress?.('Loaded from cache', 100);
            return cached;
        }
    } catch (error) {
        console.warn('Cache read failed:', error);
    }

    // Perform fresh discovery
    console.log('Performing fresh discovery...');

    onProgress?.('Scanning components...', 30);
    const components = discoverComponents();

    onProgress?.('Scanning variables...', 60);
    const variables = discoverVariables();

    onProgress?.('Inferring guidelines...', 75);
    const guidelines = inferGuidelines(variables);

    onProgress?.('Building inventory...', 80);
    const inventory: DesignSystemInventory = {
        components,
        variables,
        fileKey: fileKey,
        scannedAt: Date.now(),
        guidelines  // NEW
    };

    // Cache the result
    onProgress?.('Saving to cache...', 90);
    try {
        await figma.clientStorage.setAsync(cacheKey, inventory);
    } catch (error) {
        console.warn('Cache write failed:', error);
    }

    onProgress?.('Complete', 100);
    return inventory;
}

/**
 * Force refresh the inventory
 */
export async function refreshInventory(
    onProgress?: (step: string, progress: number) => void
): Promise<DesignSystemInventory> {
    const fileKey = figma.fileKey || 'local';
    const cacheKey = CACHE_KEY_PREFIX + fileKey;

    // Clear cache
    await figma.clientStorage.deleteAsync(cacheKey);

    // Rediscover
    return getOrDiscoverInventory(onProgress);
}

/**
 * Perform incremental discovery - only scan changes
 */
export async function incrementalDiscovery(
    lastInventory: DesignSystemInventory,
    onProgress?: (step: string, progress: number) => void
): Promise<{ inventory: DesignSystemInventory; diff: InventoryDiff }> {

    onProgress?.('Scanning for changes...', 0);

    const currentComponents = discoverComponents();
    const currentVariables = discoverVariables();

    onProgress?.('Comparing with previous scan...', 30);

    const diff: InventoryDiff = {
        added: { components: [], variables: [] },
        removed: { componentIds: [], variableIds: [] },
        modified: { components: [], variables: [] },
        unchanged: 0
    };

    // Build ID sets for comparison
    const lastComponentIds = new Set(lastInventory.components.map(c => c.id));
    const currentComponentIds = new Set(currentComponents.map(c => c.id));

    const lastVariableIds = new Set(lastInventory.variables.map(v => v.id));
    const currentVariableIds = new Set(currentVariables.map(v => v.id));

    onProgress?.('Detecting added components...', 50);

    // Find added components
    diff.added.components = currentComponents.filter(c => !lastComponentIds.has(c.id));

    // Find removed components
    diff.removed.componentIds = lastInventory.components
        .filter(c => !currentComponentIds.has(c.id))
        .map(c => c.id);

    onProgress?.('Detecting modified components...', 70);

    // Find modified components (name or description changed)
    for (const current of currentComponents) {
        if (lastComponentIds.has(current.id)) {
            const last = lastInventory.components.find(c => c.id === current.id);
            if (last && (last.name !== current.name || last.description !== current.description)) {
                diff.modified.components.push(current);
            } else {
                diff.unchanged++;
            }
        }
    }

    // Same for variables
    diff.added.variables = currentVariables.filter(v => !lastVariableIds.has(v.id));
    diff.removed.variableIds = lastInventory.variables
        .filter(v => !currentVariableIds.has(v.id))
        .map(v => v.id);

    for (const current of currentVariables) {
        if (lastVariableIds.has(current.id)) {
            const last = lastInventory.variables.find(v => v.id === current.id);
            if (last && last.name !== current.name) {
                diff.modified.variables.push(current);
            } else {
                diff.unchanged++;
            }
        }
    }

    onProgress?.('Building updated inventory...', 90);

    // Build new inventory
    const inventory: DesignSystemInventory = {
        components: currentComponents,
        variables: currentVariables,
        fileKey: figma.fileKey || 'local',
        scannedAt: Date.now()
    };

    // Update cache
    const cacheKey = CACHE_KEY_PREFIX + inventory.fileKey;
    try {
        await figma.clientStorage.setAsync(cacheKey, inventory);
    } catch (error) {
        console.warn('Cache write failed:', error);
    }

    onProgress?.('Complete', 100);

    return { inventory, diff };
}