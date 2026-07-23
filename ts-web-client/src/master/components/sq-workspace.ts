import { html, type TemplateResult } from "lit-html";
import { ref } from "lit-html/directives/ref.js";
import { styleMap } from "lit-html/directives/style-map.js";
import { when } from "lit-html/directives/when.js";

import { BaseComponent } from "@core/base-component";
import { DISPLAY } from "@constants/display";
import { EventBuilder } from "@events/event-builder";
import { onGesture, tap } from "@gestures";
import { store, imageService, layerService } from "../services";
import workspaceCss from "./sq-workspace.css" with { type: "text" };

import type { SqDisplay } from "@components/sq-display";
import type { Point } from "@gestures";
import type { ImageAsset } from "@types";

export class SqWorkspace extends BaseComponent {
    private scale = 1;
    private offsetX = 0;
    private offsetY = 0;
    private observer: ResizeObserver | null = null;
    private displayEl: SqDisplay | null = null;

    // Palette state
    private palettePosition: Point | null = null;
    private images: ImageAsset[] | null = null;

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
                    <div class="controls-overlay"
                        ${onGesture(tap(), (e) => this.handleOverlayTap(e.position))}
                    >
                        ${when(this.palettePosition, (pos) => this.paletteTemplate(pos))}
                    </div>
                </div>
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
        const { imageRef } = (e as CustomEvent<{ imageRef: string }>).detail;

        if (!this.palettePosition) return;

        store.dispatch(EventBuilder.imageSet({
            layer: `layer-${Date.now()}`,
            imageRef,
            aspectRatio: "cover",
            position: { x: this.palettePosition.x, y: this.palettePosition.y },
        }));

        this.palettePosition = null;
        this.update();
    };

    private handleDismiss = (): void => {
        this.palettePosition = null;
        this.update();
    };

    // -- Helpers --

    private computeScale(viewportW: number, viewportH: number): void {
        this.scale = Math.min(viewportW / DISPLAY.WIDTH, viewportH / DISPLAY.HEIGHT);
        this.offsetX = (viewportW - DISPLAY.WIDTH * this.scale) / 2;
        this.offsetY = (viewportH - DISPLAY.HEIGHT * this.scale) / 2;
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
