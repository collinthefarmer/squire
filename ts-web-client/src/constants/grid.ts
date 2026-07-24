/**
 * The workspace's snapping parameters — the two detents a grab quantises
 * a layer to.
 *
 * The spatial one, GRID.SIZE, is a cell size in display pixels shared by
 * two readers that must never drift apart: the CSS that *draws* the grid
 * on the editing overlay, and the math that *snaps* a layer's committed
 * centre to it. The drawing side receives it as the `--grid-size` custom
 * property; the snapping side imports the number. Change it here and both
 * move together. 120 divides 1920×1080 cleanly — a 16×9 lattice — so grid
 * lines and snap nodes land on whole display pixels.
 *
 * The angular one, ROTATION_SNAP_DEGREES, is a rotation detent. It has no
 * CSS counterpart: a snapped angle needs no overlay because the handle's
 * outline already rotates to it, clicking through the detents in view.
 */
export const GRID = {
    /** Cell edge in display px. */
    SIZE: 120,
} as const;

/** Rotation detent in degrees — a grab's angle snaps to multiples of this. */
export const ROTATION_SNAP_DEGREES = 15;
