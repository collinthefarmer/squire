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
    LayerId,
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
        this.eventStore
            .ofType<ImageEvent>("visual.image.*")
            .subscribe((event) => {
                try {
                    this.handleEvent(event);
                } catch (error) {
                    const detail = error instanceof Error ? error.stack ?? error.message : String(error);
                    logger.error("Failed to handle image event", { type: event.type, error: detail });
                }
            });
    }

    private readonly handlers: {
        [K in ImageEvent["type"]]: (e: Extract<ImageEvent, { type: K }>) => void;
    } = {
        "visual.image.set": (e) => this.handleSet(e),
        "visual.image.clear": (e) => this.handleClear(e),
        "visual.image.transform": (e) => this.handleTransform(e),
        "visual.image.effect": (e) => this.handleEffect(e),
        "visual.image.layer_config": (e) => this.handleLayerConfig(e),
    };

    private handleEvent(event: ImageEvent): void {
        const handler = this.handlers[event.type];
        (handler as (e: ImageEvent) => void)(event);
    }

    private handleSet(event: ImageSetEvent): void {
        const { layer, imageRef, aspectRatio, position, scale, rotation } = event.payload;

        logger.info(
            `Image set: layer=${layer}, imageRef=${imageRef}, scale=${scale ?? 1}`,
        );

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
                      rotation: rotation ?? existingLayer.rotation,
                  }
                : {
                      id: layer,
                      imageRef,
                      aspectRatio,
                      position: position || { x: "center", y: "center" },
                      scale: scale ?? 1,
                      rotation: rotation ?? 0,
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
                rotation:
                    rotation !== undefined ? rotation : layerState.rotation,
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
    getLayer(id: LayerId): ImageLayerState | undefined {
        const state = this.stateStore.getState();
        if (!state.image) {
            return undefined;
        }
        return getImageLayer(state, id);
    }
}
