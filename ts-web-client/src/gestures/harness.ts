/**
 * Gesture recognizer harness — lifecycle bridge between raw
 * pointer input and recognized gestures.
 *
 * The harness owns everything the recognizer shouldn't think about:
 * the live pointer set, the temporal race (pointers ending before a
 * decision), stream termination, last-known-state tracking for end
 * events, and claim assembly for the coordination layer.
 *
 * The set is exposed as one stream — `pointers$` — of frames carrying
 * the current positions plus what changed (a pointer joined, moved, or
 * left). Positions, the end signal, and (for a rebasing gesture) the
 * membership signal all derive from it. A recognizer that opts into
 * `absorbs` gets a set that grows as the coordination layer feeds it
 * pointers; otherwise the set is exactly its starting pointers.
 *
 * The metrics type M is captured via inference in `describe()`
 * and erased at the `defineRecognizer()` boundary. It never
 * appears in any shared interface.
 */

import { EMPTY, Observable, from, merge, of, race } from "rxjs";
import {
    filter,
    map,
    mergeMap,
    scan,
    shareReplay,
    take,
    takeUntil,
    withLatestFrom,
} from "rxjs/operators";
import type { PointerStream, PointerEnd } from "./pointers";
import type { Point } from "./transform";
import type { Recognition, Recognizer } from "./recognizers/recognizer";

/**
 * One tick of the live pointer set: the current positions after a
 * change, tagged with the kind of change. `remove` carries the end of
 * the pointer that left.
 */
export type PointerFrame =
    | { kind: "add"; positions: Point[] }
    | { kind: "move"; positions: Point[] }
    | { kind: "remove"; positions: Point[]; end: PointerEnd };

/**
 * What the harness hands a recognizer instead of a raw pointer array.
 *
 * - `initial`: the pointers the gesture started with — read for
 *   reference geometry (origin, initial spacing), captured once.
 * - `pointers$`: the live set as a stream of frames.
 */
export type GestureContext = {
    initial: PointerStream[];
    pointers$: Observable<PointerFrame>;
};

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

export type RecognizerOptions = {
    /** Grow the set with pointers absorbed while active (default false). */
    absorbs?: boolean;
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
 * Builds a Recognizer from a declarative descriptor. The name is a
 * stable identifier surfaced to styling; the compete callback
 * receives the gesture context and returns a descriptor (or null to
 * reject immediately).
 */
export function defineRecognizer<M, T>(
    name: string,
    touches: number,
    compete: (ctx: GestureContext) => RecognizerDescriptor<M, T> | null,
    options?: RecognizerOptions,
): Recognizer<T> {
    const absorbs = options?.absorbs ?? false;

    return {
        name,
        touches,
        absorbs,
        recognize(pointers, added$) {
            const absorbed$ = absorbs ? added$ ?? EMPTY : EMPTY;
            const pointers$ = pointerFrames(pointers, absorbed$);
            const ended$ = endsBelow(pointers$, touches);

            const descriptor = compete({ initial: pointers, pointers$ });
            if (!descriptor) {
                return of<Recognition<T>>({ claimed: false });
            }

            return raceDecision(descriptor, ended$);
        },
    };
}

/**
 * The live set as a stream of frames. Every pointer — initial or
 * absorbed — joins at its start (so a new finger is present before it
 * moves), updates on move, and leaves on end. Shared, because absorbed
 * pointers arrive on a hot channel: every consumer must see one set.
 */
function pointerFrames(
    initial: PointerStream[],
    added$: Observable<PointerStream>,
): Observable<PointerFrame> {
    type Change =
        | { kind: "add"; id: number; pos: Point }
        | { kind: "move"; id: number; pos: Point }
        | { kind: "remove"; id: number; end: PointerEnd };

    type State = { members: Map<number, Point>; frame: PointerFrame };

    const changes$ = merge(from(initial), added$).pipe(
        mergeMap((p) =>
            merge(
                of<Change>({ kind: "add", id: p.id, pos: p.start }),
                p.move$.pipe(
                    map((pos): Change => ({ kind: "move", id: p.id, pos })),
                ),
                p.end$.pipe(
                    take(1),
                    map((end): Change => ({ kind: "remove", id: p.id, end })),
                ),
            ),
        ),
    );

    return changes$.pipe(
        scan<Change, State>(
            (state, change) => {
                const members = new Map(state.members);

                if (change.kind === "remove") {
                    members.delete(change.id);
                    return {
                        members,
                        frame: {
                            kind: "remove",
                            positions: [...members.values()],
                            end: change.end,
                        },
                    };
                }

                members.set(change.id, change.pos);
                return {
                    members,
                    frame: { kind: change.kind, positions: [...members.values()] },
                };
            },
            { members: new Map<number, Point>(), frame: { kind: "add", positions: [] } },
        ),
        map((state) => state.frame),
        shareReplay(1),
    );
}

/** The pointer-end that drops the active count below `touches`. */
function endsBelow(
    pointers$: Observable<PointerFrame>,
    touches: number,
): Observable<PointerEnd> {
    return pointers$.pipe(
        filter(
            (f): f is Extract<PointerFrame, { kind: "remove" }> =>
                f.kind === "remove" && f.positions.length < touches,
        ),
        map((f) => f.end),
        take(1),
        shareReplay(1),
    );
}

function raceDecision<M, T>(
    descriptor: RecognizerDescriptor<M, T>,
    ended$: Observable<PointerEnd>,
): Observable<Recognition<T>> {
    const { decide, toEvent, toEnd } = descriptor;

    // Shared so the decision pass and the gesture stream observe the
    // same metrics — and, for a stateful (scan-based) metrics$, the
    // same accumulator. shareReplay also lets the gesture stream, which
    // subscribes just after the claim, replay the claiming metric.
    const metrics$ = descriptor.metrics$.pipe(shareReplay(1));

    const decided$ = metrics$.pipe(
        map((m): Recognition<T> | null => {
            const decision = decide(m);
            if (decision === null) return null;
            if (decision === false) return { claimed: false };

            return {
                claimed: true,
                confidence: decision,
                gesture$: gestureStream(m, metrics$, ended$, toEvent, toEnd),
            };
        }),
        filter((r): r is Recognition<T> => r !== null),
        take(1),
    );

    if (descriptor.usePointerEnd) return decided$;

    const rejected$: Observable<Recognition<T>> = ended$.pipe(
        map(() => ({ claimed: false as const })),
    );

    return race(decided$, rejected$);
}

function gestureStream<M, T>(
    firstMetrics: M,
    metrics$: Observable<M>,
    ended$: Observable<PointerEnd>,
    toEvent: (m: M) => T,
    toEnd?: (end: PointerEnd, last: T) => T,
): Observable<T> {
    // No end mapping → the gesture is a single emission (e.g. tap).
    // Return it directly: tap claims *at* the pointer end, so `ended$`
    // has already fired and a takeUntil path would complete first.
    if (!toEnd) return of(toEvent(firstMetrics));

    // metrics$ is shared and replays its latest, so a subscriber here
    // receives the claiming metric immediately without a startWith.
    // For a continuous gesture `ended$` hasn't fired yet at the claim,
    // so takeUntil doesn't race it.
    const move$ = metrics$.pipe(
        map((m) => toEvent(m)),
        takeUntil(ended$),
        shareReplay(1),
    );

    const end$ = ended$.pipe(
        withLatestFrom(move$),
        map(([end, last]) => toEnd(end, last)),
    );

    return merge(move$, end$);
}
