/**
 * Error handling types and utilities for user-facing error messages
 */

export interface UserFacingError {
    title: string;
    message: string;
    suggestions: string[];
    technicalDetails?: string;
    reportable: boolean;
}

export interface RenderError {
    severity: 'error' | 'warning';
    message: string;
    nodeId: string;
    recoveryAction?: string;
}

export interface RenderResult {
    node: SceneNode;
    errors: RenderError[];
    warnings: RenderError[];
}

/**
 * Format an error into a user-friendly structure with actionable suggestions
 */
export function formatError(error: Error, context?: any): UserFacingError {
    const errorMessage = error.message || 'Unknown error';

    // Component not found errors
    if (errorMessage.includes('Component') && errorMessage.includes('not found')) {
        const componentId = context?.componentId || 'unknown';
        return {
            title: 'Component Not Found',
            message: 'The AI tried to use a component that doesn\'t exist in your file.',
            suggestions: [
                'Click "🔄 Refresh Components & Variables" to update the component list',
                'Make sure your design system components are published',
                'Try describing your request differently',
                'Check if the component was recently deleted or renamed'
            ],
            technicalDetails: `Missing component ID: ${componentId}\nError: ${errorMessage}`,
            reportable: true
        };
    }

    // Variable not found errors
    if (errorMessage.includes('Variable') && errorMessage.includes('not found')) {
        const variableId = context?.variableId || 'unknown';
        return {
            title: 'Variable Not Found',
            message: 'The AI tried to use a design variable that doesn\'t exist in your file.',
            suggestions: [
                'Click "🔄 Refresh Components & Variables" to update the variable list',
                'Check if the variable was recently deleted or renamed',
                'Try using simpler color/spacing descriptions'
            ],
            technicalDetails: `Missing variable ID: ${variableId}\nError: ${errorMessage}`,
            reportable: true
        };
    }

    // Color validation errors
    if (errorMessage.includes('color') || errorMessage.includes('NaN') || errorMessage.includes('Invalid color')) {
        return {
            title: 'Invalid Color Values',
            message: 'The AI generated incorrect color data that cannot be rendered.',
            suggestions: [
                'Try again - the AI may generate valid colors on retry',
                'Use simpler color descriptions (e.g., "blue button" instead of specific hex codes)',
                'Check if your design system has color variables defined',
                'Report this issue if it persists'
            ],
            technicalDetails: errorMessage,
            reportable: true
        };
    }

    // Validation errors
    if (errorMessage.includes('Validation failed')) {
        return {
            title: 'Design Validation Failed',
            message: 'The AI-generated design has structural issues that prevent rendering.',
            suggestions: [
                'Try a simpler request first',
                'Be more specific about what components you need',
                'Check the technical details below for specific issues',
                'Click "🔄 Refresh Components & Variables" and try again'
            ],
            technicalDetails: errorMessage,
            reportable: true
        };
    }

    // API errors
    if (errorMessage.includes('API') || errorMessage.includes('RATE_LIMIT')) {
        return {
            title: 'API Error',
            message: 'There was a problem communicating with the AI service.',
            suggestions: [
                'Wait a few moments and try again',
                'Check your internet connection',
                'Verify your API key is valid in Settings',
                'You may have hit the API rate limit - wait 1-2 minutes'
            ],
            technicalDetails: errorMessage,
            reportable: false
        };
    }

    // Font errors
    if (errorMessage.includes('font') || errorMessage.includes('Font')) {
        return {
            title: 'Font Loading Error',
            message: 'Unable to load the required font for text elements.',
            suggestions: [
                'The plugin will use a fallback font',
                'Install the missing font on your system for better results',
                'Check which fonts are used in your design system'
            ],
            technicalDetails: errorMessage,
            reportable: false
        };
    }

    // Generic fallback
    return {
        title: 'Generation Failed',
        message: 'An unexpected error occurred during design generation.',
        suggestions: [
            'Try again with a simpler request',
            'Click "🔄 Refresh Components & Variables"',
            'Check the technical details below',
            'Report this issue if it persists'
        ],
        technicalDetails: errorMessage,
        reportable: true
    };
}

/**
 * Create a RenderError from an exception
 */
export function createRenderError(
    error: Error,
    nodeId: string,
    severity: 'error' | 'warning' = 'error',
    recoveryAction?: string
): RenderError {
    return {
        severity,
        message: error.message,
        nodeId,
        recoveryAction
    };
}
