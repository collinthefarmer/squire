/**
 * Multi-pointer gatherer — collects concurrent pointer streams
 * into a single observable of PointerSnapshots.
 *
 * Pure gathering: no claim logic, no scroll awareness, no gate.
 * The consumer provides the source Observable<PointerStream>
 * and handles capture/release upstream.
 *
 * Pipeline:
 *   source$
 *     → mergeMap(pointerLifecycle$)
 *     → scan(gather)
 *     → map(toSnapshot)
 *     → share()
 */

import { of, merge } from "rxjs";
import { mergeMap, scan, map, share } from "rxjs/operators";
import type { PointerStream } from "./pointers";
import type { Point } from "./transform";
import type { Observable } from "rxjs";

// ── Public types ────────────────────────────────────────────────

export type PointerPhase = "start" | "move" | "end" | "cancel";

export interface TrackedPointer {
    id: number;
    position: Point;
    startPosition: Point;
    startTime: number;
    pointerType: "mouse" | "touch" | "pen";
}

export interface PointerSnapshot {
    phase: PointerPhase;
    changed: TrackedPointer;
    active: ReadonlyMap<number, TrackedPointer>;
    activeCount: number;
}

// ── Public entry point ──────────────────────────────────────────

export function trackedPointers$(
    source$: Observable<PointerStream>,
): Observable<PointerSnapshot> {
    return source$.pipe(
        mergeMap((stream) => pointerLifecycle$(stream)),
        scan(
            (state: GathererState, event: InternalEvent) =>
                gather(state, event),
            emptyState(),
        ),
        map(toSnapshot),
        share(),
    );
}

// ── Internal types (exported for testing) ───────────────────────

export type InternalEvent = {
    phase: PointerPhase;
    stream: PointerStream;
    pointer: TrackedPointer;
};

export type GathererState = {
    active: Map<number, TrackedPointer>;
    lastEvent: InternalEvent;
};

// ── Lifecycle flattening ────────────────────────────────────────

export function pointerLifecycle$(
    stream: PointerStream,
): Observable<InternalEvent> {
    const base: TrackedPointer = {
        id: stream.id,
        position: stream.start,
        startPosition: stream.start,
        startTime: stream.startTime,
        pointerType: stream.pointerType,
    };

    return merge(
        of<InternalEvent>({
            phase: "start",
            stream,
            pointer: base,
        }),

        stream.move$.pipe(
            map(
                (position): InternalEvent => ({
                    phase: "move",
                    stream,
                    pointer: { ...base, position },
                }),
            ),
        ),

        stream.end$.pipe(
            map(
                (end): InternalEvent => ({
                    phase: end.reason === "cancel" ? "cancel" : "end",
                    stream,
                    pointer: { ...base, position: end.position },
                }),
            ),
        ),
    );
}

// ── Gatherer ────────────────────────────────────────────────────

export function emptyState(): GathererState {
    const noop: InternalEvent = {
        phase: "start",
        stream: null as unknown as PointerStream,
        pointer: {
            id: -1,
            position: { x: 0, y: 0 },
            startPosition: { x: 0, y: 0 },
            startTime: 0,
            pointerType: "mouse",
        },
    };

    return {
        active: new Map(),
        lastEvent: noop,
    };
}

export function gather(
    state: GathererState,
    event: InternalEvent,
): GathererState {
    const active = new Map(state.active);

    switch (event.phase) {
        case "start":
        case "move":
            active.set(event.pointer.id, event.pointer);
            break;

        case "end":
        case "cancel":
            active.delete(event.pointer.id);
            break;
    }

    return { active, lastEvent: event };
}

// ── Projection ──────────────────────────────────────────────────

function toSnapshot(state: GathererState): PointerSnapshot {
    return {
        phase: state.lastEvent.phase,
        changed: state.lastEvent.pointer,
        active: state.active,
        activeCount: state.active.size,
    };
}
