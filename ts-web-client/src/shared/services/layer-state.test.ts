import { test, expect, describe } from "bun:test";
import {
    applyImageSet,
    applyImageClear,
    applyImageTransform,
    applyImageEffect,
    applyImageLayerConfig,
} from "./layer-state";
import { makeMetadata } from "../../test-utils/factories";
import type { ImageLayerState } from "@types";

function makeLayers(
    ...entries: [string, Partial<ImageLayerState>][]
): Map<string, ImageLayerState> {
    const map = new Map<string, ImageLayerState>();

    for (const [id, overrides] of entries) {
        map.set(id, {
            id,
            imageRef: "default.png",
            aspectRatio: "cover",
            position: { x: "center", y: "center" },
            scale: 1.0,
            rotation: 0,
            blendMode: "normal",
            opacity: 1.0,
            zIndex: 0,
            visible: true,
            effects: [],
            ...overrides,
        });
    }

    return map;
}

describe("layer-state reducers", () => {
    describe("applyImageSet", () => {
        test("should create a new layer with defaults", () => {
            const result = applyImageSet(new Map(), {
                type: "visual.image.set",
                payload: {
                    layer: "bg",
                    imageRef: "forest.png",
                    aspectRatio: "cover",
                },
                metadata: makeMetadata(),
            });

            const layer = result.get("bg")!;
            expect(layer.imageRef).toBe("forest.png");
            expect(layer.aspectRatio).toBe("cover");
            expect(layer.opacity).toBe(1.0);
            expect(layer.visible).toBe(true);
            expect(layer.blendMode).toBe("normal");
        });

        test("should preserve existing layer properties", () => {
            const layers = makeLayers(["bg", { opacity: 0.5, zIndex: 3 }]);

            const result = applyImageSet(layers, {
                type: "visual.image.set",
                payload: {
                    layer: "bg",
                    imageRef: "new.png",
                    aspectRatio: "contain",
                },
                metadata: makeMetadata(),
            });

            const layer = result.get("bg")!;
            expect(layer.imageRef).toBe("new.png");
            expect(layer.opacity).toBe(0.5); // Preserved
            expect(layer.zIndex).toBe(3); // Preserved
        });

        test("should not mutate original map", () => {
            const original = new Map<string, ImageLayerState>();

            applyImageSet(original, {
                type: "visual.image.set",
                payload: {
                    layer: "bg",
                    imageRef: "a.png",
                    aspectRatio: "cover",
                },
                metadata: makeMetadata(),
            });

            expect(original.size).toBe(0);
        });
    });

    describe("applyImageClear", () => {
        test("should remove a layer", () => {
            const layers = makeLayers(["bg", {}]);

            const result = applyImageClear(layers, {
                type: "visual.image.clear",
                payload: { layer: "bg" },
                metadata: makeMetadata(),
            });

            expect(result.has("bg")).toBe(false);
        });

        test("should not affect other layers", () => {
            const layers = makeLayers(["bg", {}], ["fg", {}]);

            const result = applyImageClear(layers, {
                type: "visual.image.clear",
                payload: { layer: "bg" },
                metadata: makeMetadata(),
            });

            expect(result.has("fg")).toBe(true);
        });
    });

    describe("applyImageTransform", () => {
        test("should update position and scale", () => {
            const layers = makeLayers(["bg", {}]);

            const result = applyImageTransform(layers, {
                type: "visual.image.transform",
                payload: {
                    layer: "bg",
                    position: { x: 100, y: 200 },
                    scale: 2.0,
                },
                metadata: makeMetadata(),
            });

            const layer = result.get("bg")!;
            expect(layer.position).toEqual({ x: 100, y: 200 });
            expect(layer.scale).toBe(2.0);
        });

        test("should only update provided fields", () => {
            const layers = makeLayers(["bg", { scale: 1.5, rotation: 45 }]);

            const result = applyImageTransform(layers, {
                type: "visual.image.transform",
                payload: { layer: "bg", rotation: 90 },
                metadata: makeMetadata(),
            });

            const layer = result.get("bg")!;
            expect(layer.scale).toBe(1.5); // Unchanged
            expect(layer.rotation).toBe(90);
        });

        test("should return same map for non-existent layer", () => {
            const layers = new Map<string, ImageLayerState>();

            const result = applyImageTransform(layers, {
                type: "visual.image.transform",
                payload: { layer: "missing", scale: 2.0 },
                metadata: makeMetadata(),
            });

            expect(result).toBe(layers);
        });
    });

    describe("applyImageEffect", () => {
        test("should replace effects when replace=true", () => {
            const layers = makeLayers([
                "bg",
                { effects: [{ type: "old", params: {} }] },
            ]);

            const result = applyImageEffect(layers, {
                type: "visual.image.effect",
                payload: {
                    layer: "bg",
                    effects: [{ type: "blur", params: { radius: 5 } }],
                    replace: true,
                },
                metadata: makeMetadata(),
            });

            const effects = result.get("bg")!.effects;
            expect(effects).toHaveLength(1);
            expect(effects[0]!.type).toBe("blur");
        });

        test("should append effects when replace=false", () => {
            const layers = makeLayers([
                "bg",
                { effects: [{ type: "existing", params: {} }] },
            ]);

            const result = applyImageEffect(layers, {
                type: "visual.image.effect",
                payload: {
                    layer: "bg",
                    effects: [{ type: "new", params: {} }],
                    replace: false,
                },
                metadata: makeMetadata(),
            });

            expect(result.get("bg")!.effects).toHaveLength(2);
        });
    });

    describe("applyImageLayerConfig", () => {
        test("should update config fields selectively", () => {
            const layers = makeLayers(["bg", {}]);

            const result = applyImageLayerConfig(layers, {
                type: "visual.image.layer_config",
                payload: {
                    layer: "bg",
                    blendMode: "multiply",
                    opacity: 0.5,
                },
                metadata: makeMetadata(),
            });

            const layer = result.get("bg")!;
            expect(layer.blendMode).toBe("multiply");
            expect(layer.opacity).toBe(0.5);
            expect(layer.visible).toBe(true); // Unchanged
        });
    });
});
