import { test, expect, describe } from "bun:test";
import { computeLayerPlacement } from "./layer-placement";

describe("computeLayerPlacement", () => {
    test("reproduces cover scale — minor axis fills the preview square", () => {
        // landscape: height is the minor axis
        const land = computeLayerPlacement({ width: 1024, height: 768 }, { x: 0, y: 0 }, 268);
        expect(land.scale).toBeCloseTo(268 / 768);

        // portrait: width is the minor axis
        const port = computeLayerPlacement({ width: 600, height: 900 }, { x: 0, y: 0 }, 268);
        expect(port.scale).toBeCloseTo(268 / 600);
    });

    test("a square image maps 1:1 onto the preview square", () => {
        const { scale } = computeLayerPlacement({ width: 500, height: 500 }, { x: 0, y: 0 }, 268);
        expect(scale).toBeCloseTo(268 / 500);
        // visual side = 500 * (268/500) = 268 → exactly the preview
        expect(500 * scale).toBeCloseTo(268);
    });

    test("centres the layer on the given point via the natural half-size", () => {
        const { position } = computeLayerPlacement({ width: 1024, height: 768 }, { x: 960, y: 540 }, 268);
        expect(position).toEqual({ x: 960 - 512, y: 540 - 384 });
    });

    test("clamps scale up for a tiny source", () => {
        // 268 / 20 = 13.4 → clamped to 5.0
        const { scale } = computeLayerPlacement({ width: 20, height: 20 }, { x: 0, y: 0 }, 268);
        expect(scale).toBe(5.0);
    });

    test("clamps scale down for a huge source", () => {
        // 268 / 8000 = 0.0335 → clamped to 0.1
        const { scale } = computeLayerPlacement({ width: 8000, height: 8000 }, { x: 0, y: 0 }, 268);
        expect(scale).toBe(0.1);
    });

    test("scales with the measured preview size (pinch-zoomed palette)", () => {
        const small = computeLayerPlacement({ width: 500, height: 500 }, { x: 0, y: 0 }, 134);
        const large = computeLayerPlacement({ width: 500, height: 500 }, { x: 0, y: 0 }, 402);
        expect(large.scale).toBeCloseTo(small.scale * 3);
    });

    test("rounds fractional positions to whole display px", () => {
        const { position } = computeLayerPlacement({ width: 101, height: 101 }, { x: 100, y: 100 }, 268);
        expect(position).toEqual({ x: Math.round(100 - 50.5), y: Math.round(100 - 50.5) });
    });
});
