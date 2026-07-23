import { html, type TemplateResult } from "lit-html";
import { classMap } from "lit-html/directives/class-map.js";
import { map } from "lit-html/directives/map.js";
import { ref } from "lit-html/directives/ref.js";
import { styleMap } from "lit-html/directives/style-map.js";
import { when } from "lit-html/directives/when.js";

import { BaseComponent } from "@core/base-component";
import { PanelTransform, PANEL_TRANSFORM_CSS } from "@core/panel-transform";
import { drag, GESTURE_STYLES, onGesture, pinch, pinchVars, tap } from "@gestures";
import paletteCss from "./sq-palette.css" with { type: "text" };

import type { ImageService } from "@core/image-service";
import type { DragEvent, PinchEvent, Point } from "@gestures";
import type { ImageAsset } from "@types";

const THUMB_WIDTH = 120;
const PANEL_W = 280;
const PANEL_H = 340;

export class SqPalette extends BaseComponent {
    private _images: ImageAsset[] = [];
    private _imageService: ImageService | null = null;
    private currentIndex = 0;
    private displayScale = 1;
    private reelEl: HTMLDivElement | null = null;
    private browserEl: HTMLDivElement | null = null;

    private readonly transform = new PanelTransform({
        minScale: 0.5,
        maxScale: 2.0,
        baseWidth: PANEL_W,
        baseHeight: PANEL_H,
    });

    set imageService(value: ImageService) {
        this._imageService = value;
    }

    set images(value: ImageAsset[]) {
        this._images = value;
        this.update();
    }

    set position(value: Point) {
        this.transform.position = value;
        this.update();
    }

    set scale(value: number) {
        this.displayScale = value;
    }

    private reelRef = (el: Element | undefined): void => {
        if (!el) return;
        this.reelEl = el as HTMLDivElement;
    };

    private browserRef = (el: Element | undefined): void => {
        if (!el) return;
        this.browserEl = el as HTMLDivElement;
        this.browserEl.addEventListener("scroll", this.handleBrowserScroll, { passive: true });
    };

    override connectedCallback(): void {
        super.connectedCallback();
        this.adoptStyles(GESTURE_STYLES, paletteCss, PANEL_TRANSFORM_CSS);
        this.update();
    }

    override disconnectedCallback(): void {
        this.browserEl?.removeEventListener("scroll", this.handleBrowserScroll);
        super.disconnectedCallback();
    }

    protected template(): TemplateResult {
        return html`
            <div class="backdrop" @pointerdown=${this.handleBackdropTap}></div>
            ${this.panelTemplate()}
        `;
    }

    private panelTemplate(): TemplateResult {
        return html`
            <div class="panel panel-transform"
                @pointerdown=${(e: PointerEvent) => e.stopPropagation()}
                ${onGesture(pinch(), (e: PinchEvent) => this.handlePinch(e), pinchVars)}
                ${onGesture(drag({ touches: 2 }), (e: DragEvent) => this.handleDrag(e))}
                style=${styleMap(this.transform.styles)}
            >
                ${when(
                    this._images.length > 0,
                    () => html`
                        ${this.reelTemplate()}
                        ${this.browserTemplate()}
                    `,
                    () => html`<div class="empty">No images available</div>`,
                )}
            </div>
        `;
    }

    private reelTemplate(): TemplateResult {
        return html`
            <div class="reel" ${ref(this.reelRef)}>
                <div class="reel-track">
                    ${map(this._images, (img, i) => html`
                        <img
                            class=${classMap({ "reel-thumb": true, active: i === this.currentIndex })}
                            src="${this._imageService!.resolveUrl(img.name, { width: THUMB_WIDTH })}"
                            alt=${img.name}
                            loading="lazy"
                            ${onGesture(tap(), () => this.scrollToIndex(i))}
                        />
                    `)}
                </div>
            </div>
        `;
    }

    private browserTemplate(): TemplateResult {
        return html`
            <div class="browser" ${ref(this.browserRef)}>
                ${map(this._images, (img) => html`
                    <div class="slide" ${onGesture(tap(), () => this.selectImage(img))}>
                        <img src="${this._imageService!.resolveUrl(img.name, { width: 480 })}" alt=${img.name} />
                        <span class="name">${img.name}</span>
                    </div>
                `)}
            </div>
        `;
    }

    // -- Handlers --

    private handleBrowserScroll = (): void => {
        if (!this.browserEl || !this.reelEl || this._images.length <= 1) return;

        const index = Math.round(this.browserEl.scrollLeft / this.browserEl.clientWidth);
        this.centerReelOn(index);

        if (index !== this.currentIndex) {
            this.currentIndex = Math.min(index, this._images.length - 1);
            this.update();
        }
    };

    private centerReelOn(index: number): void {
        if (!this.reelEl) return;

        const thumbs = this.reelEl.querySelectorAll(".reel-thumb");
        const thumb = thumbs[index];
        if (!thumb) return;

        const thumbEl = thumb as HTMLElement;
        const thumbCenter = thumbEl.offsetLeft + thumbEl.offsetWidth / 2;
        this.reelEl.scrollLeft = thumbCenter - this.reelEl.clientWidth / 2;
    }

    private handleDrag(event: DragEvent): void {
        this.transform.applyDrag(event, this.displayScale);
        this.update();
    }

    private handlePinch(event: PinchEvent): void {
        this.transform.applyPinch(event);
        this.update();
    }

    private selectImage(image: ImageAsset): void {
        this.dispatchEvent(new CustomEvent("image-select", {
            detail: { imageRef: image.name },
            bubbles: true,
            composed: true,
        }));
    }

    private scrollToIndex(index: number): void {
        if (!this.browserEl) return;

        this.browserEl.scrollLeft = index * this.browserEl.clientWidth;
    }

    private handleBackdropTap = (e: PointerEvent): void => {
        e.stopPropagation();

        this.dispatchEvent(new CustomEvent("dismiss", {
            bubbles: true,
            composed: true,
        }));
    };
}
