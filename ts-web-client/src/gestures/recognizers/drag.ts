/**
 * Drag recognizer — single or multi-touch directional drag.
 *
 * Recognition: the decide function watches centroid displacement
 * until it crosses threshold, then checks direction and guard.
 * Multi-touch confidence is based on translation vs spread.
 */

import { filter, map } from "rxjs/operators";
import {
    subtract,
    magnitude,
    distance,
    centroid,
    matchesDirection,
} from "../transform";
import { defineRecognizer, describe } from "../harness";
import type { Recognizer } from "./recognizer";
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

const DEFAULT_DRAG_THRESHOLD = 10;

export function drag(config?: DragConfig): Recognizer<DragEvent> {
    const threshold = config?.threshold ?? DEFAULT_DRAG_THRESHOLD;
    const touches = config?.touches ?? 1;

    return defineRecognizer("drag", touches, ({ initial, pointers$ }) => {
        const origin = centroid(initial.map((p) => p.start));
        const initialSpacing =
            initial.length >= 2
                ? distance(initial[0]!.start, initial[1]!.start)
                : 0;

        return describe(
            pointers$.pipe(
                filter((f) => f.positions.length >= touches),
                map((f) => mapDragMetrics(origin)(f.positions)),
            ),
            {
                decide(m) {
                    if (magnitude(m.delta) < threshold) return null;

                    if (
                        (config?.direction &&
                            !matchesDirection(m.delta, config.direction)) ||
                        (config?.when && !config.when())
                    ) {
                        return false;
                    }

                    return dragConfidence(m.delta, m.positions, initialSpacing);
                },

                toEvent: (m): DragEvent => ({
                    phase: "move",
                    position: m.position,
                    origin,
                    delta: m.delta,
                }),

                toEnd: (end): DragEvent => ({
                    phase: "end",
                    position: end.position,
                    origin,
                    delta: subtract(end.position, origin),
                }),
            },
        );
    });
}

type DragMetrics = {
    position: Point;
    delta: Point;
    positions: Point[];
};

function mapDragMetrics(origin: Point): (positions: Point[]) => DragMetrics {
    return (positions) => {
        const position = centroid(positions);

        return {
            position,
            delta: subtract(position, origin),
            positions,
        };
    };
}

/**
 * Single-touch: full confidence. Multi-touch: ratio of centroid
 * translation to finger spread. A pure drag (fingers moving
 * together) scores high; diverging fingers score low.
 */
function dragConfidence(
    delta: Point,
    positions: Point[],
    initialSpacing: number,
): number {
    if (positions.length < 2 || initialSpacing === 0) return 1.0;

    const translation = magnitude(delta);
    const currentDist = distance(positions[0]!, positions[1]!);
    const spread = Math.abs(currentDist - initialSpacing);

    return translation / (translation + spread + 1);
}
