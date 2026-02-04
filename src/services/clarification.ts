import { ConfidenceFactors } from '../types/confidence';

export type QuestionType = 'multiple-choice' | 'multi-select' | 'freeform';

export type AmbiguityCategory = 'layout' | 'content' | 'sizing' | 'styling' | 'hierarchy';

export interface ClarificationQuestion {
    id: string;
    text: string;
    type: QuestionType;
    options?: string[]; // For multiple-choice/multi-select
    category: AmbiguityCategory;
}

export interface ClarificationRequest {
    questions: ClarificationQuestion[];
    confidenceScore: number;
    originalIntent: string;
    uncertainties: string[];
}

export interface ClarificationAnswer {
    questionId: string;
    answer: string | string[]; // Single string or array of strings
}

/**
 * Main function to generate clarification questions based on low confidence
 */
export function generateClarifyingQuestions(
    intent: string,
    confidenceScore: number,
    factors: ConfidenceFactors,
    aiUncertainties: string[] = []
): ClarificationQuestion[] {
    const questions: ClarificationQuestion[] = [];

    // 1. Process explicit AI uncertainties first (highest priority)
    // These are things the AI explicitly said "I'm not sure about X"
    aiUncertainties.forEach((uncertainty, index) => {
        // Try to categorize the uncertainty based on keywords
        let category: AmbiguityCategory = 'content';
        const lower = uncertainty.toLowerCase();

        if (lower.includes('layout') || lower.includes('arrang') || lower.includes('stack')) category = 'layout';
        if (lower.includes('size') || lower.includes('width') || lower.includes('height') || lower.includes('gap') || lower.includes('padding')) category = 'sizing';
        if (lower.includes('color') || lower.includes('style') || lower.includes('dark') || lower.includes('light')) category = 'styling';

        // Convert uncertainty statement to question
        // "Not sure if 'compact' means p-4 or p-2" -> "You mentioned 'compact'. What spacing matches your vision?"
        questions.push({
            id: `ai-uncertainty-${index}`,
            text: `I'm unsure: ${uncertainty}. How should I handle this?`,
            type: 'freeform', // Default to freeform for generic AI uncertainties
            category
        });
    });

    // 2. Detect specific ambiguities if AI didn't catch them
    // Only detect if we have room (max 5 questions)
    if (questions.length < 5) {

        // Layout Ambiguity
        if (detectLayoutAmbiguity(intent, factors)) {
            questions.push({
                id: 'layout-preference',
                text: 'How should the content be arranged?',
                type: 'multiple-choice',
                options: [
                    'Vertical Stack (standard for mobile)',
                    'Horizontal Row (good for headers/toolbars)',
                    'Grid (for gallery/collections)',
                    'Auto-responsive (wrap as needed)'
                ],
                category: 'layout'
            });
        }

        // Sizing/Spacing Ambiguity (if "compact" or "spacious" isn't specified but maybe implied)
        if (detectSizingAmbiguity(intent, factors)) {
            questions.push({
                id: 'sizing-preference',
                text: 'What kind of spacing density do you prefer?',
                type: 'multiple-choice',
                options: [
                    'Compact (dense, information rich)',
                    'Comfortable (standard defaults)',
                    'Spacious (airy, modern feel)'
                ],
                category: 'sizing'
            });
        }

        // Content Ambiguity (if intent is very short)
        if (detectContentAmbiguity(intent, factors)) {
            questions.push({
                id: 'content-details',
                text: 'What specific elements should be included?',
                type: 'multi-select',
                options: [
                    'Title / Heading',
                    'Description text',
                    'Image / Icon',
                    'Action Button',
                    'Tags / Metadata'
                ],
                category: 'content'
            });
        }

        // Styling Ambiguity
        if (detectStylingAmbiguity(intent, factors)) {
            questions.push({
                id: 'styling-preference',
                text: 'Any preference for visual style?',
                type: 'multiple-choice',
                options: [
                    'Minimal (clean, subtle borders)',
                    'Card (shadows, rounded corners)',
                    'Flat (solid backgrounds, no depth)',
                    'Outline (borders only)'
                ],
                category: 'styling'
            });
        }
    }

    // Cap at 5 questions
    return questions.slice(0, 5);
}

// --- Detection Logic ---

function detectLayoutAmbiguity(intent: string, factors: ConfidenceFactors): boolean {
    const lower = intent.toLowerCase();
    // If user didn't specify direction and ambiguity factor is low
    const hasDirection = lower.includes('column') || lower.includes('row') || lower.includes('vertical') || lower.includes('horizontal') || lower.includes('grid');
    return !hasDirection && factors.ambiguity < 0.8;
}

function detectSizingAmbiguity(intent: string, factors: ConfidenceFactors): boolean {
    const lower = intent.toLowerCase();
    // If sizing keywords missing
    const hasSizing = lower.includes('compact') || lower.includes('spacious') || lower.includes('padding') || lower.includes('gap') || lower.includes('small') || lower.includes('large');
    return !hasSizing && factors.unknownElements < 0.9;
}

function detectContentAmbiguity(intent: string, factors: ConfidenceFactors): boolean {
    // If intent is very short (< 5 words) OR explicit ambiguity factor is very low
    const wordCount = intent.split(/\s+/).length;
    return wordCount < 5 || factors.ambiguity < 0.6;
}

function detectStylingAmbiguity(intent: string, factors: ConfidenceFactors): boolean {
    const lower = intent.toLowerCase();
    const hasStyle = lower.includes('color') || lower.includes('style') || lower.includes('theme') || lower.includes('modern') || lower.includes('clean');
    return !hasStyle && factors.validation < 0.9; // Validation issues often stem from bad style/color application
}
