/**
 * Pure geometric computations for pointer data.
 *
 * No dependencies. All functions are stateless — they compute
 * spatial relationships from point coordinates.
 */

export interface Point {
    x: number;
    y: number;
}

export interface PointerPairMetrics {
    distance: number;
    midpoint: Point;
    angle: number;
}

export interface PairDelta {
    scaleRatio: number;
    rotationDelta: number;
    translationDelta: Point;
}

export function distance(a: Point, b: Point): number {
    return Math.hypot(b.x - a.x, b.y - a.y);
}

export function midpoint(a: Point, b: Point): Point {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function angle(a: Point, b: Point): number {
    return Math.atan2(b.y - a.y, b.x - a.x);
}

export function delta(prev: Point, current: Point): Point {
    return { x: current.x - prev.x, y: current.y - prev.y };
}

export function velocity(prev: Point, current: Point, dtMs: number): Point {
    if (dtMs <= 0) {
        return { x: 0, y: 0 };
    }

    return {
        x: (current.x - prev.x) / dtMs,
        y: (current.y - prev.y) / dtMs,
    };
}

export function pairMetrics(a: Point, b: Point): PointerPairMetrics {
    return {
        distance: distance(a, b),
        midpoint: midpoint(a, b),
        angle: angle(a, b),
    };
}

export function centroid(points: Point[]): Point {
    const n = points.length;
    if (n === 0) return { x: 0, y: 0 };

    let x = 0;
    let y = 0;

    for (const p of points) {
        x += p.x;
        y += p.y;
    }

    return { x: x / n, y: y / n };
}

export function matchesDirection(
    dx: number,
    dy: number,
    direction: Point,
): boolean {
    const dot = dx * direction.x + dy * direction.y;
    if (dot <= 0) return false;

    const moveDominant =
        Math.abs(dy) >= Math.abs(dx) ? ("y" as const) : ("x" as const);
    const dirDominant =
        Math.abs(direction.y) >= Math.abs(direction.x)
            ? ("y" as const)
            : ("x" as const);

    return moveDominant === dirDominant;
}

export function pairDelta(
    prev: PointerPairMetrics,
    current: PointerPairMetrics,
): PairDelta {
    return {
        scaleRatio: prev.distance > 0 ? current.distance / prev.distance : 1,
        rotationDelta: current.angle - prev.angle,
        translationDelta: delta(prev.midpoint, current.midpoint),
    };
}
