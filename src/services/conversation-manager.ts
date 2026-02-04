/**
 * Multi-turn conversation management for iterative design refinement
 */

import { RSNT_Node } from '../types/rsnt';

export type IntentType =
    | 'NEW_DESIGN'
    | 'SPACING_CHANGE'
    | 'ELEMENT_ADD'
    | 'ELEMENT_REMOVE'
    | 'ELEMENT_REORDER'
    | 'STYLE_CHANGE'
    | 'UNKNOWN_REFINEMENT';

export interface ConversationTurn {
    id: string;
    timestamp: number;
    userIntent: string;
    intentType: IntentType;
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
    private readonly MAX_TURNS = 5;

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

        // Parse intent type
        const intentType = this.parseIterationIntent(userIntent);

        this.currentConversation!.turns.push({
            id: this.generateId(),
            timestamp: Date.now(),
            userIntent,
            intentType,
            rsnt,
            promptVersion
        });

        this.currentConversation!.lastUpdatedAt = Date.now();
        console.log(`Conversation: Added turn ${this.currentConversation!.turns.length} (${intentType})`);
    }

    /**
     * Parse the user's intent to determine the type of iteration
     */
    parseIterationIntent(intent: string): IntentType {
        const lower = intent.toLowerCase();

        // Spacing/Layout
        if (
            lower.includes('compact') ||
            lower.includes('spacious') ||
            lower.includes('tight') ||
            lower.includes('gap') ||
            lower.includes('padding') ||
            lower.includes('space')
        ) {
            return 'SPACING_CHANGE';
        }

        // Adding elements
        if (
            lower.includes('add') ||
            lower.includes('insert') ||
            lower.includes('include') ||
            lower.includes('with') ||
            lower.includes('put')
        ) {
            return 'ELEMENT_ADD';
        }

        // Removing elements
        if (
            lower.includes('remove') ||
            lower.includes('delete') ||
            lower.includes('without') ||
            lower.includes('exclude') ||
            lower.includes('get rid of')
        ) {
            return 'ELEMENT_REMOVE';
        }

        // Reordering
        if (
            lower.includes('move') ||
            lower.includes('swap') ||
            lower.includes('order') ||
            lower.includes('arrange') ||
            lower.includes('switch')
        ) {
            return 'ELEMENT_REORDER';
        }

        // Style changes
        if (
            lower.includes('color') ||
            lower.includes('font') ||
            lower.includes('size') ||
            lower.includes('background') ||
            lower.includes('style') ||
            lower.includes('look') ||
            lower.includes('dark') ||
            lower.includes('light')
        ) {
            return 'STYLE_CHANGE';
        }

        // General refinement fallback
        if (this.isRefinement(intent)) {
            return 'UNKNOWN_REFINEMENT';
        }

        return 'NEW_DESIGN';
    }

    /**
     * Get conversation context for prompt
     */
    getContext(currentIntent: string): string {
        if (!this.currentConversation || this.currentConversation.turns.length === 0) {
            return '';
        }

        const lastTurn = this.currentConversation.turns[this.currentConversation.turns.length - 1];
        const intentType = this.parseIterationIntent(currentIntent);

        // If it's a new design request, ignore history
        if (intentType === 'NEW_DESIGN') {
            return '';
        }

        const historySummary = this.currentConversation.turns.map((t, i) =>
            `${i + 1}. "${t.userIntent}"`
        ).join('\n');

        return `
ITERATION CONTEXT:
This is iteration #${this.currentConversation.turns.length + 1} of a design session.
History:
${historySummary}

CURRENT DESIGN (Reference for Modification):
The user wants to modify the previous design. 
Previous User Request: "${lastTurn.userIntent}"
Detected Modification Type: ${intentType}

CURRENT RSNT STRUCTURE (JSON):
\`\`\`json
${JSON.stringify(lastTurn.rsnt, null, 2)}
\`\`\`

INSTRUCTIONS FOR MODIFICATION:
${this.getModificationInstructions(intentType)}
`;
    }

    /**
     * Get specific instructions based on modification type
     */
    private getModificationInstructions(type: IntentType): string {
        switch (type) {
            case 'SPACING_CHANGE':
                return `
- MODIFY the provided RSNT JSON to adjust spacing (padding, gaps).
- "Compact": Reduce values (e.g., p-8 -> p-6, gap-4 -> gap-2).
- "Spacious": Increase values (e.g., p-4 -> p-6).
- Preserve the overall structure and component IDs.
`;
            case 'ELEMENT_ADD':
                return `
- INSERT new nodes into the provided RSNT JSON.
- Find the semantic location for the new element.
- Use existing component IDs where possible.
- Ensure the new structure is valid.
`;
            case 'ELEMENT_REMOVE':
                return `
- REMOVE specific nodes from the provided RSNT JSON.
- Update parent's children array.
- Clean up any now-empty containers if needed.
`;
            case 'ELEMENT_REORDER':
                return `
- REORDER nodes within their parent's children array in the provided RSNT JSON.
- Do not change properties, just the order.
`;
            case 'STYLE_CHANGE':
                return `
- UPDATE specific properties (fills, fonts, etc.) in the provided RSNT JSON.
- Preserve structure.
`;
            default:
                return `
- MODIFY the provided RSNT JSON based on the user's request.
- Preserve as much of the existing structure as possible.
`;
        }
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
            'increase', 'decrease', 'replace', 'swap', 'put', 'insert',
            'too', 'more', 'less', 'turn'
        ];

        const lower = intent.toLowerCase();

        // Simple heuristic - can be improved
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
     * Undo last turn (remove the most recent addition)
     */
    undoTurn(): ConversationTurn | null {
        if (!this.currentConversation || this.currentConversation.turns.length === 0) {
            return null;
        }

        const removed = this.currentConversation.turns.pop();
        this.currentConversation.lastUpdatedAt = Date.now();
        console.log('Conversation: Undid last turn');
        return removed || null;
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
