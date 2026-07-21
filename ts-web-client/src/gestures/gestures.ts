/**
 * Gesture coordination layer.
 *
 * gestures(element) returns a gesture source that coordinates
 * competing recognizers on a single element. Each .on(recognizer)
 * call returns a typed Observable — subscribing enters the
 * competition, unsubscribing withdraws.
 *
 * On pointer-down, concurrent pointers are buffered within a
 * short window (~50ms) then fanned to all eligible recognizers.
 * Each recognizer claims with a confidence value or rejects.
 * Once all have decided, the highest confidence wins — weighted
 * by pointer utilization (recognizers that explain more of the
 * input are preferred). If all reject, pointers are released
 * and the browser handles the interaction (scroll, zoom, etc).
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
import { buffer, debounceTime, filter, share, take } from "rxjs/operators";
import { pointers$ } from "./pointers";
import type { PointerStream } from "./pointers";

// ── Public types ────────────────────────────────────────────────

export type Recognition<T> =
    | { status: "pending" }
    | { status: "claim"; gesture$: Observable<T>; confidence: number }
    | { status: "reject" };

export type Recognizer<T> = {
    readonly touches: number;
    recognize(pointers: PointerStream[]): Observable<Recognition<T>>;
};

export type GestureSource = {
    on<T>(recognizer: Recognizer<T>): Observable<T>;
};

// ── Constants ───────────────────────────────────────────────────

const CONCURRENT_WINDOW_MS = 50;

// ── Factory ─────────────────────────────────────────────────────

export function gestures(element: HTMLElement): GestureSource {
    const registrations: Registration[] = [];
    let sourceSubscription: Subscription | null = null;

    const pointerSource$ = pointers$(element, { gate: true }).pipe(share());

    function ensureListening(): void {
        if (sourceSubscription) return;

        // Buffer concurrent pointers within a short window.
        // Single pointer → 1-touch recognizers only.
        // Multiple pointers → ALL recognizers compete in one
        // competition, each receiving the pointers it needs.
        const grouped$ = pointerSource$.pipe(
            buffer(pointerSource$.pipe(debounceTime(CONCURRENT_WINDOW_MS))),
            filter((group) => group.length > 0),
        );

        sourceSubscription = grouped$.subscribe((group) => {
            runCompetition(group);
        });
    }

    function stopListening(): void {
        sourceSubscription?.unsubscribe();
        sourceSubscription = null;
    }

    function runCompetition(ptrs: PointerStream[]): void {
        const candidates = registrations.filter(
            (r) => r.recognizer.touches <= ptrs.length,
        );

        if (candidates.length === 0) {
            for (const p of ptrs) p.release();
            return;
        }

        let resolved = false;
        let pendingCount = candidates.length;
        const claims: {
            candidate: Registration;
            recognition: Recognition<unknown> & { status: "claim" };
        }[] = [];
        const recognitionSubs: Subscription[] = [];

        const cleanup = (): void => {
            for (const sub of recognitionSubs) sub.unsubscribe();
        };

        const tryResolve = (): void => {
            if (pendingCount > 0 || resolved) return;

            resolved = true;
            cleanup();

            if (claims.length === 0) {
                for (const p of ptrs) p.release();
                return;
            }

            // Weight confidence by pointer utilization — a recognizer
            // that explains more of the input is preferred over one
            // that ignores available pointers.
            const weighted = claims.map((c) => ({
                ...c,
                score:
                    c.recognition.confidence *
                    (c.candidate.recognizer.touches / ptrs.length),
            }));

            weighted.sort((a, b) => b.score - a.score);
            const winner = weighted[0]!;

            for (const p of ptrs) p.capture();

            const gestureSub = winner.recognition.gesture$.subscribe({
                next: (value) => winner.candidate.subject.next(value),
            });

            merge(...ptrs.map((p) => p.end$))
                .pipe(take(1))
                .subscribe(() => {
                    gestureSub.unsubscribe();
                });
        };

        for (const candidate of candidates) {
            const needed = candidate.recognizer.touches;
            const given = ptrs.slice(0, needed);

            const sub = candidate.recognizer
                .recognize(given)
                .subscribe((recognition) => {
                    if (resolved) return;

                    if (recognition.status === "pending") return;

                    pendingCount--;

                    if (recognition.status === "claim") {
                        claims.push({ candidate, recognition });
                    }

                    tryResolve();
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
