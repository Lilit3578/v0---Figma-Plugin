/**
 * Error handling types and utilities for structured error reporting
 */

export enum ErrorCategory {
    RSNT_VALIDATION = 'RSNT_VALIDATION',
    AI_ORCHESTRATION = 'AI_ORCHESTRATION',
    DISCOVERY = 'DISCOVERY',
    RESOLUTION = 'RESOLUTION',
    EXECUTION = 'EXECUTION',
    CODE_EXPORT = 'CODE_EXPORT'
}

export enum ErrorCode {
    // 1000-1999: RSNT Validation Errors
    INVALID_SEMANTIC_ROLE = 1001,
    INVALID_LAYOUT_PRIMITIVE = 1002,
    MISSING_REQUIRED_PROPERTY = 1003,
    CIRCULAR_DEPENDENCY = 1004,
    EXCEEDS_MAX_DEPTH = 1005,

    // 2000-2999: AI Orchestration Errors
    API_REQUEST_FAILED = 2001,
    INVALID_JSON_RESPONSE = 2002,
    SCHEMA_VALIDATION_FAILED = 2003,
    CONFIDENCE_TOO_LOW = 2004,
    TIMEOUT = 2005,

    // 3000-3999: Discovery Errors
    NO_COMPONENTS_FOUND = 3001,
    NO_VARIABLES_FOUND = 3002,
    FINGERPRINTING_FAILED = 3003,
    CACHE_CORRUPTED = 3004,

    // 4000-4999: Resolution Errors
    NO_RESOLUTION_FOUND = 4001,
    COMPONENT_NOT_FOUND = 4002,
    VARIABLE_NOT_FOUND = 4003,
    MAPPING_FAILED = 4004,

    // 5000-5999: Execution Errors
    NODE_CREATION_FAILED = 5001,
    LAYOUT_APPLICATION_FAILED = 5002,
    PROPERTY_BINDING_FAILED = 5003,
    GENERATION_CANCELLED = 5004,

    // 6000-6999: Code Export Errors
    NO_RSNT_METADATA_FOUND = 6001,
    EXPORT_FORMAT_INVALID = 6002,
    CODE_GENERATION_FAILED = 6003,
    EXPORT_VALIDATION_FAILED = 6004
}

export interface ErrorGuidance {
    message: string;
    guidance: string;
    suggestions: string[];
    recoverable: boolean;
}

export const ERROR_GUIDANCE: Record<ErrorCode, ErrorGuidance> = {
    [ErrorCode.INVALID_SEMANTIC_ROLE]: {
        message: "Semantic role not in approved list",
        guidance: "The AI tried to use a component role that isn't recognized by the system.",
        suggestions: ["Use approved roles like Button, Card, Input", "Check the Semantic Role documentation"],
        recoverable: true
    },
    [ErrorCode.INVALID_LAYOUT_PRIMITIVE]: {
        message: "Layout primitive not in approved list",
        guidance: "The requested layout structure is not supported.",
        suggestions: ["Use stack-v, stack-h, or flex-center patterns"],
        recoverable: true
    },
    [ErrorCode.MISSING_REQUIRED_PROPERTY]: {
        message: "Required property missing from node",
        guidance: "A node is missing a property required for its type or role.",
        suggestions: ["Ensure component instances have componentId", "Check RSNT schema requirements"],
        recoverable: true
    },
    [ErrorCode.CIRCULAR_DEPENDENCY]: {
        message: "Node tree contains circular reference",
        guidance: "The AI generated a structure that infinitely nests itself.",
        suggestions: ["Simplify your prompt", "Try a fresh generation request"],
        recoverable: false
    },
    [ErrorCode.EXCEEDS_MAX_DEPTH]: {
        message: "Tree nesting exceeds maximum depth",
        guidance: "The design is too complex and exceeds the nesting limit.",
        suggestions: ["Try breaking the request into smaller components", "Reduce the depth of nested elements"],
        recoverable: true
    },
    [ErrorCode.API_REQUEST_FAILED]: {
        message: "AI API request failed",
        guidance: "There was a problem communicating with the AI service.",
        suggestions: ["Check your internet connection", "Verify your API key in Settings", "Wait 1-2 minutes and try again"],
        recoverable: true
    },
    [ErrorCode.INVALID_JSON_RESPONSE]: {
        message: "Invalid JSON response from AI",
        guidance: "The AI's response couldn't be parsed correctly.",
        suggestions: ["Try a simpler request", "Check if the AI response was truncated"],
        recoverable: true
    },
    [ErrorCode.SCHEMA_VALIDATION_FAILED]: {
        message: "RSNT schema validation failed",
        guidance: "The AI generated a design that doesn't follow the system rules.",
        suggestions: ["Rephrase your request", "Be more specific about the components needed"],
        recoverable: true
    },
    [ErrorCode.CONFIDENCE_TOO_LOW]: {
        message: "AI confidence too low",
        guidance: "The AI is not sure enough about how to fulfill your request.",
        suggestions: ["Provide more detail in your description", "Use standard design system terms"],
        recoverable: true
    },
    [ErrorCode.TIMEOUT]: {
        message: "Generation timed out",
        guidance: "The request took too long to process.",
        suggestions: ["Try a simpler request", "Check AI service status"],
        recoverable: true
    },
    [ErrorCode.NO_COMPONENTS_FOUND]: {
        message: "No components found in file",
        guidance: "The system couldn't find any components to use.",
        suggestions: ["Make sure you have components in your Figma file", "Ensure components are published or local"],
        recoverable: true
    },
    [ErrorCode.NO_VARIABLES_FOUND]: {
        message: "No variables found in file",
        guidance: "No design tokens (colors, spacing) were found.",
        suggestions: ["Define variables in Figma Local Variables", "Import a design system library"],
        recoverable: true
    },
    [ErrorCode.FINGERPRINTING_FAILED]: {
        message: "Component fingerprinting failed",
        guidance: "The system couldn't understand your component's structure.",
        suggestions: ["Check for complex component nesting", "Rename your components to use standard terms"],
        recoverable: true
    },
    [ErrorCode.CACHE_CORRUPTED]: {
        message: "Discovery cache corrupted",
        guidance: "Saved design system info is unreadable.",
        suggestions: ["Click 'Refresh Components & Variables'"],
        recoverable: true
    },
    [ErrorCode.NO_RESOLUTION_FOUND]: {
        message: "No resolution found (all tiers failed)",
        guidance: "The system couldn't find any way to implement this element.",
        suggestions: ["Check if the required component exists", "Simplify the RSNT structure"],
        recoverable: true
    },
    [ErrorCode.COMPONENT_NOT_FOUND]: {
        message: "Component not found",
        guidance: "A required component is missing from your file.",
        suggestions: ["Click 'Refresh Components & Variables'", "Check if the component was deleted/renamed"],
        recoverable: true
    },
    [ErrorCode.VARIABLE_NOT_FOUND]: {
        message: "Variable not found",
        guidance: "A required design token is missing.",
        suggestions: ["Check your local variables", "Ensure the variable name matches expected tokens"],
        recoverable: true
    },
    [ErrorCode.MAPPING_FAILED]: {
        message: "Property mapping failed",
        guidance: "Couldn't translate RSNT properties to component variants.",
        suggestions: ["Check component variant property names", "Try a different component"],
        recoverable: true
    },
    [ErrorCode.NODE_CREATION_FAILED]: {
        message: "Figma node creation failed",
        guidance: "An error occurred while building the design in Figma.",
        suggestions: ["Check Figma console for details", "Simplify the design structure"],
        recoverable: false
    },
    [ErrorCode.LAYOUT_APPLICATION_FAILED]: {
        message: "Layout application failed",
        guidance: "Couldn't apply Auto Layout rules to the design.",
        suggestions: ["Check for conflicting constraints", "Ensure frames have valid dimensions"],
        recoverable: true
    },
    [ErrorCode.PROPERTY_BINDING_FAILED]: {
        message: "Variable binding failed",
        guidance: "Couldn't connect design tokens to Figma properties.",
        suggestions: ["Check if the variable exists", "Verify property compatibility with the variable type"],
        recoverable: true
    },
    [ErrorCode.GENERATION_CANCELLED]: {
        message: "Generation cancelled by user",
        guidance: "The process was stopped.",
        suggestions: ["Try again when ready"],
        recoverable: true
    },
    [ErrorCode.NO_RSNT_METADATA_FOUND]: {
        message: "No RSNT metadata found for export",
        guidance: "This design wasn't generated by the compiler or metadata was lost.",
        suggestions: ["Generate the design again using the plugin", "Ensure metadata is attached to the root node"],
        recoverable: false
    },
    [ErrorCode.EXPORT_FORMAT_INVALID]: {
        message: "Export format invalid",
        guidance: "The requested code format is not supported.",
        suggestions: ["Use React/Tailwind (default)"],
        recoverable: true
    },
    [ErrorCode.CODE_GENERATION_FAILED]: {
        message: "Code generation engine error",
        guidance: "There was a problem translating Figma nodes to code.",
        suggestions: ["Check nested component structures", "Report this error to support"],
        recoverable: false
    },
    [ErrorCode.EXPORT_VALIDATION_FAILED]: {
        message: "Export content validation failed",
        guidance: "The generated code contains errors.",
        suggestions: ["Try exporting again", "Modify the design slightly and retry"],
        recoverable: true
    }
};

export class CompilerError extends Error {
    public readonly code: ErrorCode;
    public readonly category: ErrorCategory;
    public readonly details: any;
    public readonly guidance: string;
    public readonly suggestions: string[];
    public readonly recoverable: boolean;

    constructor(code: ErrorCode, category: ErrorCategory, details?: any, customMessage?: string) {
        const errorInfo = ERROR_GUIDANCE[code];
        const message = customMessage || `${errorInfo.message} (${code})`;
        super(message);

        this.name = 'CompilerError';
        this.code = code;
        this.category = category;
        this.details = details;
        this.guidance = errorInfo.guidance;
        this.suggestions = errorInfo.suggestions;
        this.recoverable = errorInfo.recoverable;

        // Restore prototype chain for extending Error in TS
        Object.setPrototypeOf(this, CompilerError.prototype);
    }
}

// Factory functions
export const createValidationError = (code: ErrorCode, details?: any, message?: string) =>
    new CompilerError(code, ErrorCategory.RSNT_VALIDATION, details, message);

export const createAIError = (code: ErrorCode, details?: any, message?: string) =>
    new CompilerError(code, ErrorCategory.AI_ORCHESTRATION, details, message);

export const createDiscoveryError = (code: ErrorCode, details?: any, message?: string) =>
    new CompilerError(code, ErrorCategory.DISCOVERY, details, message);

export const createResolutionError = (code: ErrorCode, details?: any, message?: string) =>
    new CompilerError(code, ErrorCategory.RESOLUTION, details, message);

export const createExecutionError = (code: ErrorCode, details?: any, message?: string) =>
    new CompilerError(code, ErrorCategory.EXECUTION, details, message);

export const createExportError = (code: ErrorCode, details?: any, message?: string) =>
    new CompilerError(code, ErrorCategory.CODE_EXPORT, details, message);

export interface UserFacingError {
    code: number;
    title: string;
    message: string;
    guidance: string;
    suggestions: string[];
    technicalDetails?: string;
    category: ErrorCategory;
    recoverable: boolean;
}

export interface RenderError {
    severity: 'error' | 'warning';
    message: string;
    nodeId: string;
    code?: number;
    recoveryAction?: string;
}

export interface RenderResult {
    node: SceneNode;
    errors: RenderError[];
    warnings: RenderError[];
}

/**
 * Format an error into a user-friendly structure
 */
export function formatError(error: Error | CompilerError, context?: any): UserFacingError {
    if (error instanceof CompilerError) {
        return {
            code: error.code,
            category: error.category,
            title: ERROR_GUIDANCE[error.code].message,
            message: error.message,
            guidance: error.guidance,
            suggestions: error.suggestions,
            technicalDetails: error.details ? JSON.stringify(error.details, null, 2) : undefined,
            recoverable: error.recoverable
        };
    }

    // Fallback for generic errors (legacy support)
    const errorMessage = error.message || 'Unknown error';

    // Attempt to map common error strings to codes
    let code = 0;
    let category = ErrorCategory.EXECUTION;

    if (errorMessage.includes('Component') && errorMessage.includes('not found')) {
        code = ErrorCode.COMPONENT_NOT_FOUND;
        category = ErrorCategory.RESOLUTION;
    } else if (errorMessage.includes('Variable') && errorMessage.includes('not found')) {
        code = ErrorCode.VARIABLE_NOT_FOUND;
        category = ErrorCategory.RESOLUTION;
    } else if (errorMessage.includes('API') || errorMessage.includes('RATE_LIMIT')) {
        code = ErrorCode.API_REQUEST_FAILED;
        category = ErrorCategory.AI_ORCHESTRATION;
    }

    if (code !== 0) {
        const info = ERROR_GUIDANCE[code as ErrorCode];
        return {
            code,
            category,
            title: info.message,
            message: errorMessage,
            guidance: info.guidance,
            suggestions: info.suggestions,
            technicalDetails: JSON.stringify(context || {}, null, 2),
            recoverable: info.recoverable
        };
    }

    return {
        code: 0,
        category: ErrorCategory.EXECUTION,
        title: 'Unexpected Error',
        message: errorMessage,
        guidance: 'An unexpected internal error occurred.',
        suggestions: ['Try again', 'Check console for technical details'],
        technicalDetails: errorMessage,
        recoverable: true
    };
}

/**
 * Format error for logs
 */
export function formatErrorForLog(error: CompilerError): string {
    return `[${error.category}] ${error.message} (Code: ${error.code})
Guidance: ${error.guidance}
Details: ${JSON.stringify(error.details, null, 2)}`;
}

/**
 * Create a RenderError from an exception
 */
export function createRenderErrorUI(
    error: Error | CompilerError,
    nodeId: string,
    severity: 'error' | 'warning' = 'error',
    recoveryAction?: string
): RenderError {
    return {
        severity,
        message: error.message,
        nodeId,
        code: error instanceof CompilerError ? error.code : undefined,
        recoveryAction: recoveryAction || (error instanceof CompilerError ? error.suggestions[0] : undefined)
    };
}
