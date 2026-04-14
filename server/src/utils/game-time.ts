import type { TimeScaleEntry } from "@services/time/time-service";

/**
 * Compute effective game-time elapsed since a given timestamp,
 * accounting for all time-scale changes.
 *
 * Walks the scale history from `since` to `now`, summing
 * (real_time_interval × scale) for each period.
 *
 * @param since - Start timestamp (e.g., when audio started playing)
 * @param scaleHistory - Chronological array of {timestamp, scale} entries
 * @param now - Current time (defaults to Date.now())
 * @returns Elapsed game time in milliseconds
 */
export function computeGameTimeElapsed(
    since: number,
    scaleHistory: TimeScaleEntry[],
    now: number = Date.now(),
): number {
    if (scaleHistory.length === 0) {
        return now - since;
    }

    let elapsed = 0;
    let currentTime = since;

    // Find the scale active at `since` by walking backwards
    let activeScale = 1.0;
    for (const entry of scaleHistory) {
        if (entry.timestamp <= since) {
            activeScale = entry.scale;
        } else {
            break;
        }
    }

    // Walk forward through scale changes
    for (const entry of scaleHistory) {
        if (entry.timestamp <= since) {
            continue;
        }

        if (entry.timestamp >= now) {
            break;
        }

        // Accumulate game time for the interval at the active scale
        const interval = entry.timestamp - currentTime;
        elapsed += interval * activeScale;

        currentTime = entry.timestamp;
        activeScale = entry.scale;
    }

    // Accumulate remaining time at the current scale
    const remaining = now - currentTime;
    elapsed += remaining * activeScale;

    return elapsed;
}
