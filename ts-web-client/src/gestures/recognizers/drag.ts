/**
 * Drag recognizer — single or multi-touch directional drag.
 *
 * Recognition: race threshold crossing against early pointer end.
 * At threshold, evaluates direction match and guard predicate.
 * Confidence for multi-touch is based on translation vs spread.
 */

import { race, of, merge, combineLatest } from "rxjs";
import { map, filter, take, takeUntil, share } from "rxjs/operators";
import { distance, centroid, matchesDirection } from "../transform";
import type { Observable } from "rxjs";
import type { PointerStream } from "../pointers";
import type { Recognition, Recognizer } from "../gestures";
import type { Point } from "../transform";

export type DragEvent = {
    phase: "start" | "move" | "end";
    position: Point;
    origin: Point;
    delta: Point;
};

export type DragConfig = {
    /** Number of concurrent touches required (default: 1). */
    touches?: number;
    threshold?: number;
    /** Expected movement direction. Rejects if movement doesn't align. */
    direction?: Point;
    /** Guard predicate evaluated at threshold. Rejects if false. */
    when?: () => boolean;
};

const DEFAULT_THRESHOLD = 10;

export function drag(config?: DragConfig): Recognizer<DragEvent> {
    const threshold = config?.threshold ?? DEFAULT_THRESHOLD;
    const touches = config?.touches ?? 1;

    return {
        touches,
        recognize(
            pointers: PointerStream[],
        ): Observable<Recognition<DragEvent>> {
            if (pointers.length < touches) {
                return of<Recognition<DragEvent>>({ status: "reject" });
            }

            const ptrs = pointers.slice(0, touches);
            const origin = centroid(ptrs.map((p) => p.start));
            const initialDist =
                ptrs.length >= 2
                    ? distance(ptrs[0]!.start, ptrs[1]!.start)
                    : 0;

            const delta$ = combinedDelta$(ptrs, origin);

            const thresholdCrossed$ = delta$.pipe(
                filter((e) => Math.hypot(e.dx, e.dy) >= threshold),
                take(1),
                map((first) =>
                    decideClaim(ptrs, delta$, origin, first, initialDist, config),
                ),
            );

            const anyEnded$ = merge(...ptrs.map((p) => p.end$)).pipe(
                take(1),
                map((): Recognition<DragEvent> => ({ status: "reject" })),
            );

            return race(thresholdCrossed$, anyEnded$);
        },
    };
}

// ── Combined delta stream ───────────────────────────────────────

type DeltaEvent = { pos: Point; dx: number; dy: number; positions?: Point[] };

function combinedDelta$(
    pointers: PointerStream[],
    origin: Point,
): Observable<DeltaEvent> {
    if (pointers.length === 1) {
        const pointer = pointers[0]!;

        return pointer.move$.pipe(
            map((pos) => ({
                pos,
                dx: pos.x - origin.x,
                dy: pos.y - origin.y,
            })),
            share(),
        );
    }

    return combineLatest(pointers.map((p) => p.move$)).pipe(
        map((positions) => {
            const pos = centroid(positions);

            return {
                pos,
                dx: pos.x - origin.x,
                dy: pos.y - origin.y,
                positions,
            };
        }),
        share(),
    );
}

// ── Claim decision ──────────────────────────────────────────────

function decideClaim(
    pointers: PointerStream[],
    delta$: Observable<DeltaEvent>,
    origin: Point,
    first: DeltaEvent,
    initialDist: number,
    config?: DragConfig,
): Recognition<DragEvent> {
    if (
        config?.direction &&
        !matchesDirection(first.dx, first.dy, config.direction)
    ) {
        return { status: "reject" };
    }

    if (config?.when && !config.when()) {
        return { status: "reject" };
    }

    const translation = Math.hypot(first.dx, first.dy);
    let confidence = 1.0;

    if (pointers.length >= 2 && first.positions && initialDist > 0) {
        const currentDist = distance(first.positions[0]!, first.positions[1]!);
        const spread = Math.abs(currentDist - initialDist);

        confidence = translation / (translation + spread + 1);
    }

    const anyEnd$ = merge(...pointers.map((p) => p.end$)).pipe(take(1));

    const moves$ = delta$.pipe(
        map(
            (e): DragEvent => ({
                phase: "move",
                position: e.pos,
                origin,
                delta: { x: e.dx, y: e.dy },
            }),
        ),
        takeUntil(anyEnd$),
    );

    const end$ = anyEnd$.pipe(
        map(
            (end): DragEvent => ({
                phase: "end",
                position: end.position,
                origin,
                delta: {
                    x: end.position.x - origin.x,
                    y: end.position.y - origin.y,
                },
            }),
        ),
    );

    return {
        status: "claim",
        gesture$: merge(moves$, end$),
        confidence,
    };
}
