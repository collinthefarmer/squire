import { html, svg, nothing, type TemplateResult } from "lit-html";
import { classMap } from "lit-html/directives/class-map.js";
import { styleMap } from "lit-html/directives/style-map.js";

import { BaseComponent } from "@core/base-component";
import { DISPLAY } from "@constants/display";
import { grab, longPress, GESTURE_STYLES, grabVars, onGesture } from "@gestures";
import { settingsService } from "../../services";
import {
    handleRect,
    snapToGrid,
    snapAngle,
    pointAtAngle,
    rotationGuideRadius,
    rotationTicks,
    type HandleRect,
} from "./handle-geometry";
import handleCss from "./sq-layer-handle.css" with { type: "text" };

import type { Observable } from "rxjs";
import type { GrabEvent } from "@gestures";
import type { LayerView } from "@core/layer-service";
import type { ImagePosition } from "@types";

const MIN_SCALE = 0.1;
const MAX_SCALE = 5.0;
const RAD_TO_DEG = 180 / Math.PI;

/** Gap between the layer's corner and the guide ring, in display px. */
const ROTATION_GUIDE_MARGIN = 40;
/** The ring is capped so it always fits on the display. */
const ROTATION_GUIDE_MAX_RADIUS = Math.min(DISPLAY.WIDTH, DISPLAY.HEIGHT) / 2;

/** Detail of the `layer-transform` event the handle emits upward. */
export interface LayerTransformIntent {
    position?: ImagePosition;
    scale?: number;
    rotation?: number;
}

/** Detail of the `layer-visibility` event the handle emits upward. */
export interface LayerVisibilityIntent {
    visible: boolean;
}

/**
 * A master-only manipulation handle that mirrors one layer's placement
 * and turns a direct grab into live transform intents: one finger moves,
 * a second finger (absorbed mid-gesture) adds scale and rotation.
 *
 * It renders from an injected `LayerView` stream and signals intent
 * through a `layer-transform` CustomEvent; the workspace dispatches. Snap
 * settings it reads straight from the settings service — it needs them
 * only at grab time, so it reads rather than takes them as props. It
 * measures the image's natural size with a hidden probe `<img>` (already
 * cached by the display), so it needs no dimension plumbing. Scale and
 * rotation carry no position correction because the renderer transforms
 * about the layer's centre.
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
        this.adoptStyles(handleCss, GESTURE_STYLES);
        this.update();
    }

    protected template(): TemplateResult {
        const view = this._view;
        if (!view || !view.imageUrl) return html`${nothing}`;

        const rect = handleRect(view, this._natural);

        return html`
            <img class="probe" src=${view.imageUrl} @load=${this.onProbeLoad} alt="" aria-hidden="true" />
            ${rect
                ? html`
                    ${this.guideTemplate(rect, view.zIndex)}
                    <div
                        class=${classMap({ outline: true, ghost: !view.visible })}
                        style=${styleMap({
                            left: `${rect.cx}px`,
                            top: `${rect.cy}px`,
                            width: `${rect.width}px`,
                            height: `${rect.height}px`,
                            zIndex: String(view.zIndex),
                            transform: `translate(-50%, -50%) rotate(${rect.rotation}deg)`,
                        })}
                        @pointerdown=${(e: PointerEvent) => e.stopPropagation()}
                        ${view.visible
                            ? onGesture(grab(), (e: GrabEvent) => this.handleGrab(e), grabVars)
                            : nothing}
                        ${onGesture(longPress(), () => this.toggleVisibility())}
                    ></div>`
                : nothing}
        `;
    }

    /**
     * The rotation dial, centred on the layer and drawn beneath the
     * outline (which renders after it and so paints on top). It does not
     * rotate with the layer — the detent ticks mark absolute headings —
     * while the needle and the highlighted tick track the layer's current
     * angle, so a snap reads as the needle settling onto a tick.
     *
     * Always rendered when the handle has a rectangle; the CSS reveals it
     * only under `:host([data-rotating])`, so its presence is a styling
     * concern the grab handler flips with one attribute — no component
     * state, no render on toggle.
     */
    private guideTemplate(rect: HandleRect, zIndex: number): TemplateResult {
        const radius = rotationGuideRadius(rect, ROTATION_GUIDE_MARGIN, ROTATION_GUIDE_MAX_RADIUS);
        const size = radius * 2;
        const ticks = rotationTicks(radius, settingsService.rotationSnap, rect.rotation);
        const needle = pointAtAngle(radius, rect.rotation);

        return html`<svg
            class="rot-guide"
            viewBox="${-radius} ${-radius} ${size} ${size}"
            style=${styleMap({
                left: `${rect.cx}px`,
                top: `${rect.cy}px`,
                width: `${size}px`,
                height: `${size}px`,
                zIndex: String(zIndex),
            })}
            aria-hidden="true"
        >
            <circle class="rot-ring" cx="0" cy="0" r=${radius}></circle>
            <line class="rot-needle" x1="0" y1="0" x2=${needle.x} y2=${needle.y}></line>
            ${ticks.map((t) => svg`<line
                class=${classMap({ "rot-tick": true, cardinal: t.cardinal, active: t.active })}
                x1=${t.x1} y1=${t.y1} x2=${t.x2} y2=${t.y2}
            ></line>`)}
        </svg>`;
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
            this.removeAttribute("data-manipulating");
            this.removeAttribute("data-rotating");
            return;
        }

        // Both states are reflected onto the host (which lives in the
        // workspace's shadow tree, unlike the recognizer's own data-gesture
        // buried in ours), so pure CSS can react: data-manipulating reveals
        // the workspace grid, data-rotating reveals this handle's dial. The
        // event states `rotating` outright, so there's nothing to derive and
        // no toggle to track — the attribute is the state.
        this.setAttribute("data-manipulating", "");
        this.toggleAttribute("data-rotating", event.rotating);

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

        const raw = {
            x: b.x + event.translation.x / this._displayScale,
            y: b.y + event.translation.y / this._displayScale,
        };

        // Snap settings are read live from the service — the handle needs
        // them only here, at grab time, so it reads rather than subscribes.
        const { snapEnabled, gridSize, rotationSnap } = settingsService;

        // Snapping quantises the numeric position itself — the value that
        // is broadcast to every display — not just the master's view; a
        // CSS-only snap would leave the displays showing the raw drift.
        const position = snapEnabled && this._natural
            ? snapToGrid(raw, this._natural, gridSize)
            : { x: Math.round(raw.x), y: Math.round(raw.y) };

        // Same reasoning as position: the snapped angle is the value that
        // reaches every display, so it quantises here, not in CSS. Its
        // feedback rides the render loop — the outline rotates to the
        // detent — so no overlay is needed to make it legible.
        const rotation = b.rotation + event.rotation * RAD_TO_DEG;

        this.emit({
            position,
            scale: clamp(b.scale * event.scale, MIN_SCALE, MAX_SCALE),
            rotation: snapEnabled ? snapAngle(rotation, rotationSnap) : rotation,
        });
    }

    private emit(detail: LayerTransformIntent): void {
        this.dispatchEvent(new CustomEvent("layer-transform", {
            detail,
            bubbles: true,
            composed: true,
        }));
    }

    /** A long-press flips the layer's visibility; the workspace dispatches. */
    private toggleVisibility(): void {
        const view = this._view;
        if (!view) return;

        this.dispatchEvent(new CustomEvent<LayerVisibilityIntent>("layer-visibility", {
            detail: { visible: !view.visible },
            bubbles: true,
            composed: true,
        }));
    }
}

function clamp(value: number, lo: number, hi: number): number {
    return Math.min(hi, Math.max(lo, value));
}
