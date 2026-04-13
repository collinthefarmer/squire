import { BehaviorSubject, type Observable } from "rxjs";
import { Logger } from "@utils/logger";
import {
    setInMap,
    updateInMap,
    removeFromMap,
} from "@utils/state-helpers";
import type { EventBus } from "@services/event-bus";
import type {
    ImageLayerState,
    ImageSetEvent,
    ImageClearEvent,
    ImageTransformEvent,
    ImageEffectEvent,
    ImageLayerConfigEvent,
} from "@types";

/**
 * Visual service for display client
 *
 * Manages image layer state, subscribes to server events,
 * and provides observables for components to render
 */
export class VisualService {
    private logger = new Logger("VisualService");
    private layers$ = new BehaviorSubject<Map<string, ImageLayerState>>(
        new Map(),
    );

    constructor(private eventBus: EventBus) {
        this.setupEventListeners();
    }

    /**
     * Get layers observable
     */
    getLayers$(): Observable<Map<string, ImageLayerState>> {
        return this.layers$.asObservable();
    }

    /**
     * Get current layers value
     */
    getLayers(): Map<string, ImageLayerState> {
        return this.layers$.value;
    }

    /**
     * Get current layer state
     */
    getLayer(id: string): ImageLayerState | undefined {
        return this.layers$.value.get(id);
    }

    /**
     * Get all layers
     */
    getAllLayers(): ImageLayerState[] {
        return Array.from(this.layers$.value.values());
    }

    /**
     * Setup event listeners for server events
     */
    private setupEventListeners(): void {
        this.eventBus.on("server:visual.image.*", (event: any) => {
            this.handleImageEvent(event);
        });
    }

    /**
     * Route image events to appropriate handlers
     */
    private handleImageEvent(event: any): void {
        switch (event.type) {
            case "visual.image.set":
                this.handleSet(event as ImageSetEvent);
                break;
            case "visual.image.clear":
                this.handleClear(event as ImageClearEvent);
                break;
            case "visual.image.transform":
                this.handleTransform(event as ImageTransformEvent);
                break;
            case "visual.image.effect":
                this.handleEffect(event as ImageEffectEvent);
                break;
            case "visual.image.layer_config":
                this.handleLayerConfig(event as ImageLayerConfigEvent);
                break;
        }
    }

    /**
     * Handle visual.image.set event
     *
     * Preserves existing layer properties (opacity, scale, etc.) when changing images.
     */
    private handleSet(event: ImageSetEvent): void {
        const { layer, imageRef, aspectRatio, position } = event.payload;

        this.logger.info("Image set", { layer, imageRef });

        const existingLayer = this.layers$.value.get(layer);

        const layerState: ImageLayerState = existingLayer
            ? {
                  ...existingLayer,
                  imageRef,
                  aspectRatio,
                  position: position || existingLayer.position,
              }
            : {
                  id: layer,
                  imageRef,
                  aspectRatio,
                  position: position || { x: "center", y: "center" },
                  scale: 1.0,
                  rotation: 0,
                  blendMode: "normal",
                  opacity: 1.0,
                  zIndex: 0,
                  visible: true,
                  effects: [],
              };

        const updated = setInMap(this.layers$.value, layer, layerState);
        this.layers$.next(updated);
    }

    /**
     * Handle visual.image.clear event
     */
    private handleClear(event: ImageClearEvent): void {
        const { layer } = event.payload;

        this.logger.info("Image clear", { layer });

        const updated = removeFromMap(this.layers$.value, layer);
        this.layers$.next(updated);
    }

    /**
     * Handle visual.image.transform event
     */
    private handleTransform(event: ImageTransformEvent): void {
        const { layer, position, scale, rotation } = event.payload;

        this.logger.info("Image transform", { layer });

        const updated = updateInMap(this.layers$.value, layer, (layerState) => {
            const updates: Partial<ImageLayerState> = {};

            if (position !== undefined) {
                updates.position = position;
            }
            if (scale !== undefined) {
                updates.scale = scale;
            }
            if (rotation !== undefined) {
                updates.rotation = rotation;
            }

            return { ...layerState, ...updates };
        });

        this.layers$.next(updated);
    }

    /**
     * Handle visual.image.effect event
     */
    private handleEffect(event: ImageEffectEvent): void {
        const { layer, effects, replace } = event.payload;

        this.logger.info("Image effect", { layer, replace });

        const updated = updateInMap(this.layers$.value, layer, (layerState) => {
            if (replace) {
                return { ...layerState, effects };
            }

            // Merge effects
            return {
                ...layerState,
                effects: [...layerState.effects, ...effects],
            };
        });

        this.layers$.next(updated);
    }

    /**
     * Handle visual.image.layer_config event
     */
    private handleLayerConfig(event: ImageLayerConfigEvent): void {
        const { layer, blendMode, opacity, zIndex, visible } = event.payload;

        this.logger.info("Layer config", { layer });

        const updated = updateInMap(this.layers$.value, layer, (layerState) => {
            const updates: Partial<ImageLayerState> = {};

            if (blendMode !== undefined) {
                updates.blendMode = blendMode;
            }
            if (opacity !== undefined) {
                updates.opacity = opacity;
            }
            if (zIndex !== undefined) {
                updates.zIndex = zIndex;
            }
            if (visible !== undefined) {
                updates.visible = visible;
            }

            return { ...layerState, ...updates };
        });

        this.layers$.next(updated);
    }
}
