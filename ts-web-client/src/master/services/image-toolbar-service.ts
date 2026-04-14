import { BehaviorSubject, type Observable } from "rxjs";
import { Logger } from "@utils/logger";
import type { AspectRatioMode } from "@types";

/**
 * Position using normalized 0-1 values
 *
 * 0 = left/top edge
 * 0.5 = center
 * 1 = right/bottom edge
 */
export interface ToolbarPosition {
    x: number;
    y: number;
}

export interface ImageDimensions {
    width: number;
    height: number;
}

export interface ImageToolbarSettings {
    layer: string;
    aspectRatio: AspectRatioMode;
    position: ToolbarPosition;
    scale: number;
    imageDimensions: ImageDimensions | null;
}

/**
 * Service for managing image toolbar state
 *
 * Holds current image placement settings (layer, aspect ratio, position)
 * that are applied when dropping images onto the canvas preview.
 */
export class ImageToolbarService {
    private logger = new Logger("ImageToolbarService");

    private readonly MIN_SCALE = 0.1;
    private readonly MAX_SCALE = 5.0;

    private settings$ = new BehaviorSubject<ImageToolbarSettings>({
        layer: "background",
        aspectRatio: "contain",
        position: { x: 0.5, y: 0.5 },
        scale: 1.0,
        imageDimensions: null,
    });

    /**
     * Get settings as observable for reactive updates
     */
    getSettings$(): Observable<ImageToolbarSettings> {
        return this.settings$.asObservable();
    }

    /**
     * Get current settings value
     */
    getSettings(): ImageToolbarSettings {
        return this.settings$.value;
    }

    /**
     * Set target layer
     */
    setLayer(layer: string): void {
        const current = this.settings$.value;
        this.settings$.next({ ...current, layer });
        this.logger.info("Layer updated", { layer });
    }

    /**
     * Set aspect ratio mode
     */
    setAspectRatio(aspectRatio: AspectRatioMode): void {
        const current = this.settings$.value;
        this.settings$.next({ ...current, aspectRatio });
        this.logger.info("Aspect ratio updated", { aspectRatio });
    }

    /**
     * Set position (normalized 0-1 values)
     */
    setPosition(position: ToolbarPosition): void {
        const current = this.settings$.value;
        this.settings$.next({ ...current, position });
        this.logger.info("Position updated", { position });
    }

    /**
     * Set scale (clamped to min/max bounds)
     */
    setScale(scale: number): void {
        const current = this.settings$.value;
        const clampedScale = Math.max(
            this.MIN_SCALE,
            Math.min(this.MAX_SCALE, scale),
        );
        this.settings$.next({ ...current, scale: clampedScale });
        this.logger.info("Scale updated", { scale: clampedScale });
    }

    /**
     * Reset scale to default (1.0)
     */
    resetScale(): void {
        const current = this.settings$.value;
        this.settings$.next({ ...current, scale: 1.0 });
        this.logger.info("Scale reset to 1.0");
    }

    /**
     * Set image dimensions (from dragged image)
     */
    setImageDimensions(dimensions: ImageDimensions | null): void {
        const current = this.settings$.value;
        this.settings$.next({ ...current, imageDimensions: dimensions });
        this.logger.info("Image dimensions updated", { dimensions });
    }
}
