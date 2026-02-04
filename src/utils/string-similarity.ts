/**
 * String Similarity Utilities
 * 
 * Provides fuzzy string matching using Levenshtein distance
 * for property name matching when exact matches aren't found.
 */

/**
 * Calculate Levenshtein distance between two strings
 * Returns the minimum number of single-character edits needed to transform one string into another
 */
export function levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    // Initialize first column
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    // Initialize first row
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    // Fill in the rest of the matrix
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                // Characters match, no operation needed
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                // Take minimum of insert, delete, or substitute
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitute
                    matrix[i][j - 1] + 1,     // insert
                    matrix[i - 1][j] + 1      // delete
                );
            }
        }
    }

    return matrix[b.length][a.length];
}

/**
 * Calculate normalized similarity score between two strings
 * Returns a value between 0 (completely different) and 1 (identical)
 */
export function stringSimilarity(a: string, b: string): number {
    // Case-insensitive comparison
    const lowerA = a.toLowerCase();
    const lowerB = b.toLowerCase();

    // Handle edge cases
    if (lowerA === lowerB) return 1;
    if (lowerA.length === 0 || lowerB.length === 0) return 0;

    const distance = levenshteinDistance(lowerA, lowerB);
    const maxLength = Math.max(a.length, b.length);

    // Normalize to 0-1 range
    return 1 - distance / maxLength;
}

/**
 * Find best match from a list of candidates
 * Returns the candidate with the highest similarity score above the threshold
 * 
 * @param target - The string to match against
 * @param candidates - Array of candidate strings to search
 * @param threshold - Minimum similarity score (0-1) to consider a match (default: 0.6)
 * @returns Object with match and score, or null if no match found
 */
export function findBestMatch(
    target: string,
    candidates: string[],
    threshold: number = 0.6
): { match: string; score: number } | null {
    if (candidates.length === 0) return null;

    let bestMatch: string | null = null;
    let bestScore = 0;

    for (const candidate of candidates) {
        const score = stringSimilarity(target, candidate);
        if (score > bestScore && score >= threshold) {
            bestScore = score;
            bestMatch = candidate;
        }
    }

    return bestMatch ? { match: bestMatch, score: bestScore } : null;
}

/**
 * Find all matches above a threshold, sorted by similarity
 * Useful when you want to see multiple potential matches
 * 
 * @param target - The string to match against
 * @param candidates - Array of candidate strings to search
 * @param threshold - Minimum similarity score (0-1) to include (default: 0.5)
 * @returns Array of matches sorted by score (highest first)
 */
export function findAllMatches(
    target: string,
    candidates: string[],
    threshold: number = 0.5
): Array<{ match: string; score: number }> {
    const matches: Array<{ match: string; score: number }> = [];

    for (const candidate of candidates) {
        const score = stringSimilarity(target, candidate);
        if (score >= threshold) {
            matches.push({ match: candidate, score });
        }
    }

    // Sort by score descending
    return matches.sort((a, b) => b.score - a.score);
}

/**
 * Check if two strings are similar enough to be considered a match
 * 
 * @param a - First string
 * @param b - Second string
 * @param threshold - Minimum similarity score (default: 0.7)
 * @returns true if similarity >= threshold
 */
export function isSimilar(a: string, b: string, threshold: number = 0.7): boolean {
    return stringSimilarity(a, b) >= threshold;
}
