import type { ServerWebSocket } from "bun";

// Core type definitions

/**
 * Base event structure
 */
export interface Event<T extends string = string, P = unknown> {
    type: T;
    payload: P;
    metadata: EventMetadata;
}

export interface EventMetadata {
    timestamp: number;
    source: string;
    gameTimestamp?: number;
    targetClients?: string[];
    priority?: "low" | "normal" | "high";
}

/**
 * Audio event types
 */
export interface AudioPlayPayload {
    channel: string;
    trackId?: string;
    source: {
        type: "file" | "stream" | "live";
        ref: string;
    };
    volume: number;
    loop: boolean;
    effects?: AudioEffect[];
    respectTimeScale: boolean;
}

export interface AudioEffect {
    type: string;
    params: Record<string, unknown>;
}

export type AudioPlayEvent = Event<"audio.play", AudioPlayPayload>;
export type AudioPauseEvent = Event<
    "audio.pause",
    { channel: string; trackId?: string }
>;
export type AudioResumeEvent = Event<
    "audio.resume",
    { channel: string; trackId?: string }
>;
export type AudioStopEvent = Event<
    "audio.stop",
    { channel: string; trackId?: string }
>;
export type AudioVolumeEvent = Event<
    "audio.volume",
    { channel: string; volume: number; trackId?: string }
>;
export type AudioLoopEvent = Event<
    "audio.loop",
    { channel: string; trackId: string; loop: boolean }
>;
export type AudioChannelEffectsEvent = Event<
    "audio.channel_effects",
    { channel: string; effects: AudioEffect[] }
>;

export type AudioEvent =
    | AudioPlayEvent
    | AudioPauseEvent
    | AudioResumeEvent
    | AudioStopEvent
    | AudioVolumeEvent
    | AudioLoopEvent
    | AudioChannelEffectsEvent;

/**
 * Audio state
 */
export interface AudioTrackState {
    id: string;
    source: {
        type: "file" | "stream" | "live";
        ref: string;
    };
    playing: boolean;
    position: number;
    volume: number;
    loop: boolean;
    effects: AudioEffect[];
    respectTimeScale: boolean;
}

export interface AudioChannelState {
    id: string;
    tracks: ReadonlyMap<string, AudioTrackState>;
    volume: number;
    effects: AudioEffect[];
}

export interface AudioState {
    channels: ReadonlyMap<string, AudioChannelState>;
    masterVolume: number;
}

/**
 * System events — server-originated, not validated through eventSchema
 */
export interface SystemConnectedPayload {
    clientId: string;
}

export interface ClientInfo {
    id: string;
    type: "master" | "display";
}

export interface SystemClientListPayload {
    displays: ClientInfo[];
}

/**
 * WebSocket data attached to each connection
 */
export interface WebSocketData {
    clientId: string;
    clientType: "master" | "display";
}

/**
 * Client registry
 */
export interface ConnectedClient {
    id: string;
    type: "master" | "display";
    ws: ServerWebSocket<WebSocketData>;
    connectedAt: number;
}

export interface ClientsState {
    clients: ReadonlyMap<string, ConnectedClient>;
}

/**
 * Image/Visual event types
 */

export type AspectRatioMode =
    | "cover"
    | "contain"
    | "fill"
    | "native"
    | "custom";
export type BlendMode = "normal" | "multiply" | "screen" | "overlay" | "add";
export type TransitionType =
    | "crossfade"
    | "fade-to-black"
    | "wipe"
    | "dissolve"
    | "cut";

export interface ImagePosition {
    x: string | number; // "center", "left", "right", or pixel/percentage value
    y: string | number; // "center", "top", "bottom", or pixel/percentage value
}

export interface ImageTransition {
    type: TransitionType;
    duration: number; // milliseconds
    easing?: string; // CSS easing function
}

export interface ImageEffect {
    type: string; // "blur", "tint", "glow", etc.
    params: Record<string, unknown>;
}

export interface ImageSetPayload {
    layer: string; // Layer alias like "background", "midground", etc.
    imageRef: string; // Asset reference
    aspectRatio: AspectRatioMode;
    position?: ImagePosition;
    transition?: ImageTransition;
    scale?: number; // Initial scale factor (defaults to 1.0)
}

export interface ImageClearPayload {
    layer: string;
    transition?: ImageTransition;
}

export interface ImageTransformPayload {
    layer: string;
    position?: ImagePosition;
    scale?: number;
    rotation?: number; // degrees
}

export interface ImageEffectPayload {
    layer: string;
    effects: ImageEffect[];
    replace: boolean; // If true, replace all effects; if false, add/merge
}

export interface ImageLayerConfigPayload {
    layer: string;
    blendMode?: BlendMode;
    opacity?: number; // 0.0 to 1.0
    zIndex?: number;
    visible?: boolean;
}

export type ImageSetEvent = Event<"visual.image.set", ImageSetPayload>;
export type ImageClearEvent = Event<"visual.image.clear", ImageClearPayload>;
export type ImageTransformEvent = Event<
    "visual.image.transform",
    ImageTransformPayload
>;
export type ImageEffectEvent = Event<"visual.image.effect", ImageEffectPayload>;
export type ImageLayerConfigEvent = Event<
    "visual.image.layer_config",
    ImageLayerConfigPayload
>;

export type ImageEvent =
    | ImageSetEvent
    | ImageClearEvent
    | ImageTransformEvent
    | ImageEffectEvent
    | ImageLayerConfigEvent;

/**
 * Image layer state
 */
export interface ImageLayerState {
    id: string; // Layer alias
    imageRef: string | null;
    aspectRatio: AspectRatioMode;
    position: ImagePosition;
    scale: number;
    rotation: number;
    blendMode: BlendMode;
    opacity: number;
    zIndex: number;
    visible: boolean;
    effects: ImageEffect[];
}

export interface ImageState {
    layers: ReadonlyMap<string, ImageLayerState>;
}

/**
 * Clock event types
 *
 * Lifecycle events for countdown clocks. The server relays these
 * without managing clock time — clients compute remaining time
 * independently from event timestamps.
 */

export type ClockVisibility = "always" | "hidden" | "dm-only";
export type ClockCompletionBehavior = "persist" | "auto-hide" | "auto-destroy";

export interface ClockCreatePayload {
    id: string;
    duration: number; // total duration in ms
    autoStart?: boolean; // start immediately on create
    position?: ImagePosition; // reuses image position format
    zIndex?: number;
    respectTimeScale?: boolean; // default true
    visibility?: ClockVisibility; // default "always"
    onComplete?: ClockCompletionBehavior; // default "persist"
}

export interface ClockStartPayload {
    id: string;
}

export interface ClockPausePayload {
    id: string;
}

export interface ClockAdjustPayload {
    id: string;
    delta: number; // ms to add (positive) or remove (negative)
}

export interface ClockDestroyPayload {
    id: string;
}

export interface ClockUpdatePayload {
    id: string;
    position?: ImagePosition;
    zIndex?: number;
    visible?: boolean;
}

export type ClockCreateEvent = Event<"ui.clock.create", ClockCreatePayload>;
export type ClockStartEvent = Event<"ui.clock.start", ClockStartPayload>;
export type ClockPauseEvent = Event<"ui.clock.pause", ClockPausePayload>;
export type ClockAdjustEvent = Event<"ui.clock.adjust", ClockAdjustPayload>;
export type ClockDestroyEvent = Event<"ui.clock.destroy", ClockDestroyPayload>;
export type ClockUpdateEvent = Event<"ui.clock.update", ClockUpdatePayload>;

export type ClockEvent =
    | ClockCreateEvent
    | ClockStartEvent
    | ClockPauseEvent
    | ClockAdjustEvent
    | ClockDestroyEvent
    | ClockUpdateEvent;

/**
 * Time-scale event types
 */

export interface TimeScaleChangedPayload {
    scale: number;
}

export type TimeScaleChangedEvent = Event<
    "time.scale_changed",
    TimeScaleChangedPayload
>;

export type TimeEvent = TimeScaleChangedEvent;

/**
 * Application state
 */
export interface ApplicationState {
    audio?: AudioState;
    clients?: ClientsState;
    image?: ImageState;
    time?: { scale: number };
}
