import { BehaviorSubject, type Observable } from "rxjs";
import { Logger } from "@utils/logger";
import {
    applyImageSet,
    applyImageClear,
    applyImageTransform,
    applyImageEffect,
    applyImageLayerConfig,
} from "@services/layer-state";
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

    getLayers$(): Observable<Map<string, ImageLayerState>> {
        return this.layers$.asObservable();
    }

    getLayers(): Map<string, ImageLayerState> {
        return this.layers$.value;
    }

    getLayer(id: string): ImageLayerState | undefined {
        return this.layers$.value.get(id);
    }

    getAllLayers(): ImageLayerState[] {
        return Array.from(this.layers$.value.values());
    }

    private setupEventListeners(): void {
        this.eventBus.on("server:visual.image.*", (event: unknown) => {
            this.handleImageEvent(event as { type: string });
        });
    }

    private handleImageEvent(event: { type: string }): void {
        const current = this.layers$.value;
        let updated: Map<string, ImageLayerState>;

        switch (event.type) {
            case "visual.image.set":
                updated = applyImageSet(current, event as ImageSetEvent);
                this.logger.info("Image set", {
                    layer: (event as ImageSetEvent).payload.layer,
                });
                break;
            case "visual.image.clear":
                updated = applyImageClear(current, event as ImageClearEvent);
                this.logger.info("Image clear", {
                    layer: (event as ImageClearEvent).payload.layer,
                });
                break;
            case "visual.image.transform":
                updated = applyImageTransform(
                    current,
                    event as ImageTransformEvent,
                );
                this.logger.info("Image transform", {
                    layer: (event as ImageTransformEvent).payload.layer,
                });
                break;
            case "visual.image.effect":
                updated = applyImageEffect(current, event as ImageEffectEvent);
                this.logger.info("Image effect", {
                    layer: (event as ImageEffectEvent).payload.layer,
                });
                break;
            case "visual.image.layer_config":
                updated = applyImageLayerConfig(
                    current,
                    event as ImageLayerConfigEvent,
                );
                this.logger.info("Layer config", {
                    layer: (event as ImageLayerConfigEvent).payload.layer,
                });
                break;
            default:
                return;
        }

        this.layers$.next(updated);
    }
}
