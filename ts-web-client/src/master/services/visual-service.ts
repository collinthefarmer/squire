import { BehaviorSubject, type Observable } from "rxjs";
import { map } from "rxjs";
import { Logger } from "@utils/logger";
import { ServiceRegistry } from "@services/service-registry";
import type { EventBus } from "@services/event-bus";
import type { ConnectionService } from "@services/connection-service";
import type { AssetService, ImageAsset } from "./asset-service";
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
    AspectRatioMode,
    ImagePosition,
    ImageTransition,
    ImageLayerState,
    ImageSetEvent,
    ImageClearEvent,
    ImageTransformEvent,
    ImageEffectEvent,
    ImageLayerConfigEvent,
} from "@types";

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

    private layers$ = new BehaviorSubject<Map<string, ImageLayerState>>(new Map());

    constructor(connectionService: ConnectionService, eventBus: EventBus) {
        this.connectionService = connectionService;
        this.setupEventListeners(eventBus);
    }

    // -- Canvas object derivation --

    getCanvasObjects$(): Observable<CanvasObject[]> {
        return this.layers$.pipe(
            map((layers) => this.computeCanvasObjects(layers)),
        );
    }

    private computeCanvasObjects(layers: Map<string, ImageLayerState>): CanvasObject[] {
        const objects: CanvasObject[] = [];

        for (const [id, layer] of layers) {
            if (!layer.imageRef || !layer.visible) {
                continue;
            }

            const bounds = this.computeBounds(layer);
            if (!bounds) {
                continue;
            }

            objects.push({ id, type: "image", bounds, scale: layer.scale, zIndex: layer.zIndex });
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

        const bounds = computeDisplayBounds(layer.position, width, height, layer.scale);

        this.logger.debug("computeBounds", {
            layer: layer.id,
            imageRef: layer.imageRef,
            naturalDims: dims,
            scaled: { width, height },
            bounds,
        });

        return bounds;
    }

    private resolveImageDimensions(imageRef: string): { width: number; height: number } {
        try {
            const assetService = ServiceRegistry.get<AssetService>("AssetService");
            const assets = assetService.getImageAssets();
            const asset = assets.find((a: ImageAsset) => a.name === imageRef);
            if (asset) {
                return { width: asset.width, height: asset.height };
            }
        } catch {
            // AssetService not registered yet (unlikely but safe)
        }
        return { width: DISPLAY.WIDTH, height: DISPLAY.HEIGHT };
    }

    // -- Layer targeting --

    getTargetLayer(_x: number, _y: number): string {
        return "background";
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
        this.logger.info("Setting image", { layer, imageRef, scale: options?.scale });

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
        transform: { position?: ImagePosition; scale?: number; rotation?: number },
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
    handleImageDrop(imageRef: string, displayX: number, displayY: number): void {
        const imageToolbarService = ServiceRegistry.get<ImageToolbarService>(
            "ImageToolbarService",
        );
        const settings = imageToolbarService.getSettings();

        const imgWidth = settings.imageDimensions?.width ?? DISPLAY.WIDTH;
        const imgHeight = settings.imageDimensions?.height ?? DISPLAY.HEIGHT;

        const { width, height } = calculateScaledDimensions(
            settings.aspectRatio,
            imgWidth,
            imgHeight,
            DISPLAY.WIDTH,
            DISPLAY.HEIGHT,
        );

        const posX = displayX - width / 2;
        const posY = displayY - height / 2;

        const position: ImagePosition = {
            x: `${posX}px`,
            y: `${posY}px`,
        };

        this.logger.info("Handling image drop", {
            imageRef,
            layer: settings.layer,
            displayCenter: { displayX, displayY },
            naturalDimensions: { imgWidth, imgHeight },
            scaledDimensions: { width, height },
            aspectRatio: settings.aspectRatio,
            position,
            scale: settings.scale,
        });

        this.setImage(settings.layer, imageRef, {
            aspectRatio: settings.aspectRatio,
            position,
            scale: settings.scale,
        });
    }

    // -- Server event handling --

    private setupEventListeners(eventBus: EventBus): void {
        eventBus.on("server:visual.image.*", (event: unknown) => {
            this.handleImageEvent(event as { type: string });
        });
    }

    private handleImageEvent(event: { type: string }): void {
        const current = this.layers$.value;
        let updated: Map<string, ImageLayerState>;

        switch (event.type) {
            case "visual.image.set":
                updated = applyImageSet(current, event as ImageSetEvent);
                this.logger.info("Image set (server)", { layer: (event as ImageSetEvent).payload.layer });
                break;
            case "visual.image.clear":
                updated = applyImageClear(current, event as ImageClearEvent);
                this.logger.info("Image clear (server)", { layer: (event as ImageClearEvent).payload.layer });
                break;
            case "visual.image.transform":
                updated = applyImageTransform(current, event as ImageTransformEvent);
                this.logger.info("Image transform (server)", { layer: (event as ImageTransformEvent).payload.layer });
                break;
            case "visual.image.effect":
                updated = applyImageEffect(current, event as ImageEffectEvent);
                break;
            case "visual.image.layer_config":
                updated = applyImageLayerConfig(current, event as ImageLayerConfigEvent);
                break;
            default:
                return;
        }

        this.layers$.next(updated);
    }
}
