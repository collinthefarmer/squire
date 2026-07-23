/**
 * Geometry for a layer manipulation handle — the on-stage rectangle
 * that mirrors a layer's placement, in display coordinates.
 *
 * Pure and DOM-free. Mirrors the renderer's contract: `sq-layer`
 * positions the layer's top-left at `position` and applies `scale()`
 * and `rotate()` about the element centre. So the visual centre is
 * `position + naturalSize / 2` (independent of scale) and the visual
 * size is `naturalSize * scale`.
 */

import type { LayerView } from "@core/layer-service";

export interface HandleRect {
    /** Centre in display px. */
    cx: number;
    cy: number;
    /** Visual (scaled) size in display px. */
    width: number;
    height: number;
    /** Degrees. */
    rotation: number;
}

/** Aspect modes that fill the whole stage — no per-image handle (v1). */
const FULL_BLEED = new Set(["cover", "contain", "fill"]);

/**
 * The handle rectangle for a layer, or null when a handle doesn't
 * apply: hidden or image-less layers, full-bleed layers, layers with
 * a symbolic (non-numeric) position, or before the natural size has
 * been measured.
 */
export function handleRect(
    view: LayerView,
    naturalSize: { width: number; height: number } | null,
): HandleRect | null {
    if (!view.visible || !view.imageUrl) return null;
    if (FULL_BLEED.has(view.aspectRatio)) return null;
    if (!naturalSize) return null;

    const { x, y } = view.position;
    if (typeof x !== "number" || typeof y !== "number") return null;

    return {
        cx: x + naturalSize.width / 2,
        cy: y + naturalSize.height / 2,
        width: naturalSize.width * view.scale,
        height: naturalSize.height * view.scale,
        rotation: view.rotation,
    };
}
