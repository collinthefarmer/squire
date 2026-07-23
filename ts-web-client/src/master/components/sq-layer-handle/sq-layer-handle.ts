import { html, nothing, type TemplateResult } from "lit-html";
import { styleMap } from "lit-html/directives/style-map.js";

import { BaseComponent } from "@core/base-component";
import { grab, onGesture } from "@gestures";
import { handleRect } from "./handle-geometry";
import handleCss from "./sq-layer-handle.css" with { type: "text" };

import type { Observable } from "rxjs";
import type { GrabEvent } from "@gestures";
import type { LayerView } from "@core/layer-service";
import type { ImagePosition } from "@types";

const MIN_SCALE = 0.1;
const MAX_SCALE = 5.0;
const RAD_TO_DEG = 180 / Math.PI;

/** Detail of the `layer-transform` event the handle emits upward. */
export interface LayerTransformIntent {
    position?: ImagePosition;
    scale?: number;
    rotation?: number;
}

/**
 * A master-only manipulation handle that mirrors one layer's placement
 * and turns a direct grab into live transform intents: one finger moves,
 * a second finger (absorbed mid-gesture) adds scale and rotation.
 *
 * Presentational — it renders from an injected `LayerView` stream and
 * signals intent through a `layer-transform` CustomEvent; the workspace
 * dispatches. It measures the image's natural size with a hidden probe
 * `<img>` (already cached by the display), so it needs no dimension
 * plumbing. Scale and rotation carry no position correction because the
 * renderer transforms about the layer's centre.
 */
export class SqLayerHandle extends BaseComponent {
    private _view: LayerView | undefined;
    private _state$: Observable<LayerView | undefined> | null = null;
    private _displayScale = 1;
    private _natural: { width: number; height: number } | null = null;

    private grabBaseline: { x: number; y: number; scale: number; rotation: number } | null = null;

    set state$(value: Observable<LayerView | undefined>) {
        if (value === this._state$) return;

        this._state$ = value;
        this.subscribe(value, (v) => {
            this._view = v;
            this.update();
        });
    }

    set displayScale(value: number) {
        this._displayScale = value;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.adoptStyles(handleCss);
        this.update();
    }

    protected template(): TemplateResult {
        const view = this._view;
        if (!view || !view.imageUrl) return html`${nothing}`;

        const rect = handleRect(view, this._natural);

        return html`
            <img class="probe" src=${view.imageUrl} @load=${this.onProbeLoad} alt="" aria-hidden="true" />
            ${rect
                ? html`<div
                      class="outline"
                      style=${styleMap({
                          left: `${rect.cx}px`,
                          top: `${rect.cy}px`,
                          width: `${rect.width}px`,
                          height: `${rect.height}px`,
                          zIndex: String(view.zIndex),
                          transform: `translate(-50%, -50%) rotate(${rect.rotation}deg)`,
                      })}
                      @pointerdown=${(e: PointerEvent) => e.stopPropagation()}
                      ${onGesture(grab(), (e: GrabEvent) => this.handleGrab(e))}
                  ></div>`
                : nothing}
        `;
    }

    private onProbeLoad = (e: Event): void => {
        const img = e.target as HTMLImageElement;
        if (this._natural?.width === img.naturalWidth && this._natural?.height === img.naturalHeight) return;

        this._natural = { width: img.naturalWidth, height: img.naturalHeight };
        this.update();
    };

    private handleGrab(event: GrabEvent): void {
        const view = this._view;
        if (!view || typeof view.position.x !== "number" || typeof view.position.y !== "number") return;

        if (event.phase === "end") {
            this.grabBaseline = null;
            return;
        }

        // Capture the layer's transform at grab start (no "start" phase is
        // emitted) and apply the grab's cumulative transform on top. The
        // baseline stays fixed, so the store echo can't drift.
        if (!this.grabBaseline) {
            this.grabBaseline = {
                x: view.position.x,
                y: view.position.y,
                scale: view.scale,
                rotation: view.rotation,
            };
        }

        const b = this.grabBaseline;

        this.emit({
            position: {
                x: Math.round(b.x + event.translation.x / this._displayScale),
                y: Math.round(b.y + event.translation.y / this._displayScale),
            },
            scale: clamp(b.scale * event.scale, MIN_SCALE, MAX_SCALE),
            rotation: b.rotation + event.rotation * RAD_TO_DEG,
        });
    }

    private emit(detail: LayerTransformIntent): void {
        this.dispatchEvent(new CustomEvent("layer-transform", {
            detail,
            bubbles: true,
            composed: true,
        }));
    }
}

function clamp(value: number, lo: number, hi: number): number {
    return Math.min(hi, Math.max(lo, value));
}
