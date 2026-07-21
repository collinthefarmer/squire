/**
 * Drag recognizer — single or multi-touch directional drag.
 *
 * Recognition: the decide function watches centroid displacement
 * until it crosses threshold, then checks direction and guard.
 * Multi-touch confidence is based on translation vs spread.
 */

import { combineLatest } from "rxjs";
import { map } from "rxjs/operators";
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

    return defineRecognizer(config?.touches ?? 1, (pointers) => {
        const origin = centroid(pointers.map((p) => p.start));
        const initialSpacing =
            pointers.length >= 2
                ? distance(pointers[0]!.start, pointers[1]!.start)
                : 0;

        return describe(
            combineLatest(pointers.map((p) => p.move$)).pipe(
                map(mapDragMetrics(origin)),
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
