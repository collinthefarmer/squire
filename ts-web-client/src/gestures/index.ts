// Gesture system barrel export.

// Coordination
export { gestures } from "./coordination";

// Directive
export { onGesture } from "./directive";

// Gesture-state styling
export {
    GESTURE_STYLES,
    GESTURE_ATTR,
    pinchVars,
    dragVars,
} from "./gesture-styles";

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
export { drag, pinch, tap, grab } from "./recognizers";
export type {
    DragEvent,
    DragConfig,
    PinchEvent,
    PinchConfig,
    TapEvent,
    TapConfig,
    GrabEvent,
    GrabConfig,
} from "./recognizers";
