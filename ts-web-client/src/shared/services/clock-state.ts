/**
 * Client-side clock state, computation, and event reducers
 *
 * Shared between display and master clients. Clocks compute
 * remaining time locally from lifecycle event timestamps.
 *
 * Reducers follow the apply{Domain}{Action} convention
 * established by layer-state.ts.
 */

import { setInMap, updateInMap, removeFromMap } from "@utils/state-helpers";
import type {
    ImagePosition,
    ClockCreateEvent,
    ClockStartEvent,
    ClockPauseEvent,
    ClockAdjustEvent,
    ClockDestroyEvent,
    ClockUpdateEvent,
    ClockVisibility,
    ClockCompletionBehavior,
} from "@types";

/**
 * Client-side clock state derived from lifecycle events
 */
export interface ClockState {
    id: string;
    duration: number;
    elapsed: number;
    running: boolean;
    startedAt: number | null;
    position: ImagePosition;
    zIndex: number;
    visible: boolean;

    // V2 fields
    respectTimeScale: boolean;
    scaleAtStart: number;
    visibility: ClockVisibility;
    onComplete: ClockCompletionBehavior;
    completed: boolean;
}

/**
 * Default display-space dimensions for clock overlays
 */
export const CLOCK_DISPLAY = { width: 200, height: 60 } as const;

// -- Computation helpers --

/**
 * Compute remaining time for a clock.
 *
 * When respectTimeScale is true and the clock is running,
 * elapsed real time is multiplied by scaleAtStart to produce
 * game-time elapsed. Scale changes mid-run require an internal
 * pause+resume cycle to capture the new scale.
 */
export function getRemainingTime(clock: ClockState, now: number = Date.now()): number {
    if (clock.completed) {
        return 0;
    }

    let runningElapsed = 0;

    if (clock.running && clock.startedAt !== null) {
        const realElapsed = now - clock.startedAt;
        runningElapsed = clock.respectTimeScale
            ? realElapsed * clock.scaleAtStart
            : realElapsed;
    }

    return Math.max(0, clock.duration - clock.elapsed - runningElapsed);
}

/**
 * Format remaining milliseconds as MM:SS or SS
 */
export function formatTime(remainingMs: number): string {
    const totalSeconds = Math.ceil(remainingMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (minutes > 0) {
        return `${minutes}:${String(seconds).padStart(2, "0")}`;
    }

    return String(seconds);
}

/**
 * Compute urgency ratio (0 = full time, 1 = no time left)
 */
export function getUrgency(clock: ClockState, now: number = Date.now()): number {
    const remaining = getRemainingTime(clock, now);

    if (clock.duration <= 0) {
        return 1;
    }

    return 1 - remaining / clock.duration;
}

/**
 * Apply a time-scale change to all running clocks that respect it.
 *
 * Performs an internal pause+resume: accumulates elapsed game time
 * at the old scale, then records the new scale for future computation.
 */
export function applyTimeScaleChange(
    clocks: Map<string, ClockState>,
    newScale: number,
    now: number = Date.now(),
): Map<string, ClockState> {
    let updated = clocks;

    for (const [id, clock] of clocks) {
        if (!clock.running || !clock.respectTimeScale || clock.startedAt === null) {
            continue;
        }

        // Accumulate elapsed game time at the old scale
        const realElapsed = now - clock.startedAt;
        const gameElapsed = realElapsed * clock.scaleAtStart;

        updated = updateInMap(updated, id, (c) => ({
            ...c,
            elapsed: c.elapsed + gameElapsed,
            startedAt: now,
            scaleAtStart: newScale,
        }));
    }

    return updated;
}

// -- Event reducers --

/**
 * Apply a ui.clock.create event.
 *
 * Always creates a fresh clock. Use ui.clock.update for mutations.
 */
export function applyClockCreate(
    clocks: Map<string, ClockState>,
    event: ClockCreateEvent,
    currentScale: number = 1.0,
): Map<string, ClockState> {
    const { id, duration, autoStart, position, zIndex,
            respectTimeScale, visibility, onComplete } = event.payload;
    const timestamp = event.metadata.timestamp;

    const clock: ClockState = {
        id,
        duration,
        elapsed: 0,
        running: autoStart ?? false,
        startedAt: autoStart ? timestamp : null,
        position: position ?? { x: "center", y: "top" },
        zIndex: zIndex ?? 100,
        visible: true,
        respectTimeScale: respectTimeScale ?? true,
        scaleAtStart: autoStart ? currentScale : 1.0,
        visibility: visibility ?? "always",
        onComplete: onComplete ?? "persist",
        completed: false,
    };

    return setInMap(clocks, id, clock);
}

/**
 * Apply a ui.clock.start event.
 */
export function applyClockStart(
    clocks: Map<string, ClockState>,
    event: ClockStartEvent,
    currentScale: number = 1.0,
): Map<string, ClockState> {
    return updateInMap(clocks, event.payload.id, (clock) => ({
        ...clock,
        running: true,
        startedAt: event.metadata.timestamp,
        scaleAtStart: currentScale,
        completed: false,
    }));
}

/**
 * Apply a ui.clock.pause event.
 *
 * Accumulates the running interval into elapsed time,
 * accounting for time scale if applicable.
 */
export function applyClockPause(
    clocks: Map<string, ClockState>,
    event: ClockPauseEvent,
): Map<string, ClockState> {
    const timestamp = event.metadata.timestamp;

    return updateInMap(clocks, event.payload.id, (clock) => {
        let runningElapsed = 0;

        if (clock.startedAt !== null) {
            const realElapsed = timestamp - clock.startedAt;
            runningElapsed = clock.respectTimeScale
                ? realElapsed * clock.scaleAtStart
                : realElapsed;
        }

        return {
            ...clock,
            running: false,
            elapsed: clock.elapsed + runningElapsed,
            startedAt: null,
        };
    });
}

/**
 * Apply a ui.clock.adjust event.
 *
 * Adds delta (positive or negative) to the total duration.
 */
export function applyClockAdjust(
    clocks: Map<string, ClockState>,
    event: ClockAdjustEvent,
): Map<string, ClockState> {
    return updateInMap(clocks, event.payload.id, (clock) => ({
        ...clock,
        duration: clock.duration + event.payload.delta,
    }));
}

/**
 * Apply a ui.clock.destroy event.
 */
export function applyClockDestroy(
    clocks: Map<string, ClockState>,
    event: ClockDestroyEvent,
): Map<string, ClockState> {
    return removeFromMap(clocks, event.payload.id);
}

/**
 * Apply a ui.clock.update event.
 *
 * Selectively updates position, zIndex, and visibility
 * without touching timing state.
 */
export function applyClockUpdate(
    clocks: Map<string, ClockState>,
    event: ClockUpdateEvent,
): Map<string, ClockState> {
    const { id, position, zIndex, visible } = event.payload;

    return updateInMap(clocks, id, (clock) => {
        const updates: Partial<ClockState> = {};

        if (position !== undefined) {
            updates.position = position;
        }
        if (zIndex !== undefined) {
            updates.zIndex = zIndex;
        }
        if (visible !== undefined) {
            updates.visible = visible;
        }

        return { ...clock, ...updates };
    });
}
