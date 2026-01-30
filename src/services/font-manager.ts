/**
 * Font management utilities for dynamic font loading and fallbacks
 */

import { DesignSystemInventory } from '../services/auto-discovery';

export class FontManager {
    private loadedFonts: Set<string> = new Set();
    private fallbackChain: FontName[] = [
        { family: 'Inter', style: 'Regular' },
        { family: 'Roboto', style: 'Regular' },
        { family: 'Arial', style: 'Regular' }
    ];

    /**
     * Get the default font from design system or use fallback
     */
    async getDefaultFont(inventory?: DesignSystemInventory): Promise<FontName> {
        // Try to detect fonts from design system
        if (inventory) {
            const detectedFonts = this.detectFontsFromDesignSystem(inventory);
            if (detectedFonts.length > 0) {
                // Try to load the most common font
                const font = detectedFonts[0];
                try {
                    await figma.loadFontAsync(font);
                    return font;
                } catch (error) {
                    console.warn(`Could not load detected font ${font.family}, using fallback`);
                }
            }
        }

        // Use fallback chain
        return this.loadFontWithFallback(this.fallbackChain[0]);
    }

    /**
     * Load a font with fallback support
     */
    async loadFontWithFallback(font: FontName): Promise<FontName> {
        const fontKey = `${font.family}-${font.style}`;

        // Check if already loaded
        if (this.loadedFonts.has(fontKey)) {
            return font;
        }

        // Try to load the requested font
        try {
            await figma.loadFontAsync(font);
            this.loadedFonts.add(fontKey);
            console.log(`Loaded font: ${font.family} ${font.style}`);
            return font;
        } catch (error) {
            console.warn(`Failed to load font ${font.family} ${font.style}:`, error);

            // Try fallback chain
            for (const fallback of this.fallbackChain) {
                if (fallback.family === font.family) continue; // Skip the one we just tried

                try {
                    await figma.loadFontAsync(fallback);
                    this.loadedFonts.add(`${fallback.family}-${fallback.style}`);
                    console.log(`Using fallback font: ${fallback.family} ${fallback.style}`);
                    return fallback;
                } catch (fallbackError) {
                    console.warn(`Fallback ${fallback.family} also failed`);
                }
            }

            // Last resort: throw error
            throw new Error(`Unable to load font ${font.family} or any fallback fonts`);
        }
    }

    /**
     * Detect fonts used in the design system
     */
    detectFontsFromDesignSystem(inventory: DesignSystemInventory): FontName[] {
        const fontMap = new Map<string, number>(); // font key -> usage count

        // Scan all components for text nodes
        // Note: This is a simplified version - in reality, we'd need to traverse
        // component trees to find text nodes, which requires async access to components

        // For now, we'll return common design system fonts
        // In a full implementation, you'd scan actual component content
        const commonFonts: FontName[] = [
            { family: 'Inter', style: 'Regular' },
            { family: 'Inter', style: 'Medium' },
            { family: 'Inter', style: 'Bold' },
            { family: 'Roboto', style: 'Regular' },
            { family: 'SF Pro', style: 'Regular' },
            { family: 'Helvetica', style: 'Regular' }
        ];

        return commonFonts;
    }

    /**
     * Pre-load multiple fonts in parallel
     */
    async preloadFonts(fonts: FontName[]): Promise<void> {
        const loadPromises = fonts.map(font =>
            this.loadFontWithFallback(font).catch(error => {
                console.warn(`Failed to preload font ${font.family}:`, error);
            })
        );

        await Promise.all(loadPromises);
    }

    /**
     * Get font from RSNT node or use default
     */
    async getFontForNode(
        fontFamily?: string,
        fontStyle?: string,
        inventory?: DesignSystemInventory
    ): Promise<FontName> {
        // If font is specified in node, use it
        if (fontFamily) {
            const font: FontName = {
                family: fontFamily,
                style: fontStyle || 'Regular'
            };

            try {
                return await this.loadFontWithFallback(font);
            } catch (error) {
                console.warn(`Could not load specified font ${fontFamily}, using default`);
            }
        }

        // Otherwise use default
        return this.getDefaultFont(inventory);
    }
}

// Singleton instance
export const fontManager = new FontManager();
