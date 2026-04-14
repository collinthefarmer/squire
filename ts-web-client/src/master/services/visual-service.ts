import { BehaviorSubject, type Observable } from "rxjs";
import { map } from "rxjs";
import { Logger } from "@utils/logger";
import { ServiceRegistry } from "@services/service-registry";
import type { ConnectionService } from "@services/connection-service";
import type { ImageToolbarService } from "./image-toolbar-service";
import { EventBuilder } from "./event-builder";
import {
    calculateScaledDimensions,
    calculatePosition,
} from "@utils/canvas-renderer";
import type { AspectRatioMode, ImagePosition, ImageTransition } from "@types";

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
 * Internal overlay entry — tracks everything needed to compute
 * display-space bounds for an image placed by this master session.
 */
interface OverlayEntry {
    imageRef: string;
    aspectRatio: AspectRatioMode;
    position: ImagePosition;
    scale: number;
    naturalWidth: number;
    naturalHeight: number;
    zIndex: number;
}

/**
 * Visual service for master client
 *
 * Handles image layer management, provides layer targeting logic,
 * and tracks placed images for canvas overlay interaction.
 */
export class MasterVisualService {
    private logger = new Logger("MasterVisualService");
    private connectionService: ConnectionService;

    private overlays$ = new BehaviorSubject<Map<string, OverlayEntry>>(new Map());

    private readonly DISPLAY_WIDTH = 1920;
    private readonly DISPLAY_HEIGHT = 1080;

    constructor(connectionService: ConnectionService) {
        this.connectionService = connectionService;
    }

    // -- Canvas object derivation --

    /**
     * Observable of all canvas objects with computed display-space bounds.
     * Used by the canvas-overlay component for rendering.
     */
    getCanvasObjects$(): Observable<CanvasObject[]> {
        return this.overlays$.pipe(
            map((entries) => this.computeCanvasObjects(entries)),
        );
    }

    private computeCanvasObjects(entries: Map<string, OverlayEntry>): CanvasObject[] {
        const objects: CanvasObject[] = [];

        for (const [id, entry] of entries) {
            const bounds = this.computeBounds(entry);
            if (!bounds) {
                continue;
            }

            objects.push({ id, type: "image", bounds, scale: entry.scale, zIndex: entry.zIndex });
        }

        return objects.sort((a, b) => a.zIndex - b.zIndex);
    }

    private computeBounds(entry: OverlayEntry): DisplayBounds | null {
        const { width, height } = calculateScaledDimensions(
            entry.aspectRatio,
            entry.naturalWidth,
            entry.naturalHeight,
            this.DISPLAY_WIDTH,
            this.DISPLAY_HEIGHT,
        );

        const posX = calculatePosition(entry.position.x, this.DISPLAY_WIDTH, width);
        const posY = calculatePosition(entry.position.y, this.DISPLAY_HEIGHT, height);

        const centerX = posX + width / 2;
        const centerY = posY + height / 2;
        const scaledW = width * entry.scale;
        const scaledH = height * entry.scale;

        const bounds = {
            x: centerX - scaledW / 2,
            y: centerY - scaledH / 2,
            width: scaledW,
            height: scaledH,
        };

        this.logger.debug("computeBounds", {
            input: {
                position: entry.position,
                naturalWidth: entry.naturalWidth,
                naturalHeight: entry.naturalHeight,
                aspectRatio: entry.aspectRatio,
                scale: entry.scale,
            },
            scaled: { width, height },
            posOffset: { posX, posY },
            center: { centerX, centerY },
            bounds,
        });

        return bounds;
    }

    // -- Layer targeting --

    /**
     * Determine target layer for a drop at given coordinates.
     *
     * Currently stubbed to always return "background".
     */
    getTargetLayer(_x: number, _y: number): string {
        return "background";
    }

    // -- Image commands --

    /**
     * Set image on a layer
     */
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

    /**
     * Clear image from a layer
     */
    clearImage(layer: string, transition?: ImageTransition): void {
        this.logger.info("Clearing image", { layer });

        const event = EventBuilder.imageClear({ layer, transition });
        this.connectionService.send(event);

        this.removeOverlay(layer);
    }

    /**
     * Transform a placed image (reposition, scale, rotate)
     */
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

        this.updateOverlay(layer, transform);
    }

    /**
     * Handle image drop from gallery.
     *
     * Computes pixel-based position from the display-space coordinates
     * of the image center, then tracks the placement for overlay interaction.
     */
    handleImageDrop(imageRef: string, displayX: number, displayY: number): void {
        const imageToolbarService = ServiceRegistry.get<ImageToolbarService>(
            "ImageToolbarService",
        );
        const settings = imageToolbarService.getSettings();

        const imgWidth = settings.imageDimensions?.width ?? this.DISPLAY_WIDTH;
        const imgHeight = settings.imageDimensions?.height ?? this.DISPLAY_HEIGHT;

        const { width, height } = calculateScaledDimensions(
            settings.aspectRatio,
            imgWidth,
            imgHeight,
            this.DISPLAY_WIDTH,
            this.DISPLAY_HEIGHT,
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

        this.addOverlay(settings.layer, {
            imageRef,
            aspectRatio: settings.aspectRatio,
            position,
            scale: settings.scale,
            naturalWidth: imgWidth,
            naturalHeight: imgHeight,
            zIndex: 0,
        });
    }

    // -- Overlay state management (private) --

    private addOverlay(layer: string, entry: OverlayEntry): void {
        const updated = new Map(this.overlays$.value);
        updated.set(layer, entry);
        this.overlays$.next(updated);
    }

    private updateOverlay(
        layer: string,
        partial: { position?: ImagePosition; scale?: number; rotation?: number },
    ): void {
        const current = this.overlays$.value.get(layer);
        if (!current) {
            return;
        }

        const updated = new Map(this.overlays$.value);
        updated.set(layer, {
            ...current,
            ...(partial.position !== undefined ? { position: partial.position } : {}),
            ...(partial.scale !== undefined ? { scale: partial.scale } : {}),
        });
        this.overlays$.next(updated);
    }

    private removeOverlay(layer: string): void {
        const updated = new Map(this.overlays$.value);
        updated.delete(layer);
        this.overlays$.next(updated);
    }
}
