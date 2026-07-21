/**
 * Gesture recognizer factories.
 *
 * Each factory returns a Recognizer that competes in a gesture
 * source's competition. Recognizers observe pointer streams and
 * race to claim — first claim wins, all-reject releases to the
 * browser.
 *
 * Recognition pattern: race the threshold-crossing event against
 * early pointer end. At threshold, a pure decision function
 * evaluates direction and guards to claim or reject.
 */

import { race, of, merge } from "rxjs";
import { map, filter, take, takeUntil, share } from "rxjs/operators";
import type { Observable } from "rxjs";
import type { PointerStream } from "./pointers";
import type { Recognition, Recognizer } from "./gestures";
import type { Point } from "./transform";

// ── Public types ────────────────────────────────────────────────

export type DragEvent = {
    phase: "start" | "move" | "end";
    position: Point;
    origin: Point;
    delta: Point;
};

export type DragConfig = {
    threshold?: number;
    /** Expected movement direction. Rejects if movement doesn't align. */
    direction?: Point;
    /** Guard predicate evaluated at threshold. Rejects if false. */
    when?: () => boolean;
};

// ── Constants ───────────────────────────────────────────────────

const DEFAULT_THRESHOLD = 10;

// ── Drag recognizer ─────────────────────────────────────────────

export function drag(config?: DragConfig): Recognizer<DragEvent> {
    const threshold = config?.threshold ?? DEFAULT_THRESHOLD;

    return {
        touches: 1,
        recognize(
            [pointer]: PointerStream[],
        ): Observable<Recognition<DragEvent>> {
            if (!pointer) {
                return of<Recognition<DragEvent>>({ status: "reject" });
            }

            const delta$ = pointer.move$.pipe(
                map((pos) => ({
                    pos,
                    dx: pos.x - pointer.start.x,
                    dy: pos.y - pointer.start.y,
                })),
                share(),
            );

            const thresholdCrossed$ = delta$.pipe(
                filter((e) => Math.hypot(e.dx, e.dy) >= threshold),
                take(1),
                map((first) => decideClaim(pointer, delta$, first, config)),
            );

            const pointerEnded$ = pointer.end$.pipe(
                take(1),
                map((): Recognition<DragEvent> => ({ status: "reject" })),
            );

            return race(thresholdCrossed$, pointerEnded$);
        },
    };
}

// ── Direction matching ──────────────────────────────────────────

function matchesDirection(
    dx: number,
    dy: number,
    direction: Point,
): boolean {
    const dot = dx * direction.x + dy * direction.y;
    if (dot <= 0) return false;

    const moveDominant =
        Math.abs(dy) >= Math.abs(dx) ? ("y" as const) : ("x" as const);
    const dirDominant =
        Math.abs(direction.y) >= Math.abs(direction.x)
            ? ("y" as const)
            : ("x" as const);

    return moveDominant === dirDominant;
}

// ── Claim decision ──────────────────────────────────────────────

type DeltaEvent = { pos: Point; dx: number; dy: number };

function decideClaim(
    pointer: PointerStream,
    delta$: Observable<DeltaEvent>,
    first: DeltaEvent,
    config?: DragConfig,
): Recognition<DragEvent> {
    if (config?.direction && !matchesDirection(first.dx, first.dy, config.direction)) {
        return { status: "reject" };
    }

    if (config?.when && !config.when()) {
        return { status: "reject" };
    }

    const moves$ = delta$.pipe(
        map(
            (e): DragEvent => ({
                phase: "move",
                position: e.pos,
                origin: pointer.start,
                delta: { x: e.dx, y: e.dy },
            }),
        ),
        takeUntil(pointer.end$),
    );

    const end$ = pointer.end$.pipe(
        take(1),
        map(
            (end): DragEvent => ({
                phase: "end",
                position: end.position,
                origin: pointer.start,
                delta: {
                    x: end.position.x - pointer.start.x,
                    y: end.position.y - pointer.start.y,
                },
            }),
        ),
    );

    const gesture$ = merge(moves$, end$);

    return { status: "claim", gesture$ };
}
