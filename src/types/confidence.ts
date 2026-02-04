export interface ConfidenceFactors {
    validation: number;
    ambiguity: number;
    complexityMatch: number;
    unknownElements: number;
    nestingDepth: number;
    aiSelfAssessment: number;
}

export interface ConfidenceResult {
    finalScore: number;
    factors: ConfidenceFactors;
    breakdown: string[];
}
