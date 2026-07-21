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

import { Observable, Subject, merge } from "rxjs";
import type { Subscription } from "rxjs";
import { buffer, debounceTime, filter, map, scan, share, take } from "rxjs/operators";
import { pointers$ } from "./pointers";
import type { PointerStream } from "./pointers";
import type { Recognizer, Recognition, GestureSource } from "./recognizer";

// ── Constants ───────────────────────────────────────────────────

const CONCURRENT_WINDOW_MS = 50;
const CONFIDENCE_THRESHOLD = 0.5;

// ── Internal types ──────────────────────────────────────────────

type Registration = {
    recognizer: Recognizer<unknown>;
    subject: Subject<unknown>;
};

type ScoredClaim = {
    candidate: Registration;
    recognition: Recognition<unknown> & { claimed: true };
    score: number;
};

type CompetitionState = {
    pending: number;
    claims: ScoredClaim[];
};

// ── Factory ─────────────────────────────────────────────────────

export function gestures(element: HTMLElement): GestureSource {
    const registrations: Registration[] = [];
    let sourceSubscription: Subscription | null = null;

    const pointerSource$ = pointers$(element, { gate: true }).pipe(share());

    function ensureListening(): void {
        if (sourceSubscription) return;

        const grouped$ = pointerSource$.pipe(
            buffer(pointerSource$.pipe(debounceTime(CONCURRENT_WINDOW_MS))),
            filter((group) => group.length > 0),
        );

        sourceSubscription = grouped$.subscribe((group) => {
            runCompetition(group, registrations);
        });
    }

    function stopListening(): void {
        sourceSubscription?.unsubscribe();
        sourceSubscription = null;
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

// ── Competition ─────────────────────────────────────────────────

function runCompetition(
    ptrs: PointerStream[],
    registrations: Registration[],
): void {
    const candidates = registrations.filter(
        (r) => r.recognizer.touches <= ptrs.length,
    );

    if (candidates.length === 0) {
        for (const p of ptrs) p.release();
        return;
    }

    const recognitions$ = candidates.map((candidate) => {
        const given = ptrs.slice(0, candidate.recognizer.touches);

        return candidate.recognizer.recognize(given).pipe(
            take(1),
            map((recognition) => ({ candidate, recognition })),
        );
    });

    merge(...recognitions$)
        .pipe(
            scan(
                (state, { candidate, recognition }): CompetitionState => {
                    const claims = [...state.claims];

                    if (recognition.claimed) {
                        claims.push({
                            candidate,
                            recognition,
                            score:
                                recognition.confidence *
                                (candidate.recognizer.touches / ptrs.length),
                        });
                    }

                    return { pending: state.pending - 1, claims };
                },
                { pending: candidates.length, claims: [] } as CompetitionState,
            ),
            filter(
                (state) =>
                    state.pending === 0 ||
                    state.claims.some(
                        (c) =>
                            c.score >= CONFIDENCE_THRESHOLD &&
                            c.candidate.recognizer.touches >= ptrs.length,
                    ),
            ),
            take(1),
        )
        .subscribe((state) => {
            if (state.claims.length === 0) {
                for (const p of ptrs) p.release();
                return;
            }

            state.claims.sort((a, b) => b.score - a.score);
            const winner = state.claims[0]!;

            for (const p of ptrs) p.capture();

            winner.recognition.gesture$.subscribe({
                next: (value) => winner.candidate.subject.next(value),
            });
        });
}
