/**
 * Color utility functions for Variable Resolution System
 * Implements RGB <-> XYZ <-> CIELAB conversions and Delta E calculation
 */

export interface RGB {
    r: number;
    g: number;
    b: number;
}

export interface XYZ {
    x: number;
    y: number;
    z: number;
}

export interface LAB {
    l: number;
    a: number;
    b: number;
}

/**
 * Convert sRGB to XYZ color space
 * Assumes r, g, b are in range [0, 1]
 * Uses D65 white point
 */
export function rgbToXYZ({ r, g, b }: RGB): XYZ {
    // Inverse Gamma Compounding
    const pivot = (val: number) => {
        return val > 0.04045
            ? Math.pow((val + 0.055) / 1.055, 2.4)
            : val / 12.92;
    };

    const rL = pivot(r);
    const gL = pivot(g);
    const bL = pivot(b);

    // Convert to XYZ
    // Matrix for sRGB D65 2 degree observer
    const x = rL * 0.4124 + gL * 0.3576 + bL * 0.1805;
    const y = rL * 0.2126 + gL * 0.7152 + bL * 0.0722;
    const z = rL * 0.0193 + gL * 0.1192 + bL * 0.9505;

    // Scale by 100 for standard XYZ range
    return { x: x * 100, y: y * 100, z: z * 100 };
}

/**
 * Convert XYZ to CIELAB color space
 * Uses D65 reference white
 */
export function xyzToCIELAB({ x, y, z }: XYZ): LAB {
    // Reference White (D65 standard)
    const refX = 95.047;
    const refY = 100.000;
    const refZ = 108.883;

    const pivot = (val: number) => {
        return val > 0.008856
            ? Math.pow(val, 1 / 3)
            : (7.787 * val) + (16 / 116);
    };

    const xVal = pivot(x / refX);
    const yVal = pivot(y / refY);
    const zVal = pivot(z / refZ);

    const l = (116 * yVal) - 16;
    const a = 500 * (xVal - yVal);
    const b = 200 * (yVal - zVal);

    return { l, a, b };
}

/**
 * Helper: Convert RGB directly to CIELAB
 */
export function rgbToCIELAB(rgb: RGB): LAB {
    return xyzToCIELAB(rgbToXYZ(rgb));
}

/**
 * Calculate Delta E (CIE76) between two LAB colors
 * Represents perceptual difference
 * < 1.0 is barely perceptible
 * < 2.3 is JND (Just Noticeable Difference)
 */
export function calculateDeltaE(lab1: LAB, lab2: LAB): number {
    const dL = lab1.l - lab2.l;
    const da = lab1.a - lab2.a;
    const db = lab1.b - lab2.b;

    return Math.sqrt(dL * dL + da * da + db * db);
}

/**
 * Convert Hex string to RGB
 * Supports #RRGGBB and #RGB
 */
export function hexToRGB(hex: string): RGB {
    // Remove hash
    hex = hex.replace(/^#/, '');

    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }

    const num = parseInt(hex, 16);

    return {
        r: ((num >> 16) & 255) / 255,
        g: ((num >> 8) & 255) / 255,
        b: (num & 255) / 255
    };
}

/**
 * Convert RGB to Hex string
 * Assumes r, g, b are in range [0, 1]
 */
export function rgbToHex({ r, g, b }: RGB): string {
    const toHex = (val: number): string => {
        const clamped = Math.max(0, Math.min(1, val));
        const int = Math.round(clamped * 255);
        return int.toString(16).padStart(2, '0');
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}


/**
 * Handle different color input formats (hex or object) and return Figma RGB
 * Normalizes colors from various sources to the standard 0-1 range
 */
export function normalizeColor(color: any): { r: number; g: number; b: number } {
    if (typeof color === 'string') {
        return hexToRGB(color);
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
