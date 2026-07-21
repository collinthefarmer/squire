/**
 * Gesture recognizer factories.
 *
 * Each factory returns a Recognizer that competes in a gesture
 * source's competition. Recognizers observe pointer streams and
 * race to claim — highest confidence wins when all have decided.
 *
 * Recognition pattern: race the threshold-crossing event against
 * early pointer end. At threshold, a pure decision function
 * evaluates direction, guards, and confidence to claim or reject.
 */

import { race, of, merge, combineLatest } from "rxjs";
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
    /** Number of concurrent touches required (default: 1). */
    touches?: number;
    threshold?: number;
    /** Expected movement direction. Rejects if movement doesn't align. */
    direction?: Point;
    /** Guard predicate evaluated at threshold. Rejects if false. */
    when?: () => boolean;
};

export type PinchEvent = {
    phase: "start" | "move" | "end";
    center: Point;
    scale: number;
    rotation: number;
    distance: number;
};

export type PinchConfig = {
    /** Scale change from 1.0 required to claim (default: 0.05). */
    threshold?: number;
};

// ── Constants ───────────────────────────────────────────────────

const DEFAULT_DRAG_THRESHOLD = 10;
const DEFAULT_PINCH_THRESHOLD = 0.05;

// ── Drag recognizer ─────────────────────────────────────────────

export function drag(config?: DragConfig): Recognizer<DragEvent> {
    const threshold = config?.threshold ?? DEFAULT_DRAG_THRESHOLD;
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
            const initialDistance = ptrs.length >= 2
                ? dist(ptrs[0]!.start, ptrs[1]!.start)
                : 0;

            const delta$ = combinedDelta$(ptrs, origin);

            const thresholdCrossed$ = delta$.pipe(
                filter((e) => Math.hypot(e.dx, e.dy) >= threshold),
                take(1),
                map((first) =>
                    decideDragClaim(
                        ptrs,
                        delta$,
                        origin,
                        first,
                        initialDistance,
                        config,
                    ),
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

// ── Pinch recognizer ────────────────────────────────────────────

export function pinch(config?: PinchConfig): Recognizer<PinchEvent> {
    const threshold = config?.threshold ?? DEFAULT_PINCH_THRESHOLD;

    return {
        touches: 2,
        recognize(
            pointers: PointerStream[],
        ): Observable<Recognition<PinchEvent>> {
            if (pointers.length < 2) {
                return of<Recognition<PinchEvent>>({ status: "reject" });
            }

            const [a, b] = [pointers[0]!, pointers[1]!];
            const initialDistance = dist(a.start, b.start);

            if (initialDistance === 0) {
                return of<Recognition<PinchEvent>>({ status: "reject" });
            }

            const initialAngle = Math.atan2(
                b.start.y - a.start.y,
                b.start.x - a.start.x,
            );

            const anyEnd$ = merge(a.end$, b.end$).pipe(take(1));

            const metrics$ = combineLatest([a.move$, b.move$]).pipe(
                map(([posA, posB]) => {
                    const distance = dist(posA, posB);

                    return {
                        center: centroid([posA, posB]),
                        scale: distance / initialDistance,
                        rotation: Math.atan2(posB.y - posA.y, posB.x - posA.x) - initialAngle,
                        distance,
                    };
                }),
                share(),
            );

            const thresholdCrossed$ = metrics$.pipe(
                filter((m) => Math.abs(m.scale - 1.0) >= threshold),
                take(1),
                map((first): Recognition<PinchEvent> => {
                    const spread = Math.abs(first.distance - initialDistance);
                    const translation = dist(
                        first.center,
                        centroid([a.start, b.start]),
                    );
                    const confidence = spread / (spread + translation + 1);

                    const moves$ = metrics$.pipe(
                        map((m): PinchEvent => ({ phase: "move", ...m })),
                        takeUntil(anyEnd$),
                    );

                    const end$ = anyEnd$.pipe(
                        map(
                            (): PinchEvent => ({
                                phase: "end",
                                center: first.center,
                                scale: first.scale,
                                rotation: first.rotation,
                                distance: first.distance,
                            }),
                        ),
                    );

                    return {
                        status: "claim",
                        gesture$: merge(moves$, end$),
                        confidence,
                    };
                }),
            );

            const ended$ = anyEnd$.pipe(
                map((): Recognition<PinchEvent> => ({ status: "reject" })),
            );

            return race(thresholdCrossed$, ended$);
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

// ── Drag claim decision ─────────────────────────────────────────

function decideDragClaim(
    pointers: PointerStream[],
    delta$: Observable<DeltaEvent>,
    origin: Point,
    first: DeltaEvent,
    initialDistance: number,
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

    if (pointers.length >= 2 && first.positions && initialDistance > 0) {
        const currentDistance = dist(first.positions[0]!, first.positions[1]!);
        const spread = Math.abs(currentDistance - initialDistance);

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

// ── Utilities ───────────────────────────────────────────────────

function centroid(points: Point[]): Point {
    const n = points.length;
    if (n === 0) return { x: 0, y: 0 };

    let x = 0;
    let y = 0;

    for (const p of points) {
        x += p.x;
        y += p.y;
    }

    return { x: x / n, y: y / n };
}

function dist(a: Point, b: Point): number {
    return Math.hypot(b.x - a.x, b.y - a.y);
}
