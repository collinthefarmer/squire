/**
 * Pinch recognizer — two-finger scale/rotation gesture.
 *
 * Recognition: the decide function watches scale change until
 * it crosses threshold. Confidence is based on spread vs
 * translation ratio.
 */

import { filter, map } from "rxjs/operators";
import { distance, centroid, angle } from "../transform";
import { defineRecognizer, describe } from "../harness";
import type { PointerFrame } from "../harness";
import type { Recognizer } from "./recognizer";
import type { Point } from "../transform";

export type PinchEvent = {
    phase: "start" | "move" | "end";
    center: Point;
    scale: number;
    rotation: number;
    distance: number;
    /** Event time of the frame that produced this event (ms). */
    timestamp: number;
};

export type PinchConfig = {
    /** Scale change from 1.0 required to claim (default: 0.05). */
    threshold?: number;
};

const DEFAULT_PINCH_THRESHOLD = 0.05;

export function pinch(config?: PinchConfig): Recognizer<PinchEvent> {
    const threshold = config?.threshold ?? DEFAULT_PINCH_THRESHOLD;

    return defineRecognizer("pinch", 2, ({ initial, pointers$ }) => {
        const [a, b] = [initial[0]!, initial[1]!];

        const initialSpacing = distance(a.start, b.start);
        if (initialSpacing === 0) return null;

        const initialAngle = angle(a.start, b.start);
        const initialCenter = centroid([a.start, b.start]);

        return describe(
            pointers$.pipe(
                filter((f) => f.positions.length >= 2),
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
                toEnd: (end, last): PinchEvent => ({
                    ...last,
                    phase: "end",
                    timestamp: end.t,
                }),
            },
        );
    });
}

type PinchMetrics = {
    center: Point;
    scale: number;
    rotation: number;
    distance: number;
    timestamp: number;
};

function mapPinchMetrics(
    initialDist: number,
    initialAngle: number,
): (frame: PointerFrame) => PinchMetrics {
    return (frame) => {
        const [posA, posB] = [frame.positions[0]!, frame.positions[1]!];

        return {
            center: centroid([posA, posB]),
            scale: distance(posA, posB) / initialDist,
            rotation: angle(posA, posB) - initialAngle,
            distance: distance(posA, posB),
            timestamp: frame.t,
        };
    };
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
