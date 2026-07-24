/**
 * Geometry for a layer manipulation handle — the on-stage rectangle
 * that mirrors a layer's placement, in display coordinates.
 *
 * Pure and DOM-free. Mirrors the renderer's contract: `sq-layer`
 * positions the layer's top-left at `position` and applies `scale()`
 * and `rotate()` about the element centre. So the visual centre is
 * `position + naturalSize / 2` (independent of scale) and the visual
 * size is `naturalSize * scale`.
 */

import type { LayerView } from "@core/layer-service";

export interface HandleRect {
    /** Centre in display px. */
    cx: number;
    cy: number;
    /** Visual (scaled) size in display px. */
    width: number;
    height: number;
    /** Degrees. */
    rotation: number;
}

/** Aspect modes that fill the whole stage — no per-image handle (v1). */
const FULL_BLEED = new Set(["cover", "contain", "fill"]);

/**
 * The handle rectangle for a layer, or null when a handle doesn't
 * apply: hidden or image-less layers, full-bleed layers, layers with
 * a symbolic (non-numeric) position, or before the natural size has
 * been measured.
 */
export function handleRect(
    view: LayerView,
    naturalSize: { width: number; height: number } | null,
): HandleRect | null {
    if (!view.visible || !view.imageUrl) return null;
    if (FULL_BLEED.has(view.aspectRatio)) return null;
    if (!naturalSize) return null;

    const { x, y } = view.position;
    if (typeof x !== "number" || typeof y !== "number") return null;

    return {
        cx: x + naturalSize.width / 2,
        cy: y + naturalSize.height / 2,
        width: naturalSize.width * view.scale,
        height: naturalSize.height * view.scale,
        rotation: view.rotation,
    };
}

/** Nearest grid node to a scalar coordinate, in display px. */
function nearest(value: number, size: number): number {
    return Math.round(value / size) * size;
}

/**
 * Snap a layer's top-left so its visual *centre* lands on the nearest
 * grid node. The centre is `position + naturalSize/2` — independent of
 * both scale and rotation, since the renderer transforms about it — so
 * we snap the centre and derive the top-left back from it. That makes
 * snapping stable while a grab simultaneously scales or rotates: only
 * placement quantises, never size or angle.
 *
 * Returns integer display coordinates, matching the wire's contract.
 */
export function snapToGrid(
    topLeft: { x: number; y: number },
    naturalSize: { width: number; height: number },
    size: number,
): { x: number; y: number } {
    const cx = nearest(topLeft.x + naturalSize.width / 2, size);
    const cy = nearest(topLeft.y + naturalSize.height / 2, size);

    return {
        x: Math.round(cx - naturalSize.width / 2),
        y: Math.round(cy - naturalSize.height / 2),
    };
}

/**
 * Snap an angle in degrees to the nearest detent — a multiple of `step`
 * measured from zero, so detents sit at absolute headings (0°, 15°, …)
 * rather than relative to wherever the layer started.
 *
 * Magnitude-agnostic: a grab accumulates rotation without bound, and a
 * cumulative angle of any size — past a full turn, or negative — still
 * quantises cleanly.
 */
export function snapAngle(degrees: number, step: number): number {
    return Math.round(degrees / step) * step;
}

// ── Rotation guide geometry ───────────────────────────────────
//
// The dial drawn under a handle while it is being rotated: a ring big
// enough to swallow the layer, ticked at every snap detent, all in the
// ring's own centre-relative coordinates (origin at the layer's centre).

const DEG_TO_RAD = Math.PI / 180;

/** Minor / cardinal tick lengths as a fraction of the ring radius. */
const MINOR_TICK = 0.08;
const CARDINAL_TICK = 0.14;

export interface GuideTick {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    /** A quarter-turn tick (0/90/180/270) — drawn longer. */
    cardinal: boolean;
    /** The detent the layer's current heading snaps to. */
    active: boolean;
}

/**
 * A point on a circle of `radius`, at `degrees` measured clockwise from
 * straight up — the same sense as a CSS `rotate()` and the layer's own
 * rotation, so a heading in degrees maps straight onto the dial.
 */
export function pointAtAngle(radius: number, degrees: number): { x: number; y: number } {
    const r = degrees * DEG_TO_RAD;
    return { x: radius * Math.sin(r), y: -radius * Math.cos(r) };
}

/**
 * Radius of the guide ring: half the layer's diagonal — the corner
 * distance, invariant under rotation, so the ring always encloses the
 * layer — plus a margin, then capped so the ring never outgrows the
 * screen.
 */
export function rotationGuideRadius(
    size: { width: number; height: number },
    margin: number,
    max: number,
): number {
    const halfDiagonal = 0.5 * Math.hypot(size.width, size.height);
    return Math.min(halfDiagonal + margin, max);
}

/**
 * The detent ticks around the ring — one every `step` degrees, so `step`
 * is assumed to divide 360. Each is a radial line from the rim inward;
 * cardinals reach deeper, and the one nearest `currentDeg` is flagged
 * active so the layer's heading is legible at a glance.
 */
export function rotationTicks(radius: number, step: number, currentDeg: number): GuideTick[] {
    const minor = radius * MINOR_TICK;
    const cardinal = radius * CARDINAL_TICK;
    const activeDetent = (((Math.round(currentDeg / step) * step) % 360) + 360) % 360;

    const ticks: GuideTick[] = [];

    for (let deg = 0; deg < 360; deg += step) {
        const isCardinal = deg % 90 === 0;
        const outer = pointAtAngle(radius, deg);
        const inner = pointAtAngle(radius - (isCardinal ? cardinal : minor), deg);

        ticks.push({
            x1: inner.x,
            y1: inner.y,
            x2: outer.x,
            y2: outer.y,
            cardinal: isCardinal,
            active: deg === activeDetent,
        });
    }

    return ticks;
}
