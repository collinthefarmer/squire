import { Logger } from "@utils/logger";
import { ServiceRegistry } from "@services/service-registry";
import type { ConnectionService } from "@services/connection-service";
import type { ImageToolbarService } from "./image-toolbar-service";
import { EventBuilder } from "./event-builder";
import type { AspectRatioMode, ImagePosition, ImageTransition } from "@types";

/**
 * Visual service for master client
 *
 * Handles image layer management and provides layer targeting logic.
 * Currently stubbed to always target the "background" layer.
 *
 * Future implementation will track layer state and support:
 * - Drop-over-image targeting (set image on layer containing dropped-over image)
 * - Layer state synchronization from server
 */
export class MasterVisualService {
    private logger = new Logger("MasterVisualService");
    private connectionService: ConnectionService;

    constructor(connectionService: ConnectionService) {
        this.connectionService = connectionService;
    }

    /**
     * Determine target layer for a drop at given coordinates
     *
     * Currently stubbed to always return "background".
     * Future implementation will check if drop is over existing layer content.
     *
     * @param x - Drop x coordinate (screen pixels)
     * @param y - Drop y coordinate (screen pixels)
     * @returns Target layer ID
     */
    getTargetLayer(_x: number, _y: number): string {
        // TODO: Implement smart layer targeting based on drop position
        // This would require:
        // 1. Subscribing to layer state from server
        // 2. Tracking layer bounds and z-index
        // 3. Hit-testing drop coordinates against layer bounds
        return "background";
    }

    /**
     * Set image on a layer
     *
     * @param layer - Target layer ID
     * @param imageRef - Image filename
     * @param options - Optional positioning and transition settings
     */
    setImage(
        layer: string,
        imageRef: string,
        options?: {
            aspectRatio?: AspectRatioMode;
            position?: ImagePosition;
            transition?: ImageTransition;
        },
    ): void {
        this.logger.info("Setting image", { layer, imageRef });

        const event = EventBuilder.imageSet({
            layer,
            imageRef,
            aspectRatio: options?.aspectRatio ?? "contain",
            position: options?.position,
            transition: options?.transition,
        });

        this.connectionService.send(event);
    }

    /**
     * Clear image from a layer
     *
     * @param layer - Target layer ID
     * @param transition - Optional transition settings
     */
    clearImage(layer: string, transition?: ImageTransition): void {
        this.logger.info("Clearing image", { layer });

        const event = EventBuilder.imageClear({
            layer,
            transition,
        });

        this.connectionService.send(event);
    }

    /**
     * Handle image drop from gallery
     *
     * Reads settings from ImageToolbarService and sets the image.
     *
     * @param imageRef - Image filename
     * @param _x - Drop x coordinate (unused, position from toolbar)
     * @param _y - Drop y coordinate (unused, position from toolbar)
     */
    handleImageDrop(imageRef: string, _x: number, _y: number): void {
        const imageToolbarService = ServiceRegistry.get<ImageToolbarService>("ImageToolbarService");
        const settings = imageToolbarService.getSettings();

        this.logger.info("Handling image drop", {
            imageRef,
            layer: settings.layer,
            aspectRatio: settings.aspectRatio,
            position: settings.position,
        });

        this.setImage(settings.layer, imageRef, {
            aspectRatio: settings.aspectRatio,
            position: settings.position,
        });
    }
}
