/**
 * Client-side type definitions
 *
 * Re-exports server types and adds client-specific types
 */

// Re-export server types for use in client
export type {
    Event,
    EventMetadata,
    AudioPlayEvent,
    AudioPauseEvent,
    AudioResumeEvent,
    AudioStopEvent,
    AudioVolumeEvent,
    AudioEvent,
    AudioChannelState,
    AudioTrackState,
    AudioEffect,
    ImageSetEvent,
    ImageClearEvent,
    ImageTransformEvent,
    ImageEffectEvent,
    ImageLayerConfigEvent,
    ImageEvent,
    ImageLayerState,
    ImagePosition,
    ImageTransition,
    ImageEffect,
    AspectRatioMode,
    BlendMode,
    TransitionType,
    ClockCreateEvent,
    ClockStartEvent,
    ClockPauseEvent,
    ClockAdjustEvent,
    ClockDestroyEvent,
    ClockEvent,
    ClockCreatePayload,
    ClockStartPayload,
    ClockPausePayload,
    ClockAdjustPayload,
    ClockDestroyPayload,
    ClockUpdateEvent,
    ClockUpdatePayload,
    ClockVisibility,
    ClockCompletionBehavior,
    TimeScaleChangedEvent,
    TimeScaleChangedPayload,
    TimeEvent,
} from "../../server/src/types";

/**
 * Client-specific types
 */

/**
 * Audio channel state for client-side rendering
 */
export interface AudioChannelRenderState {
    id: string;
    playing: boolean;
    volume: number;
    sourceRef: string;
}

/**
 * Visual layer state for client-side rendering
 */
export interface VisualLayerRenderState {
    id: string;
    imageRef: string | null;
    opacity: number;
    blendMode: string;
    zIndex: number;
    visible: boolean;
    transform: {
        x: number;
        y: number;
        scale: number;
        rotation: number;
    };
}
