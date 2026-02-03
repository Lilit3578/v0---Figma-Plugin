
/**
 * Utility for processing arrays in chunks to prevent blocking the main thread
 */

export interface ChunkProgress {
    current: number;
    total: number;
}

/**
 * Process an array of items in chunks, yielding to the main thread between chunks.
 * This prevents UI freezes during heavy synchronous operations.
 * 
 * @param items Array of items to process
 * @param chunkSize Number of items to process in each batch
 * @param processor Async function to process each item
 * @param onProgress Optional callback for progress updates
 * @param cancellationToken Optional function that returns true if operation should be cancelled
 */
export async function processInChunks<T>(
    items: T[],
    chunkSize: number,
    processor: (item: T, index: number) => Promise<void>,
    onProgress?: (progress: ChunkProgress) => void,
    shouldCancel?: () => boolean
): Promise<void> {
    const total = items.length;

    for (let i = 0; i < total; i += chunkSize) {
        // Check for cancellation
        if (shouldCancel && shouldCancel()) {
            throw new Error('Operation cancelled');
        }

        const chunk = items.slice(i, i + chunkSize);

        // Process current chunk in parallel
        await Promise.all(chunk.map((item, index) => processor(item, i + index)));

        // Report progress
        const current = Math.min(i + chunkSize, total);
        if (onProgress) {
            onProgress({ current, total });
        }

        // Yield to main thread
        await new Promise(resolve => setTimeout(resolve, 0));
    }
}
