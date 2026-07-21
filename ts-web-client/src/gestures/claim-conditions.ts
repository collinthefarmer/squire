/**
 * Claim condition predicates for the PointerTracker claim window.
 *
 * Each factory returns a predicate that evaluates a PointerSnapshot
 * and returns true if the interaction should be claimed by the app
 * (rather than released to the browser for native scroll).
 *
 * Conditions are OR'd — any one matching triggers a claim.
 */

import type { PointerSnapshot } from "./pointer-tracker";

export type ClaimCondition = (snapshot: PointerSnapshot) => boolean;

/**
 * Claim when N or more pointers are active.
 */
export function fingerCount(n: number): ClaimCondition {
    return (snapshot) => snapshot.activeCount >= n;
}

/**
 * Claim when any pointer has moved past a threshold on the given axis.
 * Measured from the pointer's start position.
 */
export function movedInAxis(
    axis: "horizontal" | "vertical",
    thresholdPx: number,
): ClaimCondition {
    return (snapshot) => {
        for (const pointer of snapshot.active.values()) {
            const movement =
                axis === "horizontal"
                    ? Math.abs(pointer.position.x - pointer.startPosition.x)
                    : Math.abs(pointer.position.y - pointer.startPosition.y);

            if (movement >= thresholdPx) {
                return true;
            }
        }

        return false;
    };
}

/**
 * Claim when any pointer has moved past a distance threshold
 * in any direction. Measured from the pointer's start position.
 */
/**
 * Claim when a pointer pulls in a direction where the element
 * has no more scroll room.
 *
 * Example: scrollBoundaryPull(el, "down", 20) claims when the
 * element is scrolled to the top and a pointer moves 20px downward.
 * This enables pull-to-refresh and overscroll gestures.
 */
export function scrollBoundaryPull(
    element: HTMLElement,
    direction: "up" | "down" | "left" | "right",
    thresholdPx: number,
): ClaimCondition {
    return (snapshot) => {
        if (!atScrollBoundary(element, direction)) {
            return false;
        }

        for (const pointer of snapshot.active.values()) {
            const movement = pointerMovementInDirection(pointer, direction);

            if (movement >= thresholdPx) {
                return true;
            }
        }

        return false;
    };
}

function atScrollBoundary(
    element: HTMLElement,
    direction: "up" | "down" | "left" | "right",
): boolean {
    switch (direction) {
        case "down":
            return element.scrollTop <= 0;
        case "up":
            return (
                element.scrollTop + element.clientHeight >=
                element.scrollHeight - 1
            );
        case "right":
            return element.scrollLeft <= 0;
        case "left":
            return (
                element.scrollLeft + element.clientWidth >=
                element.scrollWidth - 1
            );
    }
}

function pointerMovementInDirection(
    pointer: {
        position: { x: number; y: number };
        startPosition: { x: number; y: number };
    },
    direction: "up" | "down" | "left" | "right",
): number {
    switch (direction) {
        case "down":
            return pointer.position.y - pointer.startPosition.y;
        case "up":
            return pointer.startPosition.y - pointer.position.y;
        case "right":
            return pointer.position.x - pointer.startPosition.x;
        case "left":
            return pointer.startPosition.x - pointer.position.x;
    }
}

/**
 * Claim when any pointer has moved past a distance threshold
 * in any direction. Measured from the pointer's start position.
 */
export function movedDistance(thresholdPx: number): ClaimCondition {
    return (snapshot) => {
        for (const pointer of snapshot.active.values()) {
            const dx = pointer.position.x - pointer.startPosition.x;
            const dy = pointer.position.y - pointer.startPosition.y;

            if (Math.hypot(dx, dy) >= thresholdPx) {
                return true;
            }
        }

        return false;
    };
}
