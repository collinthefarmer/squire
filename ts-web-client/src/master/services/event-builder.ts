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
    }): ImageSetEvent {
        return {
            type: "visual.image.set",
            payload: {
                layer: params.layer,
                imageRef: params.imageRef,
                aspectRatio: params.aspectRatio,
                position: params.position,
                transition: params.transition,
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
}
