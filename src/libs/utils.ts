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
        // Assume it's already {r, g, b} but ensure 0-1 range if they are 0-255
        const r = color.r > 1 ? color.r / 255 : color.r;
        const g = color.g > 1 ? color.g / 255 : color.g;
        const b = color.b > 1 ? color.b / 255 : color.b;

        return {
            r: Math.max(0, Math.min(1, r)),
            g: Math.max(0, Math.min(1, g)),
            b: Math.max(0, Math.min(1, b))
        };
    }

    return { r: 0, g: 0, b: 0 };
}
