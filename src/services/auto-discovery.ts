/**
 * Automatic Design System Discovery
 * Scans the current Figma file and builds an inventory
 */

export interface ComponentInfo {
    id: string;
    name: string;
    type: 'COMPONENT' | 'COMPONENT_SET';
    description?: string;
    variantProperties?: Record<string, { values: string[] }>;
    inferredPurpose?: string; // Set by AI
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
}

const CACHE_KEY_PREFIX = 'inventory-';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

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
            description: component.description || undefined
        };

        // If it's a component set, extract variant properties
        if (component.type === 'COMPONENT_SET') {
            const variantProps: Record<string, { values: string[] }> = {};

            Object.entries(component.componentPropertyDefinitions).forEach(([key, def]) => {
                if (def.type === 'VARIANT') {
                    variantProps[key] = {
                        values: def.variantOptions || []
                    };
                }
            });

            info.variantProperties = variantProps;
        }

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
export async function getOrDiscoverInventory(): Promise<DesignSystemInventory> {
    const fileKey = figma.fileKey || 'local';
    const cacheKey = CACHE_KEY_PREFIX + fileKey;

    // Try cache first
    try {
        const cached = await figma.clientStorage.getAsync(cacheKey) as DesignSystemInventory | null;

        if (cached && (Date.now() - cached.scannedAt) < CACHE_TTL) {
            console.log('Using cached inventory');
            return cached;
        }
    } catch (error) {
        console.warn('Cache read failed:', error);
    }

    // Perform fresh discovery
    console.log('Performing fresh discovery...');
    const inventory: DesignSystemInventory = {
        components: discoverComponents(),
        variables: discoverVariables(),
        fileKey: fileKey,
        scannedAt: Date.now()
    };

    // Cache the result
    try {
        await figma.clientStorage.setAsync(cacheKey, inventory);
    } catch (error) {
        console.warn('Cache write failed:', error);
    }

    return inventory;
}

/**
 * Force refresh the inventory
 */
export async function refreshInventory(): Promise<DesignSystemInventory> {
    const fileKey = figma.fileKey || 'local';
    const cacheKey = CACHE_KEY_PREFIX + fileKey;

    // Clear cache
    await figma.clientStorage.deleteAsync(cacheKey);

    // Rediscover
    return getOrDiscoverInventory();
}