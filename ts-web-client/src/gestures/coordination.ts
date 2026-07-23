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

import { EMPTY, Observable, concat, merge, of, pipe } from "rxjs";
import type { OperatorFunction } from "rxjs";
import {
    buffer,
    catchError,
    debounceTime,
    distinctUntilChanged,
    filter,
    finalize,
    ignoreElements,
    map,
    mergeMap,
    scan,
    share,
    startWith,
    switchMap,
    take,
    tap,
} from "rxjs/operators";
import { pointers$ } from "./pointers";
import type { PointerStream } from "./pointers";
import type {
    Recognizer,
    Recognition,
    GestureSource,
} from "./recognizers/recognizer";

// ── Constants ──────────────────────────────────────────────────

const CONCURRENT_WINDOW_MS = 50;
const CONFIDENCE_THRESHOLD = 0.5;


// ── Internal types ─────────────────────────────────────────────

type ScoredClaim = {
    recognizer: Recognizer<unknown>;
    recognition: Recognition<unknown> & { claimed: true };
    score: number;
};

type CompetitionState = {
    pending: number;
    winner: ScoredClaim | null;
    settled: boolean;
};

type PointerGroup = {
    pointers: PointerStream[];
    candidates: Recognizer<unknown>[];
};

type CompetitionResult = {
    winner: ScoredClaim | null;
    pointers: PointerStream[];
};

type ResolvedResult = {
    winner: ScoredClaim;
    pointers: PointerStream[];
};

// ── Public API ─────────────────────────────────────────────────

export function gestures(element: HTMLElement): GestureSource {
    const recognizers: Recognizer<unknown>[] = [];

    const pointerSource$ = pointers$(element, { gate: true }).pipe(share());
    const competition$ = pointerSource$.pipe(
        buffer(pointerSource$.pipe(debounceTime(CONCURRENT_WINDOW_MS))),
        filter((group) => group.length > 0),
        matchCandidates(recognizers),
        raceRecognizers(),
        resolveWinner(),
        share(),
    );

    return {
        active$: activeGesture(competition$),

        on<T>(recognizer: Recognizer<T>): Observable<T> {
            recognizers.push(recognizer);

            return competition$.pipe(
                claimGesture(recognizer),
                unregisterOnTeardown(recognizer, recognizers),
            );
        },
    };
}

/**
 * Projects the competition into a name-or-null signal spanning each
 * gesture. The window is the winning gesture stream's lifetime — it
 * opens when a recognizer claims and closes when the stream completes
 * on pointer lift. Nothing here reads the event payload, so gestures
 * that carry no phase (tap) bracket exactly like those that do.
 *
 * switchMap unsubscribes the previous marker when a new gesture wins;
 * the consumer's own subscription in claimGesture is unaffected.
 */
function activeGesture(
    competition$: Observable<ResolvedResult>,
): Observable<string | null> {
    return competition$.pipe(
        switchMap(({ winner }) =>
            concat(
                of(winner.recognizer.name),
                winner.recognition.gesture$.pipe(ignoreElements()),
                of(null),
            ),
        ),
        startWith(null),
        distinctUntilChanged(),
        share(),
    );
}

// ── Operators ──────────────────────────────────────────────────

/**
 * Filters competition results to wins for this recognizer
 * and flattens the winning gesture stream into typed events.
 */
function claimGesture<T>(
    recognizer: Recognizer<T>,
): OperatorFunction<ResolvedResult, T> {
    return pipe(
        filter(
            ({ winner }: ResolvedResult) => winner.recognizer === recognizer,
        ),
        mergeMap(
            ({ winner }: ResolvedResult) =>
                winner.recognition.gesture$ as Observable<T>,
        ),
    );
}

/**
 * Removes a recognizer from the active list when the
 * subscriber unsubscribes.
 */
function unregisterOnTeardown<T>(
    recognizer: Recognizer<T>,
    recognizers: Recognizer<unknown>[],
): OperatorFunction<T, T> {
    return finalize(() => {
        const idx = recognizers.indexOf(recognizer);
        if (idx >= 0) recognizers.splice(idx, 1);
    });
}

/**
 * Filters registered recognizers to those eligible for the current
 * pointer count. Releases pointers if no recognizers qualify.
 */
function matchCandidates(
    recognizers: Recognizer<unknown>[],
): OperatorFunction<PointerStream[], PointerGroup> {
    return pipe(
        map((pointers: PointerStream[]) => ({
            pointers,
            candidates: recognizers.filter((r) => r.touches <= pointers.length),
        })),
        tap(({ pointers, candidates }) => {
            if (candidates.length === 0) releaseAll(pointers);
        }),
        filter(({ candidates }) => candidates.length > 0),
    );
}

/**
 * Fans out to all candidate recognizers in parallel, accumulates
 * scored claims, and emits the winner (or null) once settled.
 */
function raceRecognizers(): OperatorFunction<PointerGroup, CompetitionResult> {
    return mergeMap(({ pointers, candidates }) => {
        // Each recognizer receives the first N pointers it needs.
        // Multiple recognizers may compete over the same pointers;
        // the winner claims them exclusively.
        const recognitions$ = candidates.map((recognizer) => {
            const given = pointers.slice(0, recognizer.touches);

            return recognizer.recognize(given).pipe(
                take(1),
                map((recognition) => ({ recognizer, recognition })),
            );
        });

        const accumulate = competitionReducer(pointers.length);

        return merge(...recognitions$).pipe(
            scan(accumulate, {
                pending: candidates.length,
                winner: null,
                settled: false,
            }),
            filter((state) => state.settled),
            take(1),
            map((state) => ({ winner: state.winner, pointers })),
            catchError(() => {
                releaseAll(pointers);
                return EMPTY;
            }),
        );
    });
}

/**
 * Captures pointers for the winning recognizer, or releases
 * them if nobody claimed. Drops emissions with no winner.
 */
function resolveWinner(): OperatorFunction<CompetitionResult, ResolvedResult> {
    return pipe(
        tap(({ winner, pointers }: CompetitionResult) => {
            if (winner) {
                for (const p of pointers) p.capture();
            } else {
                releaseAll(pointers);
            }
        }),
        filter(
            (result: CompetitionResult): result is ResolvedResult =>
                result.winner !== null,
        ),
    );
}

// ── Competition ────────────────────────────────────────────────

type RecognitionResult = {
    recognizer: Recognizer<unknown>;
    recognition: Recognition<unknown>;
};

/**
 * Returns a reducer that tracks the highest-scoring claim and
 * determines when the competition is settled — either all
 * recognizers responded, or the best claim scores above threshold
 * using all available pointers.
 */
function competitionReducer(pointerCount: number) {
    return (
        state: CompetitionState,
        { recognizer, recognition }: RecognitionResult,
    ): CompetitionState => {
        const pending = state.pending - 1;

        if (!recognition.claimed) {
            return { ...state, pending, settled: pending === 0 };
        }

        const score =
            recognition.confidence * (recognizer.touches / pointerCount);

        const winner =
            !state.winner || score > state.winner.score
                ? { recognizer, recognition, score }
                : state.winner;

        const earlyWinner =
            score >= CONFIDENCE_THRESHOLD && recognizer.touches >= pointerCount;

        return { pending, winner, settled: pending === 0 || earlyWinner };
    };
}

function releaseAll(pointers: PointerStream[]): void {
    for (const p of pointers) p.release();
}
