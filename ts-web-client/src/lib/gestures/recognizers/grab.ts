/**
 * Grab recognizer — direct manipulation of a target with one or more
 * fingers, absorbing pointers as they land.
 *
 * A grab starts on one finger (translation) and grows: a second finger
 * absorbed mid-gesture adds scale and rotation, all in one continuous
 * motion — no lift-and-restart. It emits a cumulative similarity
 * transform since the grab began.
 *
 * The seam is rebasing. On any membership change (a finger joins or
 * leaves) the accumulated transform is frozen as a new baseline and the
 * reference geometry is reset to the current fingers, so the transform
 * is continuous across the change.
 */

import { scan } from "rxjs/operators";
import { centroid, distance, angle, subtract, magnitude } from "../transform";
import { defineRecognizer, describe } from "../harness";
import type { Point } from "../transform";
import type { PointerFrame } from "../harness";
import type { Recognizer } from "./recognizer";

export type GrabEvent = {
    phase: "move" | "end";
    /** Cumulative centroid translation since the grab began (client px). */
    translation: Point;
    /** Cumulative scale factor since the grab began. */
    scale: number;
    /** Cumulative rotation since the grab began (radians). */
    rotation: number;
    /**
     * Whether the layer is actively turning this frame. Read straight off
     * the transform — how far `output` has rotated past the banked `base`,
     * i.e. the twist since the current finger reference — so it means real
     * rotation, not merely the presence of a second finger. A lone finger
     * (no rotation delta) and a straight pinch (scale without a twist)
     * both leave it false.
     */
    rotating: boolean;
    /** Event time of the frame that produced this event (ms). */
    timestamp: number;
};

export type GrabConfig = {
    /** Translation px required to claim (default: 10). */
    threshold?: number;
    /** Scale change from 1.0 required to claim (default: 0.05). */
    scaleThreshold?: number;
    /** Rotation in radians required to claim (default: 0.1). */
    rotationThreshold?: number;
};

const DEFAULT_THRESHOLD = 10;
const DEFAULT_SCALE_THRESHOLD = 0.05;
const DEFAULT_ROTATION_THRESHOLD = 0.1;

/**
 * Minimum live twist (radians, since the current finger reference) for a
 * frame to read as rotating. A deadzone: a two-finger *scale* wobbles its
 * pair-angle by a couple of degrees, and this keeps that from masquerading
 * as rotation. Roughly 2.9° — comfortably past pinch wobble, still well
 * short of the 7.5° midpoint to the first snap detent, so a deliberate
 * twist still summons the dial promptly.
 */
const ROTATION_ACTIVE_EPSILON = 0.05;

type Transform = { translation: Point; scale: number; rotation: number };
type Geometry = { center: Point; spread: number; angle: number };
type GrabState = {
    ref: Geometry;
    base: Transform;
    output: Transform;
    t: number;
};

const IDENTITY: Transform = { translation: { x: 0, y: 0 }, scale: 1, rotation: 0 };

/**
 * Reference geometry of a pointer set: centroid always, plus spread and
 * angle between the two primary fingers (zeroed for a lone finger, which
 * carries translation only).
 */
function geometry(positions: Point[]): Geometry {
    const center = centroid(positions);
    if (positions.length < 2) return { center, spread: 0, angle: 0 };

    return {
        center,
        spread: distance(positions[0]!, positions[1]!),
        angle: angle(positions[0]!, positions[1]!),
    };
}

function grabReducer(state: GrabState, frame: PointerFrame): GrabState {
    const cur = geometry(frame.positions);

    // Membership change → rebase: bank the current transform, re-reference.
    if (frame.kind !== "move") {
        return { ref: cur, base: state.output, output: state.output, t: frame.t };
    }

    // A spread on both frames is what lets scale and rotation be measured;
    // two fingers momentarily coincident (spread 0) can't.
    const hasSpread = state.ref.spread > 0 && cur.spread > 0;
    const translation = subtract(cur.center, state.ref.center);
    const scaleDelta = hasSpread ? cur.spread / state.ref.spread : 1;
    const rotationDelta = hasSpread ? cur.angle - state.ref.angle : 0;

    return {
        ...state,
        output: {
            translation: {
                x: state.base.translation.x + translation.x,
                y: state.base.translation.y + translation.y,
            },
            scale: state.base.scale * scaleDelta,
            rotation: state.base.rotation + rotationDelta,
        },
        t: frame.t,
    };
}

export function grab(config?: GrabConfig): Recognizer<GrabEvent> {
    const threshold = config?.threshold ?? DEFAULT_THRESHOLD;
    const scaleThreshold = config?.scaleThreshold ?? DEFAULT_SCALE_THRESHOLD;
    const rotationThreshold =
        config?.rotationThreshold ?? DEFAULT_ROTATION_THRESHOLD;

    return defineRecognizer(
        "grab",
        1,
        ({ initial, pointers$ }) => {
            const start = geometry(initial.map((p) => p.start));

            return describe(
                pointers$.pipe(
                    scan(grabReducer, {
                        ref: start,
                        base: IDENTITY,
                        output: IDENTITY,
                        t: 0,
                    }),
                ),
                {
                    decide(s) {
                        const moved = magnitude(s.output.translation) >= threshold;
                        const scaled = Math.abs(s.output.scale - 1) >= scaleThreshold;
                        const rotated = Math.abs(s.output.rotation) >= rotationThreshold;

                        return moved || scaled || rotated ? 1 : null;
                    },

                    toEvent: (s): GrabEvent => ({
                        phase: "move",
                        translation: s.output.translation,
                        scale: s.output.scale,
                        rotation: s.output.rotation,
                        rotating:
                            Math.abs(s.output.rotation - s.base.rotation) >
                            ROTATION_ACTIVE_EPSILON,
                        timestamp: s.t,
                    }),

                    toEnd: (end, last): GrabEvent => ({
                        ...last,
                        phase: "end",
                        timestamp: end.t,
                    }),
                },
            );
        },
        { absorbs: true },
    );
}
