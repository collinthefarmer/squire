/**
 * Drag interaction constants
 *
 * Shared configuration for drag threshold, scale limits,
 * and fallback values used across Draggable and overlay components.
 */
export const DRAG = {
    CLICK_THRESHOLD: 5,
    SCALE_MIN: 0.1,
    SCALE_MAX: 5.0,
    WHEEL_FACTOR: 0.1,
    PREVIEW_SCALE_FALLBACK: 0.5,
} as const;
