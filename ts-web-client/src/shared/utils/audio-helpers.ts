/**
 * Generate a unique track ID for audio events.
 */
export function generateTrackId(): string {
    return `track-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}
