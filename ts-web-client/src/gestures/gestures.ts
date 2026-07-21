/**
 * Gesture coordination layer.
 *
 * gestures(element) returns a gesture source that coordinates
 * competing recognizers on a single element. Each .on(recognizer)
 * call returns a typed Observable — subscribing enters the
 * competition, unsubscribing withdraws.
 *
 * On pointer-down, concurrent pointers are buffered within a
 * short window (~100ms) then fanned to recognizers matching the
 * touch count. Recognizers race — first to claim wins. The source
 * captures the pointers and forwards the winner's gesture stream.
 * If all reject, pointers are released and the browser handles
 * the interaction (scroll, zoom, etc).
 *
 * The gate mechanism (non-passive touchmove preventDefault) is
 * owned by pointers$ — it holds during the competition window
 * and releases when pointers are captured or released.
 */

import {
    Observable,
    Subject,
    merge,
    type Subscription,
} from "rxjs";
import { buffer, debounceTime, filter, map, share, take } from "rxjs/operators";
import { pointers$ } from "./pointers";
import type { PointerStream } from "./pointers";

// ── Public types ────────────────────────────────────────────────

export type Recognition<T> =
    | { status: "pending" }
    | { status: "claim"; gesture$: Observable<T> }
    | { status: "reject" };

export type Recognizer<T> = {
    readonly touches: number;
    recognize(pointers: PointerStream[]): Observable<Recognition<T>>;
};

export type GestureSource = {
    on<T>(recognizer: Recognizer<T>): Observable<T>;
};

// ── Constants ───────────────────────────────────────────────────

const CONCURRENT_WINDOW_MS = 100;

// ── Factory ─────────────────────────────────────────────────────

export function gestures(element: HTMLElement): GestureSource {
    const registrations: Registration[] = [];
    let sourceSubscription: Subscription | null = null;

    const pointerSource$ = pointers$(element, { gate: true }).pipe(share());

    function ensureListening(): void {
        if (sourceSubscription) return;

        // Single-touch: process immediately so the gate releases
        // quickly enough for the browser to start scrolling.
        const singleTouch$ = pointerSource$.pipe(
            map((pointer) => [pointer]),
        );

        // Multi-touch: buffer concurrent pointers within a window,
        // then run a separate competition for the group.
        const multiTouch$ = pointerSource$.pipe(
            buffer(pointerSource$.pipe(debounceTime(CONCURRENT_WINDOW_MS))),
            filter((group) => group.length >= 2),
        );

        sourceSubscription = merge(singleTouch$, multiTouch$).subscribe(
            (group) => {
                runCompetition(group, group.length);
            },
        );
    }

    function stopListening(): void {
        sourceSubscription?.unsubscribe();
        sourceSubscription = null;
    }

    function runCompetition(ptrs: PointerStream[], touches: number): void {
        const candidates = registrations.filter(
            (r) => r.recognizer.touches === touches,
        );

        if (candidates.length === 0) {
            for (const p of ptrs) p.release();
            return;
        }

        let resolved = false;
        let pendingCount = candidates.length;
        const recognitionSubs: Subscription[] = [];

        const cleanup = (): void => {
            for (const sub of recognitionSubs) sub.unsubscribe();
        };

        const reject = (): void => {
            pendingCount--;

            if (pendingCount > 0 || resolved) return;

            resolved = true;
            cleanup();

            for (const p of ptrs) p.release();
        };

        for (const candidate of candidates) {
            const sub = candidate.recognizer
                .recognize(ptrs)
                .subscribe((recognition) => {
                    if (resolved) return;

                    if (recognition.status === "pending") return;

                    if (recognition.status === "reject") {
                        reject();
                        return;
                    }

                    resolved = true;
                    cleanup();

                    for (const p of ptrs) p.capture();

                    const gestureSub = recognition.gesture$.subscribe({
                        next: (value) => candidate.subject.next(value),
                    });

                    merge(...ptrs.map((p) => p.end$))
                        .pipe(take(1))
                        .subscribe(() => {
                            gestureSub.unsubscribe();
                        });
                });

            recognitionSubs.push(sub);
        }
    }

    return {
        on<T>(recognizer: Recognizer<T>): Observable<T> {
            return new Observable<T>((subscriber) => {
                const subject = new Subject<unknown>();
                const entry: Registration = {
                    recognizer: recognizer as Recognizer<unknown>,
                    subject,
                };

                registrations.push(entry);
                ensureListening();

                const sub = subject.subscribe({
                    next: (value) => subscriber.next(value as T),
                    error: (err) => subscriber.error(err),
                });

                return () => {
                    sub.unsubscribe();
                    subject.complete();

                    const idx = registrations.indexOf(entry);
                    if (idx >= 0) registrations.splice(idx, 1);

                    if (registrations.length === 0) stopListening();
                };
            });
        },
    };
}

// ── Internal types ──────────────────────────────────────────────

type Registration = {
    recognizer: Recognizer<unknown>;
    subject: Subject<unknown>;
};
