import { html, type TemplateResult } from "lit-html";
import { map } from "lit-html/directives/map.js";
import { styleMap } from "lit-html/directives/style-map.js";

import { BaseComponent } from "@core/base-component";
import { getRemainingTime, formatTime } from "@state/clock-state";
import displayCss from "./sq-display.css" with { type: "text" };

import type { ClockState } from "@state/clock-state";
import type { ImageService } from "@core/image-service";

import type { ImageLayerState, ImagePosition, ImageEffect } from "@types";
import type { LayerId, ClockId } from "@types";

// -- Position resolution --

function resolveX(x: ImagePosition["x"]): Record<string, string> {
    if (x === "center") return { left: "50%" };
    if (x === "left") return { left: "0" };
    if (x === "right") return { right: "0" };
    return { left: `${x}px` };
}

function resolveY(y: ImagePosition["y"]): Record<string, string> {
    if (y === "center") return { top: "50%" };
    if (y === "top") return { top: "0" };
    if (y === "bottom") return { bottom: "0" };
    return { top: `${y}px` };
}

function buildTransform(position: ImagePosition, scale: number, rotation: number): string {
    const parts: string[] = [];

    if (position.x === "center") parts.push("translateX(-50%)");
    if (position.y === "center") parts.push("translateY(-50%)");
    if (scale !== 1) parts.push(`scale(${scale})`);
    if (rotation !== 0) parts.push(`rotate(${rotation}deg)`);

    return parts.join(" ");
}

// -- Effect resolution --

function resolveFilters(effects: ImageEffect[]): string {
    return effects.map((e) => {
        if (e.type === "blur") return `blur(${e.params.radius}px)`;
        if (e.type === "brightness") return `brightness(${e.params.level})`;
        if (e.type === "contrast") return `contrast(${e.params.level})`;
        if (e.type === "glow") return `drop-shadow(0 0 ${e.params.intensity * 10}px rgba(255,255,255,0.8))`;
        if (e.type === "tint") return `sepia(1) hue-rotate(0deg) saturate(${e.params.amount})`;
        return "";
    }).filter(Boolean).join(" ");
}

// -- Aspect ratio → object-fit --

const ASPECT_TO_FIT: Record<string, string> = {
    cover: "cover",
    contain: "contain",
    fill: "fill",
};

export class SqDisplay extends BaseComponent {
    private _layers: ReadonlyMap<LayerId, ImageLayerState> = new Map();
    private _clocks: ReadonlyMap<ClockId, ClockState> = new Map();
    private _imageService: ImageService | null = null;

    set imageService(value: ImageService) {
        this._imageService = value;
    }

    set layers(value: ReadonlyMap<LayerId, ImageLayerState>) {
        this._layers = value;
        this.update();
    }

    set clocks(value: ReadonlyMap<ClockId, ClockState>) {
        this._clocks = value;
        this.update();
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.adoptStyles(displayCss);
        this.update();
    }

    protected template(): TemplateResult {
        const sortedLayers = [...this._layers.values()]
            .filter((l) => l.visible && l.imageRef)
            .sort((a, b) => a.zIndex - b.zIndex);

        const visibleClocks = [...this._clocks.values()]
            .filter((c) => c.visible);

        return html`
            ${map(sortedLayers, (layer) => this.layerTemplate(layer))}
            ${map(visibleClocks, (clock) => this.clockTemplate(clock))}
        `;
    }

    private layerTemplate(layer: ImageLayerState): TemplateResult {
        const imageUrl = this._imageService!.resolveUrl(layer.imageRef!);
        const isFull = layer.aspectRatio in ASPECT_TO_FIT;

        const layerStyles: Record<string, string> = {
            opacity: String(layer.opacity),
            zIndex: String(layer.zIndex),
        };

        if (layer.blendMode !== "normal") {
            layerStyles.mixBlendMode = layer.blendMode;
        }

        if (isFull) {
            layerStyles.inset = "0";
        } else {
            Object.assign(layerStyles, resolveX(layer.position.x));
            Object.assign(layerStyles, resolveY(layer.position.y));

            const transform = buildTransform(layer.position, layer.scale, layer.rotation);
            if (transform) layerStyles.transform = transform;
        }

        const filters = resolveFilters(layer.effects);
        if (filters) layerStyles.filter = filters;

        const imgStyles: Record<string, string> = {};

        if (isFull) {
            imgStyles.objectFit = ASPECT_TO_FIT[layer.aspectRatio]!;
        }

        return html`
            <div class="layer ${isFull ? "layer-full" : ""}" style=${styleMap(layerStyles)}>
                <img src=${imageUrl} alt="" style=${styleMap(imgStyles)} />
            </div>
        `;
    }

    private clockTemplate(clock: ClockState): TemplateResult {
        const remaining = getRemainingTime(clock);
        const formatted = formatTime(remaining);

        const styles: Record<string, string> = {
            zIndex: String(clock.zIndex),
            fontSize: `${24 * clock.scale}px`,
            fontFamily: clock.font,
            ...resolveX(clock.position.x),
            ...resolveY(clock.position.y),
        };

        const transform = buildTransform(clock.position, 1, 0);
        if (transform) styles.transform = transform;

        return html`
            <div class="clock" style=${styleMap(styles)}>
                ${formatted}
            </div>
        `;
    }
}
