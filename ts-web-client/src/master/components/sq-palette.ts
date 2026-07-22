import { html, type TemplateResult } from "lit-html";
import { classMap } from "lit-html/directives/class-map.js";
import { map } from "lit-html/directives/map.js";
import { ref } from "lit-html/directives/ref.js";
import { styleMap } from "lit-html/directives/style-map.js";
import { when } from "lit-html/directives/when.js";

import { BaseComponent } from "@core/base-component";
import { onGesture, tap } from "@gestures";
import paletteCss from "./sq-palette.css" with { type: "text" };

import type { Point } from "@gestures";

export interface ImageAsset {
    name: string;
    url: string;
    width: number;
    height: number;
}

const SERVER_ORIGIN = `${location.protocol}//${location.hostname}:3000`;
const THUMB_WIDTH = 120;
const PANEL_W = 280;
const PANEL_H = 340;
const DISPLAY_W = 1920;
const DISPLAY_H = 1080;


export class SqPalette extends BaseComponent {
    private _images: ImageAsset[] = [];
    private _position: Point = { x: 0, y: 0 };
    private currentIndex = 0;
    private reelEl: HTMLDivElement | null = null;
    private browserEl: HTMLDivElement | null = null;

    set images(value: ImageAsset[]) {
        this._images = value;
        this.update();
    }

    set position(value: Point) {
        this._position = value;
        this.update();
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
        const clamped = this.clampPosition(this._position);

        return html`
            <div class="panel" @pointerdown=${(e: PointerEvent) => e.stopPropagation()} style=${styleMap({
                left: `${clamped.x}px`,
                top: `${clamped.y}px`,
            })}>
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

        const browserMax = this.browserEl.scrollWidth - this.browserEl.clientWidth;
        if (browserMax <= 0) return;

        const ratio = this.browserEl.scrollLeft / browserMax;
        const reelMax = this.reelEl.scrollWidth - this.reelEl.clientWidth;
        this.reelEl.scrollLeft = ratio * reelMax;

        const index = Math.round(this.browserEl.scrollLeft / this.browserEl.clientWidth);
        if (index !== this.currentIndex) {
            this.currentIndex = Math.min(index, this._images.length - 1);
            this.update();
        }
    };

    private selectImage(image: ImageAsset): void {
        this.dispatchEvent(new CustomEvent("image-select", {
            detail: { imageRef: image.name },
            bubbles: true,
            composed: true,
        }));
    }

    private scrollToIndex(index: number): void {
        if (!this.browserEl) return;

        this.browserEl.scrollTo({
            left: index * this.browserEl.clientWidth,
            behavior: "smooth",
        });
    }

    private handleBackdropTap = (e: PointerEvent): void => {
        e.stopPropagation();

        this.dispatchEvent(new CustomEvent("dismiss", {
            bubbles: true,
            composed: true,
        }));
    };

    // -- Helpers --

    private clampPosition(pos: Point): Point {
        return {
            x: Math.min(Math.max(0, pos.x), DISPLAY_W - PANEL_W),
            y: Math.min(Math.max(0, pos.y), DISPLAY_H - PANEL_H),
        };
    }
}
