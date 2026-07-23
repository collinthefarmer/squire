/**
 * Test fixtures for the gesture system — a `PointerStream` backed by
 * subjects that a test can drive, and a helper to pull the gesture
 * stream out of a claim. Shared by the harness and recognizer tests.
 */

import { Subject, ReplaySubject, type Observable } from "rxjs";
import type { PointerStream, PointerEnd } from "./pointers";
import type { Recognition } from "./recognizers/recognizer";
import type { Point } from "./transform";

export function fakePointer(id: number, start: Point) {
    const move$ = new Subject<Point>();
    const end$ = new ReplaySubject<PointerEnd>(1); // mirrors real shareReplay(1)
    const flags = { captured: false, released: false };

    const stream: PointerStream = {
        id,
        start,
        startTime: 0,
        pointerType: "touch",
        move$: move$.asObservable(),
        end$: end$.asObservable(),
        capture: () => {
            flags.captured = true;
        },
        release: () => {
            flags.released = true;
        },
    };

    return {
        stream,
        flags,
        moveTo: (x: number, y: number) => move$.next({ x, y }),
        lift: (x = start.x, y = start.y, reason: "up" | "cancel" = "up") => {
            end$.next({ reason, position: { x, y } });
            end$.complete();
            move$.complete();
        },
    };
}

export function gestureOf<T>(r: Recognition<T>): Observable<T> {
    if (!r.claimed) throw new Error("expected a claim");
    return r.gesture$;
}
