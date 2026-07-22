import { html, type TemplateResult } from "lit-html";
import { classMap } from "lit-html/directives/class-map.js";
import { map } from "lit-html/directives/map.js";
import { ref } from "lit-html/directives/ref.js";
import { styleMap } from "lit-html/directives/style-map.js";
import { when } from "lit-html/directives/when.js";

import { BaseComponent } from "@core/base-component";
import { SERVER_ORIGIN } from "@constants/display";
import { drag, onGesture, pinch, tap } from "@gestures";
import paletteCss from "./sq-palette.css" with { type: "text" };

import type { DragEvent, PinchEvent, Point } from "@gestures";

export interface ImageAsset {
    name: string;
    url: string;
    width: number;
    height: number;
}

const THUMB_WIDTH = 120;
const PANEL_W = 280;
const PANEL_H = 340;
const MIN_SCALE = 0.5;
const MAX_SCALE = 2.0;


export class SqPalette extends BaseComponent {
    private _images: ImageAsset[] = [];
    private _position: Point = { x: 0, y: 0 };
    private currentIndex = 0;
    private panelScale = 1;
    private pinchBaseScale: number | null = null;
    private dragOrigin: Point | null = null;
    private displayScale = 1;
    private panelEl: HTMLDivElement | null = null;
    private reelEl: HTMLDivElement | null = null;
    private browserEl: HTMLDivElement | null = null;

    set images(value: ImageAsset[]) {
        this._images = value;
        this.update();
    }

    set position(value: Point) {
        this._position = { ...value };
        this.update();
    }

    set scale(value: number) {
        this.displayScale = value;
    }

    private panelRef = (el: Element | undefined): void => {
        if (!el) return;
        this.panelEl = el as HTMLDivElement;
    };

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
        this.adoptStyles(paletteCss);
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
            <div class="panel"
                ${ref(this.panelRef)}
                @pointerdown=${(e: PointerEvent) => e.stopPropagation()}
                ${onGesture(pinch(), (e: PinchEvent) => this.handlePinch(e))}
                ${onGesture(drag({ touches: 2 }), (e: DragEvent) => this.handleDrag(e))}
                style=${styleMap({
                    left: `${this._position.x}px`,
                    top: `${this._position.y}px`,
                    '--scale': String(this.panelScale),
                })}
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
                            src="${SERVER_ORIGIN}${img.url}?w=${THUMB_WIDTH}"
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
                        <img src="${SERVER_ORIGIN}${img.url}?w=480" alt=${img.name} />
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
        if (!this.panelEl) return;

        if (!this.dragOrigin) {
            this.dragOrigin = { x: this._position.x, y: this._position.y };
        }

        if (event.phase === "move") {
            this._position.x = this.dragOrigin.x + event.delta.x / this.displayScale;
            this._position.y = this.dragOrigin.y + event.delta.y / this.displayScale;

            this.panelEl.style.left = `${this._position.x}px`;
            this.panelEl.style.top = `${this._position.y}px`;
        }

        if (event.phase === "end") {
            this.dragOrigin = null;
        }
    }

    private handlePinch(event: PinchEvent): void {
        if (!this.panelEl) return;

        if (this.pinchBaseScale === null) {
            this.pinchBaseScale = this.panelScale;
        }

        if (event.phase === "move") {
            const prevScale = this.panelScale;
            this.panelScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, this.pinchBaseScale * event.scale));

            const dw = PANEL_W * (this.panelScale - prevScale) / 2;
            const dh = PANEL_H * (this.panelScale - prevScale) / 2;
            this._position.x -= dw;
            this._position.y -= dh;

            this.panelEl.style.setProperty("--scale", String(this.panelScale));
            this.panelEl.style.left = `${this._position.x}px`;
            this.panelEl.style.top = `${this._position.y}px`;
        }

        if (event.phase === "end") {
            this.pinchBaseScale = null;
        }
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
