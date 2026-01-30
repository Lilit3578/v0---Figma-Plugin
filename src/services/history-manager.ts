/**
 * Design history management with undo/redo support
 */

import { RSNT_Node } from '../types/rsnt';

export interface HistoryEntry {
    id: string;
    timestamp: number;
    userIntent: string;
    rsnt: RSNT_Node;
    figmaNodeId?: string;  // ID of rendered Figma node
}

export class HistoryManager {
    private history: HistoryEntry[] = [];
    private currentIndex: number = -1;
    private maxHistorySize: number = 20;

    /**
     * Generate unique ID
     */
    private generateId(): string {
        return `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Add new entry to history
     */
    addEntry(userIntent: string, rsnt: RSNT_Node, figmaNodeId?: string): void {
        // Remove any entries after current index (branching)
        this.history = this.history.slice(0, this.currentIndex + 1);

        // Add new entry
        this.history.push({
            id: this.generateId(),
            timestamp: Date.now(),
            userIntent,
            rsnt,
            figmaNodeId
        });

        // Limit history size
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        } else {
            this.currentIndex++;
        }

        console.log(`History: Added entry (${this.currentIndex + 1}/${this.history.length})`);
    }

    /**
     * Undo to previous entry
     */
    undo(): HistoryEntry | null {
        if (!this.canUndo()) {
            console.warn('Cannot undo: at beginning of history');
            return null;
        }

        this.currentIndex--;
        const entry = this.history[this.currentIndex];
        console.log(`History: Undo to entry ${this.currentIndex + 1}/${this.history.length}`);
        return entry;
    }

    /**
     * Redo to next entry
     */
    redo(): HistoryEntry | null {
        if (!this.canRedo()) {
            console.warn('Cannot redo: at end of history');
            return null;
        }

        this.currentIndex++;
        const entry = this.history[this.currentIndex];
        console.log(`History: Redo to entry ${this.currentIndex + 1}/${this.history.length}`);
        return entry;
    }

    /**
     * Check if can undo
     */
    canUndo(): boolean {
        return this.currentIndex > 0;
    }

    /**
     * Check if can redo
     */
    canRedo(): boolean {
        return this.currentIndex < this.history.length - 1;
    }

    /**
     * Get current entry
     */
    getCurrentEntry(): HistoryEntry | null {
        if (this.currentIndex < 0) return null;
        return this.history[this.currentIndex];
    }

    /**
     * Get history summary
     */
    getHistorySummary(): Array<{ id: string; intent: string; timestamp: number; isCurrent: boolean }> {
        return this.history.map((entry, index) => ({
            id: entry.id,
            intent: entry.userIntent,
            timestamp: entry.timestamp,
            isCurrent: index === this.currentIndex
        }));
    }

    /**
     * Get history state
     */
    getHistoryState(): { canUndo: boolean; canRedo: boolean; currentIndex: number; totalEntries: number } {
        return {
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            currentIndex: this.currentIndex,
            totalEntries: this.history.length
        };
    }

    /**
     * Clear history
     */
    clear(): void {
        this.history = [];
        this.currentIndex = -1;
        console.log('History: Cleared');
    }
}

export const historyManager = new HistoryManager();
