import { test, expect, describe } from "bun:test";
import {
    applyImageSet,
    applyImageClear,
    applyImageTransform,
    applyImageEffect,
    applyImageLayerConfig,
} from "./layer-state";
import { makeMetadata, makeLayers } from "../test-utils/factories";
import type { ImageLayerState, LayerId } from "@types";
import { layerId } from "@types";

const BG = layerId("bg");
const FG = layerId("fg");

describe("layer-state reducers", () => {
    describe("applyImageSet", () => {
        test("should create a new layer with defaults", () => {
            const result = applyImageSet(new Map(), {
                type: "visual.image.set",
                payload: {
                    layer: BG,
                    imageRef: "forest.png",
                    aspectRatio: "cover",
                },
                metadata: makeMetadata(),
            });

            const layer = result.get(BG)!;
            expect(layer.imageRef).toBe("forest.png");
            expect(layer.aspectRatio).toBe("cover");
            expect(layer.opacity).toBe(1.0);
            expect(layer.visible).toBe(true);
            expect(layer.blendMode).toBe("normal");
        });

        test("should preserve existing layer properties", () => {
            const layers = makeLayers([BG, { opacity: 0.5, zIndex: 3 }]);

            const result = applyImageSet(layers, {
                type: "visual.image.set",
                payload: {
                    layer: BG,
                    imageRef: "new.png",
                    aspectRatio: "contain",
                },
                metadata: makeMetadata(),
            });

            const layer = result.get(BG)!;
            expect(layer.imageRef).toBe("new.png");
            expect(layer.opacity).toBe(0.5); // Preserved
            expect(layer.zIndex).toBe(3); // Preserved
        });

        test("should not mutate original map", () => {
            const original = new Map<LayerId, ImageLayerState>();

            applyImageSet(original, {
                type: "visual.image.set",
                payload: {
                    layer: BG,
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
            const layers = makeLayers([BG, {}]);

            const result = applyImageClear(layers, {
                type: "visual.image.clear",
                payload: { layer: BG },
                metadata: makeMetadata(),
            });

            expect(result.has(BG)).toBe(false);
        });

        test("should not affect other layers", () => {
            const layers = makeLayers([BG, {}], [FG, {}]);

            const result = applyImageClear(layers, {
                type: "visual.image.clear",
                payload: { layer: BG },
                metadata: makeMetadata(),
            });

            expect(result.has(FG)).toBe(true);
        });
    });

    describe("applyImageTransform", () => {
        test("should update position and scale", () => {
            const layers = makeLayers([BG, {}]);

            const result = applyImageTransform(layers, {
                type: "visual.image.transform",
                payload: {
                    layer: BG,
                    position: { x: 100, y: 200 },
                    scale: 2.0,
                },
                metadata: makeMetadata(),
            });

            const layer = result.get(BG)!;
            expect(layer.position).toEqual({ x: 100, y: 200 });
            expect(layer.scale).toBe(2.0);
        });

        test("should only update provided fields", () => {
            const layers = makeLayers([BG, { scale: 1.5, rotation: 45 }]);

            const result = applyImageTransform(layers, {
                type: "visual.image.transform",
                payload: { layer: BG, rotation: 90 },
                metadata: makeMetadata(),
            });

            const layer = result.get(BG)!;
            expect(layer.scale).toBe(1.5); // Unchanged
            expect(layer.rotation).toBe(90);
        });

        test("should return same map for non-existent layer", () => {
            const layers = new Map<LayerId, ImageLayerState>();

            const result = applyImageTransform(layers, {
                type: "visual.image.transform",
                payload: { layer: layerId("missing"), scale: 2.0 },
                metadata: makeMetadata(),
            });

            expect(result).toBe(layers);
        });
    });

    describe("applyImageEffect", () => {
        test("should replace effects when replace=true", () => {
            const layers = makeLayers([
                BG,
                { effects: [{ type: "glow", params: { intensity: 1 } }] },
            ]);

            const result = applyImageEffect(layers, {
                type: "visual.image.effect",
                payload: {
                    layer: BG,
                    effects: [{ type: "blur", params: { radius: 5 } }],
                    replace: true,
                },
                metadata: makeMetadata(),
            });

            const effects = result.get(BG)!.effects;
            expect(effects).toHaveLength(1);
            expect(effects[0]!.type).toBe("blur");
        });

        test("should append effects when replace=false", () => {
            const layers = makeLayers([
                BG,
                { effects: [{ type: "blur", params: { radius: 3 } }] },
            ]);

            const result = applyImageEffect(layers, {
                type: "visual.image.effect",
                payload: {
                    layer: BG,
                    effects: [{ type: "glow", params: { intensity: 2 } }],
                    replace: false,
                },
                metadata: makeMetadata(),
            });

            expect(result.get(BG)!.effects).toHaveLength(2);
        });
    });

    describe("applyImageLayerConfig", () => {
        test("should update config fields selectively", () => {
            const layers = makeLayers([BG, {}]);

            const result = applyImageLayerConfig(layers, {
                type: "visual.image.layer_config",
                payload: {
                    layer: BG,
                    blendMode: "multiply",
                    opacity: 0.5,
                },
                metadata: makeMetadata(),
            });

            const layer = result.get(BG)!;
            expect(layer.blendMode).toBe("multiply");
            expect(layer.opacity).toBe(0.5);
            expect(layer.visible).toBe(true); // Unchanged
        });
    });
});
