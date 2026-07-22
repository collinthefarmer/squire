/**
 * Gesture recognizer harness — lifecycle bridge between raw
 * pointer input and recognized gestures.
 *
 * The harness owns everything the recognizer shouldn't think
 * about: the temporal race (pointers ending before a decision),
 * stream termination on pointer lift, last-known-state tracking
 * for end events, and claim assembly for the coordination layer.
 *
 * The metrics type M is captured via inference in `describe()`
 * and erased at the `defineRecognizer()` boundary. It never
 * appears in any shared interface.
 */

import { Observable, merge, of, race } from "rxjs";
import {
    filter,
    map,
    shareReplay,
    startWith,
    take,
    takeUntil,
    withLatestFrom,
} from "rxjs/operators";
import type { PointerStream, PointerEnd } from "./pointers";
import type { Recognition, Recognizer } from "./recognizers/recognizer";

export type RecognizerDescriptor<M, T> = {
    metrics$: Observable<M>;
    decide: (m: M) => number | false | null;
    toEvent: (m: M) => T;
    toEnd?: (end: PointerEnd, last: T) => T;
    /**
     * When true, pointer-end events flow into metrics$ instead of
     * auto-rejecting. The recognizer's metrics$ is responsible for
     * including end data, and decide() evaluates it like any other
     * metric. Used by gestures like tap that decide at pointer end.
     */
    usePointerEnd?: boolean;
};

/**
 * Captures the metrics type M via inference from the observable
 * and checks the remaining descriptor fields against it.
 */
export function describe<M, T>(
    metrics$: Observable<M>,
    spec: Omit<RecognizerDescriptor<M, T>, "metrics$">,
): RecognizerDescriptor<M, T> {
    return { metrics$, ...spec };
}

/**
 * Builds a Recognizer from a declarative descriptor. The compete
 * callback receives pointers and returns a descriptor (or null
 * to reject immediately).
 */
export function defineRecognizer<M, T>(
    touches: number,
    compete: (pointers: PointerStream[]) => RecognizerDescriptor<M, T> | null,
): Recognizer<T> {
    return {
        touches,
        recognize(pointers) {
            const descriptor = compete(pointers);
            if (!descriptor) {
                return of<Recognition<T>>({ claimed: false });
            }

            return raceDecision(descriptor, pointers);
        },
    };
}

function raceDecision<M, T>(
    descriptor: RecognizerDescriptor<M, T>,
    pointers: PointerStream[],
): Observable<Recognition<T>> {
    const { decide, toEvent, toEnd } = descriptor;

    const anyEnded$ = merge(...pointers.map((p) => p.end$)).pipe(take(1));

    const decided$ = descriptor.metrics$.pipe(
        map((m): Recognition<T> | null => {
            const decision = decide(m);
            if (decision === null) return null;
            if (decision === false) return { claimed: false };

            return {
                claimed: true,
                confidence: decision,
                gesture$: gestureStream(
                    m,
                    descriptor.metrics$,
                    anyEnded$,
                    toEvent,
                    toEnd,
                ),
            };
        }),
        filter((r): r is Recognition<T> => r !== null),
        take(1),
    );

    if (descriptor.usePointerEnd) return decided$;

    const rejected$: Observable<Recognition<T>> = anyEnded$.pipe(
        map(() => ({ claimed: false as const })),
    );

    return race(decided$, rejected$);
}

function gestureStream<M, T>(
    firstMetrics: M,
    metrics$: Observable<M>,
    anyEnded$: Observable<PointerEnd>,
    toEvent: (m: M) => T,
    toEnd?: (end: PointerEnd, last: T) => T,
): Observable<T> {
    // When there's no end-phase mapping, the gesture is a single
    // emission (e.g. tap). Return it directly — the move$/takeUntil
    // path would race against an already-replayed end$ and lose.
    if (!toEnd) return of(toEvent(firstMetrics));

    const move$ = metrics$.pipe(
        map((m) => toEvent(m)),
        startWith(toEvent(firstMetrics)),
        takeUntil(anyEnded$),
        shareReplay(1),
    );

    const end$ = anyEnded$.pipe(
        withLatestFrom(move$),
        map(([end, last]) => toEnd(end, last)),
    );

    return merge(move$, end$);
}
