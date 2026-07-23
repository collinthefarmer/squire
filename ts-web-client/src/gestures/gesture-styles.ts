/**
 * Shared gesture-state styling.
 *
 * While a recognizer owns an element, `onGesture` reflects its name
 * onto that element as `data-gesture="drag" | "pinch" | "tap"`. The
 * attribute is present only for the duration of the gesture, so CSS
 * alone expresses what an interaction looks like:
 *
 *   [data-gesture]           — any gesture in progress
 *   [data-gesture="drag"]    — this gesture specifically
 *   :has([data-gesture])     — an ancestor reacting to a descendant
 *
 * Components adopt GESTURE_STYLES alongside their own sheet. Every
 * value is a custom property with a fallback, so a component that
 * wants a different feel overrides the property rather than
 * duplicating the rule:
 *
 *   .panel { --gesture-active-scale: 1.02; }
 */

import type { DragEvent, PinchEvent } from "./recognizers";

/** Attribute written by the onGesture directive during a gesture. */
export const GESTURE_ATTR = "data-gesture";

// ── Var projections ───────────────────────────────────────────

/**
 * Passed as the third argument to onGesture to publish a gesture's
 * live magnitude as custom properties:
 *
 *   ${onGesture(pinch(), (e) => this.handlePinch(e), pinchVars)}
 *
 * Recognizers know nothing about these — they decide what happened,
 * and these decide what that looks like. Values are written outside
 * the render loop and are only readable while [data-gesture] is on
 * the element, so rules that use them belong inside that selector.
 *
 * Each write invalidates style for the element's subtree, so only
 * pass a projection whose properties something actually consumes.
 */
export const pinchVars = (event: PinchEvent): Record<string, string> => ({
    "--gesture-scale": String(event.scale),
    "--gesture-rotation": `${event.rotation}rad`,
});

export const dragVars = (event: DragEvent): Record<string, string> => ({
    "--gesture-dx": `${event.delta.x}px`,
    "--gesture-dy": `${event.delta.y}px`,
});

export const GESTURE_STYLES = `
/* Anything gesture-bound suppresses native panning and text
   selection — the recognizers own the pointer sequence. */
[${GESTURE_ATTR}],
[${GESTURE_ATTR}] * {
    user-select: none;
    -webkit-user-select: none;
}

/* Baseline: a gesture in progress reads as lifted and responsive.
   Transitions are on the idle state so settling eases and
   engagement is immediate. */
[${GESTURE_ATTR}] {
    transition: none;
    will-change: transform, filter;
    filter: brightness(var(--gesture-active-brightness, 1.06));
}

[${GESTURE_ATTR}="drag"] {
    cursor: var(--gesture-drag-cursor, grabbing);
    outline: var(--gesture-drag-outline-width, 2px) solid
        var(--gesture-drag-outline-color, #3b9eff);
    outline-offset: var(--gesture-drag-outline-offset, 2px);
}

/* Same colour family as drag — one interaction system — but dashed
   and standing off the edge, the resize-marquee idiom, so scaling
   reads as distinct from moving at a glance.

   The standoff tracks --gesture-scale, so the marquee opens as the
   fingers spread and closes as they converge: the feedback carries
   magnitude, not just presence. */
[${GESTURE_ATTR}="pinch"] {
    cursor: var(--gesture-pinch-cursor, nwse-resize);
    outline: var(--gesture-pinch-outline-width, 2px) dashed
        var(--gesture-pinch-outline-color, #3b9eff);
    outline-offset: calc(
        var(--gesture-scale, 1) * var(--gesture-pinch-outline-offset, 6px)
    );
}

[${GESTURE_ATTR}="tap"] {
    filter: brightness(var(--gesture-tap-brightness, 1.15));
}

@media (prefers-reduced-motion: reduce) {
    [${GESTURE_ATTR}] {
        transition: none;
        transform: none;
    }
}
`;
