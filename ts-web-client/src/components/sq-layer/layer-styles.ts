/**
 * Pure `layer → CSS` projection for the image layer renderer.
 *
 * Kept apart from the component so it carries no DOM dependency and
 * is unit-testable in isolation, mirroring the pure-reducer split in
 * `@state/`. The component owns the pixels; this owns the mapping.
 */

import { resolveX, resolveY, buildTransform } from "@utils/layer-geometry";

import type { LayerView } from "@core/layer-service";
import type { ImageEffect } from "@types";

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

/** Aspect modes that fill the stage (object-fit); others are positioned. */
const ASPECT_TO_FIT: Record<string, string> = {
    cover: "cover",
    contain: "contain",
    fill: "fill",
};

/**
 * Styles for the layer wrapper (`host`) and inner image (`img`),
 * plus whether the layer fills the stage. No DOM, no service.
 */
export function buildLayerStyles(layer: LayerView): {
    host: Record<string, string>;
    img: Record<string, string>;
    isFull: boolean;
} {
    const isFull = layer.aspectRatio in ASPECT_TO_FIT;

    const host: Record<string, string> = {
        opacity: String(layer.opacity),
        zIndex: String(layer.zIndex),
    };

    if (layer.blendMode !== "normal") {
        host.mixBlendMode = layer.blendMode;
    }

    if (isFull) {
        host.inset = "0";
    } else {
        Object.assign(host, resolveX(layer.position.x));
        Object.assign(host, resolveY(layer.position.y));

        const transform = buildTransform(layer.position, layer.scale, layer.rotation);
        if (transform) host.transform = transform;
    }

    const filters = resolveFilters(layer.effects);
    if (filters) host.filter = filters;

    const img: Record<string, string> = {};

    if (isFull) {
        img.objectFit = ASPECT_TO_FIT[layer.aspectRatio]!;
    }

    return { host, img, isFull };
}
