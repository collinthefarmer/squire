/**
 * Pure geometric computations for pointer data.
 *
 * No dependencies. All functions are stateless — they compute
 * spatial relationships from point coordinates.
 *
 * Layered: basic vector ops (add, subtract, scale, magnitude, dot)
 * compose into higher-level operations (distance, centroid, velocity).
 */

export interface Point {
    x: number;
    y: number;
}

export interface PointerPairMetrics {
    distance: number;
    center: Point;
    angle: number;
}

export interface PairDelta {
    scaleRatio: number;
    rotationDelta: number;
    translationDelta: Point;
}

// ── Basic vector operations ─────────────────────────────────────

export function add(a: Point, b: Point): Point {
    return { x: a.x + b.x, y: a.y + b.y };
}

export function subtract(a: Point, b: Point): Point {
    return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(p: Point, s: number): Point {
    return { x: p.x * s, y: p.y * s };
}

export function magnitude(p: Point): number {
    return Math.hypot(p.x, p.y);
}

export function dot(a: Point, b: Point): number {
    return a.x * b.x + a.y * b.y;
}

// ── Composed operations ─────────────────────────────────────────

export function distance(a: Point, b: Point): number {
    return magnitude(subtract(b, a));
}

export function centroid(points: Point[]): Point {
    if (points.length === 0) return { x: 0, y: 0 };

    return scale(
        points.reduce((sum, p) => add(sum, p), { x: 0, y: 0 }),
        1 / points.length,
    );
}

export function angle(a: Point, b: Point): number {
    return Math.atan2(b.y - a.y, b.x - a.x);
}

export function velocity(prev: Point, current: Point, dtMs: number): Point {
    if (dtMs <= 0) return { x: 0, y: 0 };

    return scale(subtract(current, prev), 1 / dtMs);
}

export function dominantAxis(p: Point): "x" | "y" {
    return Math.abs(p.y) >= Math.abs(p.x) ? "y" : "x";
}

export function matchesDirection(movement: Point, direction: Point): boolean {
    if (dot(movement, direction) <= 0) return false;

    return dominantAxis(movement) === dominantAxis(direction);
}

// ── Pair metrics ────────────────────────────────────────────────

export function pairMetrics(a: Point, b: Point): PointerPairMetrics {
    return {
        distance: distance(a, b),
        center: centroid([a, b]),
        angle: angle(a, b),
    };
}

export function pairDelta(
    prev: PointerPairMetrics,
    current: PointerPairMetrics,
): PairDelta {
    return {
        scaleRatio: prev.distance > 0 ? current.distance / prev.distance : 1,
        rotationDelta: current.angle - prev.angle,
        translationDelta: subtract(current.center, prev.center),
    };
}
