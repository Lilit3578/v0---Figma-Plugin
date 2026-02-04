import {
    ResolutionLogEntry,
    ResolutionSummary,
    WarningCategory,
    WarningSeverity,
    DetailedWarning,
    Tier,
    ResolutionStats,
} from '../types/resolution-types';

export class ResolutionTracker {
    private log: ResolutionLogEntry[] = [];
    private startTime: number = Date.now();

    reset() {
        this.log = [];
        this.startTime = Date.now();
    }

    record(entry: ResolutionLogEntry) {
        this.log.push(entry);
    }

    getLog(): ResolutionLogEntry[] {
        return this.log;
    }

    createCategorizedWarning(message: string, tier: Tier, nodeId?: string): DetailedWarning {
        let category = WarningCategory.COMPONENT_MAPPING;
        let severity = WarningSeverity.INFO;

        if (tier === 1 || tier === 2) {
            severity = WarningSeverity.INFO;
            category = WarningCategory.COMPONENT_MAPPING;
            if (message.includes('property') || message.includes('mapped')) {
                category = WarningCategory.COMPONENT_MAPPING;
            }
        } else if (tier === 3) {
            severity = WarningSeverity.WARNING;
            category = WarningCategory.VARIABLE_RESOLUTION;
        } else if (tier === 4) {
            severity = WarningSeverity.WARNING;
            category = WarningCategory.APPROXIMATION;
        } else if (tier === 5) {
            severity = WarningSeverity.CRITICAL;
            category = WarningCategory.SYSTEM_DEFAULT;
        }

        // Keyword based overrides
        if (message.toLowerCase().includes('approx')) category = WarningCategory.APPROXIMATION;
        if (message.toLowerCase().includes('variable') || message.toLowerCase().includes('token')) category = WarningCategory.VARIABLE_RESOLUTION;
        if (message.toLowerCase().includes('default')) category = WarningCategory.SYSTEM_DEFAULT;

        return {
            message,
            category,
            severity,
            tier,
            nodeId
        };
    }

    createSummary(): ResolutionSummary {
        const totalNodes = this.log.length;
        const stats: ResolutionStats = {
            tierCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
            averageConfidence: 0,
            tier1Percentage: 0,
            lowestConfidence: 1,
            totalWarnings: 0,
            warningCounts: {
                [WarningCategory.COMPONENT_MAPPING]: 0,
                [WarningCategory.VARIABLE_RESOLUTION]: 0,
                [WarningCategory.APPROXIMATION]: 0,
                [WarningCategory.SYSTEM_DEFAULT]: 0,
            },
        };

        let totalConfidence = 0;
        const allWarnings: DetailedWarning[] = [];

        this.log.forEach(entry => {
            stats.tierCounts[entry.tier]++;
            totalConfidence += entry.confidence;
            if (entry.confidence < stats.lowestConfidence) stats.lowestConfidence = entry.confidence;

            entry.warnings.forEach(w => {
                allWarnings.push(w);
                stats.warningCounts[w.category]++;
                stats.totalWarnings++;
            });
        });

        if (totalNodes > 0) {
            stats.averageConfidence = totalConfidence / totalNodes;
            stats.tier1Percentage = (stats.tierCounts[1] / totalNodes) * 100;
        } else {
            stats.lowestConfidence = 0;
        }

        // Determine Quality
        let quality: ResolutionSummary['quality'] = 'Good';
        if (stats.averageConfidence > 0.9) quality = 'Excellent';
        else if (stats.averageConfidence < 0.6) quality = 'Poor';
        else if (stats.averageConfidence < 0.75) quality = 'Fair';

        // Group warnings for summary
        const categorizedWarnings: ResolutionSummary['warnings']['categorized'] = [];
        Object.values(WarningCategory).forEach(cat => {
            const catWarnings = allWarnings.filter(w => w.category === cat);
            if (catWarnings.length > 0) {
                // Get unique messages as examples
                const examples = Array.from(new Set(catWarnings.map(w => w.message))).slice(0, 3);
                categorizedWarnings.push({
                    category: cat,
                    count: stats.warningCounts[cat],
                    examples
                });
            }
        });

        // Generate Recommendations
        const recommendations: string[] = [];
        if (stats.tierCounts[5] > 0) {
            recommendations.push("Add design tokens (variables) to avoid using defaults");
        }
        if (stats.tierCounts[4] > 5) {
            recommendations.push("Consider adding more semantic variables");
        }
        if (stats.tier1Percentage < 50) {
            recommendations.push("Add components to library for better consistency");
        }
        if (stats.averageConfidence < 0.6) {
            recommendations.push("Review generated design - low confidence overall");
        }
        // Add specific recommendations based on warning types? (e.g. "Add 'secondary' button variant") 
        // This requires parsing the warning messages which might be too specific for now, 
        // but the requirement example suggests: 'Consider adding "secondary" and "ghost" button variants'.
        // We can look for "No matching component" messages and extract specific component names if available in the logs.

        return {
            quality,
            stats,
            warnings: {
                categorized: categorizedWarnings,
                total: stats.totalWarnings
            },
            recommendations,
            nodeBreakdown: this.log
        };
    }
}

export const resolutionTracker = new ResolutionTracker();
