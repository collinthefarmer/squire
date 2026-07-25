import type { TrackId } from "@types";
import { trackId } from "@types";

/**
 * Generate a unique track ID for audio events.
 */
export function generateTrackId(): TrackId {
    return trackId(
        `track-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    );
}
