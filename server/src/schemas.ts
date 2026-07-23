import { z } from "zod";
import { channelId, layerId, trackId, imageRef } from "./types";
import type { ChannelId, LayerId, TrackId, ImageRef } from "./types";

/**
 * Zod schemas for runtime validation
 *
 * Branded ID fields use .transform() to convert plain strings into
 * their branded counterparts after validation. Effect schemas use
 * discriminated unions that mirror the TypeScript types in types.ts.
 */

// -- Branded ID schemas --

const channelIdSchema = z.string().transform((s): ChannelId => channelId(s));
const layerIdSchema = z.string().transform((s): LayerId => layerId(s));
const trackIdSchema = z.string().transform((s): TrackId => trackId(s));
const imageRefSchema = z.string().transform((s): ImageRef => imageRef(s));

// Base schemas
export const eventMetadataSchema = z.object({
    timestamp: z.number(),
    source: z.string(),
    gameTimestamp: z.number().optional(),
    targetClients: z.array(z.string()).optional(),
    priority: z.enum(["low", "normal", "high"]).optional(),
});

// -- Audio effect schemas (discriminated union) --

const reverbEffectSchema = z.object({
    type: z.literal("reverb"),
    params: z.object({
        decay: z.number(),
        mix: z.number(),
    }),
});

const chorusEffectSchema = z.object({
    type: z.literal("chorus"),
    params: z.object({
        rate: z.number(),
        depth: z.number(),
        mix: z.number(),
    }),
});

const distortionEffectSchema = z.object({
    type: z.literal("distortion"),
    params: z.object({
        amount: z.number(),
        tone: z.number(),
        mix: z.number(),
    }),
});

export const audioEffectSchema = z.discriminatedUnion("type", [
    reverbEffectSchema,
    chorusEffectSchema,
    distortionEffectSchema,
]);

export const audioSourceSchema = z.object({
    type: z.enum(["file", "stream", "live"]),
    ref: z.string(),
});

export const audioPlayPayloadSchema = z.object({
    channel: channelIdSchema,
    trackId: trackIdSchema.optional(),
    source: audioSourceSchema,
    volume: z.number().min(0).max(1),
    loop: z.boolean(),
    effects: z.array(audioEffectSchema).optional(),
    respectTimeScale: z.boolean(),
});

export const audioPlayEventSchema = z.object({
    type: z.literal("audio.play"),
    payload: audioPlayPayloadSchema,
    metadata: eventMetadataSchema,
});

export const audioPauseEventSchema = z.object({
    type: z.literal("audio.pause"),
    payload: z.object({
        channel: channelIdSchema,
        trackId: trackIdSchema.optional(),
    }),
    metadata: eventMetadataSchema,
});

export const audioResumeEventSchema = z.object({
    type: z.literal("audio.resume"),
    payload: z.object({
        channel: channelIdSchema,
        trackId: trackIdSchema.optional(),
    }),
    metadata: eventMetadataSchema,
});

export const audioStopEventSchema = z.object({
    type: z.literal("audio.stop"),
    payload: z.object({
        channel: channelIdSchema,
        trackId: trackIdSchema.optional(),
    }),
    metadata: eventMetadataSchema,
});

export const audioVolumeEventSchema = z.object({
    type: z.literal("audio.volume"),
    payload: z.object({
        channel: channelIdSchema,
        volume: z.number().min(0).max(1),
        trackId: trackIdSchema.optional(),
    }),
    metadata: eventMetadataSchema,
});

export const audioLoopEventSchema = z.object({
    type: z.literal("audio.loop"),
    payload: z.object({
        channel: channelIdSchema,
        trackId: trackIdSchema,
        loop: z.boolean(),
    }),
    metadata: eventMetadataSchema,
});

export const audioChannelEffectsEventSchema = z.object({
    type: z.literal("audio.channel_effects"),
    payload: z.object({
        channel: channelIdSchema,
        effects: z.array(audioEffectSchema),
    }),
    metadata: eventMetadataSchema,
});

// Union of all audio events
export const audioEventSchema = z.discriminatedUnion("type", [
    audioPlayEventSchema,
    audioPauseEventSchema,
    audioResumeEventSchema,
    audioStopEventSchema,
    audioVolumeEventSchema,
    audioLoopEventSchema,
    audioChannelEffectsEventSchema,
]);

// -- Image effect schemas (discriminated union) --

const blurEffectSchema = z.object({
    type: z.literal("blur"),
    params: z.object({ radius: z.number() }),
});

const glowEffectSchema = z.object({
    type: z.literal("glow"),
    params: z.object({ intensity: z.number() }),
});

const tintEffectSchema = z.object({
    type: z.literal("tint"),
    params: z.object({ color: z.string(), amount: z.number() }),
});

const brightnessEffectSchema = z.object({
    type: z.literal("brightness"),
    params: z.object({ level: z.number() }),
});

const contrastEffectSchema = z.object({
    type: z.literal("contrast"),
    params: z.object({ level: z.number() }),
});

export const imageEffectSchema = z.discriminatedUnion("type", [
    blurEffectSchema,
    glowEffectSchema,
    tintEffectSchema,
    brightnessEffectSchema,
    contrastEffectSchema,
]);

// Image/Visual schemas
export const imagePositionSchema = z.object({
    x: z.union([z.string(), z.number()]),
    y: z.union([z.string(), z.number()]),
});

export const imageTransitionSchema = z.object({
    type: z.enum(["crossfade", "fade-to-black", "wipe", "dissolve", "cut"]),
    duration: z.number(),
    easing: z.string().optional(),
});

export const imageSetPayloadSchema = z.object({
    layer: layerIdSchema,
    imageRef: imageRefSchema,
    aspectRatio: z.enum(["cover", "contain", "fill", "native", "custom"]),
    position: imagePositionSchema.optional(),
    transition: imageTransitionSchema.optional(),
    scale: z.number().min(0.1).max(5.0).optional(),
    rotation: z.number().optional(),
});

export const imageSetEventSchema = z.object({
    type: z.literal("visual.image.set"),
    payload: imageSetPayloadSchema,
    metadata: eventMetadataSchema,
});

export const imageClearPayloadSchema = z.object({
    layer: layerIdSchema,
    transition: imageTransitionSchema.optional(),
});

export const imageClearEventSchema = z.object({
    type: z.literal("visual.image.clear"),
    payload: imageClearPayloadSchema,
    metadata: eventMetadataSchema,
});

export const imageTransformPayloadSchema = z.object({
    layer: layerIdSchema,
    position: imagePositionSchema.optional(),
    scale: z.number().optional(),
    rotation: z.number().optional(),
});

export const imageTransformEventSchema = z.object({
    type: z.literal("visual.image.transform"),
    payload: imageTransformPayloadSchema,
    metadata: eventMetadataSchema,
});

export const imageEffectPayloadSchema = z.object({
    layer: layerIdSchema,
    effects: z.array(imageEffectSchema),
    replace: z.boolean(),
});

export const imageEffectEventSchema = z.object({
    type: z.literal("visual.image.effect"),
    payload: imageEffectPayloadSchema,
    metadata: eventMetadataSchema,
});

export const imageLayerConfigPayloadSchema = z.object({
    layer: layerIdSchema,
    blendMode: z
        .enum(["normal", "multiply", "screen", "overlay", "add"])
        .optional(),
    opacity: z.number().min(0).max(1).optional(),
    zIndex: z.number().optional(),
    visible: z.boolean().optional(),
});

export const imageLayerConfigEventSchema = z.object({
    type: z.literal("visual.image.layer_config"),
    payload: imageLayerConfigPayloadSchema,
    metadata: eventMetadataSchema,
});

// Union of all image events
export const imageEventSchema = z.discriminatedUnion("type", [
    imageSetEventSchema,
    imageClearEventSchema,
    imageTransformEventSchema,
    imageEffectEventSchema,
    imageLayerConfigEventSchema,
]);

// Clock schemas
export const clockCreatePayloadSchema = z.object({
    id: z.string(),
    duration: z.number().min(1000),
    autoStart: z.boolean().optional(),
    position: imagePositionSchema.optional(),
    zIndex: z.number().optional(),
    scale: z.number().min(0.1).max(10).optional(),
    font: z.string().optional(),
    respectTimeScale: z.boolean().optional(),
    visibility: z.enum(["always", "hidden", "dm-only"]).optional(),
    onComplete: z.enum(["persist", "auto-hide", "auto-destroy"]).optional(),
});

export const clockCreateEventSchema = z.object({
    type: z.literal("ui.clock.create"),
    payload: clockCreatePayloadSchema,
    metadata: eventMetadataSchema,
});

export const clockStartEventSchema = z.object({
    type: z.literal("ui.clock.start"),
    payload: z.object({ id: z.string() }),
    metadata: eventMetadataSchema,
});

export const clockPauseEventSchema = z.object({
    type: z.literal("ui.clock.pause"),
    payload: z.object({ id: z.string() }),
    metadata: eventMetadataSchema,
});

export const clockAdjustEventSchema = z.object({
    type: z.literal("ui.clock.adjust"),
    payload: z.object({
        id: z.string(),
        delta: z.number(),
    }),
    metadata: eventMetadataSchema,
});

export const clockDestroyEventSchema = z.object({
    type: z.literal("ui.clock.destroy"),
    payload: z.object({ id: z.string() }),
    metadata: eventMetadataSchema,
});

export const clockUpdatePayloadSchema = z.object({
    id: z.string(),
    position: imagePositionSchema.optional(),
    zIndex: z.number().optional(),
    visible: z.boolean().optional(),
    scale: z.number().min(0.1).max(10).optional(),
    font: z.string().optional(),
});

export const clockUpdateEventSchema = z.object({
    type: z.literal("ui.clock.update"),
    payload: clockUpdatePayloadSchema,
    metadata: eventMetadataSchema,
});

// Union of all clock events
export const clockEventSchema = z.discriminatedUnion("type", [
    clockCreateEventSchema,
    clockStartEventSchema,
    clockPauseEventSchema,
    clockAdjustEventSchema,
    clockDestroyEventSchema,
    clockUpdateEventSchema,
]);

// Time-scale schemas
export const timeScaleChangedPayloadSchema = z.object({
    scale: z.number().min(0).max(10),
});

export const timeScaleChangedEventSchema = z.object({
    type: z.literal("time.scale_changed"),
    payload: timeScaleChangedPayloadSchema,
    metadata: eventMetadataSchema,
});

export const timeEventSchema = z.discriminatedUnion("type", [
    timeScaleChangedEventSchema,
]);

// WebRTC signaling schemas (transient — not stored in EventStore)
export const webrtcOfferEventSchema = z.object({
    type: z.literal("webrtc.offer"),
    payload: z.object({
        targetClientId: z.string(),
        channel: z.string(),
        sdp: z.string(),
    }),
    metadata: eventMetadataSchema,
});

export const webrtcAnswerEventSchema = z.object({
    type: z.literal("webrtc.answer"),
    payload: z.object({
        targetClientId: z.string(),
        channel: z.string(),
        sdp: z.string(),
    }),
    metadata: eventMetadataSchema,
});

export const webrtcIceCandidateEventSchema = z.object({
    type: z.literal("webrtc.ice_candidate"),
    payload: z.object({
        targetClientId: z.string(),
        channel: z.string(),
        candidate: z.string(),
    }),
    metadata: eventMetadataSchema,
});

export const webrtcEventSchema = z.discriminatedUnion("type", [
    webrtcOfferEventSchema,
    webrtcAnswerEventSchema,
    webrtcIceCandidateEventSchema,
]);

// All events
export const eventSchema = z.discriminatedUnion("type", [
    ...audioEventSchema.options,
    ...imageEventSchema.options,
    ...clockEventSchema.options,
    ...timeEventSchema.options,
    ...webrtcEventSchema.options,
]);

/**
 * Type inference from schemas
 */
export type EventMetadata = z.infer<typeof eventMetadataSchema>;
export type AudioEffect = z.infer<typeof audioEffectSchema>;
export type AudioSource = z.infer<typeof audioSourceSchema>;
export type AudioPlayPayload = z.infer<typeof audioPlayPayloadSchema>;
export type AudioPlayEvent = z.infer<typeof audioPlayEventSchema>;
export type AudioPauseEvent = z.infer<typeof audioPauseEventSchema>;
export type AudioResumeEvent = z.infer<typeof audioResumeEventSchema>;
export type AudioStopEvent = z.infer<typeof audioStopEventSchema>;
export type AudioVolumeEvent = z.infer<typeof audioVolumeEventSchema>;
export type AudioEvent = z.infer<typeof audioEventSchema>;
export type ImagePosition = z.infer<typeof imagePositionSchema>;
export type ImageTransition = z.infer<typeof imageTransitionSchema>;
export type ImageEffect = z.infer<typeof imageEffectSchema>;
export type ImageSetPayload = z.infer<typeof imageSetPayloadSchema>;
export type ImageSetEvent = z.infer<typeof imageSetEventSchema>;
export type ImageClearPayload = z.infer<typeof imageClearPayloadSchema>;
export type ImageClearEvent = z.infer<typeof imageClearEventSchema>;
export type ImageTransformPayload = z.infer<typeof imageTransformPayloadSchema>;
export type ImageTransformEvent = z.infer<typeof imageTransformEventSchema>;
export type ImageEffectPayload = z.infer<typeof imageEffectPayloadSchema>;
export type ImageEffectEvent = z.infer<typeof imageEffectEventSchema>;
export type ImageLayerConfigPayload = z.infer<
    typeof imageLayerConfigPayloadSchema
>;
export type ImageLayerConfigEvent = z.infer<typeof imageLayerConfigEventSchema>;
export type ImageEvent = z.infer<typeof imageEventSchema>;
export type ClockCreatePayload = z.infer<typeof clockCreatePayloadSchema>;
export type ClockCreateEvent = z.infer<typeof clockCreateEventSchema>;
export type ClockStartEvent = z.infer<typeof clockStartEventSchema>;
export type ClockPauseEvent = z.infer<typeof clockPauseEventSchema>;
export type ClockAdjustEvent = z.infer<typeof clockAdjustEventSchema>;
export type ClockDestroyEvent = z.infer<typeof clockDestroyEventSchema>;
export type ClockUpdatePayload = z.infer<typeof clockUpdatePayloadSchema>;
export type ClockUpdateEvent = z.infer<typeof clockUpdateEventSchema>;
export type ClockEvent = z.infer<typeof clockEventSchema>;
export type TimeScaleChangedPayload = z.infer<
    typeof timeScaleChangedPayloadSchema
>;
export type TimeScaleChangedEvent = z.infer<typeof timeScaleChangedEventSchema>;
export type TimeEvent = z.infer<typeof timeEventSchema>;
export type WebRTCOfferEvent = z.infer<typeof webrtcOfferEventSchema>;
export type WebRTCAnswerEvent = z.infer<typeof webrtcAnswerEventSchema>;
export type WebRTCIceCandidateEvent = z.infer<
    typeof webrtcIceCandidateEventSchema
>;
export type WebRTCEvent = z.infer<typeof webrtcEventSchema>;
export type ValidatedEvent = z.infer<typeof eventSchema>;
