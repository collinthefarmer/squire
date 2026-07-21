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
    share,
    shareReplay,
    startWith,
    take,
    takeUntil,
    withLatestFrom,
} from "rxjs/operators";
import type { PointerStream, PointerEnd } from "./pointers";
import type { Recognition, Recognizer } from "./recognizer";

// ── Descriptor ─────────────────────────────────────────────────

export type RecognizerDescriptor<M, T> = {
    metrics$: Observable<M>;
    decide: (m: M) => number | false | null;
    toEvent: (m: M) => T;
    toEnd: (end: PointerEnd, last: T) => T;
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

// ── Recognizer builder ─────────────────────────────────────────

/**
 * Builds a Recognizer from a declarative descriptor. The harness
 * owns the full gesture lifecycle: it shares the metrics stream,
 * races decision against early pointer end, tracks the latest
 * event via shareReplay, and assembles move + end streams.
 *
 * The compete callback receives pointers and returns a descriptor
 * (or null to reject immediately).
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

            const { decide, toEvent, toEnd } = descriptor;
            const anyEnd$ = merge(...pointers.map((p) => p.end$)).pipe(
                take(1),
                shareReplay(1),
            );
            const shared$ = descriptor.metrics$.pipe(share());

            const rejected$: Observable<Recognition<T>> = anyEnd$.pipe(
                map(() => ({ claimed: false as const })),
            );

            const decided$ = shared$.pipe(
                map((m) => ({ m, decision: decide(m) })),
                filter(
                    (v): v is { m: M; decision: number | false } =>
                        v.decision !== null,
                ),
                take(1),
                map(({ m, decision }): Recognition<T> => {
                    if (decision === false) {
                        return { claimed: false };
                    }

                    const confidence = decision;

                    const move$ = shared$.pipe(
                        map((m) => toEvent(m)),
                        startWith(toEvent(m)),
                        takeUntil(anyEnd$),
                        shareReplay(1),
                    );

                    const end$ = anyEnd$.pipe(
                        withLatestFrom(move$),
                        map(([end, last]) => toEnd(end, last)),
                    );

                    return {
                        claimed: true,
                        confidence,
                        gesture$: merge(move$, end$),
                    };
                }),
            );

            return race(decided$, rejected$);
        },
    };
}
