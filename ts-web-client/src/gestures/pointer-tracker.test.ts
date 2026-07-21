import { describe, test, expect } from "bun:test";
import { Subject, of, EMPTY } from "rxjs";
import {
    canScrollInDirection,
    reduceTracker,
    emptyState,
    pointerLifecycle$,
} from "./pointer-tracker";
import type {
    TrackerState,
    InternalEvent,
    ScrollState,
    ClaimPhase,
} from "./pointer-tracker";
import type { TrackedPointer } from "./pointer-tracker";
import type { PointerStream } from "./pointers";
import type { Point } from "./transform";

// ── Factories ───────────────────────────────────────────────────

function makePointer(
    id: number,
    position: Point,
    startPosition?: Point,
): TrackedPointer {
    return {
        id,
        position,
        startPosition: startPosition ?? position,
        startTime: 0,
        pointerType: "touch",
    };
}

function makeStream(id: number, pointerType: "mouse" | "touch" = "touch"): PointerStream {
    return {
        id,
        start: { x: 0, y: 0 },
        startTime: 0,
        pointerType,
        move$: EMPTY,
        end$: EMPTY,
        capture: () => {},
        release: () => {},
    };
}

function makeEvent(
    phase: InternalEvent["phase"],
    id: number,
    position: Point,
    startPosition?: Point,
    pointerType: "mouse" | "touch" = "touch",
): InternalEvent {
    return {
        phase,
        stream: makeStream(id, pointerType),
        pointer: makePointer(id, position, startPosition),
    };
}

function makeScrollState(overrides?: Partial<ScrollState>): ScrollState {
    return {
        scrollTop: 0,
        scrollHeight: 1000,
        clientHeight: 500,
        scrollLeft: 0,
        scrollWidth: 500,
        clientWidth: 500,
        ...overrides,
    };
}

function reduce(
    state: TrackerState,
    event: InternalEvent,
    scrollState?: ScrollState | null,
): TrackerState {
    return reduceTracker(state, event, scrollState ?? null);
}

// ── canScrollInDirection ────────────────────────────────────────

describe("canScrollInDirection", () => {
    test("at top, finger moving down (overscroll) — cannot scroll", () => {
        const scroll = makeScrollState({ scrollTop: 0 });
        expect(canScrollInDirection(scroll, 0, 10)).toBe(false);
    });

    test("at top, finger moving up (scroll into content) — can scroll", () => {
        const scroll = makeScrollState({ scrollTop: 0 });
        expect(canScrollInDirection(scroll, 0, -10)).toBe(true);
    });

    test("mid-scroll, finger moving down — can scroll", () => {
        const scroll = makeScrollState({ scrollTop: 200 });
        expect(canScrollInDirection(scroll, 0, 10)).toBe(true);
    });

    test("mid-scroll, finger moving up — can scroll", () => {
        const scroll = makeScrollState({ scrollTop: 200 });
        expect(canScrollInDirection(scroll, 0, -10)).toBe(true);
    });

    test("at bottom, finger moving up (overscroll) — cannot scroll", () => {
        const scroll = makeScrollState({
            scrollTop: 500,
            scrollHeight: 1000,
            clientHeight: 500,
        });
        expect(canScrollInDirection(scroll, 0, -10)).toBe(false);
    });

    test("at bottom, finger moving down (scroll back up) — can scroll", () => {
        const scroll = makeScrollState({
            scrollTop: 500,
            scrollHeight: 1000,
            clientHeight: 500,
        });
        expect(canScrollInDirection(scroll, 0, 10)).toBe(true);
    });

    test("horizontal: at left edge, finger moving right (overscroll) — cannot scroll", () => {
        const scroll = makeScrollState({
            scrollLeft: 0,
            scrollWidth: 1000,
            clientWidth: 500,
        });
        expect(canScrollInDirection(scroll, 10, 0)).toBe(false);
    });

    test("horizontal: at left edge, finger moving left (scroll into content) — can scroll", () => {
        const scroll = makeScrollState({
            scrollLeft: 0,
            scrollWidth: 1000,
            clientWidth: 500,
        });
        expect(canScrollInDirection(scroll, -10, 0)).toBe(true);
    });

    test("no movement — cannot scroll", () => {
        const scroll = makeScrollState();
        expect(canScrollInDirection(scroll, 0, 0)).toBe(false);
    });

    test("dominant axis wins when diagonal", () => {
        const scroll = makeScrollState({ scrollTop: 0 });

        // More vertical than horizontal — uses vertical check
        expect(canScrollInDirection(scroll, 3, 10)).toBe(false);

        // More horizontal — uses horizontal check
        expect(canScrollInDirection(scroll, 10, 3)).toBe(false);
    });
});

// ── reduceTracker ───────────────────────────────────────────────

describe("reduceTracker", () => {
    describe("always-capture mode (no scroll state)", () => {
        test("touch start → claimed immediately", () => {
            const state = reduce(
                emptyState(),
                makeEvent("start", 1, { x: 0, y: 0 }),
            );

            expect(state.claimPhase).toBe("claimed");
            expect(state.active.size).toBe(1);
        });

        test("mouse start → claimed immediately", () => {
            const state = reduce(
                emptyState(),
                makeEvent("start", 1, { x: 0, y: 0 }, undefined, "mouse"),
            );

            expect(state.claimPhase).toBe("claimed");
        });

        test("second pointer during claimed stays claimed", () => {
            let state = reduce(
                emptyState(),
                makeEvent("start", 1, { x: 0, y: 0 }),
            );

            state = reduce(
                state,
                makeEvent("start", 2, { x: 100, y: 0 }),
            );

            expect(state.claimPhase).toBe("claimed");
            expect(state.active.size).toBe(2);
        });

        test("last pointer end → idle", () => {
            let state = reduce(
                emptyState(),
                makeEvent("start", 1, { x: 0, y: 0 }),
            );

            state = reduce(
                state,
                makeEvent("end", 1, { x: 10, y: 10 }),
            );

            expect(state.claimPhase).toBe("idle");
            expect(state.active.size).toBe(0);
        });

        test("one of two pointers ends — stays claimed", () => {
            let state = reduce(
                emptyState(),
                makeEvent("start", 1, { x: 0, y: 0 }),
            );

            state = reduce(
                state,
                makeEvent("start", 2, { x: 100, y: 0 }),
            );

            state = reduce(
                state,
                makeEvent("end", 1, { x: 0, y: 0 }),
            );

            expect(state.claimPhase).toBe("claimed");
            expect(state.active.size).toBe(1);
        });
    });

    describe("scroll coexistence mode", () => {
        const atTop = makeScrollState({ scrollTop: 0 });
        const midScroll = makeScrollState({ scrollTop: 200 });

        test("touch start → detecting", () => {
            const state = reduce(
                emptyState(),
                makeEvent("start", 1, { x: 100, y: 100 }),
                atTop,
            );

            expect(state.claimPhase).toBe("detecting");
        });

        test("mouse start → claimed (skips detection)", () => {
            const state = reduce(
                emptyState(),
                makeEvent("start", 1, { x: 0, y: 0 }, undefined, "mouse"),
                atTop,
            );

            expect(state.claimPhase).toBe("claimed");
        });

        test("move below threshold — stays detecting", () => {
            let state = reduce(
                emptyState(),
                makeEvent("start", 1, { x: 100, y: 100 }),
                atTop,
            );

            state = reduce(
                state,
                makeEvent("move", 1, { x: 100, y: 105 }, { x: 100, y: 100 }),
                atTop,
            );

            expect(state.claimPhase).toBe("detecting");
        });

        test("move past threshold at boundary (overscroll direction) → claimed", () => {
            let state = reduce(
                emptyState(),
                makeEvent("start", 1, { x: 100, y: 100 }),
                atTop,
            );

            // Pull down at scrollTop=0 — can't scroll, so claim
            state = reduce(
                state,
                makeEvent("move", 1, { x: 100, y: 115 }, { x: 100, y: 100 }),
                atTop,
            );

            expect(state.claimPhase).toBe("claimed");
        });

        test("move past threshold in scrollable direction → released", () => {
            let state = reduce(
                emptyState(),
                makeEvent("start", 1, { x: 100, y: 100 }),
                atTop,
            );

            // Swipe up at scrollTop=0 — can scroll down, so release
            state = reduce(
                state,
                makeEvent("move", 1, { x: 100, y: 85 }, { x: 100, y: 100 }),
                atTop,
            );

            expect(state.claimPhase).toBe("released");
        });

        test("move past threshold mid-scroll — always released", () => {
            let state = reduce(
                emptyState(),
                makeEvent("start", 1, { x: 100, y: 100 }),
                midScroll,
            );

            // Either direction from mid-scroll: can scroll both ways
            state = reduce(
                state,
                makeEvent("move", 1, { x: 100, y: 115 }, { x: 100, y: 100 }),
                midScroll,
            );

            expect(state.claimPhase).toBe("released");
        });

        test("cancel during detecting → idle", () => {
            let state = reduce(
                emptyState(),
                makeEvent("start", 1, { x: 100, y: 100 }),
                atTop,
            );

            state = reduce(
                state,
                makeEvent("cancel", 1, { x: 100, y: 100 }),
                atTop,
            );

            expect(state.claimPhase).toBe("idle");
            expect(state.active.size).toBe(0);
        });

        test("previousClaimPhase tracks transitions", () => {
            let state = reduce(
                emptyState(),
                makeEvent("start", 1, { x: 100, y: 100 }),
                atTop,
            );

            expect(state.previousClaimPhase).toBe("idle");
            expect(state.claimPhase).toBe("detecting");

            state = reduce(
                state,
                makeEvent("move", 1, { x: 100, y: 115 }, { x: 100, y: 100 }),
                atTop,
            );

            expect(state.previousClaimPhase).toBe("detecting");
            expect(state.claimPhase).toBe("claimed");
        });
    });

    describe("move updates position in active map", () => {
        test("position updates on move", () => {
            let state = reduce(
                emptyState(),
                makeEvent("start", 1, { x: 0, y: 0 }),
            );

            state = reduce(
                state,
                makeEvent("move", 1, { x: 50, y: 75 }),
            );

            const pointer = state.active.get(1);
            expect(pointer?.position).toEqual({ x: 50, y: 75 });
        });
    });
});

// ── pointerLifecycle$ ───────────────────────────────────────────

describe("pointerLifecycle$", () => {
    test("emits start immediately", () => {
        const events: InternalEvent[] = [];
        const move$ = new Subject<Point>();
        const end$ = new Subject<{ reason: "up" | "cancel"; position: Point }>();

        const stream: PointerStream = {
            id: 1,
            start: { x: 10, y: 20 },
            startTime: 100,
            pointerType: "touch",
            move$: move$.asObservable(),
            end$: end$.asObservable(),
            capture: () => {},
            release: () => {},
        };

        pointerLifecycle$(stream).subscribe((e) => events.push(e));

        expect(events.length).toBe(1);
        expect(events[0]!.phase).toBe("start");
        expect(events[0]!.pointer.position).toEqual({ x: 10, y: 20 });
        expect(events[0]!.pointer.startPosition).toEqual({ x: 10, y: 20 });
        expect(events[0]!.pointer.pointerType).toBe("touch");

        move$.complete();
        end$.complete();
    });

    test("emits move events with updated position", () => {
        const events: InternalEvent[] = [];
        const move$ = new Subject<Point>();
        const end$ = new Subject<{ reason: "up" | "cancel"; position: Point }>();

        const stream: PointerStream = {
            id: 1,
            start: { x: 0, y: 0 },
            startTime: 0,
            pointerType: "touch",
            move$: move$.asObservable(),
            end$: end$.asObservable(),
            capture: () => {},
            release: () => {},
        };

        pointerLifecycle$(stream).subscribe((e) => events.push(e));

        move$.next({ x: 50, y: 60 });
        move$.next({ x: 100, y: 120 });

        expect(events.length).toBe(3);
        expect(events[1]!.phase).toBe("move");
        expect(events[1]!.pointer.position).toEqual({ x: 50, y: 60 });
        expect(events[1]!.pointer.startPosition).toEqual({ x: 0, y: 0 });
        expect(events[2]!.phase).toBe("move");
        expect(events[2]!.pointer.position).toEqual({ x: 100, y: 120 });

        move$.complete();
        end$.complete();
    });

    test("emits end with final position", () => {
        const events: InternalEvent[] = [];
        const move$ = new Subject<Point>();
        const end$ = new Subject<{ reason: "up" | "cancel"; position: Point }>();

        const stream: PointerStream = {
            id: 1,
            start: { x: 0, y: 0 },
            startTime: 0,
            pointerType: "touch",
            move$: move$.asObservable(),
            end$: end$.asObservable(),
            capture: () => {},
            release: () => {},
        };

        pointerLifecycle$(stream).subscribe((e) => events.push(e));
        end$.next({ reason: "up", position: { x: 30, y: 40 } });

        const last = events.at(-1)!;
        expect(last.phase).toBe("end");
        expect(last.pointer.position).toEqual({ x: 30, y: 40 });
    });

    test("cancel reason maps to cancel phase", () => {
        const events: InternalEvent[] = [];
        const move$ = new Subject<Point>();
        const end$ = new Subject<{ reason: "up" | "cancel"; position: Point }>();

        const stream: PointerStream = {
            id: 1,
            start: { x: 0, y: 0 },
            startTime: 0,
            pointerType: "touch",
            move$: move$.asObservable(),
            end$: end$.asObservable(),
            capture: () => {},
            release: () => {},
        };

        pointerLifecycle$(stream).subscribe((e) => events.push(e));
        end$.next({ reason: "cancel", position: { x: 0, y: 0 } });

        expect(events.at(-1)!.phase).toBe("cancel");
    });

    test("stream reference is preserved on all events", () => {
        const events: InternalEvent[] = [];
        const move$ = new Subject<Point>();
        const end$ = new Subject<{ reason: "up" | "cancel"; position: Point }>();

        const stream: PointerStream = {
            id: 42,
            start: { x: 0, y: 0 },
            startTime: 0,
            pointerType: "touch",
            move$: move$.asObservable(),
            end$: end$.asObservable(),
            capture: () => {},
            release: () => {},
        };

        pointerLifecycle$(stream).subscribe((e) => events.push(e));
        move$.next({ x: 10, y: 10 });
        end$.next({ reason: "up", position: { x: 10, y: 10 } });

        for (const event of events) {
            expect(event.stream).toBe(stream);
        }
    });
});
