import type { DragEvent, PinchEvent, Point } from "@gestures";

export interface PanelTransformConfig {
    minScale?: number;
    maxScale?: number;
    /** Width of the panel at scale 1, used for center-anchored scaling. */
    baseWidth?: number;
    /** Height of the panel at scale 1, used for center-anchored scaling. */
    baseHeight?: number;
}

/**
 * Manages position and scale state for a draggable/scalable panel.
 *
 * Handles lazy origin capture (recognizers don't emit "start" phase),
 * coordinate conversion from client to display space, and
 * center-anchored scaling.
 *
 * Exposes state as CSS custom properties via `styles`, ready for use
 * with `styleMap()`. This is the render-loop instance of the
 * variable-forwarding pattern (see CLIENT_STANDARDS §7.1): durable
 * component state, so the values flow through the template rather
 * than being written to the element out of band.
 */
export class PanelTransform {
    private _position: Point = { x: 0, y: 0 };
    private _scale = 1;
    private dragOrigin: Point | null = null;
    private pinchBaseScale: number | null = null;

    private readonly minScale: number;
    private readonly maxScale: number;
    private readonly baseWidth: number;
    private readonly baseHeight: number;

    constructor(config?: PanelTransformConfig) {
        this.minScale = config?.minScale ?? 0.5;
        this.maxScale = config?.maxScale ?? 2.0;
        this.baseWidth = config?.baseWidth ?? 0;
        this.baseHeight = config?.baseHeight ?? 0;
    }

    get position(): Point {
        return this._position;
    }

    set position(value: Point) {
        this._position = { x: value.x, y: value.y };
    }

    get scale(): number {
        return this._scale;
    }

    set scale(value: number) {
        this._scale = Math.min(this.maxScale, Math.max(this.minScale, value));
    }

    get x(): number {
        return this._position.x;
    }

    get y(): number {
        return this._position.y;
    }

    /**
     * CSS custom properties for the current transform state.
     * Keys: --panel-x, --panel-y, --panel-scale.
     *
     * Names are fixed, not namespaced: custom properties inherit
     * per-subtree, so every panel setting these on its own root is
     * already isolated from every other. Consumed by PANEL_TRANSFORM_CSS.
     */
    get styles(): Record<string, string> {
        return {
            "--panel-x": `${this._position.x}px`,
            "--panel-y": `${this._position.y}px`,
            "--panel-scale": String(this._scale),
        };
    }

    /**
     * Apply a drag event. Converts delta from client to display
     * coordinates using the provided displayScale.
     */
    applyDrag(event: DragEvent, displayScale: number): void {
        if (!this.dragOrigin) {
            this.dragOrigin = { x: this._position.x, y: this._position.y };
        }

        if (event.phase === "move") {
            this._position.x = this.dragOrigin.x + event.delta.x / displayScale;
            this._position.y = this.dragOrigin.y + event.delta.y / displayScale;
        }

        if (event.phase === "end") {
            this.dragOrigin = null;
        }
    }

    /**
     * Apply a pinch event. Adjusts position to keep the visual
     * center stable when baseWidth/baseHeight are configured.
     */
    applyPinch(event: PinchEvent): void {
        if (this.pinchBaseScale === null) {
            this.pinchBaseScale = this._scale;
        }

        if (event.phase === "move") {
            const prevScale = this._scale;
            this._scale = Math.min(this.maxScale, Math.max(this.minScale, this.pinchBaseScale * event.scale));

            if (this.baseWidth > 0) {
                this._position.x -= this.baseWidth * (this._scale - prevScale) / 2;
            }

            if (this.baseHeight > 0) {
                this._position.y -= this.baseHeight * (this._scale - prevScale) / 2;
            }
        }

        if (event.phase === "end") {
            this.pinchBaseScale = null;
        }
    }
}

/**
 * Core, overridable stylesheet consuming the panel transform
 * variables. Adopt it alongside a component sheet, and give the
 * transformed element the `panel-transform` class:
 *
 *   this.adoptStyles(PANEL_TRANSFORM_CSS, myComponentCss);
 *   // <div class="panel-transform" style=${styleMap(transform.styles)}>
 *
 * Every value is a var() with a fallback, so a component overrides
 * behavior by setting the property rather than restating the rule.
 */
export const PANEL_TRANSFORM_CSS = `
.panel-transform {
    left: var(--panel-x, 0px);
    top: var(--panel-y, 0px);
    font-size: calc(1em * var(--panel-scale, 1));
}
`;
