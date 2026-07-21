import { test, expect, describe } from "bun:test";
import {
    distance,
    midpoint,
    angle,
    delta,
    velocity,
    pairMetrics,
    pairDelta,
} from "./transform";

describe("transform", () => {
    describe("distance", () => {
        test("should compute distance between two points", () => {
            expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
        });

        test("should return 0 for same point", () => {
            expect(distance({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
        });
    });

    describe("midpoint", () => {
        test("should compute midpoint", () => {
            const m = midpoint({ x: 0, y: 0 }, { x: 10, y: 20 });
            expect(m).toEqual({ x: 5, y: 10 });
        });
    });

    describe("angle", () => {
        test("should return 0 for horizontal right", () => {
            expect(angle({ x: 0, y: 0 }, { x: 10, y: 0 })).toBe(0);
        });

        test("should return PI/2 for vertical down", () => {
            expect(angle({ x: 0, y: 0 }, { x: 0, y: 10 })).toBeCloseTo(
                Math.PI / 2,
            );
        });

        test("should return -PI/2 for vertical up", () => {
            expect(angle({ x: 0, y: 0 }, { x: 0, y: -10 })).toBeCloseTo(
                -Math.PI / 2,
            );
        });
    });

    describe("delta", () => {
        test("should compute displacement", () => {
            expect(delta({ x: 10, y: 20 }, { x: 15, y: 18 })).toEqual({
                x: 5,
                y: -2,
            });
        });
    });

    describe("velocity", () => {
        test("should compute px/ms", () => {
            const v = velocity({ x: 0, y: 0 }, { x: 100, y: 0 }, 50);
            expect(v).toEqual({ x: 2, y: 0 });
        });

        test("should return zero for zero time", () => {
            expect(velocity({ x: 0, y: 0 }, { x: 100, y: 0 }, 0)).toEqual({
                x: 0,
                y: 0,
            });
        });
    });

    describe("pairMetrics", () => {
        test("should compute distance, midpoint, and angle", () => {
            const m = pairMetrics({ x: 0, y: 0 }, { x: 6, y: 8 });
            expect(m.distance).toBe(10);
            expect(m.midpoint).toEqual({ x: 3, y: 4 });
            expect(m.angle).toBeCloseTo(Math.atan2(8, 6));
        });
    });

    describe("pairDelta", () => {
        test("should compute scale ratio for pinch out", () => {
            const prev = pairMetrics({ x: 0, y: 0 }, { x: 10, y: 0 });
            const current = pairMetrics({ x: 0, y: 0 }, { x: 20, y: 0 });
            const d = pairDelta(prev, current);

            expect(d.scaleRatio).toBe(2);
            expect(d.rotationDelta).toBe(0);
        });

        test("should compute scale ratio for pinch in", () => {
            const prev = pairMetrics({ x: 0, y: 0 }, { x: 20, y: 0 });
            const current = pairMetrics({ x: 0, y: 0 }, { x: 10, y: 0 });
            const d = pairDelta(prev, current);

            expect(d.scaleRatio).toBe(0.5);
        });

        test("should compute rotation delta", () => {
            const prev = pairMetrics({ x: 0, y: 0 }, { x: 10, y: 0 });
            const current = pairMetrics({ x: 0, y: 0 }, { x: 0, y: 10 });
            const d = pairDelta(prev, current);

            expect(d.rotationDelta).toBeCloseTo(Math.PI / 2);
        });

        test("should compute translation delta", () => {
            const prev = pairMetrics({ x: 0, y: 0 }, { x: 10, y: 0 });
            const current = pairMetrics({ x: 5, y: 5 }, { x: 15, y: 5 });
            const d = pairDelta(prev, current);

            expect(d.translationDelta).toEqual({ x: 5, y: 5 });
        });

        test("should return scale 1 when prev distance is 0", () => {
            const prev = pairMetrics({ x: 5, y: 5 }, { x: 5, y: 5 });
            const current = pairMetrics({ x: 0, y: 0 }, { x: 10, y: 0 });
            const d = pairDelta(prev, current);

            expect(d.scaleRatio).toBe(1);
        });
    });
});
