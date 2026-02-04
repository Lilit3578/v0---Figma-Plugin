import { RSNT_Node } from '../types/rsnt';
import { ResolutionResult, ExecutionInstructions } from '../types/resolution-types';
import { TAILWIND_DEFAULTS, getTailwindSpacing, getTailwindColor, getTailwindRadius } from '../constants/tailwind-defaults';
import { DesignSystemInventory, ComponentInfo } from './auto-discovery';
import { normalizeColor } from '../libs/color-utils';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type ConflictSourceType = 'component' | 'preset' | 'ai' | 'system';

export interface ConflictSource {
    source: ConflictSourceType;
    value: any;
    priority: 1 | 2 | 3 | 4; // 1 is highest
    formattedValue?: string; // For display
}

export interface Conflict {
    property: string;
    sources: ConflictSource[];
    winner: ConflictSource;
    reason: string;
}

export interface PresetConfig {
    name: string;
    values: Record<string, any>; // prop -> value
}

export type ConflictLog = {
    nodeId: string;
    nodeName?: string;
    conflicts: Conflict[];
};

// ============================================================================
// PRIORITY CONSTANTS
// ============================================================================

const PRIORITY = {
    COMPONENT: 1 as const,
    PRESET: 2 as const,
    AI: 3 as const,
    SYSTEM: 4 as const
};

// ============================================================================
// CORE LOGIC
// ============================================================================

/**
 * Orchestrate conflict resolution for a single node
 */
export async function resolveAllConflicts(
    node: RSNT_Node,
    resolution: ResolutionResult,
    inventory: DesignSystemInventory,
    preset?: PresetConfig
): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];

    // Properties to check
    const propertiesToCheck = [
        'height',
        'width',
        'padding',
        'itemSpacing',
        'fill',
        'stroke',
        'cornerRadius',
        'fontSize'
    ];

    for (const prop of propertiesToCheck) {
        const sources = collectPropertySources(prop, node, resolution, inventory, preset);

        if (detectConflicts(sources)) {
            const resolved = resolveConflict(prop, sources, preset?.name);
            conflicts.push(resolved);
        }
    }

    // Log for debugging
    if (conflicts.length > 0) {
        console.log(`[Conflict] Found ${conflicts.length} conflicts for node ${node.name || node.id}`);
    }

    return conflicts;
}

/**
 * Collect values from all available sources for a property
 */
export function collectPropertySources(
    property: string,
    node: RSNT_Node,
    resolution: ResolutionResult,
    inventory: DesignSystemInventory,
    preset?: PresetConfig
): ConflictSource[] {
    const sources: ConflictSource[] = [];

    // 1. Component Source (Priority 1)
    // Only available if we are instantiating a component (Tier 1 or Tier 2)
    if (resolution.instructions.type === 'INSTANTIATE_COMPONENT') {
        const componentId = resolution.instructions.componentId;
        const component = inventory.components.find(c => c.id === componentId);

        if (component) {
            const componentValue = getComponentValue(component, property);
            if (componentValue !== undefined) {
                sources.push({
                    source: 'component',
                    value: componentValue,
                    priority: PRIORITY.COMPONENT,
                    formattedValue: formatValue(componentValue)
                });
            }
        }
    }

    // 2. Preset Source (Priority 2)
    if (preset && preset.values[property] !== undefined) {
        sources.push({
            source: 'preset',
            value: preset.values[property],
            priority: PRIORITY.PRESET,
            formattedValue: formatValue(preset.values[property])
        });
    }

    // 3. AI Source (Priority 3)
    // From RSNT node description/classes
    const aiValue = getAIValue(node, property);
    if (aiValue !== undefined) {
        sources.push({
            source: 'ai',
            value: aiValue,
            priority: PRIORITY.AI,
            formattedValue: formatValue(aiValue)
        });
    }

    // 4. System Default (Priority 4)
    const systemValue = getSystemDefault(property);
    if (systemValue !== undefined) {
        sources.push({
            source: 'system',
            value: systemValue,
            priority: PRIORITY.SYSTEM,
            formattedValue: formatValue(systemValue)
        });
    }

    return sources;
}

/**
 * Detect if there is an actual conflict (more than 1 unique value)
 */
export function detectConflicts(sources: ConflictSource[]): boolean {
    if (sources.length <= 1) return false;

    // Get unique values (using JSON stringify for object comparison)
    const uniqueValues = new Set(sources.map(s => JSON.stringify(s.value)));

    return uniqueValues.size > 1;
}

/**
 * Resolve conflict by picking the winner based on priority
 */
export function resolveConflict(
    property: string,
    sources: ConflictSource[],
    presetName?: string
): Conflict {
    // Sort by priority (ascending: 1 is top)
    const sorted = [...sources].sort((a, b) => a.priority - b.priority);
    const winner = sorted[0];

    // Generate reason
    let reason = '';
    switch (winner.source) {
        case 'component':
            reason = "Component internal logic takes precedence to preserve accessibility and brand standards";
            break;
        case 'preset':
            reason = `Preset convention takes precedence (you selected ${presetName || 'Preset'})`;
            break;
        case 'ai':
            reason = "AI judgment used (no component or preset value specified)";
            break;
        case 'system':
            reason = "System default used (no design system values available)";
            break;
    }

    return {
        property,
        sources,
        winner,
        reason
    };
}

/**
 * Apply resolved values to instructions
 * This modifies the instructions object in place
 */
export function applyResolutionToInstructions(
    instructions: ExecutionInstructions,
    conflicts: Conflict[]
) {
    for (const conflict of conflicts) {
        const { property, winner } = conflict;
        const val = winner.value;

        // Apply based on property map
        // This mapping needs to be robust for all supported props
        if (property === 'height') {
            // Apply to frame size or component override??
            // For components, we usually can't force height easily unless it's a prop or auto-layout resize.
            // For frames, we set height.
            if (instructions.type === 'CREATE_FRAME') {
                // instructions.height is not on interface but sizing is in execution logic
                // We'll need to handle this via styling instructions or modifying the underlying RSNT logic
                // The current ExecutionInstructions for frame has dimensions implicit in rsnt usually?
                // Actually ExecutionInstructions doesn't explicitly have width/height for Frame,
                // it relies on RSNT node prop passed to executeFrameInstructions. 
                // But we want to OVERRIDE.
                // We might need to extend ExecutionInstructions to support explicit dimensions overrides
                // OR we accept that we can't easily change it here without refactoring.
                // Let's modify styling instructions where possible.
            }
        }

        if (instructions.type === 'CREATE_FRAME') {
            const style = instructions.styling;

            if (property === 'padding') {
                if (typeof val === 'number') {
                    style.padding = { top: val, right: val, bottom: val, left: val };
                } else if (typeof val === 'object') {
                    style.padding = val;
                }
            } else if (property === 'fill' && Array.isArray(val)) {
                style.fills = val;
            } else if (property === 'cornerRadius' && typeof val === 'number') {
                style.cornerRadius = val;
            }
        } else if (instructions.type === 'INSTANTIATE_COMPONENT') {
            // For components, we apply overrides
            if (!instructions.overrides) instructions.overrides = {};

            if (property === 'padding') {
                if (typeof val === 'number') {
                    instructions.overrides.padding = { top: val, right: val, bottom: val, left: val };
                } else if (typeof val === 'object') {
                    instructions.overrides.padding = val;
                }
            }
            // Add other overrides as needed
        }
    }
}


// ============================================================================
// HELPERS
// ============================================================================

function getComponentValue(component: ComponentInfo, property: string): any | undefined {
    if (!component.anatomy) return undefined;

    const info = component.anatomy;

    switch (property) {
        case 'height':
            return info.dimensionInfo?.height;
        case 'width':
            return info.dimensionInfo?.width;
        case 'padding':
            // Logic to extract padding from anatomy or layoutInfo
            // simplified:
            return undefined; // We often don't store exact padding in anatomy yet
        // Add more extractions
    }
    return undefined;
}

function getAIValue(node: RSNT_Node, property: string): any | undefined {
    // 1. Check direct properties
    if (property === 'height' && node.height) return node.height;
    if (property === 'width' && node.width) return node.width;

    // 2. Check tailwind classes
    if (node.tailwindClasses) {
        for (const cls of node.tailwindClasses) {
            if (property === 'padding') {
                const p = getTailwindSpacing(cls);
                if (p !== null) return p; // Returns number
            }
            if (property === 'fill' && cls.startsWith('bg-')) {
                const c = getTailwindColor(cls);
                if (c) return [{ type: 'SOLID', color: normalizeColor(c) }];
            }
            if (property === 'cornerRadius') {
                const r = getTailwindRadius(cls);
                if (r !== null) return r;
            }
            // Height/Width from tailwind (h-10 -> 40px)
            if (property === 'height' && cls.startsWith('h-')) {
                const h = getTailwindSpacing(cls);
                if (h !== null) return h;
            }
        }
    }
    return undefined;
}

function getSystemDefault(property: string): any | undefined {
    switch (property) {
        case 'padding': return TAILWIND_DEFAULTS.spacing['4'];
        case 'cornerRadius': return TAILWIND_DEFAULTS.borderRadius['DEFAULT'];
        case 'fontSize': return TAILWIND_DEFAULTS.fontSize['base'];
        case 'fill': return [{ type: 'SOLID', color: normalizeColor(TAILWIND_DEFAULTS.colors['blue-500']) }];
        // Add more defaults
    }
    return undefined;
}

function formatValue(val: any): string {
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
}
