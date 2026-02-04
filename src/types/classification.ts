export interface AIClassificationResponse {
    semanticRole: string;
    confidence: number;
    reasoning: string;
}

export interface ClassificationRequest {
    componentId: string;
    name: string;
    structureSignature: string;
    anatomy: any; // Using any for now to avoid circular dependency if strict typing needed, or I'll import ComponentAnatomy
}

export interface ClassificationBatchResult {
    componentId: string;
    result: AIClassificationResponse | null;
    error?: string;
}

export enum PropertyType {
    SEMANTIC_VARIANT = 'SEMANTIC_VARIANT',
    SEMANTIC_SIZE = 'SEMANTIC_SIZE',
    SEMANTIC_STATE = 'SEMANTIC_STATE',
    SEMANTIC_STYLE = 'SEMANTIC_STYLE',
    SEMANTIC_CUSTOM = 'SEMANTIC_CUSTOM'
}

export interface ValueMapping {
    clientValue: string;
    semanticValue: string;
    confidence: number;
}

export interface PropertyAnalysis {
    propertyType: PropertyType;
    reasoning: string;
    valueMappings: ValueMapping[];
}

export interface PropertyAnalysisRequest {
    componentName: string;
    propertyName: string;
    values: string[];
}

/**
 * Complete property mapping result with overall metrics
 */
export interface PropertyMappingResult {
    mappings: PropertyAnalysis[];
    overallConfidence: number;
    mappablePercentage: number;
    unmappedProps: string[];
    timestamp: number;
}

/**
 * Result of applying property mappings to RSNT props
 */
export interface AppliedMapping {
    componentProperties: Record<string, string>;
    skippedProps: string[];
    warnings: string[];
}
