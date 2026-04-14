import { BehaviorSubject, type Observable } from "rxjs";
import { map } from "rxjs";
import { Logger } from "@utils/logger";
import { ServiceRegistry } from "@services/service-registry";
import type { ConnectionService } from "@services/connection-service";
import type { ImageToolbarService } from "./image-toolbar-service";
import { EventBuilder } from "./event-builder";
import { calculateScaledDimensions } from "@utils/canvas-renderer";
import { DISPLAY } from "@shared/constants/display";
import { computeDisplayBounds } from "@master/components/canvas/display-coordinates";
import type { CanvasObjectProvider } from "./canvas-object-provider";
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
export class MasterVisualService implements CanvasObjectProvider {
    private logger = new Logger("MasterVisualService");
    private connectionService: ConnectionService;

    private overlays$ = new BehaviorSubject<Map<string, OverlayEntry>>(new Map());

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
            DISPLAY.WIDTH,
            DISPLAY.HEIGHT,
        );

        const bounds = computeDisplayBounds(entry.position, width, height, entry.scale);

        this.logger.debug("computeBounds", {
            input: {
                position: entry.position,
                naturalWidth: entry.naturalWidth,
                naturalHeight: entry.naturalHeight,
                aspectRatio: entry.aspectRatio,
                scale: entry.scale,
            },
            scaled: { width, height },
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
