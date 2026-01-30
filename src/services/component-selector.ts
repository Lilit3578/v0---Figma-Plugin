/**
 * Smart component selection based on semantic matching
 */

import { ComponentInfo, DesignSystemInventory } from './auto-discovery';

interface ComponentScore {
    component: ComponentInfo;
    score: number;
    matchReasons: string[];
}

export interface SelectionResult {
    selected: ComponentInfo[];
    excluded: number;
    selectionStrategy: string;
    topScores?: ComponentScore[];  // For debugging
}

export class ComponentSelector {
    /**
     * Extract keywords from user intent
     */
    private extractKeywords(intent: string): string[] {
        // Remove common stop words
        const stopWords = new Set([
            'the', 'a', 'an', 'with', 'for', 'create', 'make', 'add', 'and', 'or',
            'design', 'page', 'screen', 'view', 'using', 'that', 'has', 'have'
        ]);

        const words = intent.toLowerCase()
            .split(/\s+/)
            .filter(w => w.length > 2 && !stopWords.has(w));

        return [...new Set(words)]; // Unique keywords
    }

    /**
     * Calculate semantic similarity between intent and component
     */
    private calculateSimilarity(
        keywords: string[],
        component: ComponentInfo
    ): ComponentScore {
        let score = 0;
        const matchReasons: string[] = [];

        const componentName = component.name.toLowerCase();
        const componentDesc = (component.description || '').toLowerCase();
        const semanticType = component.semanticType || 'unknown';

        // Exact keyword matches in name (highest priority)
        for (const keyword of keywords) {
            if (componentName.includes(keyword)) {
                score += 10;
                matchReasons.push(`Name contains "${keyword}"`);
            }
        }

        // Keyword matches in description
        for (const keyword of keywords) {
            if (componentDesc.includes(keyword)) {
                score += 5;
                matchReasons.push(`Description contains "${keyword}"`);
            }
        }

        // Semantic type matches
        for (const keyword of keywords) {
            if (keyword === semanticType || semanticType.includes(keyword)) {
                score += 8;
                matchReasons.push(`Semantic type match: ${semanticType}`);
            }
        }

        // Common semantic type keywords
        const semanticKeywords: Record<string, string[]> = {
            'button': ['button', 'btn', 'submit', 'cta', 'action'],
            'input': ['input', 'field', 'textfield', 'text', 'email', 'password', 'name', 'form'],
            'checkbox': ['checkbox', 'check', 'agree', 'terms', 'consent', 'toggle'],
            'card': ['card', 'container', 'box', 'panel'],
            'text': ['text', 'label', 'heading', 'title', 'paragraph']
        };

        if (semanticType !== 'unknown' && semanticKeywords[semanticType]) {
            for (const keyword of keywords) {
                if (semanticKeywords[semanticType].includes(keyword)) {
                    score += 7;
                    matchReasons.push(`Keyword "${keyword}" matches ${semanticType} type`);
                }
            }
        }

        // Boost for components with descriptions (better documented)
        if (component.description && component.description.length > 10) {
            score += 2;
            matchReasons.push('Has detailed description');
        }

        // Boost for component sets (have variants, more flexible)
        if (component.type === 'COMPONENT_SET') {
            score += 3;
            matchReasons.push('Component set with variants');
        }

        return { component, score, matchReasons };
    }

    /**
     * Select most relevant components for user intent
     */
    selectComponents(
        intent: string,
        inventory: DesignSystemInventory,
        maxComponents: number = 20
    ): SelectionResult {
        const keywords = this.extractKeywords(intent);

        console.log(`Selecting components for intent: "${intent}"`);
        console.log(`Extracted keywords: ${keywords.join(', ')}`);

        // Score all components
        const scored = inventory.components.map(c =>
            this.calculateSimilarity(keywords, c)
        );

        // Sort by score (descending)
        scored.sort((a, b) => b.score - a.score);

        // Log top scores for debugging
        const topScores = scored.slice(0, 5);
        console.log('Top 5 component matches:');
        topScores.forEach((s, i) => {
            console.log(`  ${i + 1}. ${s.component.name} (score: ${s.score}) - ${s.matchReasons.join(', ')}`);
        });

        // Select top N with score > 0
        const selectedWithScore = scored
            .filter(s => s.score > 0)
            .slice(0, maxComponents);

        // If no components scored above 0, use fallback
        if (selectedWithScore.length === 0) {
            console.warn('No components matched intent, using alphabetical fallback');

            // Fallback: include first 10 components alphabetically
            const fallback = inventory.components
                .sort((a, b) => a.name.localeCompare(b.name))
                .slice(0, Math.min(10, inventory.components.length));

            return {
                selected: fallback,
                excluded: inventory.components.length - fallback.length,
                selectionStrategy: 'fallback-alphabetical',
                topScores: scored.slice(0, 5)
            };
        }

        const selected = selectedWithScore.map(s => s.component);

        console.log(`Selected ${selected.length} components (excluded ${inventory.components.length - selected.length})`);

        return {
            selected,
            excluded: inventory.components.length - selected.length,
            selectionStrategy: 'semantic-matching',
            topScores: selectedWithScore.slice(0, 5)
        };
    }
}

// Singleton instance
export const componentSelector = new ComponentSelector();
