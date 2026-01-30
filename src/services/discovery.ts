/**
 * Component Discovery Service
 * Scans the Figma file for existing components and caches the inventory.
 */

export interface ComponentMetadata {
    id: string;
    name: string;
    type: 'COMPONENT' | 'COMPONENT_SET';
    hasVariants: boolean;
    variantProperties?: string[];
}

export interface ComponentInventory {
    components: ComponentMetadata[];
    suggestedMappings: Record<string, string>;
    lastScanned: number;
    fileId: string;
}

const INVENTORY_STORAGE_KEY = 'component-inventory';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Common naming patterns for automatic mapping.
 */
const ROLE_PATTERNS: Record<string, string[]> = {
    'PrimaryButton': ['primary button', 'button/primary', 'button-primary', 'btn-primary'],
    'SecondaryButton': ['secondary button', 'button/secondary', 'button-secondary', 'btn-secondary'],
    'GhostButton': ['ghost button', 'button/ghost', 'button-ghost', 'btn-ghost'],
    'Input': ['input', 'form/input', 'text field', 'input field'],
    'Card': ['card', 'container/card', 'card/default', 'card/base'],
    'Heading': ['heading', 'title', 'h1', 'h2'],
    'Paragraph': ['paragraph', 'body', 'text/body', 'description'],
};

/**
 * Scans the current Figma file for all components and component sets.
 */
export async function discoverComponents(): Promise<ComponentInventory> {
    const fileId = figma.fileKey || 'local-file';

    // Find all components and component sets (NOT text styles or other nodes)
    const allNodes = figma.root.findAll(node =>
        node.type === 'COMPONENT' || node.type === 'COMPONENT_SET'
    );

    // Filter to only actual components
    const componentNodes = allNodes.filter(node => {
        return (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') &&
            !node.name.includes('text=') &&
            !node.name.includes('font=') &&
            !node.name.includes('weight=');
    }) as (ComponentNode | ComponentSetNode)[];

    const components: ComponentMetadata[] = componentNodes.map(node => {
        const isComponentSet = node.type === 'COMPONENT_SET';
        return {
            id: node.id,
            name: node.name,
            type: node.type as 'COMPONENT' | 'COMPONENT_SET',
            hasVariants: isComponentSet,
            variantProperties: isComponentSet ? Object.keys((node as ComponentSetNode).variantGroupProperties) : undefined
        };
    });

    // Auto-discovery logic for suggested mappings
    const suggestedMappings: Record<string, string> = {};
    for (const [role, patterns] of Object.entries(ROLE_PATTERNS)) {
        const match = componentNodes.find(node => {
            const lowerName = node.name.toLowerCase();
            return patterns.some(pattern => lowerName.includes(pattern));
        });
        if (match) {
            suggestedMappings[role] = match.id;  // Correct: role → componentId
        }
    }

    const inventory: ComponentInventory = {
        components,
        suggestedMappings,
        lastScanned: Date.now(),
        fileId
    };

    // Cache the results
    await figma.clientStorage.setAsync(INVENTORY_STORAGE_KEY, inventory);

    return inventory;
}

/**
 * Retrieves the cached inventory if it exists and is not expired.
 */
export async function getCachedInventory(): Promise<ComponentInventory | null> {
    try {
        const cached = await figma.clientStorage.getAsync(INVENTORY_STORAGE_KEY) as ComponentInventory;

        if (!cached) return null;

        const isExpired = (Date.now() - cached.lastScanned) > CACHE_TTL;
        const isDifferentFile = cached.fileId !== figma.fileKey;

        if (isExpired || isDifferentFile) {
            // Clear cache if invalid
            await figma.clientStorage.setAsync(INVENTORY_STORAGE_KEY, null);
            return null;
        }

        return cached;
    } catch (error) {
        console.error('Error reading cached inventory:', error);
        return null;
    }
}

/**
 * Forces a refresh of the component inventory.
 */
export async function refreshInventory(): Promise<ComponentInventory> {
    return await discoverComponents();
}
