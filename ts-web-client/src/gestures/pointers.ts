/**
 * Per-pointer lifecycle streams from Pointer Events.
 *
 * Each pointer-down on the target element emits a PointerStream —
 * a per-pointer observable lifecycle with move$, end$, and
 * capture/release controls. Unsubscribing tears down all listeners.
 *
 * Gate mode: when enabled, a non-passive touchmove listener blocks
 * browser scroll during a detection window. Call capture() to claim
 * the pointer for JS, or release() to hand it back to the browser
 * for native scroll. The gate is ref-counted across concurrent
 * pointers and auto-releases on pointer end.
 */

import { Observable, fromEvent, merge } from "rxjs";
import {
    filter,
    take,
    map,
    takeUntil,
    share,
    shareReplay,
} from "rxjs/operators";
import type { Point as Vector2 } from "./transform";

export type PointerEnd = {
    reason: "up" | "cancel";
    position: Vector2;
};

export type PointerStream = {
    id: number;
    start: Vector2;
    startTime: number;
    pointerType: "mouse" | "touch" | "pen";
    move$: Observable<Vector2>;
    end$: Observable<PointerEnd>;
    capture: () => void;
    release: () => void;
};

// ── Pointer stream factory ─────────────────────────────────────

export function pointers$(
    element: HTMLElement,
    options?: { gate?: boolean },
): Observable<PointerStream> {
    return new Observable<PointerStream>((subscriber) => {
        const gate = options?.gate ? createGate(element) : null;

        const onPointerDown = (e: PointerEvent): void => {
            subscriber.next(buildPointerStream(e, element, gate));
        };

        element.addEventListener("pointerdown", onPointerDown);

        return () => {
            element.removeEventListener("pointerdown", onPointerDown);
            gate?.teardown();
        };
    });
}

type Gate = {
    hold: () => () => void;
    teardown: () => void;
};

function createGate(element: HTMLElement): Gate {
    let count = 0;

    const onTouchMove = (e: TouchEvent): void => {
        if (count > 0) e.preventDefault();
    };

    element.addEventListener("touchmove", onTouchMove, { passive: false });

    return {
        hold() {
            count++;
            let released = false;

            return () => {
                if (released) return;
                released = true;
                count--;
            };
        },

        teardown() {
            element.removeEventListener("touchmove", onTouchMove);
        },
    };
}

function buildPointerStream(
    e: PointerEvent,
    element: HTMLElement,
    gate: Gate | null,
): PointerStream {
    const start: Vector2 = { x: e.clientX, y: e.clientY };
    const releaseGate = gate?.hold() ?? null;
    let captured = false;

    const up$ = fromEvent<PointerEvent>(document, "pointerup").pipe(
        filter((ev) => ev.pointerId === e.pointerId),
        take(1),
        map(
            (ev): PointerEnd => ({
                reason: "up",
                position: { x: ev.clientX, y: ev.clientY },
            }),
        ),
    );

    const cancel$ = fromEvent<PointerEvent>(document, "pointercancel").pipe(
        filter((ev) => ev.pointerId === e.pointerId),
        take(1),
        map(
            (ev): PointerEnd => ({
                reason: "cancel",
                position: { x: ev.clientX, y: ev.clientY },
            }),
        ),
    );

    const end$ = merge(up$, cancel$).pipe(take(1), shareReplay(1));

    end$.subscribe(() => releaseGate?.());

    const move$ = fromEvent<PointerEvent>(document, "pointermove").pipe(
        filter((ev) => ev.pointerId === e.pointerId),
        map((ev): Vector2 => ({ x: ev.clientX, y: ev.clientY })),
        takeUntil(end$),
        share(),
    );

    return {
        id: e.pointerId,
        start,
        startTime: e.timeStamp,
        pointerType: normalizePointerType(e.pointerType),
        move$,
        end$,
        capture() {
            if (captured) return;
            captured = true;

            try {
                element.setPointerCapture(e.pointerId);
            } catch {
                // Pointer may already be released
            }
        },
        release() {
            releaseGate?.();
        },
    };
}

function normalizePointerType(raw: string): PointerStream["pointerType"] {
    if (raw === "mouse" || raw === "touch" || raw === "pen") return raw;
    return "mouse";
}
