/**
 * Placement math for reifying a palette preview into a display layer.
 *
 * The intent: the layer should land exactly where the preview image
 * sits on screen, at the same zoom — as if the palette dissolved and
 * left the image behind, now uncropped. So we reproduce the preview's
 * `object-fit: cover` scale: the square the user saw stays pixel-for-
 * pixel put, and the margins the crop hid reappear around it.
 *
 * Pure and DOM-free so it is testable in isolation. Coupled to the
 * renderer's contract in one respect, noted below: `sq-layer` applies
 * `scale()` about the element's centre, so the visual centre of a
 * scaled layer coincides with its unscaled layout centre.
 */

import type { ImagePosition } from "@types";

/** Fallback preview size (display px) when a live measurement is absent. */
export const PLACED_LAYER_WIDTH = 268;

// Matches the server's scale bounds (imageSetPayloadSchema).
const MIN_SCALE = 0.1;
const MAX_SCALE = 5.0;

export interface Placement {
    position: ImagePosition;
    scale: number;
}

/**
 * Place a layer so it coincides with the preview: same on-stage centre,
 * same cover-scale, image shown whole.
 *
 * `center` and `previewSize` are in display coordinates — `previewSize`
 * is the side of the square the preview occupied.
 *
 * Scale reproduces `cover` — the image's minor axis fills the square, so
 * `scale = previewSize / min(width, height)` — clamped to the wire's
 * bounds. Because the renderer scales about the centre, the layout
 * top-left is offset by half the image's NATURAL size to seat the visual
 * centre on `center`.
 */
export function computeLayerPlacement(
    image: { width: number; height: number },
    center: { x: number; y: number },
    previewSize: number,
): Placement {
    const scale = clamp(previewSize / Math.min(image.width, image.height), MIN_SCALE, MAX_SCALE);

    const position: ImagePosition = {
        x: Math.round(center.x - image.width / 2),
        y: Math.round(center.y - image.height / 2),
    };

    return { position, scale };
}

function clamp(value: number, lo: number, hi: number): number {
    return Math.min(hi, Math.max(lo, value));
}
