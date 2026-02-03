import { DESIGN_SYSTEM, getColorValue, getTokenValue, ColorValue } from '../rules/design-system';

/**
 * Variable resolution helpers
 * Maps design tokens to Figma variables
 */

/**
 * Find a Figma variable by name
 */
export function findVariableByName(name: string): Variable | null {
    const localVariables = figma.variables.getLocalVariables();

    for (const variable of localVariables) {
        if (variable.name === name) {
            return variable;
        }
    }

    return null;
}

/**
 * Resolve border radius from class name (e.g., "rounded-lg")
 * Returns either a Variable binding or the numeric value
 */
export function resolveBorderRadius(className: string): number | Variable | null {
    // Extract the size token (e.g., "lg" from "rounded-lg")
    const match = className.match(/^rounded-(.+)$/);
    if (!match) {
        if (className === 'rounded') {
            const size = 'base';
            const variableName = `rounded/${size}`;
            const variable = findVariableByName(variableName);
            return variable || DESIGN_SYSTEM.borderRadius[size];
        }
        return null;
    }

    const size = match[1];

    // Try to find Figma variable first
    const variableName = `rounded/${size}`;
    const variable = findVariableByName(variableName);

    if (variable) {
        return variable;
    }

    // Fallback to design system value
    return getTokenValue('borderRadius', size) || null;
}

/**
 * Resolve spacing from class name (e.g., "p-4", "gap-2", "w-12")
 * Returns either a Variable binding or the numeric value
 */
export function resolveSpacing(className: string, type: 'p' | 'gap' | 'size'): number | Variable | null {
    // Extract the value (e.g., "4" from "p-4" or "2" from "gap-2")
    const match = className.match(/\d+\.?\d*/);
    if (!match) return null;

    const value = match[0];

    // Try to find Figma variable first
    const variableName = `${type}/${value}`;
    const variable = findVariableByName(variableName);

    if (variable) {
        return variable;
    }

    // Fallback to design system value
    return getTokenValue('spacing', value) || null;
}

/**
 * Resolve color from class name (e.g., "bg-neutral-100", "text-slate-500")
 * Returns either a Variable binding or the RGBA value
 */
export function resolveColor(className: string): { variable?: Variable; color?: ColorValue } | null {
    // Extract color name (e.g., "neutral-100" from "bg-neutral-100")
    const match = className.match(/(?:bg|text|border)-(.+)$/);
    if (!match) return null;

    const colorName = match[1];

    // Try to find Figma variable first
    // Variable naming: "tailwind/neutral/100" or "custom/xxx/xxx"
    const parts = colorName.split('-');
    let variableName: string;

    if (parts.length >= 2) {
        // e.g., "neutral-100" -> "tailwind/neutral/100"
        variableName = `tailwind/${parts[0]}/${parts[1]}`;
    } else {
        // Single word colors like "black", "white"
        variableName = colorName;
    }

    const variable = findVariableByName(variableName);

    if (variable) {
        return { variable };
    }

    // Fallback to design system value
    const colorValue = getColorValue(colorName);
    if (colorValue) {
        return { color: colorValue };
    }

    return null;
}

/**
 * Resolve font size from class name (e.g., "text-xl", "text-2xl")
 */
export function resolveFontSize(className: string): number | Variable | null {
    const match = className.match(/^text-(.+)$/);
    if (!match) return null;

    const size = match[1];

    // Try to find Figma variable
    const variableName = `text/${size}`;
    const variable = findVariableByName(variableName);

    if (variable) {
        return variable;
    }

    // Fallback to design system
    return getTokenValue('fontSize', size) || null;
}
