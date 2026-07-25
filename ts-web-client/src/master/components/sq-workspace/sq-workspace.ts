import { html, type TemplateResult } from "lit-html";
import { ref } from "lit-html/directives/ref.js";
import { repeat } from "lit-html/directives/repeat.js";
import { styleMap } from "lit-html/directives/style-map.js";
import { when } from "lit-html/directives/when.js";

import { BaseComponent } from "@components/base-component";
import { DISPLAY } from "@constants/display";
import { GRID } from "@constants/grid";
import { EventBuilder } from "@events/event-builder";
import { fitScale } from "@utils/fit-scale";
import { onGesture, tap } from "@gestures";
import { store, imageService, layerService, settingsService } from "@master/services";
import { computeLayerPlacement, PLACED_LAYER_WIDTH } from "./layer-placement";
import workspaceCss from "./sq-workspace.css" with { type: "text" };

import type { SqDisplay } from "@components/sq-display";
import type { LayerTransformIntent, LayerVisibilityIntent } from "../sq-layer-handle";
import type { Point } from "@gestures";
import type { ImageAsset, LayerId } from "@types";

export class SqWorkspace extends BaseComponent {
    private scale = 1;
    private offsetX = 0;
    private offsetY = 0;
    private observer: ResizeObserver | null = null;
    private displayEl: SqDisplay | null = null;

    // Palette state
    private palettePosition: Point | null = null;
    private images: ImageAsset[] | null = null;

    // Layer manipulation handles
    private layerIds: LayerId[] = [];

    // Snapping — the workspace reads these for its own grid overlay (the
    // handles read the service directly for the actual snap math).
    private snapEnabled = true;
    private gridSize: number = GRID.SIZE;

    // -- Element refs --

    private viewportRef = (el: Element | undefined): void => {
        if (!el) return;

        this.observer = new ResizeObserver(([entry]) => {
            if (!entry) return;
            const { width, height } = entry.contentRect;
            this.computeScale(width, height);
        });

        this.observer.observe(el);
    };

    private displayRef = (el: Element | undefined): void => {
        if (!el) return;
        this.displayEl = el as SqDisplay;
        this.displayEl.layerService = layerService;
        this.displayEl.clocks = store.clocks;
    };

    // -- Lifecycle --

    override connectedCallback(): void {
        super.connectedCallback();
        this.adoptStyles(workspaceCss);

        this.subscribe(store.clocks$, (clocks) => {
            if (this.displayEl) this.displayEl.clocks = clocks;
        });

        this.subscribe(layerService.layerIds$, (ids) => {
            this.layerIds = ids;
            this.update();
        });

        this.subscribe(settingsService.snapEnabled$, (v) => {
            this.snapEnabled = v;
            this.update();
        });
        this.subscribe(settingsService.gridSize$, (v) => {
            this.gridSize = v;
            this.update();
        });

        this.update();
    }

    override disconnectedCallback(): void {
        this.observer?.disconnect();
        this.observer = null;
        super.disconnectedCallback();
    }

    // -- Template --

    protected template(): TemplateResult {
        return html`
            <div class="viewport" ${ref(this.viewportRef)}>
                <div class="display-frame" style=${styleMap({
                    transform: `translate(${this.offsetX}px, ${this.offsetY}px) scale(${this.scale})`,
                })}>
                    <sq-display ${ref(this.displayRef)}></sq-display>
                    <div class="controls-overlay ${this.snapEnabled ? "" : "no-snap"}"
                        style=${styleMap({ "--grid-size": `${this.gridSize}px` })}
                        ${onGesture(tap(), (e) => this.handleOverlayTap(e.position))}
                    >
                        ${repeat(
                            this.layerIds,
                            (id) => id,
                            (id) => html`<sq-layer-handle
                                .state$=${layerService.layer$(id)}
                                .displayScale=${this.scale}
                                @layer-transform=${(e: Event) => this.applyTransform(id, e)}
                                @layer-visibility=${(e: Event) => this.applyVisibility(id, e)}
                            ></sq-layer-handle>`,
                        )}
                        ${when(this.palettePosition, (pos) => this.paletteTemplate(pos))}
                    </div>
                </div>

                <sq-settings-panel></sq-settings-panel>
            </div>
        `;
    }

    private paletteTemplate(position: Point): TemplateResult {
        return html`
            <sq-palette
                .imageService=${imageService}
                .images=${this.images ?? []}
                .position=${position}
                .scale=${this.scale}
                @image-select=${this.handleImageSelect}
                @dismiss=${this.handleDismiss}
            ></sq-palette>
        `;
    }

    // -- Handlers --

    private handleOverlayTap(clientPosition: Point): void {
        if (this.palettePosition) {
            this.palettePosition = null;
            this.update();
            return;
        }

        const displayPosition = this.clientToDisplay(clientPosition);
        this.palettePosition = displayPosition;
        this.update();

        if (!this.images) {
            this.fetchImages();
        }
    }

    private handleImageSelect = (e: Event): void => {
        const { imageRef, width, height, preview } = (
            e as CustomEvent<{
                imageRef: string;
                width: number;
                height: number;
                preview: { cx: number; cy: number; size: number } | null;
            }>
        ).detail;

        // Land the layer exactly on the preview's on-screen rectangle,
        // converted from client to display space. Fall back to the tap
        // point at a default size if the measurement was unavailable.
        const center = preview
            ? this.clientToDisplay({ x: preview.cx, y: preview.cy })
            : this.palettePosition;

        if (!center) return;

        const previewSize = preview ? preview.size / this.scale : PLACED_LAYER_WIDTH;

        const { position, scale } = computeLayerPlacement({ width, height }, center, previewSize);

        store.dispatch(EventBuilder.imageSet({
            layer: `layer-${Date.now()}`,
            imageRef,
            aspectRatio: "native",
            position,
            scale,
        }));

        this.palettePosition = null;
        this.update();
    };

    private handleDismiss = (): void => {
        this.palettePosition = null;
        this.update();
    };

    private applyTransform(layer: LayerId, e: Event): void {
        const intent = (e as CustomEvent<LayerTransformIntent>).detail;
        store.dispatch(EventBuilder.imageTransform({ layer, ...intent }));
    }

    private applyVisibility(layer: LayerId, e: Event): void {
        const { visible } = (e as CustomEvent<LayerVisibilityIntent>).detail;
        store.dispatch(EventBuilder.imageLayerConfig({ layer, visible }));
    }

    // -- Helpers --

    private computeScale(viewportW: number, viewportH: number): void {
        const fit = fitScale(viewportW, viewportH, DISPLAY.WIDTH, DISPLAY.HEIGHT);
        this.scale = fit.scale;
        this.offsetX = fit.offsetX;
        this.offsetY = fit.offsetY;
        this.update();
    }

    private clientToDisplay(client: Point): Point {
        return {
            x: Math.round((client.x - this.offsetX) / this.scale),
            y: Math.round((client.y - this.offsetY) / this.scale),
        };
    }

    private async fetchImages(): Promise<void> {
        try {
            this.images = await imageService.catalog.get();
            this.update();
        } catch {
            this.images = [];
            this.update();
        }
    }
}
