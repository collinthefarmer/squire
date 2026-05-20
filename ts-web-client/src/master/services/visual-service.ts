import { BehaviorSubject, type Observable } from "rxjs";
import { map } from "rxjs";
import { Logger } from "@utils/logger";
import { ServiceRegistry } from "@services/service-registry";
import { TOKENS } from "@services/service-tokens";
import type { EventBus } from "@services/event-bus";
import type { ConnectionService } from "@services/connection-service";
import type { AssetService } from "./asset-service";
import type { ImageToolbarService } from "./image-toolbar-service";
import { EventBuilder } from "./event-builder";
import {
    applyImageSet,
    applyImageClear,
    applyImageTransform,
    applyImageEffect,
    applyImageLayerConfig,
} from "@services/layer-state";
import { calculateScaledDimensions } from "@utils/canvas-renderer";
import { DISPLAY } from "@shared/constants/display";
import { computeDisplayBounds } from "@master/components/canvas/display-coordinates";
import type { CanvasObjectProvider } from "./canvas-object-provider";
import type {
    BlendMode,
    AspectRatioMode,
    ImagePosition,
    ImageTransition,
    ImageLayerState,
    ImageEvent,
} from "@types";

/**
 * Subset of layer config fields that can be updated via
 * the visual.image.layer_config event.
 */
export interface LayerConfigUpdate {
    opacity?: number;
    blendMode?: BlendMode;
    zIndex?: number;
    visible?: boolean;
}

/**
 * Bounding box in display-space pixels (1920×1080)
 */
export interface DisplayBounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * A persistent object on the canvas that can be interacted with
 * via overlays. Type-tagged for extensibility (images, timers, etc.)
 */
export interface CanvasObject {
    id: string;
    type: string;
    bounds: DisplayBounds;
    scale: number;
    zIndex: number;
}

/**
 * Visual service for master client
 *
 * Handles image layer management and tracks layer state from server
 * events for canvas overlay interaction. Subscribes to server image
 * events so overlays appear for pre-existing images on connect.
 */
export class MasterVisualService implements CanvasObjectProvider {
    private logger = new Logger("MasterVisualService");
    private connectionService: ConnectionService;
    private assetService: AssetService;
    private imageToolbarService: ImageToolbarService;

    private layers$ = new BehaviorSubject<Map<string, ImageLayerState>>(
        new Map(),
    );

    private readonly canvasObjects$ = this.layers$.pipe(
        map((layers) => this.computeCanvasObjects(layers)),
    );

    constructor(connectionService: ConnectionService, eventBus: EventBus) {
        this.connectionService = connectionService;
        this.assetService = ServiceRegistry.get(TOKENS.AssetService);
        this.imageToolbarService = ServiceRegistry.get(TOKENS.ImageToolbarService);
        this.setupEventListeners(eventBus);
    }

    // -- Canvas object derivation --

    getCanvasObjects$(): Observable<CanvasObject[]> {
        return this.canvasObjects$;
    }

    private computeCanvasObjects(
        layers: Map<string, ImageLayerState>,
    ): CanvasObject[] {
        const objects: CanvasObject[] = [];

        for (const [id, layer] of layers) {
            if (!layer.imageRef || !layer.visible) {
                continue;
            }

            const bounds = this.computeBounds(layer);
            if (!bounds) {
                continue;
            }

            objects.push({
                id,
                type: "image",
                bounds,
                scale: layer.scale,
                zIndex: layer.zIndex,
            });
        }

        return objects.sort((a, b) => a.zIndex - b.zIndex);
    }

    private computeBounds(layer: ImageLayerState): DisplayBounds | null {
        if (!layer.imageRef) {
            return null;
        }

        const dims = this.resolveImageDimensions(layer.imageRef);

        const { width, height } = calculateScaledDimensions(
            layer.aspectRatio,
            dims.width,
            dims.height,
            DISPLAY.WIDTH,
            DISPLAY.HEIGHT,
        );

        const bounds = computeDisplayBounds(
            layer.position,
            width,
            height,
            layer.scale,
        );

        this.logger.debug("computeBounds", {
            layer: layer.id,
            imageRef: layer.imageRef,
            naturalDims: dims,
            scaled: { width, height },
            bounds,
        });

        return bounds;
    }

    private resolveImageDimensions(imageRef: string): {
        width: number;
        height: number;
    } {
        const assets = this.assetService.getImageAssets();
        const asset = assets.find((a) => a.name === imageRef);
        if (asset) {
            return { width: asset.width, height: asset.height };
        }
        return { width: DISPLAY.WIDTH, height: DISPLAY.HEIGHT };
    }

    // -- Layer access --

    getLayers$(): Observable<Map<string, ImageLayerState>> {
        return this.layers$.asObservable();
    }

    getLayers(): Map<string, ImageLayerState> {
        return this.layers$.value;
    }

    getTargetLayer(_x: number, _y: number): string {
        return "background";
    }

    // -- Layer configuration --

    setLayerConfig(layer: string, config: LayerConfigUpdate): void {
        this.logger.info("Setting layer config", { layer, ...config });
        const event = EventBuilder.layerConfig({ layer, ...config });
        this.connectionService.send(event);
    }

    /**
     * Apply a new layer ordering by assigning descending z-index values.
     * The first element gets the highest z-index (rendered on top).
     * Only sends events for layers whose z-index actually changed.
     */
    reorderLayers(order: string[]): void {
        const layers = this.layers$.value;

        this.logger.info("Reordering layers", { order });

        for (let i = 0; i < order.length; i++) {
            const id = order[i] as string;
            const zIndex = order.length - 1 - i;
            const current = layers.get(id);

            if (current && current.zIndex !== zIndex) {
                this.setLayerConfig(id, { zIndex });
            }
        }
    }

    // -- Image commands --

    setImage(
        layer: string,
        imageRef: string,
        options?: {
            aspectRatio?: AspectRatioMode;
            position?: ImagePosition;
            transition?: ImageTransition;
            scale?: number;
        },
    ): void {
        this.logger.info("Setting image", {
            layer,
            imageRef,
            scale: options?.scale,
        });

        const event = EventBuilder.imageSet({
            layer,
            imageRef,
            aspectRatio: options?.aspectRatio ?? "contain",
            position: options?.position,
            transition: options?.transition,
            scale: options?.scale,
        });

        this.connectionService.send(event);
    }

    clearImage(layer: string, transition?: ImageTransition): void {
        this.logger.info("Clearing image", { layer });

        const event = EventBuilder.imageClear({ layer, transition });
        this.connectionService.send(event);
    }

    /**
     * CanvasObjectProvider implementation — delegates to transformImage.
     */
    transformObject(id: string, position: ImagePosition, scale?: number): void {
        this.transformImage(id, { position, scale });
    }

    transformImage(
        layer: string,
        transform: {
            position?: ImagePosition;
            scale?: number;
            rotation?: number;
        },
    ): void {
        this.logger.info("Transforming image", {
            layer,
            position: transform.position,
            scale: transform.scale,
            rotation: transform.rotation,
        });

        const event = EventBuilder.imageTransform({ layer, ...transform });
        this.connectionService.send(event);
    }

    /**
     * Handle image drop from gallery.
     *
     * Computes pixel-based position from the display-space coordinates
     * of the image center. The overlay is created when the server
     * broadcasts the event back and the event handler processes it.
     */
    handleImageDrop(
        imageRef: string,
        displayX: number,
        displayY: number,
    ): void {
        const settings = this.imageToolbarService.getSettings();

        // Auto-create a new layer if the selected one already has an image
        let targetLayer = settings.layer;
        const existingLayer = this.layers$.value.get(targetLayer);
        if (existingLayer?.imageRef) {
            targetLayer = this.generateLayerName();
            this.imageToolbarService.registerLayer(targetLayer);
        }

        const position = this.computeDropPosition(
            displayX,
            displayY,
            "contain",
            settings.imageDimensions?.width ?? DISPLAY.WIDTH,
            settings.imageDimensions?.height ?? DISPLAY.HEIGHT,
        );

        this.logger.info("Handling image drop", {
            imageRef,
            layer: targetLayer,
            position,
            scale: settings.scale,
        });

        this.setImage(targetLayer, imageRef, {
            aspectRatio: "contain",
            position,
            scale: settings.scale,
        });
    }

    /**
     * Convert a display-space center point into a pixel-based ImagePosition,
     * accounting for the image's scaled dimensions so the center of the
     * placed image aligns with the drop point.
     */
    private computeDropPosition(
        displayX: number,
        displayY: number,
        aspectRatio: AspectRatioMode,
        imgWidth: number,
        imgHeight: number,
    ): ImagePosition {
        const { width, height } = calculateScaledDimensions(
            aspectRatio,
            imgWidth,
            imgHeight,
            DISPLAY.WIDTH,
            DISPLAY.HEIGHT,
        );

        return {
            x: `${displayX - width / 2}px`,
            y: `${displayY - height / 2}px`,
        };
    }

    // -- Helpers --

    private generateLayerName(): string {
        const existing = new Set(this.layers$.value.keys());
        const registered = this.imageToolbarService.getRegisteredLayers();
        for (const name of registered) {
            existing.add(name);
        }

        let i = 1;
        while (existing.has(`layer-${i}`)) {
            i++;
        }
        return `layer-${i}`;
    }

    // -- Server event handling --

    private readonly imageHandlers: {
        [K in ImageEvent["type"]]: (
            current: Map<string, ImageLayerState>,
            event: Extract<ImageEvent, { type: K }>,
        ) => Map<string, ImageLayerState>;
    } = {
        "visual.image.set": (c, e) => applyImageSet(c, e),
        "visual.image.clear": (c, e) => applyImageClear(c, e),
        "visual.image.transform": (c, e) => applyImageTransform(c, e),
        "visual.image.effect": (c, e) => applyImageEffect(c, e),
        "visual.image.layer_config": (c, e) => applyImageLayerConfig(c, e),
    };

    private setupEventListeners(eventBus: EventBus): void {
        eventBus.on("server:system.connected", () => {
            this.logger.info("Resetting layer state for reconnection sync");
            this.layers$.next(new Map());
        });

        eventBus.on("server:visual.image.*", (event: unknown) => {
            try {
                this.handleImageEvent(event as ImageEvent);
            } catch (error) {
                this.logger.error("Failed to handle image event", { error: String(error) });
            }
        });
    }

    private handleImageEvent(event: ImageEvent): void {
        const current = this.layers$.value;
        const handler = this.imageHandlers[event.type];
        const updated = (handler as (c: Map<string, ImageLayerState>, e: ImageEvent) => Map<string, ImageLayerState>)(current, event);

        this.logger.info(event.type, { layer: event.payload.layer });
        this.layers$.next(updated);
    }
}
