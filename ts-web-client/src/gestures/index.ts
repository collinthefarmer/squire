// Gesture system barrel export.

// Coordination
export { gestures } from "./coordination";
export type { GestureSource, Recognition, Recognizer } from "./recognizer";

// Harness
export { defineRecognizer, describe } from "./harness";
export type { RecognizerDescriptor } from "./harness";

// Pointer streams
export { pointers$ } from "./pointers";
export { canScrollInDirection, readScrollState } from "./pointers";
export type { PointerStream, PointerEnd, ScrollState } from "./pointers";

// Multi-pointer gathering
export { trackedPointers$ } from "./pointer-tracker";
export type {
    TrackedPointer,
    PointerSnapshot,
    PointerPhase,
} from "./pointer-tracker";

// Geometry
export {
    add,
    subtract,
    scale,
    magnitude,
    dot,
    distance,
    centroid,
    angle,
    velocity,
    cosineAngle,
    matchesDirection,
    pairMetrics,
    pairDelta,
} from "./transform";
export type {
    Point as Point,
    PointerPairMetrics,
    PairDelta,
} from "./transform";

// Recognizers
export { drag } from "./recognizers/drag";
export type { DragEvent, DragConfig } from "./recognizers/drag";

export { pinch } from "./recognizers/pinch";
export type { PinchEvent, PinchConfig } from "./recognizers/pinch";
