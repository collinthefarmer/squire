import { calculateScaledDimensions, calculatePosition } from "@utils/canvas-renderer";
import { DISPLAY } from "@shared/constants/display";
import type { AspectRatioMode, ImagePosition } from "@types";
import type { ImageDimensions } from "@master/services/image-toolbar-service";
import type { DisplayBounds } from "@master/services/visual-service";

/**
 * Convert screen coordinates to a normalized fraction of a wrapper element.
 * Values outside 0–1 indicate the point is beyond the wrapper edge.
 */
export function screenToCanvasFraction(
    screenX: number,
    screenY: number,
    wrapperRect: DOMRect,
): { x: number; y: number } {
    return {
        x: (screenX - wrapperRect.left) / wrapperRect.width,
        y: (screenY - wrapperRect.top) / wrapperRect.height,
    };
}

/**
 * Convert screen coordinates to display-space pixel coordinates (1920×1080).
 */
export function screenToDisplayPixels(
    screenX: number,
    screenY: number,
    wrapperRect: DOMRect,
    previewScale: number,
): { x: number; y: number } {
    return {
        x: (screenX - wrapperRect.left) / previewScale,
        y: (screenY - wrapperRect.top) / previewScale,
    };
}

/**
 * Check whether an image centered at the given display-space position
 * would overlap the display area.
 *
 * When image dimensions are unknown, uses a generous bounding check.
 */
export function wouldOverlapDisplay(
    displayX: number,
    displayY: number,
    imageDimensions: ImageDimensions | null,
    aspectRatio: AspectRatioMode,
    scale: number,
    displayWidth: number,
    displayHeight: number,
): boolean {
    if (!imageDimensions) {
        return displayX > -displayWidth / 2 && displayX < displayWidth * 1.5 &&
               displayY > -displayHeight / 2 && displayY < displayHeight * 1.5;
    }

    const { width, height } = calculateScaledDimensions(
        aspectRatio,
        imageDimensions.width,
        imageDimensions.height,
        displayWidth,
        displayHeight,
    );

    const halfW = (width * scale) / 2;
    const halfH = (height * scale) / 2;

    return displayX + halfW > 0 && displayX - halfW < displayWidth &&
           displayY + halfH > 0 && displayY - halfH < displayHeight;
}

/**
 * Convert display-space bounds to CSS percentages of the display.
 */
export function boundsToPercentages(bounds: DisplayBounds): {
    left: number;
    top: number;
    width: number;
    height: number;
} {
    return {
        left: (bounds.x / DISPLAY.WIDTH) * 100,
        top: (bounds.y / DISPLAY.HEIGHT) * 100,
        width: (bounds.width / DISPLAY.WIDTH) * 100,
        height: (bounds.height / DISPLAY.HEIGHT) * 100,
    };
}

/**
 * Compute visual display-space bounds from a position offset,
 * pre-scale (aspect-ratio-scaled) dimensions, and layer scale.
 *
 * The position offset is the top-left of the unscaled image.
 * Scale is applied around the center of the unscaled image.
 */
export function computeDisplayBounds(
    position: ImagePosition,
    scaledWidth: number,
    scaledHeight: number,
    layerScale: number,
): DisplayBounds {
    const posX = calculatePosition(position.x, DISPLAY.WIDTH, scaledWidth);
    const posY = calculatePosition(position.y, DISPLAY.HEIGHT, scaledHeight);

    const centerX = posX + scaledWidth / 2;
    const centerY = posY + scaledHeight / 2;
    const finalW = scaledWidth * layerScale;
    const finalH = scaledHeight * layerScale;

    return {
        x: centerX - finalW / 2,
        y: centerY - finalH / 2,
        width: finalW,
        height: finalH,
    };
}

/**
 * Compute a new position offset after applying a drag delta
 * in display-space pixels.
 *
 * Recovers the pre-scale image dimensions from the bounds and
 * scale, then converts the new center back to an offset.
 */
export function applyDragDelta(
    bounds: DisplayBounds,
    scale: number,
    dx: number,
    dy: number,
): ImagePosition {
    const preScaleW = bounds.width / scale;
    const preScaleH = bounds.height / scale;

    const oldCenterX = bounds.x + bounds.width / 2;
    const oldCenterY = bounds.y + bounds.height / 2;

    const newOffsetX = oldCenterX + dx - preScaleW / 2;
    const newOffsetY = oldCenterY + dy - preScaleH / 2;

    return { x: `${newOffsetX}px`, y: `${newOffsetY}px` };
}
