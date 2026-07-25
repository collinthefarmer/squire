/**
 * Long-press recognizer — a single (or multi-touch) press held in place.
 *
 * Unlike tap, which decides at pointer *up*, a long-press fires while the
 * finger is still down: once the hold time elapses without the pointer
 * straying past a small threshold, it claims. Movement past the threshold
 * rejects (it was a drag); lifting before the hold elapses rejects (it was
 * a tap) — the harness auto-rejects on pointer-end since we don't opt into
 * usePointerEnd.
 *
 * The time trigger is a `timer` folded into the metrics stream: pointer
 * frames carry displacement (to reject a wander) and a lone timer tick
 * flips `held`, which is what decide() claims on.
 */

import { merge, timer } from "rxjs";
import { map, scan } from "rxjs/operators";
import { centroid, magnitude, subtract } from "../transform";
import { defineRecognizer, describe } from "../harness";
import type { Point } from "../transform";
import type { Recognizer } from "./recognizer";

export type LongPressEvent = {
    position: Point;
    /** The hold time that elapsed to fire this press (ms). */
    duration: number;
    /** Event time of the last sample before the press fired (ms). */
    timestamp: number;
};

export type LongPressConfig = {
    /** Number of concurrent touches required (default: 1). */
    touches?: number;
    /** Hold time before the press fires (default: 350ms). */
    duration?: number;
    /** Maximum movement in px before rejection (default: 10). */
    threshold?: number;
};

const DEFAULT_DURATION = 350;
const DEFAULT_THRESHOLD = 10;

type PressState = {
    displacement: number;
    position: Point;
    held: boolean;
    timestamp: number;
};

export function longPress(config?: LongPressConfig): Recognizer<LongPressEvent> {
    const duration = config?.duration ?? DEFAULT_DURATION;
    const threshold = config?.threshold ?? DEFAULT_THRESHOLD;

    return defineRecognizer("long-press", config?.touches ?? 1, ({ initial, pointers$ }) => {
        const origin = centroid(initial.map((p) => p.start));

        // Pointer frames report the farthest any finger has strayed from
        // the origin — the wander that would make this a drag, not a press.
        const moves$ = pointers$.pipe(
            map((frame): Partial<PressState> => ({
                displacement: Math.max(
                    0,
                    ...frame.positions.map((pos) => magnitude(subtract(pos, origin))),
                ),
                position: centroid(frame.positions),
                timestamp: frame.t,
            })),
        );

        // A single tick, once the hold has elapsed — this is what claims.
        // It carries no timestamp, so the last move's time is what the
        // fired press inherits.
        const held$ = timer(duration).pipe(map((): Partial<PressState> => ({ held: true })));

        const metrics$ = merge(moves$, held$).pipe(
            scan<Partial<PressState>, PressState>(
                (state, patch) => ({ ...state, ...patch }),
                { displacement: 0, position: origin, held: false, timestamp: 0 },
            ),
        );

        return describe(metrics$, {
            decide(m) {
                if (m.displacement >= threshold) return false;
                if (m.held) return 1.0;

                return null;
            },

            toEvent: (m): LongPressEvent => ({
                position: m.position,
                duration,
                timestamp: m.timestamp,
            }),
        });
    });
}
