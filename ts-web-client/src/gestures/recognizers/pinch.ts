/**
 * Pinch recognizer — two-finger scale/rotation gesture.
 *
 * Recognition: race scale-change threshold against early pointer
 * end. Confidence is based on spread vs translation ratio.
 */

import { race, of, merge, combineLatest } from "rxjs";
import { map, filter, take, takeUntil, share } from "rxjs/operators";
import { distance, centroid, angle } from "../transform";
import type { Observable } from "rxjs";
import type { PointerStream } from "../pointers";
import type { Recognition, Recognizer } from "../gestures";
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

const DEFAULT_THRESHOLD = 0.05;

export function pinch(config?: PinchConfig): Recognizer<PinchEvent> {
    const threshold = config?.threshold ?? DEFAULT_THRESHOLD;

    return {
        touches: 2,
        recognize(
            pointers: PointerStream[],
        ): Observable<Recognition<PinchEvent>> {
            if (pointers.length < 2) {
                return of<Recognition<PinchEvent>>({ status: "reject" });
            }

            const [a, b] = [pointers[0]!, pointers[1]!];
            const initialDist = distance(a.start, b.start);

            if (initialDist === 0) {
                return of<Recognition<PinchEvent>>({ status: "reject" });
            }

            const initialAngle = angle(a.start, b.start);
            const initialCenter = centroid([a.start, b.start]);
            const anyEnd$ = merge(a.end$, b.end$).pipe(take(1));

            const metrics$ = combineLatest([a.move$, b.move$]).pipe(
                map(([posA, posB]) => ({
                    center: centroid([posA, posB]),
                    scale: distance(posA, posB) / initialDist,
                    rotation: angle(posA, posB) - initialAngle,
                    distance: distance(posA, posB),
                })),
                share(),
            );

            const thresholdCrossed$ = metrics$.pipe(
                filter((m) => Math.abs(m.scale - 1.0) >= threshold),
                take(1),
                map((first): Recognition<PinchEvent> => {
                    const spread = Math.abs(first.distance - initialDist);
                    const translation = distance(first.center, initialCenter);
                    const confidence = spread / (spread + translation + 1);

                    const moves$ = metrics$.pipe(
                        map((m): PinchEvent => ({ phase: "move", ...m })),
                        takeUntil(anyEnd$),
                    );

                    const end$ = anyEnd$.pipe(
                        map((): PinchEvent => ({ phase: "end", ...first })),
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
