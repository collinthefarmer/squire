/**
 * Pinch recognizer — two-finger scale/rotation gesture.
 *
 * Recognition: the decide function watches scale change until
 * it crosses threshold. Confidence is based on spread vs
 * translation ratio.
 */

import { combineLatest } from "rxjs";
import { map } from "rxjs/operators";
import { distance, centroid, angle } from "../transform";
import { defineRecognizer, describe } from "../harness";
import type { Recognizer } from "./recognizer";
import type { Point } from "../transform";

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

const DEFAULT_PINCH_THRESHOLD = 0.05;

export function pinch(config?: PinchConfig): Recognizer<PinchEvent> {
    const threshold = config?.threshold ?? DEFAULT_PINCH_THRESHOLD;

    return defineRecognizer(2, (pointers) => {
        const [a, b] = [pointers[0]!, pointers[1]!];

        const initialSpacing = distance(a.start, b.start);
        if (initialSpacing === 0) return null;

        const initialAngle = angle(a.start, b.start);
        const initialCenter = centroid([a.start, b.start]);

        return describe(
            combineLatest([a.move$, b.move$]).pipe(
                map(mapPinchMetrics(initialSpacing, initialAngle)),
            ),
            {
                decide(m) {
                    if (Math.abs(m.scale - 1.0) < threshold) return null;

                    return pinchConfidence(
                        m.distance,
                        initialSpacing,
                        m.center,
                        initialCenter,
                    );
                },

                toEvent: (m): PinchEvent => ({ phase: "move", ...m }),
                toEnd: (_end, last): PinchEvent => ({ ...last, phase: "end" }),
            },
        );
    });
}

type PinchMetrics = {
    center: Point;
    scale: number;
    rotation: number;
    distance: number;
};

function mapPinchMetrics(
    initialDist: number,
    initialAngle: number,
): (points: [Point, Point]) => PinchMetrics {
    return ([posA, posB]) => ({
        center: centroid([posA, posB]),
        scale: distance(posA, posB) / initialDist,
        rotation: angle(posA, posB) - initialAngle,
        distance: distance(posA, posB),
    });
}

/**
 * Ratio of finger spread to centroid translation. A pure pinch
 * (fingers diverging/converging in place) scores high; fingers
 * translating together score low.
 */
function pinchConfidence(
    currentDist: number,
    initialDist: number,
    center: Point,
    initialCenter: Point,
): number {
    const spread = Math.abs(currentDist - initialDist);
    const translation = distance(center, initialCenter);

    return spread / (spread + translation + 1);
}
