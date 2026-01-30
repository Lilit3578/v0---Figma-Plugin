/**
 * Convert hex color string to Figma RGB color object (0-1 range)
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
    // Remove the hash if it's there
    hex = hex.replace(/^#/, '');

    // Parse hexadecimal values
    let r = 0, g = 0, b = 0;

    if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
    }

    // Convert to 0-1 range
    return {
        r: Math.max(0, Math.min(1, r / 255)),
        g: Math.max(0, Math.min(1, g / 255)),
        b: Math.max(0, Math.min(1, b / 255))
    };
}

/**
 * Handle different color input formats (hex or object) and return Figma RGB
 */
export function normalizeColor(color: any): { r: number; g: number; b: number } {
    if (typeof color === 'string') {
        return hexToRgb(color);
    }

    if (typeof color === 'object' && color !== null) {
        // Check if r, g, b exist and are numbers
        const r = typeof color.r === 'number' ? (color.r > 1 ? color.r / 255 : color.r) : 0;
        const g = typeof color.g === 'number' ? (color.g > 1 ? color.g / 255 : color.g) : 0;
        const b = typeof color.b === 'number' ? (color.b > 1 ? color.b / 255 : color.b) : 0;

        // Ensure values are valid numbers in 0-1 range
        return {
            r: isNaN(r) ? 0 : Math.max(0, Math.min(1, r)),
            g: isNaN(g) ? 0 : Math.max(0, Math.min(1, g)),
            b: isNaN(b) ? 0 : Math.max(0, Math.min(1, b))
        };
    }

    // Fallback to black
    return { r: 0, g: 0, b: 0 };
}