import type {
    Event,
    AudioState,
    ImageState,
    AudioChannelState,
    ImageLayerState,
    AudioPlayPayload,
    AudioVolumeEvent,
    ImageSetPayload,
    ImageTransformPayload,
    ImageEffectPayload,
    ImageLayerConfigPayload,
} from "@types";
import {
    generateTrackId,
    getOrCreateChannel,
    createTrackState,
    updateTracksConditional,
    removeTrack,
    isChannelEmpty,
} from "@utils/audio-helpers";

/**
 * Project audio state from an event sequence
 *
 * Takes a sequence of events and derives the current audio state.
 * Used for state materialization and debugging.
 */
export function projectAudioState(events: Event[]): AudioState {
    const channels = new Map<string, AudioChannelState>();

    for (const event of events) {
        const payload = event.payload as { channel: string; trackId?: string };
        const channelId = payload.channel;

        switch (event.type) {
            case "audio.play": {
                const p = event.payload as AudioPlayPayload;
                const trackId = p.trackId ?? generateTrackId();
                const track = createTrackState(trackId, p.source, {
                    loop: p.loop,
                    effects: p.effects,
                    respectTimeScale: p.respectTimeScale,
                });

                const ch = getOrCreateChannel(channels, channelId, p.volume);
                const tracks = new Map(ch.tracks);
                tracks.set(trackId, track);
                channels.set(channelId, { ...ch, tracks });
                break;
            }

            case "audio.pause": {
                const channel = channels.get(channelId);
                if (channel) {
                    channels.set(channelId, {
                        ...channel,
                        tracks: updateTracksConditional(
                            channel.tracks,
                            payload.trackId,
                            (t) => ({ ...t, playing: false }),
                        ),
                    });
                }
                break;
            }

            case "audio.resume": {
                const channel = channels.get(channelId);
                if (channel) {
                    channels.set(channelId, {
                        ...channel,
                        tracks: updateTracksConditional(
                            channel.tracks,
                            payload.trackId,
                            (t) => ({ ...t, playing: true }),
                        ),
                    });
                }
                break;
            }

            case "audio.stop": {
                if (payload.trackId) {
                    const channel = channels.get(channelId);
                    if (channel) {
                        const updated = removeTrack(channel, payload.trackId);
                        if (isChannelEmpty(updated)) {
                            channels.delete(channelId);
                        } else {
                            channels.set(channelId, updated);
                        }
                    }
                } else {
                    channels.delete(channelId);
                }
                break;
            }

            case "audio.volume": {
                const channel = channels.get(channelId);
                if (channel) {
                    const volPayload = (event as AudioVolumeEvent).payload;
                    if (volPayload.trackId) {
                        channels.set(channelId, {
                            ...channel,
                            tracks: updateTracksConditional(
                                channel.tracks,
                                volPayload.trackId,
                                (t) => ({ ...t, volume: volPayload.volume }),
                            ),
                        });
                    } else {
                        channels.set(channelId, {
                            ...channel,
                            volume: volPayload.volume,
                        });
                    }
                }
                break;
            }
        }
    }

    return { channels, masterVolume: 1 };
}

/**
 * Project image state from an event sequence
 *
 * Takes a sequence of events and derives the current image layer state.
 */
export function projectImageState(events: Event[]): ImageState {
    const layers = new Map<string, ImageLayerState>();

    for (const event of events) {
        const payload = event.payload as { layer: string };
        const layerId = payload.layer;

        switch (event.type) {
            case "visual.image.set": {
                const setPayload = event.payload as ImageSetPayload;
                layers.set(layerId, {
                    id: layerId,
                    imageRef: setPayload.imageRef,
                    aspectRatio: setPayload.aspectRatio,
                    position: setPayload.position || {
                        x: "center",
                        y: "center",
                    },
                    scale: 1,
                    rotation: 0,
                    blendMode: "normal",
                    opacity: 1,
                    zIndex: 0,
                    visible: true,
                    effects: [],
                });
                break;
            }

            case "visual.image.clear": {
                layers.delete(layerId);
                break;
            }

            case "visual.image.transform": {
                const layer = layers.get(layerId);
                if (layer) {
                    const transformPayload =
                        event.payload as ImageTransformPayload;
                    layers.set(layerId, {
                        ...layer,
                        position: transformPayload.position ?? layer.position,
                        scale: transformPayload.scale ?? layer.scale,
                        rotation: transformPayload.rotation ?? layer.rotation,
                    });
                }
                break;
            }

            case "visual.image.effect": {
                const layer = layers.get(layerId);
                if (layer) {
                    const effectPayload = event.payload as ImageEffectPayload;
                    const newEffects = effectPayload.replace
                        ? effectPayload.effects
                        : [...layer.effects, ...effectPayload.effects];

                    layers.set(layerId, {
                        ...layer,
                        effects: newEffects,
                    });
                }
                break;
            }

            case "visual.image.layer_config": {
                const layer = layers.get(layerId);
                if (layer) {
                    const configPayload =
                        event.payload as ImageLayerConfigPayload;
                    layers.set(layerId, {
                        ...layer,
                        blendMode: configPayload.blendMode ?? layer.blendMode,
                        opacity: configPayload.opacity ?? layer.opacity,
                        zIndex: configPayload.zIndex ?? layer.zIndex,
                        visible: configPayload.visible ?? layer.visible,
                    });
                }
                break;
            }
        }
    }

    return { layers };
}

/**
 * Calculate audio position from event sequence
 *
 * Given a sequence of play/pause/resume events, calculates the current
 * playback position in seconds.
 */
export function calculateAudioPosition(events: Event[]): number {
    let playTimestamp: number | null = null;
    let pauseTimestamp: number | null = null;
    let accumulatedPauseTime = 0;

    for (const event of events) {
        switch (event.type) {
            case "audio.play":
                playTimestamp = event.metadata.timestamp;
                pauseTimestamp = null;
                accumulatedPauseTime = 0;
                break;

            case "audio.pause":
                pauseTimestamp = event.metadata.timestamp;
                break;

            case "audio.resume":
                if (pauseTimestamp !== null) {
                    accumulatedPauseTime +=
                        event.metadata.timestamp - pauseTimestamp;
                    pauseTimestamp = null;
                }
                break;

            case "audio.stop":
                return 0;
        }
    }

    if (playTimestamp === null) {
        return 0;
    }

    // If currently paused, calculate position at pause time
    if (pauseTimestamp !== null) {
        return (pauseTimestamp - playTimestamp - accumulatedPauseTime) / 1000;
    }

    // If playing, calculate current position
    return (Date.now() - playTimestamp - accumulatedPauseTime) / 1000;
}

/**
 * Determine if audio is currently playing from event sequence
 */
export function isAudioPlaying(events: Event[]): boolean {
    let playing = false;

    for (const event of events) {
        switch (event.type) {
            case "audio.play":
                playing = true;
                break;
            case "audio.pause":
                playing = false;
                break;
            case "audio.resume":
                playing = true;
                break;
            case "audio.stop":
                playing = false;
                break;
        }
    }

    return playing;
}
