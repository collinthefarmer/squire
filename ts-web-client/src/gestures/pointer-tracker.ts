/**
 * Multi-pointer tracker composed from per-pointer lifecycle streams.
 *
 * trackedPointers$ gathers concurrent pointer streams into a single
 * observable of PointerSnapshots — each emission carries the full
 * set of active pointers, the pointer that changed, and (when
 * coexisting with scroll) the current claim state.
 *
 * Pipeline:
 *   pointers$
 *     → mergeMap(pointerLifecycle$)
 *     → scan(reduceTracker)
 *     → tap(applyClaimEffects)
 *     → map(toSnapshot)
 *     → share()
 *
 * Scroll coexistence: when { scroll: true }, the tracker gates
 * browser scroll during a detection window (~10px). At the
 * threshold it reads the element's DOM scroll state and checks
 * whether movement conflicts with available scroll room. If the
 * element can scroll in that direction, the gate releases and
 * the browser handles natively. If not, the tracker claims the
 * pointer for an overscroll gesture.
 */

import { of, merge } from "rxjs";
import { mergeMap, scan, tap, map, share } from "rxjs/operators";
import { pointers$ } from "./pointers";
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
    claimState?: "detecting" | "claimed" | "released";
}

export type TrackerOptions = {
    scroll?: boolean;
};

// ── Public entry point ──────────────────────────────────────────

export function trackedPointers$(
    element: HTMLElement,
    options?: TrackerOptions,
): Observable<PointerSnapshot> {
    const scroll = options?.scroll ?? false;

    return pointers$(element, { gate: scroll }).pipe(
        mergeMap((stream) => pointerLifecycle$(stream)),
        scan(
            (state: TrackerState, event: InternalEvent) =>
                reduceTracker(
                    state,
                    event,
                    scroll ? readScrollState(element) : null,
                ),
            emptyState(),
        ),
        tap(applyClaimEffects),
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

export type ClaimPhase = "idle" | "detecting" | "claimed" | "released";

export type TrackerState = {
    active: Map<number, TrackedPointer>;
    streams: Map<number, PointerStream>;
    claimPhase: ClaimPhase;
    previousClaimPhase: ClaimPhase;
    lastEvent: InternalEvent;
};

export type ScrollState = {
    scrollTop: number;
    scrollHeight: number;
    clientHeight: number;
    scrollLeft: number;
    scrollWidth: number;
    clientWidth: number;
};

// ── Lifecycle flattening ────────────────────────────────────────

export function pointerLifecycle$(stream: PointerStream): Observable<InternalEvent> {
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

// ── Reducer ─────────────────────────────────────────────────────

const DETECTION_THRESHOLD = 10;

export function emptyState(): TrackerState {
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
        streams: new Map(),
        claimPhase: "idle",
        previousClaimPhase: "idle",
        lastEvent: noop,
    };
}

export function reduceTracker(
    state: TrackerState,
    event: InternalEvent,
    scrollState: ScrollState | null,
): TrackerState {
    const previousClaimPhase = state.claimPhase;
    const active = new Map(state.active);
    const streams = new Map(state.streams);
    let claimPhase = state.claimPhase;

    switch (event.phase) {
        case "start": {
            active.set(event.pointer.id, event.pointer);
            streams.set(event.stream.id, event.stream);

            if (event.stream.pointerType === "mouse" || !scrollState) {
                claimPhase = "claimed";
            } else if (claimPhase === "idle") {
                claimPhase = "detecting";
            }

            break;
        }

        case "move": {
            active.set(event.pointer.id, event.pointer);

            if (claimPhase === "detecting" && scrollState) {
                const dx =
                    event.pointer.position.x - event.pointer.startPosition.x;
                const dy =
                    event.pointer.position.y - event.pointer.startPosition.y;

                if (Math.hypot(dx, dy) >= DETECTION_THRESHOLD) {
                    claimPhase = canScrollInDirection(scrollState, dx, dy)
                        ? "released"
                        : "claimed";
                }
            }

            break;
        }

        case "end":
        case "cancel": {
            active.delete(event.pointer.id);
            streams.delete(event.stream.id);

            if (active.size === 0) {
                claimPhase = "idle";
            }

            break;
        }
    }

    return {
        active,
        streams,
        claimPhase,
        previousClaimPhase,
        lastEvent: event,
    };
}

// ── Scroll boundary detection ───────────────────────────────────

function readScrollState(element: HTMLElement): ScrollState {
    return {
        scrollTop: element.scrollTop,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
        scrollLeft: element.scrollLeft,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
    };
}

export function canScrollInDirection(
    scroll: ScrollState,
    dx: number,
    dy: number,
): boolean {
    const vertical = Math.abs(dy) >= Math.abs(dx);

    if (vertical) {
        if (dy < 0) {
            return (
                scroll.scrollTop + scroll.clientHeight < scroll.scrollHeight - 1
            );
        }

        if (dy > 0) {
            return scroll.scrollTop > 0;
        }
    } else {
        if (dx < 0) {
            return (
                scroll.scrollLeft + scroll.clientWidth < scroll.scrollWidth - 1
            );
        }

        if (dx > 0) {
            return scroll.scrollLeft > 0;
        }
    }

    return false;
}

// ── Side effects ────────────────────────────────────────────────

function applyClaimEffects(state: TrackerState): void {
    const { previousClaimPhase, claimPhase, lastEvent } = state;

    if (claimPhase === "claimed") {
        const transitioned = previousClaimPhase !== "claimed";
        const newPointerWhileClaimed =
            previousClaimPhase === "claimed" && lastEvent.phase === "start";

        if (transitioned || newPointerWhileClaimed) {
            for (const stream of state.streams.values()) {
                stream.capture();
            }
        }
    }

    if (previousClaimPhase === "detecting" && claimPhase === "released") {
        for (const stream of state.streams.values()) {
            stream.release();
        }
    }
}

// ── Projection ──────────────────────────────────────────────────

function toSnapshot(state: TrackerState): PointerSnapshot {
    const snap: PointerSnapshot = {
        phase: state.lastEvent.phase,
        changed: state.lastEvent.pointer,
        active: state.active,
        activeCount: state.active.size,
    };

    if (state.claimPhase !== "idle") {
        snap.claimState = state.claimPhase;
    }

    return snap;
}
