import type {
    AudioPlayEvent,
    AudioPauseEvent,
    AudioResumeEvent,
    AudioStopEvent,
    AudioVolumeEvent,
    ImageSetEvent,
    ImageClearEvent,
    ImageTransformEvent,
    ImageEffectEvent,
    ImageLayerConfigEvent,
    AudioEffect,
    ImageEffect,
    ImagePosition,
    ImageTransition,
    AspectRatioMode,
    BlendMode,
    ClockCreateEvent,
    ClockStartEvent,
    ClockPauseEvent,
    ClockAdjustEvent,
    ClockDestroyEvent,
    ClockUpdateEvent,
    TimeScaleChangedEvent,
} from "@types";

/**
 * Event builder service for master client
 *
 * Provides static factory methods for type-safe event construction
 */
export class EventBuilder {
    /**
     * Create audio.play event
     */
    static audioPlay(params: {
        channel: string;
        source: string;
        volume?: number;
        loop?: boolean;
        effects?: AudioEffect[];
        respectTimeScale?: boolean;
    }): AudioPlayEvent {
        return {
            type: "audio.play",
            payload: {
                channel: params.channel,
                source: {
                    type: "file",
                    ref: params.source,
                },
                volume: params.volume ?? 1.0,
                loop: params.loop ?? false,
                effects: params.effects,
                respectTimeScale: params.respectTimeScale ?? true,
            },
            metadata: {
                timestamp: Date.now(),
                source: "master-client",
            },
        };
    }

    /**
     * Create audio.pause event
     */
    static audioPause(params: { channel: string }): AudioPauseEvent {
        return {
            type: "audio.pause",
            payload: {
                channel: params.channel,
            },
            metadata: {
                timestamp: Date.now(),
                source: "master-client",
            },
        };
    }

    /**
     * Create audio.resume event
     */
    static audioResume(params: { channel: string }): AudioResumeEvent {
        return {
            type: "audio.resume",
            payload: {
                channel: params.channel,
            },
            metadata: {
                timestamp: Date.now(),
                source: "master-client",
            },
        };
    }

    /**
     * Create audio.stop event
     */
    static audioStop(params: { channel: string }): AudioStopEvent {
        return {
            type: "audio.stop",
            payload: {
                channel: params.channel,
            },
            metadata: {
                timestamp: Date.now(),
                source: "master-client",
            },
        };
    }

    /**
     * Create audio.volume event
     */
    static audioVolume(params: {
        channel: string;
        volume: number;
    }): AudioVolumeEvent {
        return {
            type: "audio.volume",
            payload: {
                channel: params.channel,
                volume: params.volume,
            },
            metadata: {
                timestamp: Date.now(),
                source: "master-client",
            },
        };
    }

    /**
     * Create visual.image.set event
     */
    static imageSet(params: {
        layer: string;
        imageRef: string;
        aspectRatio: AspectRatioMode;
        position?: ImagePosition;
        transition?: ImageTransition;
        scale?: number;
    }): ImageSetEvent {
        return {
            type: "visual.image.set",
            payload: {
                layer: params.layer,
                imageRef: params.imageRef,
                aspectRatio: params.aspectRatio,
                position: params.position,
                transition: params.transition,
                scale: params.scale,
            },
            metadata: {
                timestamp: Date.now(),
                source: "master-client",
            },
        };
    }

    /**
     * Create visual.image.clear event
     */
    static imageClear(params: {
        layer: string;
        transition?: ImageTransition;
    }): ImageClearEvent {
        return {
            type: "visual.image.clear",
            payload: {
                layer: params.layer,
                transition: params.transition,
            },
            metadata: {
                timestamp: Date.now(),
                source: "master-client",
            },
        };
    }

    /**
     * Create visual.image.transform event
     */
    static imageTransform(params: {
        layer: string;
        position?: ImagePosition;
        scale?: number;
        rotation?: number;
    }): ImageTransformEvent {
        return {
            type: "visual.image.transform",
            payload: {
                layer: params.layer,
                position: params.position,
                scale: params.scale,
                rotation: params.rotation,
            },
            metadata: {
                timestamp: Date.now(),
                source: "master-client",
            },
        };
    }

    /**
     * Create visual.image.effect event
     */
    static imageEffect(params: {
        layer: string;
        effects: ImageEffect[];
        replace: boolean;
    }): ImageEffectEvent {
        return {
            type: "visual.image.effect",
            payload: {
                layer: params.layer,
                effects: params.effects,
                replace: params.replace,
            },
            metadata: {
                timestamp: Date.now(),
                source: "master-client",
            },
        };
    }

    /**
     * Create visual.image.layer_config event
     */
    static layerConfig(params: {
        layer: string;
        blendMode?: BlendMode;
        opacity?: number;
        zIndex?: number;
        visible?: boolean;
    }): ImageLayerConfigEvent {
        return {
            type: "visual.image.layer_config",
            payload: {
                layer: params.layer,
                blendMode: params.blendMode,
                opacity: params.opacity,
                zIndex: params.zIndex,
                visible: params.visible,
            },
            metadata: {
                timestamp: Date.now(),
                source: "master-client",
            },
        };
    }

    // -- Clock events --

    static clockCreate(params: {
        id: string;
        duration: number;
        autoStart?: boolean;
        position?: ImagePosition;
        zIndex?: number;
        respectTimeScale?: boolean;
        visibility?: "always" | "hidden" | "dm-only";
        onComplete?: "persist" | "auto-hide" | "auto-destroy";
    }): ClockCreateEvent {
        return {
            type: "ui.clock.create",
            payload: {
                id: params.id,
                duration: params.duration,
                autoStart: params.autoStart,
                position: params.position,
                zIndex: params.zIndex,
                respectTimeScale: params.respectTimeScale,
                visibility: params.visibility,
                onComplete: params.onComplete,
            },
            metadata: {
                timestamp: Date.now(),
                source: "master-client",
            },
        };
    }

    static clockStart(params: { id: string }): ClockStartEvent {
        return {
            type: "ui.clock.start",
            payload: { id: params.id },
            metadata: {
                timestamp: Date.now(),
                source: "master-client",
            },
        };
    }

    static clockPause(params: { id: string }): ClockPauseEvent {
        return {
            type: "ui.clock.pause",
            payload: { id: params.id },
            metadata: {
                timestamp: Date.now(),
                source: "master-client",
            },
        };
    }

    static clockAdjust(params: { id: string; delta: number }): ClockAdjustEvent {
        return {
            type: "ui.clock.adjust",
            payload: { id: params.id, delta: params.delta },
            metadata: {
                timestamp: Date.now(),
                source: "master-client",
            },
        };
    }

    static clockDestroy(params: { id: string }): ClockDestroyEvent {
        return {
            type: "ui.clock.destroy",
            payload: { id: params.id },
            metadata: {
                timestamp: Date.now(),
                source: "master-client",
            },
        };
    }

    static clockUpdate(params: {
        id: string;
        position?: ImagePosition;
        zIndex?: number;
        visible?: boolean;
    }): ClockUpdateEvent {
        return {
            type: "ui.clock.update",
            payload: {
                id: params.id,
                position: params.position,
                zIndex: params.zIndex,
                visible: params.visible,
            },
            metadata: {
                timestamp: Date.now(),
                source: "master-client",
            },
        };
    }

    // -- Time events --

    static timeScaleChanged(params: { scale: number }): TimeScaleChangedEvent {
        return {
            type: "time.scale_changed",
            payload: { scale: params.scale },
            metadata: {
                timestamp: Date.now(),
                source: "master-client",
            },
        };
    }
}
