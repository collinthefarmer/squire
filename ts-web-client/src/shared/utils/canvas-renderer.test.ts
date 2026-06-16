import { test, expect, describe } from "bun:test";
import {
    calculateNormalizedPosition,
    calculateStringPosition,
    calculatePosition,
    mapBlendMode,
    calculateScaledDimensions,
} from "./canvas-renderer";

// -- Position Calculations --

describe("calculateNormalizedPosition", () => {
    test("should return 0 for normalized 0 (left/top edge)", () => {
        expect(calculateNormalizedPosition(0, 1000, 200)).toBe(0);
    });

    test("should center image for normalized 0.5", () => {
        expect(calculateNormalizedPosition(0.5, 1000, 200)).toBe(400);
    });

    test("should align to right/bottom edge for normalized 1", () => {
        expect(calculateNormalizedPosition(1, 1000, 200)).toBe(800);
    });
});

describe("calculateStringPosition", () => {
    test("should center image for 'center'", () => {
        expect(calculateStringPosition("center", 1000, 200)).toBe(400);
    });

    test("should return 0 for 'left'", () => {
        expect(calculateStringPosition("left", 1000, 200)).toBe(0);
    });

    test("should return 0 for 'top'", () => {
        expect(calculateStringPosition("top", 1000, 200)).toBe(0);
    });

    test("should align to far edge for 'right'", () => {
        expect(calculateStringPosition("right", 1000, 200)).toBe(800);
    });

    test("should align to far edge for 'bottom'", () => {
        expect(calculateStringPosition("bottom", 1000, 200)).toBe(800);
    });

    test("should handle percentage values", () => {
        expect(calculateStringPosition("25%", 1000, 200)).toBe(200);
    });

    test("should handle pixel values", () => {
        expect(calculateStringPosition("150px", 1000, 200)).toBe(150);
    });

    test("should return 0 for unknown values", () => {
        expect(calculateStringPosition("unknown", 1000, 200)).toBe(0);
    });
});

describe("calculatePosition", () => {
    test("should route numbers to normalized calculation", () => {
        expect(calculatePosition(0.5, 1000, 200)).toBe(400);
    });

    test("should route strings to string calculation", () => {
        expect(calculatePosition("center", 1000, 200)).toBe(400);
    });
});

// -- Blend Mode --

describe("mapBlendMode", () => {
    test("should map known blend modes", () => {
        expect(mapBlendMode("normal")).toBe("source-over");
        expect(mapBlendMode("multiply")).toBe("multiply");
        expect(mapBlendMode("screen")).toBe("screen");
        expect(mapBlendMode("overlay")).toBe("overlay");
        expect(mapBlendMode("add")).toBe("lighter");
    });

    test("should default to source-over for unknown modes", () => {
        expect(mapBlendMode("unknown")).toBe("source-over");
    });
});

// -- Scaled Dimensions --

describe("calculateScaledDimensions", () => {
    test("should scale to cover canvas", () => {
        const result = calculateScaledDimensions("cover", 800, 600, 1920, 1080);
        const scale = Math.max(1920 / 800, 1080 / 600);
        expect(result.width).toBe(800 * scale);
        expect(result.height).toBe(600 * scale);
    });

    test("should scale to contain within canvas", () => {
        const result = calculateScaledDimensions("contain", 800, 600, 1920, 1080);
        const scale = Math.min(1920 / 800, 1080 / 600);
        expect(result.width).toBe(800 * scale);
        expect(result.height).toBe(600 * scale);
    });

    test("should stretch to fill canvas", () => {
        const result = calculateScaledDimensions("fill", 800, 600, 1920, 1080);
        expect(result.width).toBe(1920);
        expect(result.height).toBe(1080);
    });

    test("should use native dimensions", () => {
        const result = calculateScaledDimensions("native", 800, 600, 1920, 1080);
        expect(result.width).toBe(800);
        expect(result.height).toBe(600);
    });
});
