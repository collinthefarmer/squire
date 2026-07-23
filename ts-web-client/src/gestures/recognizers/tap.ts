/**
 * Tap recognizer — single or multi-touch tap.
 *
 * Uses usePointerEnd to receive pointer-end data through the
 * metrics stream rather than auto-rejecting. The decide function
 * rejects immediately on excessive movement, stays undecided
 * during movement, then evaluates duration and displacement
 * when the pointer lifts.
 */

import { merge } from "rxjs";
import { map, take } from "rxjs/operators";
import { centroid, magnitude, subtract } from "../transform";
import { defineRecognizer, describe } from "../harness";
import type { Point } from "../transform";
import type { Recognizer } from "./recognizer";

export type TapEvent = {
    position: Point;
    duration: number;
};

export type TapConfig = {
    /** Number of concurrent touches required (default: 1). */
    touches?: number;
    /** Maximum ms between pointer down and up (default: 300). */
    maxDuration?: number;
    /** Maximum movement in px before rejection (default: 10). */
    threshold?: number;
};

const DEFAULT_MAX_DURATION = 300;
const DEFAULT_TAP_THRESHOLD = 10;

export function tap(config?: TapConfig): Recognizer<TapEvent> {
    const maxDuration = config?.maxDuration ?? DEFAULT_MAX_DURATION;
    const threshold = config?.threshold ?? DEFAULT_TAP_THRESHOLD;

    return defineRecognizer("tap", config?.touches ?? 1, (pointers) => {
        const origin = centroid(pointers.map((p) => p.start));
        const startTime = Date.now();

        const anyEnd$ = merge(...pointers.map((p) => p.end$)).pipe(take(1));

        const moveMetrics$ = merge(...pointers.map((p) => p.move$)).pipe(
            map((pos) => ({
                displacement: magnitude(subtract(pos, origin)),
                position: pos,
                ended: false as const,
                duration: 0,
                reason: "up" as "up" | "cancel",
            })),
        );

        const endMetrics$ = anyEnd$.pipe(
            map((end) => ({
                displacement: magnitude(subtract(end.position, origin)),
                position: end.position,
                ended: true as const,
                duration: Date.now() - startTime,
                reason: end.reason,
            })),
        );

        return describe(merge(moveMetrics$, endMetrics$), {
            usePointerEnd: true,

            decide(m) {
                if (m.displacement >= threshold) return false;
                if (!m.ended) return null;
                if (m.reason === "cancel") return false;
                if (m.duration > maxDuration) return false;
                return 1.0;
            },

            toEvent: (m): TapEvent => ({
                position: m.position,
                duration: m.duration,
            }),
        });
    });
}
