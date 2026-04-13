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

export interface ImageToolbarSettings {
    layer: string;
    aspectRatio: AspectRatioMode;
    position: ToolbarPosition;
}

/**
 * Service for managing image toolbar state
 *
 * Holds current image placement settings (layer, aspect ratio, position)
 * that are applied when dropping images onto the canvas preview.
 */
export class ImageToolbarService {
    private logger = new Logger("ImageToolbarService");

    private settings$ = new BehaviorSubject<ImageToolbarSettings>({
        layer: "background",
        aspectRatio: "contain",
        position: { x: 0.5, y: 0.5 },
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
}
