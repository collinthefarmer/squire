import { describe, test, expect } from "bun:test";
import { Subject, EMPTY } from "rxjs";
import { gather, emptyState, pointerLifecycle$ } from "./pointer-tracker";
import type { InternalEvent } from "./pointer-tracker";
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

function makeStream(
    id: number,
    pointerType: "mouse" | "touch" = "touch",
): PointerStream {
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
): InternalEvent {
    return {
        phase,
        stream: makeStream(id),
        pointer: makePointer(id, position, startPosition),
    };
}

// ── gather ──────────────────────────────────────────────────────

describe("gather", () => {
    test("start adds pointer to active map", () => {
        const state = gather(
            emptyState(),
            makeEvent("start", 1, { x: 10, y: 20 }),
        );

        expect(state.active.size).toBe(1);
        expect(state.active.get(1)?.position).toEqual({ x: 10, y: 20 });
    });

    test("move updates position in active map", () => {
        let state = gather(emptyState(), makeEvent("start", 1, { x: 0, y: 0 }));

        state = gather(state, makeEvent("move", 1, { x: 50, y: 75 }));

        expect(state.active.get(1)?.position).toEqual({ x: 50, y: 75 });
    });

    test("end removes pointer from active map", () => {
        let state = gather(emptyState(), makeEvent("start", 1, { x: 0, y: 0 }));

        state = gather(state, makeEvent("end", 1, { x: 10, y: 10 }));

        expect(state.active.size).toBe(0);
    });

    test("cancel removes pointer from active map", () => {
        let state = gather(emptyState(), makeEvent("start", 1, { x: 0, y: 0 }));

        state = gather(state, makeEvent("cancel", 1, { x: 0, y: 0 }));

        expect(state.active.size).toBe(0);
    });

    test("multiple pointers tracked concurrently", () => {
        let state = gather(emptyState(), makeEvent("start", 1, { x: 0, y: 0 }));

        state = gather(state, makeEvent("start", 2, { x: 100, y: 0 }));

        expect(state.active.size).toBe(2);

        state = gather(state, makeEvent("end", 1, { x: 0, y: 0 }));

        expect(state.active.size).toBe(1);
        expect(state.active.has(2)).toBe(true);
    });

    test("lastEvent tracks the most recent event", () => {
        let state = gather(emptyState(), makeEvent("start", 1, { x: 0, y: 0 }));

        expect(state.lastEvent?.phase).toBe("start");

        state = gather(state, makeEvent("move", 1, { x: 50, y: 50 }));

        expect(state.lastEvent?.phase).toBe("move");
        expect(state.lastEvent?.pointer.position).toEqual({ x: 50, y: 50 });
    });
});

// ── pointerLifecycle$ ───────────────────────────────────────────

describe("pointerLifecycle$", () => {
    test("emits start immediately", () => {
        const events: InternalEvent[] = [];
        const move$ = new Subject<Point>();
        const end$ = new Subject<{
            reason: "up" | "cancel";
            position: Point;
        }>();

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
        const end$ = new Subject<{
            reason: "up" | "cancel";
            position: Point;
        }>();

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
        const end$ = new Subject<{
            reason: "up" | "cancel";
            position: Point;
        }>();

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
        const end$ = new Subject<{
            reason: "up" | "cancel";
            position: Point;
        }>();

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
        const end$ = new Subject<{
            reason: "up" | "cancel";
            position: Point;
        }>();

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
