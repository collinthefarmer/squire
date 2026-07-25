import { test, expect, describe } from "bun:test";
import { layerId, imageRef } from "@types";
import {
    handleRect,
    snapToGrid,
    snapAngle,
    pointAtAngle,
    rotationGuideRadius,
    rotationTicks,
} from "./handle-geometry";
import type { LayerView } from "@services/layer-service";

const BASE: LayerView = {
    id: layerId("l"),
    imageRef: imageRef("x.png"),
    imageUrl: "img://x.png",
    aspectRatio: "native",
    position: { x: 800, y: 400 },
    scale: 1,
    rotation: 0,
    blendMode: "normal",
    opacity: 1,
    zIndex: 0,
    visible: true,
    effects: [],
};

function view(overrides: Partial<LayerView>): LayerView {
    return { ...BASE, ...overrides };
}

const DIMS = { width: 400, height: 200 };

describe("handleRect", () => {
    test("centres on position + natural/2, sizes by natural * scale", () => {
        const rect = handleRect(view({ scale: 0.5 }), DIMS);
        expect(rect).toEqual({ cx: 800 + 200, cy: 400 + 100, width: 200, height: 100, rotation: 0 });
    });

    test("carries rotation through", () => {
        expect(handleRect(view({ rotation: 30 }), DIMS)?.rotation).toBe(30);
    });

    test("centre is independent of scale (renderer scales about centre)", () => {
        const a = handleRect(view({ scale: 1 }), DIMS)!;
        const b = handleRect(view({ scale: 2 }), DIMS)!;
        expect({ cx: a.cx, cy: a.cy }).toEqual({ cx: b.cx, cy: b.cy });
        expect(b.width).toBe(a.width * 2);
    });

    test("null before the natural size is measured", () => {
        expect(handleRect(view({}), null)).toBeNull();
    });

    test("null for full-bleed layers", () => {
        expect(handleRect(view({ aspectRatio: "cover" }), DIMS)).toBeNull();
    });

    test("null for symbolic (non-numeric) positions", () => {
        expect(handleRect(view({ position: { x: "center", y: "center" } }), DIMS)).toBeNull();
    });

    test("null when image-less", () => {
        expect(handleRect(view({ imageUrl: null }), DIMS)).toBeNull();
    });

    test("still returns a rect for a hidden layer (the ghost handle)", () => {
        expect(handleRect(view({ visible: false }), DIMS)).not.toBeNull();
    });
});

describe("snapToGrid", () => {
    // 400×200 image → centre offset 200×100 from the top-left.
    const DIMS = { width: 400, height: 200 };

    test("lands the visual centre on the nearest grid node", () => {
        // Top-left 810,410 → centre 1010,510 → nearest 120-node 960,480
        // → top-left back off by natural/2.
        expect(snapToGrid({ x: 810, y: 410 }, DIMS, 120)).toEqual({ x: 760, y: 380 });
    });

    test("a centre already on a node is left where it is", () => {
        // Centre 960,480 is a node; top-left 760,380 stays put.
        expect(snapToGrid({ x: 760, y: 380 }, DIMS, 120)).toEqual({ x: 760, y: 380 });
    });

    test("rounds up past the half-cell boundary", () => {
        // Centre 1020,540 is a half-cell over — snaps to 1080,600.
        expect(snapToGrid({ x: 820, y: 440 }, DIMS, 120)).toEqual({ x: 880, y: 500 });
    });

    test("returns integer coordinates for odd natural sizes", () => {
        const odd = { width: 401, height: 201 };
        const snapped = snapToGrid({ x: 800, y: 400 }, odd, 120);
        expect(Number.isInteger(snapped.x)).toBe(true);
        expect(Number.isInteger(snapped.y)).toBe(true);
    });
});

describe("snapAngle", () => {
    test("pulls to the nearest detent", () => {
        expect(snapAngle(7, 15)).toBe(0);
        expect(snapAngle(8, 15)).toBe(15);
        expect(snapAngle(23, 15)).toBe(30);
    });

    test("leaves an exact detent untouched", () => {
        expect(snapAngle(45, 15)).toBe(45);
        expect(snapAngle(90, 15)).toBe(90);
    });

    test("detents are absolute, measured from zero", () => {
        // A layer starting at 7° that rotates a hair still snaps to 0/15,
        // not to 7 + a multiple.
        expect(snapAngle(7 + 2, 15)).toBe(15);
    });

    test("quantises negatives and angles past a full turn", () => {
        expect(snapAngle(-22, 15)).toBe(-15);
        expect(snapAngle(-40, 15)).toBe(-45);
        expect(snapAngle(370, 15)).toBe(375);
    });
});

describe("pointAtAngle", () => {
    test("zero degrees is straight up", () => {
        const p = pointAtAngle(100, 0);
        expect(p.x).toBeCloseTo(0);
        expect(p.y).toBeCloseTo(-100);
    });

    test("ninety degrees is to the right (clockwise)", () => {
        const p = pointAtAngle(100, 90);
        expect(p.x).toBeCloseTo(100);
        expect(p.y).toBeCloseTo(0);
    });
});

describe("rotationGuideRadius", () => {
    test("reaches the layer's corner plus a margin", () => {
        // 300×400 → diagonal 500 → half 250, + margin 40.
        expect(rotationGuideRadius({ width: 300, height: 400 }, 40, 540)).toBeCloseTo(290);
    });

    test("caps at the screen bound for an oversized layer", () => {
        expect(rotationGuideRadius({ width: 4000, height: 4000 }, 40, 540)).toBe(540);
    });
});

describe("rotationTicks", () => {
    test("one tick per detent, cardinals every quarter turn", () => {
        const ticks = rotationTicks(100, 15, 0);
        expect(ticks).toHaveLength(24);
        expect(ticks.filter((t) => t.cardinal)).toHaveLength(4);
    });

    test("flags the detent nearest the current heading", () => {
        // 44° rounds to the 45° detent — the third tick (0,15,30,45).
        const ticks = rotationTicks(100, 15, 44);
        const active = ticks.filter((t) => t.active);
        expect(active).toHaveLength(1);
        expect(active[0]).toBe(ticks[3]!);
    });

    test("wraps the active detent past a full turn", () => {
        // 359° rounds to 360 → detent 0, the first tick.
        const ticks = rotationTicks(100, 15, 359);
        expect(ticks[0]!.active).toBe(true);
    });

    test("cardinal ticks reach deeper than minor ticks", () => {
        const ticks = rotationTicks(100, 15, 0);
        const cardinal = ticks.find((t) => t.cardinal)!;
        const minor = ticks.find((t) => !t.cardinal)!;
        // Inner endpoint sits closer to centre for the longer tick.
        expect(Math.hypot(cardinal.x1, cardinal.y1)).toBeLessThan(Math.hypot(minor.x1, minor.y1));
    });
});
