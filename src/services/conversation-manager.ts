/**
 * Multi-turn conversation management for iterative design refinement
 */

import { RSNT_Node } from '../types/rsnt';

export interface ConversationTurn {
    id: string;
    timestamp: number;
    userIntent: string;
    rsnt: RSNT_Node;
    promptVersion: string;
}

export interface Conversation {
    id: string;
    turns: ConversationTurn[];
    createdAt: number;
    lastUpdatedAt: number;
}

export class ConversationManager {
    private currentConversation: Conversation | null = null;

    /**
     * Generate unique ID
     */
    private generateId(): string {
        return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Start a new conversation
     */
    startConversation(): Conversation {
        this.currentConversation = {
            id: this.generateId(),
            turns: [],
            createdAt: Date.now(),
            lastUpdatedAt: Date.now()
        };
        console.log('Conversation: Started new conversation');
        return this.currentConversation;
    }

    /**
     * Add a turn to the current conversation
     */
    addTurn(userIntent: string, rsnt: RSNT_Node, promptVersion: string): void {
        if (!this.currentConversation) {
            this.startConversation();
        }

        this.currentConversation!.turns.push({
            id: this.generateId(),
            timestamp: Date.now(),
            userIntent,
            rsnt,
            promptVersion
        });

        this.currentConversation!.lastUpdatedAt = Date.now();
        console.log(`Conversation: Added turn ${this.currentConversation!.turns.length}`);
    }

    /**
     * Get conversation context for prompt
     */
    getContext(): string {
        if (!this.currentConversation || this.currentConversation.turns.length === 0) {
            return '';
        }

        const lastTurn = this.currentConversation.turns[this.currentConversation.turns.length - 1];

        const componentCount = this.countComponents(lastTurn.rsnt);
        const frameCount = this.countFrames(lastTurn.rsnt);

        return `
PREVIOUS CONTEXT:
Last request: "${lastTurn.userIntent}"
Current design has: ${componentCount} components, ${frameCount} frames

If the new request is a refinement (e.g., "make it bigger", "add X", "change Y"), 
modify the existing design. Otherwise, create a new design.
`;
    }

    /**
     * Count components in RSNT tree
     */
    private countComponents(node: RSNT_Node): number {
        let count = node.type === 'COMPONENT_INSTANCE' ? 1 : 0;

        if (node.children) {
            for (const child of node.children) {
                count += this.countComponents(child);
            }
        }

        return count;
    }

    /**
     * Count frames in RSNT tree
     */
    private countFrames(node: RSNT_Node): number {
        let count = node.type === 'FRAME' ? 1 : 0;

        if (node.children) {
            for (const child of node.children) {
                count += this.countFrames(child);
            }
        }

        return count;
    }

    /**
     * Check if intent is a refinement
     */
    isRefinement(intent: string): boolean {
        const refinementKeywords = [
            'make', 'change', 'add', 'remove', 'bigger', 'smaller',
            'move', 'adjust', 'update', 'modify', 'fix', 'delete',
            'increase', 'decrease', 'replace', 'swap'
        ];

        const lower = intent.toLowerCase();
        const hasRefinementKeyword = refinementKeywords.some(keyword => lower.includes(keyword));

        console.log(`Conversation: Intent "${intent}" is ${hasRefinementKeyword ? 'a refinement' : 'a new design'}`);
        return hasRefinementKeyword;
    }

    /**
     * Get current conversation
     */
    getCurrentConversation(): Conversation | null {
        return this.currentConversation;
    }

    /**
     * Clear conversation (start fresh)
     */
    clearConversation(): void {
        this.currentConversation = null;
        console.log('Conversation: Cleared');
    }
}

export const conversationManager = new ConversationManager();
