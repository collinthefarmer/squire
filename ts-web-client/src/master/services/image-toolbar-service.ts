import { BehaviorSubject, type Observable } from "rxjs";
import { map, distinctUntilChanged } from "rxjs";
import { Logger } from "@utils/logger";
import { DRAG } from "@shared/constants/drag";
import { LAYER } from "@shared/constants/layer";

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
    position: ToolbarPosition;
    scale: number;
    imageDimensions: ImageDimensions | null;
    previewScale: number;
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
        layer: LAYER.DEFAULT,
        previewScale: 0.5,
        position: { x: 0.5, y: 0.5 },
        scale: 1.0,
        imageDimensions: null,
    });

    private registeredLayers$ = new BehaviorSubject<string[]>([LAYER.DEFAULT]);

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
            DRAG.SCALE_MIN,
            Math.min(DRAG.SCALE_MAX, scale),
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

    /**
     * Set preview scale (from iframe resize)
     */
    setPreviewScale(previewScale: number): void {
        const current = this.settings$.value;
        this.settings$.next({ ...current, previewScale });
    }

    // -- Layer registry --

    getRegisteredLayers$(): Observable<string[]> {
        return this.registeredLayers$.asObservable();
    }

    getRegisteredLayers(): string[] {
        return this.registeredLayers$.value;
    }

    /**
     * Get the currently selected layer as an observable.
     * Derived from settings$ to avoid a separate subject.
     */
    getSelectedLayer$(): Observable<string> {
        return this.settings$.pipe(
            map((s) => s.layer),
            distinctUntilChanged(),
        );
    }

    /**
     * Add a named layer to the registry and select it.
     * Duplicate names are ignored.
     */
    registerLayer(name: string): void {
        const current = this.registeredLayers$.value;
        if (current.includes(name)) {
            this.setLayer(name);
            return;
        }

        this.registeredLayers$.next([...current, name]);
        this.setLayer(name);
        this.logger.info("Layer registered", { name });
    }

    /**
     * Remove a named layer from the registry.
     * If it was selected, falls back to the first remaining layer.
     */
    unregisterLayer(name: string): void {
        const current = this.registeredLayers$.value;
        const filtered = current.filter((l) => l !== name);

        if (filtered.length === 0) {
            filtered.push(LAYER.DEFAULT);
        }

        this.registeredLayers$.next(filtered);

        if (this.settings$.value.layer === name) {
            this.setLayer(filtered[0] ?? LAYER.DEFAULT);
        }

        this.logger.info("Layer unregistered", { name });
    }

    /**
     * Ensure all server-known layer IDs appear in the registry.
     * Preserves existing order; new layers are appended.
     */
    syncServerLayers(serverLayerIds: string[]): void {
        const current = this.registeredLayers$.value;
        const missing = serverLayerIds.filter((id) => !current.includes(id));

        if (missing.length === 0) {
            return;
        }

        this.registeredLayers$.next([...current, ...missing]);
        this.logger.info("Synced server layers", { added: missing });
    }
}
