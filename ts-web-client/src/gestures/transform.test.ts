import { test, expect, describe } from "bun:test";
import {
    add,
    subtract,
    scale,
    magnitude,
    dot,
    distance,
    centroid,
    angle,
    velocity,
    dominantAxis,
    matchesDirection,
    pairMetrics,
    pairDelta,
} from "./transform";

describe("basic vector operations", () => {
    test("add", () => {
        expect(add({ x: 1, y: 2 }, { x: 3, y: 4 })).toEqual({ x: 4, y: 6 });
    });

    test("subtract", () => {
        expect(subtract({ x: 10, y: 20 }, { x: 3, y: 5 })).toEqual({ x: 7, y: 15 });
    });

    test("scale", () => {
        expect(scale({ x: 3, y: 4 }, 2)).toEqual({ x: 6, y: 8 });
    });

    test("magnitude", () => {
        expect(magnitude({ x: 3, y: 4 })).toBe(5);
    });

    test("dot", () => {
        expect(dot({ x: 1, y: 0 }, { x: 0, y: 1 })).toBe(0);
        expect(dot({ x: 2, y: 3 }, { x: 4, y: 5 })).toBe(23);
    });
});

describe("composed operations", () => {
    test("distance", () => {
        expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
        expect(distance({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
    });

    test("centroid of empty array", () => {
        expect(centroid([])).toEqual({ x: 0, y: 0 });
    });

    test("centroid of two points", () => {
        expect(centroid([{ x: 0, y: 0 }, { x: 10, y: 20 }])).toEqual({ x: 5, y: 10 });
    });

    test("centroid of three points", () => {
        const c = centroid([{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 0, y: 9 }]);
        expect(c).toEqual({ x: 2, y: 3 });
    });

    test("angle horizontal right", () => {
        expect(angle({ x: 0, y: 0 }, { x: 10, y: 0 })).toBe(0);
    });

    test("angle vertical down", () => {
        expect(angle({ x: 0, y: 0 }, { x: 0, y: 10 })).toBeCloseTo(Math.PI / 2);
    });

    test("angle vertical up", () => {
        expect(angle({ x: 0, y: 0 }, { x: 0, y: -10 })).toBeCloseTo(-Math.PI / 2);
    });

    test("velocity computes px/ms", () => {
        expect(velocity({ x: 0, y: 0 }, { x: 100, y: 0 }, 50)).toEqual({ x: 2, y: 0 });
    });

    test("velocity returns zero for zero time", () => {
        expect(velocity({ x: 0, y: 0 }, { x: 100, y: 0 }, 0)).toEqual({ x: 0, y: 0 });
    });
});

describe("direction", () => {
    test("dominantAxis", () => {
        expect(dominantAxis({ x: 10, y: 3 })).toBe("x");
        expect(dominantAxis({ x: 3, y: 10 })).toBe("y");
        expect(dominantAxis({ x: 5, y: 5 })).toBe("y"); // equal defaults to y
    });

    test("matchesDirection — same direction and axis", () => {
        expect(matchesDirection({ x: 0, y: 10 }, { x: 0, y: 1 })).toBe(true);
    });

    test("matchesDirection — opposite direction", () => {
        expect(matchesDirection({ x: 0, y: -10 }, { x: 0, y: 1 })).toBe(false);
    });

    test("matchesDirection — wrong dominant axis", () => {
        expect(matchesDirection({ x: 10, y: 2 }, { x: 0, y: 1 })).toBe(false);
    });
});

describe("pair metrics", () => {
    test("computes distance, center, and angle", () => {
        const m = pairMetrics({ x: 0, y: 0 }, { x: 6, y: 8 });
        expect(m.distance).toBe(10);
        expect(m.center).toEqual({ x: 3, y: 4 });
        expect(m.angle).toBeCloseTo(Math.atan2(8, 6));
    });

    test("pairDelta — pinch out doubles scale", () => {
        const prev = pairMetrics({ x: 0, y: 0 }, { x: 10, y: 0 });
        const current = pairMetrics({ x: 0, y: 0 }, { x: 20, y: 0 });
        const d = pairDelta(prev, current);

        expect(d.scaleRatio).toBe(2);
        expect(d.rotationDelta).toBe(0);
    });

    test("pairDelta — pinch in halves scale", () => {
        const prev = pairMetrics({ x: 0, y: 0 }, { x: 20, y: 0 });
        const current = pairMetrics({ x: 0, y: 0 }, { x: 10, y: 0 });

        expect(pairDelta(prev, current).scaleRatio).toBe(0.5);
    });

    test("pairDelta — rotation", () => {
        const prev = pairMetrics({ x: 0, y: 0 }, { x: 10, y: 0 });
        const current = pairMetrics({ x: 0, y: 0 }, { x: 0, y: 10 });

        expect(pairDelta(prev, current).rotationDelta).toBeCloseTo(Math.PI / 2);
    });

    test("pairDelta — translation", () => {
        const prev = pairMetrics({ x: 0, y: 0 }, { x: 10, y: 0 });
        const current = pairMetrics({ x: 5, y: 5 }, { x: 15, y: 5 });

        expect(pairDelta(prev, current).translationDelta).toEqual({ x: 5, y: 5 });
    });

    test("pairDelta — zero distance returns scale 1", () => {
        const prev = pairMetrics({ x: 5, y: 5 }, { x: 5, y: 5 });
        const current = pairMetrics({ x: 0, y: 0 }, { x: 10, y: 0 });

        expect(pairDelta(prev, current).scaleRatio).toBe(1);
    });
});
