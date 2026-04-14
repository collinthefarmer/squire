import type { EventStore } from "@core/events/event-store";
import type { StateStore } from "@core/state/state-store";
import type { ClientRegistry } from "@core/transport/client-registry";
import type {
    ImageSetEvent,
    ImageClearEvent,
    ImageTransformEvent,
    ImageEffectEvent,
    ImageLayerConfigEvent,
    ImageLayerState,
    ImageEvent,
} from "@types";
import {
    setImageLayer,
    updateImageLayer,
    getImageLayer,
    getAllImageLayers,
    removeImageLayer,
} from "@utils/state-helpers";
import { Logger } from "@utils/logger";

const logger = new Logger("ImageService");

/**
 * Image service handles visual layer events
 *
 * Subscribes to EventStore for image events and maintains
 * a materialized view in StateStore for quick lookups.
 */
export class ImageService {
    constructor(
        private eventStore: EventStore,
        private stateStore: StateStore,
        private clientRegistry: ClientRegistry,
    ) {
        this.setupEventListeners();
        logger.info("ImageService initialized");
    }

    private setupEventListeners(): void {
        // Subscribe to all image events from EventStore
        this.eventStore.ofType<ImageEvent>("visual.image.*").subscribe((event) => {
            this.handleEvent(event);
        });
    }

    private handleEvent(event: ImageEvent): void {
        switch (event.type) {
            case "visual.image.set":
                this.handleSet(event);
                break;
            case "visual.image.clear":
                this.handleClear(event);
                break;
            case "visual.image.transform":
                this.handleTransform(event);
                break;
            case "visual.image.effect":
                this.handleEffect(event);
                break;
            case "visual.image.layer_config":
                this.handleLayerConfig(event);
                break;
        }
    }

    private handleSet(event: ImageSetEvent): void {
        const { layer, imageRef, aspectRatio, position, scale } = event.payload;

        logger.info(`Image set: layer=${layer}, imageRef=${imageRef}, scale=${scale ?? 1}`);

        // Update materialized view - create or update layer
        this.stateStore.updateState((state) => {
            const existingLayer = getImageLayer(state, layer);

            const layerState: ImageLayerState = existingLayer
                ? {
                      ...existingLayer,
                      imageRef,
                      aspectRatio,
                      position: position || existingLayer.position,
                      scale: scale ?? existingLayer.scale,
                  }
                : {
                      id: layer,
                      imageRef,
                      aspectRatio,
                      position: position || { x: "center", y: "center" },
                      scale: scale ?? 1,
                      rotation: 0,
                      blendMode: "normal",
                      opacity: 1,
                      zIndex: 0,
                      visible: true,
                      effects: [],
                  };

            return setImageLayer(state, layer, layerState);
        });

        // Broadcast to all clients
        this.clientRegistry.broadcast(event);
    }

    private handleClear(event: ImageClearEvent): void {
        const { layer } = event.payload;

        logger.info(`Image clear: layer=${layer}`);

        // Update materialized view - remove the layer
        this.stateStore.updateState((state) => {
            return removeImageLayer(state, layer);
        });

        // Broadcast to all clients
        this.clientRegistry.broadcast(event);
    }

    private handleTransform(event: ImageTransformEvent): void {
        const { layer, position, scale, rotation } = event.payload;

        logger.info(`Image transform: layer=${layer}`);

        // Update materialized view
        this.stateStore.updateState((state) => {
            return updateImageLayer(state, layer, (layerState) => ({
                ...layerState,
                position: position || layerState.position,
                scale: scale !== undefined ? scale : layerState.scale,
                rotation: rotation !== undefined ? rotation : layerState.rotation,
            }));
        });

        // Broadcast to all clients
        this.clientRegistry.broadcast(event);
    }

    private handleEffect(event: ImageEffectEvent): void {
        const { layer, effects, replace } = event.payload;

        logger.info(`Image effect: layer=${layer}, replace=${replace}`);

        // Update materialized view
        this.stateStore.updateState((state) => {
            return updateImageLayer(state, layer, (layerState) => {
                const newEffects = replace
                    ? effects
                    : [...layerState.effects, ...effects];

                return {
                    ...layerState,
                    effects: newEffects,
                };
            });
        });

        // Broadcast to all clients
        this.clientRegistry.broadcast(event);
    }

    private handleLayerConfig(event: ImageLayerConfigEvent): void {
        const { layer, blendMode, opacity, zIndex, visible } = event.payload;

        logger.info(`Image layer config: layer=${layer}`);

        // Update materialized view
        this.stateStore.updateState((state) => {
            return updateImageLayer(state, layer, (layerState) => ({
                ...layerState,
                blendMode: blendMode || layerState.blendMode,
                opacity: opacity !== undefined ? opacity : layerState.opacity,
                zIndex: zIndex !== undefined ? zIndex : layerState.zIndex,
                visible: visible !== undefined ? visible : layerState.visible,
            }));
        });

        // Broadcast to all clients
        this.clientRegistry.broadcast(event);
    }

    /**
     * Get all layers from materialized view
     */
    getAllLayers(): ImageLayerState[] {
        const state = this.stateStore.getState();
        if (!state.image) {
            return [];
        }
        return getAllImageLayers(state);
    }

    /**
     * Get layer state from materialized view
     */
    getLayer(layerId: string): ImageLayerState | undefined {
        const state = this.stateStore.getState();
        if (!state.image) {
            return undefined;
        }
        return getImageLayer(state, layerId);
    }
}
