import { test, expect, describe } from "bun:test";
import { layerId, imageRef } from "@types";
import { handleRect } from "./handle-geometry";
import type { LayerView } from "@core/layer-service";

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

    test("null when hidden or image-less", () => {
        expect(handleRect(view({ visible: false }), DIMS)).toBeNull();
        expect(handleRect(view({ imageUrl: null }), DIMS)).toBeNull();
    });
});
