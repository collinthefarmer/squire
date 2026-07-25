/**
 * Uniformly scale a fixed-size stage to fit a viewport (letterbox /
 * pillarbox), centring the remainder. Preserves aspect ratio — the
 * whole stage stays visible, never cropped.
 *
 * Used by both clients to fit the 1920×1080 stage: the master frames
 * its preview with it, the display fills the screen with it.
 */
export interface FitResult {
    /** Uniform scale factor to apply to the stage. */
    scale: number;
    /** Left offset in viewport px to centre the scaled stage. */
    offsetX: number;
    /** Top offset in viewport px to centre the scaled stage. */
    offsetY: number;
}

export function fitScale(
    viewportW: number,
    viewportH: number,
    contentW: number,
    contentH: number,
): FitResult {
    const scale = Math.min(viewportW / contentW, viewportH / contentH);

    return {
        scale,
        offsetX: (viewportW - contentW * scale) / 2,
        offsetY: (viewportH - contentH * scale) / 2,
    };
}
