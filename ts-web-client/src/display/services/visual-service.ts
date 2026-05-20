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
    ImageEvent,
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

    private setupEventListeners(): void {
        this.eventBus.on("server:system.connected", () => {
            this.logger.info("Resetting layer state for reconnection sync");
            this.layers$.next(new Map());
        });

        this.eventBus.on("server:visual.image.*", (event: unknown) => {
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
