import type { Event } from "@types";
import type { TimeScaleEntry } from "@services/time/time-service";
import { computeGameTimeElapsed } from "./game-time";

/**
 * Compute a game-time-adjusted timestamp for replay.
 *
 * Given an original wall-clock timestamp, computes what the
 * timestamp would be if time had always run at the scaled rate.
 * Clients can then use (now - gameTimestamp) to get the correct
 * game-time-scaled elapsed.
 */
export function computeGameTimestamp(
    originalTimestamp: number,
    scaleHistory: TimeScaleEntry[],
    now: number = Date.now(),
): number {
    const gameElapsed = computeGameTimeElapsed(originalTimestamp, scaleHistory, now);
    return now - gameElapsed;
}

/**
 * Add gameTimestamp to an event's metadata.
 *
 * Non-destructive — the original timestamp is preserved.
 * Clients read gameTimestamp for elapsed calculations and
 * timestamp for ordering/debugging.
 */
export function withGameTimestamp(
    event: Event,
    scaleHistory: TimeScaleEntry[],
    now: number = Date.now(),
): Event {
    return {
        ...event,
        metadata: {
            ...event.metadata,
            gameTimestamp: computeGameTimestamp(
                event.metadata.timestamp, scaleHistory, now,
            ),
        },
    };
}

/**
 * A running interval — a period during which an entity was active.
 */
export interface RunInterval {
    start: number;
    end: number;
}

/**
 * Extract running intervals from a sequence of lifecycle events.
 *
 * Walks the sequence looking for start/pause transitions.
 * If the entity is still running at the end, the last interval
 * extends to `now`.
 *
 * @param sequence - Chronological event array
 * @param startTypes - Event types that begin a running interval
 * @param pauseTypes - Event types that end a running interval
 * @param autoStartCheck - Optional check on creation event for autoStart
 */
export function extractRunIntervals(
    sequence: Event[],
    startTypes: string[],
    pauseTypes: string[],
    autoStartCheck?: (event: Event) => boolean,
): { intervals: RunInterval[]; running: boolean } {
    const intervals: RunInterval[] = [];
    let start: number | null = null;

    for (const event of sequence) {
        if (autoStartCheck && autoStartCheck(event)) {
            start = event.metadata.timestamp;
        } else if (startTypes.includes(event.type)) {
            start = event.metadata.timestamp;
        } else if (pauseTypes.includes(event.type) && start !== null) {
            intervals.push({ start, end: event.metadata.timestamp });
            start = null;
        }
    }

    const running = start !== null;
    if (running) {
        intervals.push({ start: start!, end: Date.now() });
    }

    return { intervals, running };
}

/**
 * Sum game-time across a set of running intervals.
 *
 * When respectsScale is true, each interval's duration is computed
 * using the time-scale history. Otherwise, wall-clock duration is used.
 */
export function sumIntervals(
    intervals: RunInterval[],
    scaleHistory: TimeScaleEntry[],
    respectsScale: boolean,
): number {
    return intervals.reduce((total, { start, end }) =>
        total + (respectsScale
            ? computeGameTimeElapsed(start, scaleHistory, end)
            : end - start),
    0);
}
