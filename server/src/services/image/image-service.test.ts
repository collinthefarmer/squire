import { test, expect, describe, beforeEach } from "bun:test";
import { ImageService } from "./image-service";
import { EventStore } from "@core/events/event-store";
import { StateStore } from "@core/state/state-store";
import { ClientRegistry } from "@core/transport/client-registry";
import { getImageLayer } from "@utils/state-helpers";
import { makeMetadata } from "../../test-utils/factories";

describe("ImageService", () => {
    let eventStore: EventStore;
    let stateStore: StateStore;
    let clientRegistry: ClientRegistry;
    let service: ImageService;

    beforeEach(() => {
        eventStore = new EventStore();
        stateStore = new StateStore();
        clientRegistry = new ClientRegistry();
        service = new ImageService(eventStore, stateStore, clientRegistry);
    });

    describe("handleSet", () => {
        test("should create a new layer", () => {
            eventStore.append({
                type: "visual.image.set",
                payload: {
                    layer: "background",
                    imageRef: "forest.png",
                    aspectRatio: "cover",
                },
                metadata: makeMetadata(),
            });

            const layer = getImageLayer(stateStore.getState(), "background");
            expect(layer).toBeDefined();
            expect(layer!.imageRef).toBe("forest.png");
            expect(layer!.aspectRatio).toBe("cover");
            expect(layer!.opacity).toBe(1);
            expect(layer!.visible).toBe(true);
        });

        test("should preserve existing layer properties on image change", () => {
            eventStore.append({
                type: "visual.image.set",
                payload: {
                    layer: "bg",
                    imageRef: "a.png",
                    aspectRatio: "cover",
                },
                metadata: makeMetadata(),
            });

            // Change opacity via layer_config
            eventStore.append({
                type: "visual.image.layer_config",
                payload: { layer: "bg", opacity: 0.5 },
                metadata: makeMetadata(),
            });

            // Set new image
            eventStore.append({
                type: "visual.image.set",
                payload: {
                    layer: "bg",
                    imageRef: "b.png",
                    aspectRatio: "contain",
                },
                metadata: makeMetadata(),
            });

            const layer = getImageLayer(stateStore.getState(), "bg");
            expect(layer!.imageRef).toBe("b.png");
            expect(layer!.opacity).toBe(0.5); // Preserved
        });
    });

    describe("handleClear", () => {
        test("should remove a layer", () => {
            eventStore.append({
                type: "visual.image.set",
                payload: {
                    layer: "bg",
                    imageRef: "a.png",
                    aspectRatio: "cover",
                },
                metadata: makeMetadata(),
            });

            eventStore.append({
                type: "visual.image.clear",
                payload: { layer: "bg" },
                metadata: makeMetadata(),
            });

            expect(getImageLayer(stateStore.getState(), "bg")).toBeUndefined();
        });
    });

    describe("handleTransform", () => {
        test("should update position and scale", () => {
            eventStore.append({
                type: "visual.image.set",
                payload: {
                    layer: "bg",
                    imageRef: "a.png",
                    aspectRatio: "cover",
                },
                metadata: makeMetadata(),
            });

            eventStore.append({
                type: "visual.image.transform",
                payload: {
                    layer: "bg",
                    position: { x: 100, y: 200 },
                    scale: 2.0,
                    rotation: 45,
                },
                metadata: makeMetadata(),
            });

            const layer = getImageLayer(stateStore.getState(), "bg");
            expect(layer!.position).toEqual({ x: 100, y: 200 });
            expect(layer!.scale).toBe(2.0);
            expect(layer!.rotation).toBe(45);
        });

        test("should only update provided fields", () => {
            eventStore.append({
                type: "visual.image.set",
                payload: {
                    layer: "bg",
                    imageRef: "a.png",
                    aspectRatio: "cover",
                    scale: 1.5,
                },
                metadata: makeMetadata(),
            });

            eventStore.append({
                type: "visual.image.transform",
                payload: {
                    layer: "bg",
                    rotation: 90,
                },
                metadata: makeMetadata(),
            });

            const layer = getImageLayer(stateStore.getState(), "bg");
            expect(layer!.scale).toBe(1.5); // Unchanged
            expect(layer!.rotation).toBe(90);
        });
    });

    describe("handleEffect", () => {
        test("should replace effects when replace=true", () => {
            eventStore.append({
                type: "visual.image.set",
                payload: {
                    layer: "bg",
                    imageRef: "a.png",
                    aspectRatio: "cover",
                },
                metadata: makeMetadata(),
            });

            eventStore.append({
                type: "visual.image.effect",
                payload: {
                    layer: "bg",
                    effects: [{ type: "blur", params: { radius: 5 } }],
                    replace: true,
                },
                metadata: makeMetadata(),
            });

            const layer = getImageLayer(stateStore.getState(), "bg");
            expect(layer!.effects).toHaveLength(1);
            expect(layer!.effects[0].type).toBe("blur");
        });

        test("should append effects when replace=false", () => {
            eventStore.append({
                type: "visual.image.set",
                payload: {
                    layer: "bg",
                    imageRef: "a.png",
                    aspectRatio: "cover",
                },
                metadata: makeMetadata(),
            });

            eventStore.append({
                type: "visual.image.effect",
                payload: {
                    layer: "bg",
                    effects: [{ type: "blur", params: { radius: 5 } }],
                    replace: true,
                },
                metadata: makeMetadata(),
            });

            eventStore.append({
                type: "visual.image.effect",
                payload: {
                    layer: "bg",
                    effects: [{ type: "glow", params: { intensity: 1 } }],
                    replace: false,
                },
                metadata: makeMetadata(),
            });

            const layer = getImageLayer(stateStore.getState(), "bg");
            expect(layer!.effects).toHaveLength(2);
        });
    });

    describe("handleLayerConfig", () => {
        test("should update layer configuration", () => {
            eventStore.append({
                type: "visual.image.set",
                payload: {
                    layer: "bg",
                    imageRef: "a.png",
                    aspectRatio: "cover",
                },
                metadata: makeMetadata(),
            });

            eventStore.append({
                type: "visual.image.layer_config",
                payload: {
                    layer: "bg",
                    blendMode: "multiply",
                    opacity: 0.7,
                    zIndex: 5,
                    visible: false,
                },
                metadata: makeMetadata(),
            });

            const layer = getImageLayer(stateStore.getState(), "bg");
            expect(layer!.blendMode).toBe("multiply");
            expect(layer!.opacity).toBe(0.7);
            expect(layer!.zIndex).toBe(5);
            expect(layer!.visible).toBe(false);
        });
    });

    describe("public getters", () => {
        test("getAllLayers should return all layers", () => {
            eventStore.append({
                type: "visual.image.set",
                payload: { layer: "bg", imageRef: "a.png", aspectRatio: "cover" },
                metadata: makeMetadata(),
            });
            eventStore.append({
                type: "visual.image.set",
                payload: { layer: "fg", imageRef: "b.png", aspectRatio: "contain" },
                metadata: makeMetadata(),
            });

            expect(service.getAllLayers()).toHaveLength(2);
        });

        test("getLayer should return undefined for missing layer", () => {
            expect(service.getLayer("nonexistent")).toBeUndefined();
        });
    });
});
