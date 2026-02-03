/**
 * Semantic Aliases Database
 * Maps standard/common token names to potential variable names found in design systems.
 * Used for Tier 2 Resolution (Semantic Alias Match).
 */

export const SEMANTIC_ALIASES: Record<string, string[]> = {
    // --- COLORS ---

    // Primary / Brand
    "colors/primary": [
        "brand-primary", "primary-color", "sys-color-primary", "color-primary",
        "brand-500", "blue-500", "primary-500", "brand-main", "action-primary"
    ],
    "colors/primary/foreground": [
        "primary-foreground", "on-primary", "text-on-primary", "content-on-primary",
        "brand-contrast"
    ],

    // Secondary / Accent
    "colors/secondary": [
        "brand-secondary", "secondary-color", "sys-color-secondary", "accent",
        "accent-color", "secondary-500", "purple-500"
    ],
    "colors/secondary/foreground": ["secondary-foreground", "on-secondary"],

    // State Colors
    "colors/success": ["color-success", "sys-color-success", "feedback-success", "green-500", "success-500"],
    "colors/warning": ["color-warning", "sys-color-warning", "feedback-warning", "yellow-500", "warning-500", "orange-500"],
    "colors/error": ["color-error", "sys-color-error", "feedback-error", "destructive", "red-500", "danger", "error-500"],
    "colors/info": ["color-info", "sys-color-info", "feedback-info", "blue-400", "info-500"],

    // Neutrals / Backgrounds
    "colors/background": ["sys-color-background", "bg-default", "surface-primary", "canvas", "body-bg", "white"],
    "colors/surface": ["sys-color-surface", "bg-surface", "surface-card", "panel-bg", "white"],
    "colors/foreground": ["sys-color-foreground", "text-primary", "content-primary", "black", "gray-900"],

    // Borders
    "colors/border": ["border-color", "sys-color-border", "stroke-default", "gray-200", "neutral-200"],

    // Specifc Palettes commonly used
    "colors/blue/500": ["blue-500", "brand-blue", "primary-blue"],
    "colors/slate/500": ["slate-500", "gray-500", "neutral-500"],

    // --- SPACING ---

    "spacing/0": ["space-0", "spacing-none", "0"],
    "spacing/1": ["space-1", "spacing-xs", "space-4px", "4px", "gap-xs"],
    "spacing/2": ["space-2", "spacing-sm", "space-8px", "8px", "gap-sm"],
    "spacing/3": ["space-3", "spacing-md-sm", "space-12px", "12px"],
    "spacing/4": ["space-4", "spacing-md", "space-16px", "16px", "gap-md", "gap-default"],
    "spacing/5": ["space-5", "spacing-lg-sm", "space-20px", "20px"],
    "spacing/6": ["space-6", "spacing-lg", "space-24px", "24px", "gap-lg"],
    "spacing/8": ["space-8", "spacing-xl", "space-32px", "32px", "gap-xl"],
    "spacing/10": ["space-10", "spacing-2xl", "space-40px", "40px"],
    "spacing/12": ["space-12", "spacing-3xl", "space-48px", "48px"],

    // --- RADIUS ---
    "radius/sm": ["radius-sm", "rounded-sm", "corner-sm", "2px"],
    "radius/md": ["radius-md", "rounded-md", "corner-md", "4px", "default-radius"],
    "radius/lg": ["radius-lg", "rounded-lg", "corner-lg", "8px"],
    "radius/full": ["radius-full", "rounded-full", "circle", "9999px"],

    // --- SHADOWS ---
    "shadows/sm": ["shadow-sm", "elevation-1", "depth-1"],
    "shadows/md": ["shadow-md", "elevation-2", "depth-2", "shadow-default"],
    "shadows/lg": ["shadow-lg", "elevation-3", "depth-3"],
};
