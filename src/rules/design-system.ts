/**
 * Design System Constants
 * Extracted from the Figma design system JSON
 * This serves as the source of truth for all design tokens
 */

export const DESIGN_SYSTEM = {
    borderRadius: {
        none: 0,
        sm: 2,
        base: 4,
        md: 6,
        lg: 8,
        xl: 12,
        '2xl': 16,
        '3xl': 24,
        full: 9999,
    },

    spacing: {
        0: 0,
        px: 1,
        0.5: 2,
        1: 4,
        1.5: 6,
        2: 8,
        2.5: 10,
        3: 12,
        3.5: 14,
        4: 16,
        4.5: 18,
        5: 20,
        6: 24,
        7: 28,
        8: 32,
        9: 36,
        10: 40,
        11: 44,
        12: 48,
        14: 56,
        16: 64,
        20: 80,
        24: 96,
        28: 112,
        32: 128,
        36: 144,
        40: 160,
        44: 176,
        48: 192,
        52: 208,
        56: 224,
        60: 240,
        64: 256,
        72: 288,
        80: 320,
        96: 384,
    },

    fontSize: {
        xs: 12,
        sm: 14,
        base: 16,
        lg: 18,
        xl: 20,
        '2xl': 24,
        '3xl': 30,
        '4xl': 36,
        '5xl': 48,
        '6xl': 60,
        '7xl': 72,
        '8xl': 96,
        '9xl': 128,
    },

    fontFamily: {
        sans: 'Geist',
        serif: 'Noto Serif',
        mono: 'Geist Mono',
    },

    fontWeight: {
        thin: 100,
        extralight: 200,
        light: 300,
        normal: 400,
        medium: 500,
        semibold: 600,
        bold: 700,
        extrabold: 800,
        black: 900,
    },

    lineHeight: {
        3: 12,
        4: 16,
        5: 20,
        6: 24,
        7: 28,
        8: 32,
        9: 36,
        10: 40,
        none: 100,
    },

    letterSpacing: {
        tighter: -0.5,
        tight: -0.025,
        normal: 0,
        wide: 0.025,
        wider: 0.05,
        widest: 0.1,
    },

    colors: {
        transparent: { r: 0, g: 0, b: 0, a: 0 },
        black: { r: 0, g: 0, b: 0, a: 1 },
        white: { r: 1, g: 1, b: 1, a: 1 },

        // Neutral
        neutral: {
            50: { r: 0.98, g: 0.98, b: 0.98, a: 1 },
            100: { r: 0.96, g: 0.96, b: 0.96, a: 1 },
            200: { r: 0.898, g: 0.898, b: 0.898, a: 1 },
            300: { r: 0.831, g: 0.831, b: 0.831, a: 1 },
            400: { r: 0.631, g: 0.631, b: 0.631, a: 1 },
            500: { r: 0.451, g: 0.451, b: 0.451, a: 1 },
            600: { r: 0.322, g: 0.322, b: 0.322, a: 1 },
            700: { r: 0.251, g: 0.251, b: 0.251, a: 1 },
            800: { r: 0.149, g: 0.149, b: 0.149, a: 1 },
            900: { r: 0.09, g: 0.09, b: 0.09, a: 1 },
            950: { r: 0.039, g: 0.039, b: 0.039, a: 1 },
        },

        // Slate
        slate: {
            50: { r: 0.973, g: 0.98, b: 0.988, a: 1 },
            100: { r: 0.945, g: 0.961, b: 0.976, a: 1 },
            200: { r: 0.886, g: 0.91, b: 0.941, a: 1 },
            300: { r: 0.792, g: 0.835, b: 0.886, a: 1 },
            400: { r: 0.565, g: 0.631, b: 0.725, a: 1 },
            500: { r: 0.384, g: 0.455, b: 0.557, a: 1 },
            600: { r: 0.271, g: 0.333, b: 0.424, a: 1 },
            700: { r: 0.192, g: 0.255, b: 0.345, a: 1 },
            800: { r: 0.114, g: 0.161, b: 0.239, a: 1 },
            900: { r: 0.059, g: 0.09, b: 0.169, a: 1 },
            950: { r: 0.008, g: 0.024, b: 0.094, a: 1 },
        },

        // Add more color scales as needed from the JSON
        // For brevity, showing pattern - full implementation would include all colors
    },
} as const;

// Helper type for accessing nested color values
export type ColorValue = { r: number; g: number; b: number; a: number };

/**
 * Maps Tailwind-style class names to design system values
 * e.g., "rounded-lg" -> DESIGN_SYSTEM.borderRadius.lg
 */
export function getTokenValue(
    category: 'spacing' | 'borderRadius' | 'fontSize',
    key: string
): number | undefined {
    return DESIGN_SYSTEM[category][key as keyof typeof DESIGN_SYSTEM[typeof category]];
}

/**
 * Maps color class names to RGBA values
 * e.g., "neutral-100" -> { r: 0.96, g: 0.96, b: 0.96, a: 1 }
 */
export function getColorValue(colorName: string): ColorValue | undefined {
    const parts = colorName.split('-');
    if (parts.length === 2) {
        const [scale, shade] = parts;
        const colorScale = DESIGN_SYSTEM.colors[scale as keyof typeof DESIGN_SYSTEM.colors];
        if (colorScale && typeof colorScale === 'object' && !('r' in colorScale)) {
            return (colorScale as any)[shade];
        }
    }
    // Handle single-word colors like "black", "white", "transparent"
    return DESIGN_SYSTEM.colors[colorName as keyof typeof DESIGN_SYSTEM.colors] as ColorValue | undefined;
}
