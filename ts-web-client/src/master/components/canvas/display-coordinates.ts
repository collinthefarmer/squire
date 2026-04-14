import { calculateScaledDimensions } from "@utils/canvas-renderer";
import type { AspectRatioMode } from "@types";
import type { ImageDimensions } from "@master/services/image-toolbar-service";

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
