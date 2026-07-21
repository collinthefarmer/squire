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
import { filter, take, map, takeUntil, share, shareReplay } from "rxjs/operators";
import type { Point } from "./transform";

export type PointerEnd = {
    reason: "up" | "cancel";
    position: Point;
};

export type PointerStream = {
    id: number;
    start: Point;
    startTime: number;
    pointerType: "mouse" | "touch" | "pen";
    move$: Observable<Point>;
    end$: Observable<PointerEnd>;
    capture: () => void;
    release: () => void;
};

function normalizePointerType(raw: string): PointerStream["pointerType"] {
    if (raw === "mouse" || raw === "touch" || raw === "pen") return raw;
    return "mouse";
}

export function pointers$(
    element: HTMLElement,
    options?: { gate?: boolean },
): Observable<PointerStream> {
    return new Observable<PointerStream>((subscriber) => {
        let gateCount = 0;

        const onTouchMove = options?.gate
            ? (e: TouchEvent) => {
                  if (gateCount > 0) e.preventDefault();
              }
            : null;

        if (onTouchMove) {
            element.addEventListener("touchmove", onTouchMove, {
                passive: false,
            });
        }

        const onPointerDown = (e: PointerEvent): void => {
            const start: Point = { x: e.clientX, y: e.clientY };
            let captured = false;
            let gated = !!options?.gate;

            if (gated) gateCount++;

            const endGate = (): void => {
                if (!gated) return;
                gateCount--;
                gated = false;
            };

            const capture = (): void => {
                if (captured) return;
                captured = true;

                try {
                    element.setPointerCapture(e.pointerId);
                } catch {
                    // Pointer may already be released
                }
            };

            const release = (): void => {
                endGate();
            };

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

            const cancel$ = fromEvent<PointerEvent>(
                document,
                "pointercancel",
            ).pipe(
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

            end$.subscribe(() => endGate());

            const move$ = fromEvent<PointerEvent>(document, "pointermove").pipe(
                filter((ev) => ev.pointerId === e.pointerId),
                map((ev): Point => ({ x: ev.clientX, y: ev.clientY })),
                takeUntil(end$),
                share(),
            );

            subscriber.next({
                id: e.pointerId,
                start,
                startTime: e.timeStamp,
                pointerType: normalizePointerType(e.pointerType),
                move$,
                end$,
                capture,
                release,
            });
        };

        element.addEventListener("pointerdown", onPointerDown);

        return () => {
            element.removeEventListener("pointerdown", onPointerDown);

            if (onTouchMove) {
                element.removeEventListener("touchmove", onTouchMove);
            }
        };
    });
}
