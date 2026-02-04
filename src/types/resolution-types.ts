export type Tier = 1 | 2 | 3 | 4 | 5;

export enum WarningCategory {
    COMPONENT_MAPPING = 'COMPONENT_MAPPING',
    VARIABLE_RESOLUTION = 'VARIABLE_RESOLUTION',
    APPROXIMATION = 'APPROXIMATION',
    SYSTEM_DEFAULT = 'SYSTEM_DEFAULT',
}

export enum WarningSeverity {
    INFO = 'INFO',
    WARNING = 'WARNING',
    CRITICAL = 'CRITICAL',
}

export interface DetailedWarning {
    message: string;
    category: WarningCategory;
    severity: WarningSeverity;
    tier: Tier;
    nodeId?: string;
}

export interface ResolutionMetadata {
    nodeId: string;
    tier: Tier;
    confidence: number;
    method: string;
    timeTaken: number;
    fallbackReason?: string;
}

export interface ResolutionLogEntry extends ResolutionMetadata {
    warnings: DetailedWarning[];
    succeeded: boolean;
    attemptedTiers: Tier[];
}

export interface ResolutionStats {
    tierCounts: Record<Tier, number>;
    averageConfidence: number;
    tier1Percentage: number;
    lowestConfidence: number;
    totalWarnings: number;
    warningCounts: Record<WarningCategory, number>;
}

export interface ResolutionSummary {
    quality: 'Excellent' | 'Good' | 'Fair' | 'Poor';
    stats: ResolutionStats;
    warnings: {
        categorized: Array<{ category: WarningCategory; count: number; examples: string[] }>;
        total: number;
    };
    recommendations: string[];
    nodeBreakdown: ResolutionLogEntry[];
}

// ============================================================================
// RESOLUTION CORE TYPES (Moved from resolution.ts)
// ============================================================================

import { ComponentInfo } from '../services/auto-discovery';

/**
 * Result of resolving a single RSNT node
 */
export interface ResolutionResult {
    success: boolean;
    tier: Tier;
    method: string;
    instructions: ExecutionInstructions;
    confidence: number;
    warnings: string[]; // Legacy warnings (string array)
    metadata?: {
        nodeId: string;
        timeMs: number;
        fallbackReason?: string;
    };
}

/**
 * Instructions for rendering engine to execute
 */
export type ExecutionInstructions = ComponentInstructions | FrameInstructions;

/**
 * Instructions to instantiate a component
 */
export interface ComponentInstructions {
    type: 'INSTANTIATE_COMPONENT';
    componentId: string;
    properties: Record<string, any>;
    overrides?: {
        fills?: any[];
        strokes?: any[];
        text?: string;
        padding?: { top: number; right: number; bottom: number; left: number };
    };
}

/**
 * Instructions to create a frame from scratch
 */
export interface FrameInstructions {
    type: 'CREATE_FRAME';
    layoutMode: 'HORIZONTAL' | 'VERTICAL' | 'NONE';
    styling: {
        fills?: any[];
        strokes?: any[];
        cornerRadius?: number;
        padding?: { top: number; right: number; bottom: number; left: number };
    };
    variableBindings?: Record<string, string>;
    primitiveValues?: Record<string, any>;
}

/**
 * Structural match candidate with scoring details
 */
export interface StructuralMatchCandidate {
    component: ComponentInfo;
    score: number;
    confidence: number;
    matchDetails: {
        layoutMatch: boolean;
        alignmentMatch: boolean;
        flexibilityIndicator: boolean;
        simpleStructure: boolean;
    };
}

/**
 * Override safety validation report
 */
export interface OverrideSafetyReport {
    safe: boolean;
    unsafeProperties: string[];
    testResults: {
        textChange: boolean;
        fillChange: boolean;
        paddingChange: boolean;
    };
}
/**
 * Aggregated warnings from resolution
 */
export interface WarningAggregation {
    componentWarnings: { message: string; count: number }[];
    variableWarnings: { message: string; count: number }[];
    approximationWarnings: { message: string; count: number }[];
    summary: string;
}

