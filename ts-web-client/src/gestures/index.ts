// Gesture system barrel export.

// Coordination
export { gestures } from "./coordination";

// Pointer streams
export { pointers$ } from "./pointers";

// Multi-pointer gathering
export { trackedPointers$ } from "./pointer-tracker";
export type {
    TrackedPointer,
    PointerSnapshot,
    PointerPhase,
} from "./pointer-tracker";

// Geometry
export { subtract, velocity, pairMetrics, pairDelta } from "./transform";
export type { Point, PointerPairMetrics, PairDelta } from "./transform";

// Recognizers
export { drag, pinch } from "./recognizers";
export type {
    DragEvent,
    DragConfig,
    PinchEvent,
    PinchConfig,
} from "./recognizers";
