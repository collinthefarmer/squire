import type { EventStore } from "@core/events/event-store";
import type { StateStore } from "@core/state/state-store";
import type { ClientRegistry } from "@core/transport/client-registry";
import type {
    AudioPlayEvent,
    AudioPauseEvent,
    AudioResumeEvent,
    AudioStopEvent,
    AudioVolumeEvent,
    AudioLoopEvent,
    AudioChannelEffectsEvent,
    AudioChannelState,
    AudioEvent,
    Event,
} from "@types";
import {
    setAudioChannel,
    updateAudioChannel,
    getAudioChannel,
    getAllAudioChannels,
    removeAudioChannel,
} from "@utils/state-helpers";
import {
    generateTrackId,
    getOrCreateChannel,
    createTrackState,
    updateTracksConditional,
    removeTrack,
    isChannelEmpty,
} from "@utils/audio-helpers";
import { Logger } from "@utils/logger";

const logger = new Logger("AudioService");

/**
 * Audio service handles audio playback events
 *
 * Subscribes to EventStore for audio events and maintains
 * a materialized view in StateStore for quick lookups.
 * Supports multiple simultaneous tracks per channel.
 */
export class AudioService {
    constructor(
        private eventStore: EventStore,
        private stateStore: StateStore,
        private clientRegistry: ClientRegistry,
    ) {
        this.setupEventListeners();
        logger.info("AudioService initialized");
    }

    private setupEventListeners(): void {
        this.eventStore.ofType<AudioEvent>("audio.*").subscribe((event) => {
            try {
                this.handleEvent(event);
            } catch (error) {
                logger.error("Failed to handle audio event", { type: event.type, error: String(error) });
            }
        });
    }

    private readonly handlers: {
        [K in AudioEvent["type"]]: (e: Extract<AudioEvent, { type: K }>) => void;
    } = {
        "audio.play": (e) => this.handlePlay(e),
        "audio.pause": (e) => this.handlePause(e),
        "audio.resume": (e) => this.handleResume(e),
        "audio.stop": (e) => this.handleStop(e),
        "audio.volume": (e) => this.handleVolumeChange(e),
        "audio.loop": (e) => this.handleLoopChange(e),
        "audio.channel_effects": (e) => this.handleChannelEffects(e),
    };

    private handleEvent(event: AudioEvent): void {
        const handler = this.handlers[event.type];
        (handler as (e: AudioEvent) => void)(event);
    }

    private handlePlay(event: AudioPlayEvent): void {
        const { channel, source, volume, loop, effects, respectTimeScale } =
            event.payload;

        const trackId = event.payload.trackId ?? generateTrackId();

        logger.info(
            `Audio play: channel=${channel}, track=${trackId}, source=${source.ref}`,
        );

        const track = createTrackState(trackId, source, {
            loop,
            effects,
            respectTimeScale,
        });

        this.stateStore.updateState((state) => {
            const ch = getOrCreateChannel(
                state.audio?.channels ?? new Map(),
                channel,
                volume,
            );
            const tracks = new Map(ch.tracks);
            tracks.set(trackId, track);
            return setAudioChannel(state, channel, { ...ch, tracks });
        });

        const broadcastEvent: Event = {
            ...event,
            payload: { ...event.payload, trackId },
        };
        this.clientRegistry.broadcast(broadcastEvent);
    }

    private handlePause(event: AudioPauseEvent): void {
        const { channel, trackId } = event.payload;

        logger.info(
            `Audio pause: channel=${channel}, track=${trackId ?? "all"}`,
        );

        this.stateStore.updateState((state) => {
            return updateAudioChannel(state, channel, (ch) => ({
                ...ch,
                tracks: updateTracksConditional(ch.tracks, trackId, (t) => ({
                    ...t,
                    playing: false,
                })),
            }));
        });

        this.clientRegistry.broadcast(event);
    }

    private handleResume(event: AudioResumeEvent): void {
        const { channel, trackId } = event.payload;

        const channelState = this.getChannel(channel);
        if (!channelState) {
            logger.debug(
                `Audio resume: channel=${channel} does not exist, no-op`,
            );
            return;
        }

        logger.info(
            `Audio resume: channel=${channel}, track=${trackId ?? "all"}`,
        );

        this.stateStore.updateState((state) => {
            return updateAudioChannel(state, channel, (ch) => ({
                ...ch,
                tracks: updateTracksConditional(ch.tracks, trackId, (t) => ({
                    ...t,
                    playing: true,
                })),
            }));
        });

        this.clientRegistry.broadcast(event);
    }

    private handleStop(event: AudioStopEvent): void {
        const { channel, trackId } = event.payload;

        logger.info(
            `Audio stop: channel=${channel}, track=${trackId ?? "all"}`,
        );

        this.stateStore.updateState((state) => {
            if (!trackId) {
                return removeAudioChannel(state, channel);
            }

            const ch = getAudioChannel(state, channel);
            if (!ch) {
                return state;
            }

            const updated = removeTrack(ch, trackId);

            if (isChannelEmpty(updated)) {
                return removeAudioChannel(state, channel);
            }

            return setAudioChannel(state, channel, updated);
        });

        this.clientRegistry.broadcast(event);
    }

    private handleVolumeChange(event: AudioVolumeEvent): void {
        const { channel, volume, trackId } = event.payload;

        logger.info(
            `Audio volume: channel=${channel}, track=${trackId ?? "channel"}, volume=${volume}`,
        );

        this.stateStore.updateState((state) => {
            if (trackId) {
                return updateAudioChannel(state, channel, (ch) => ({
                    ...ch,
                    tracks: updateTracksConditional(
                        ch.tracks,
                        trackId,
                        (t) => ({
                            ...t,
                            volume,
                        }),
                    ),
                }));
            }

            const existing = getAudioChannel(state, channel);
            if (!existing) {
                return state;
            }

            return setAudioChannel(state, channel, { ...existing, volume });
        });

        this.clientRegistry.broadcast(event);
    }

    private handleLoopChange(event: AudioLoopEvent): void {
        const { channel, trackId, loop } = event.payload;

        logger.info(`Audio loop: channel=${channel}, track=${trackId}, loop=${loop}`);

        this.stateStore.updateState((state) =>
            updateAudioChannel(state, channel, (ch) => ({
                ...ch,
                tracks: updateTracksConditional(ch.tracks, trackId, (t) => ({
                    ...t,
                    loop,
                })),
            })),
        );

        this.clientRegistry.broadcast(event);
    }

    private handleChannelEffects(event: AudioChannelEffectsEvent): void {
        const { channel, effects } = event.payload;

        logger.info(`Audio channel effects: channel=${channel}, count=${effects.length}`);

        this.stateStore.updateState((state) => {
            const existing = getAudioChannel(state, channel);
            if (!existing) {
                return state;
            }

            return setAudioChannel(state, channel, { ...existing, effects });
        });

        this.clientRegistry.broadcast(event);
    }

    getAllChannels(): AudioChannelState[] {
        const state = this.stateStore.getState();
        if (!state.audio) {
            return [];
        }
        return getAllAudioChannels(state);
    }

    getChannel(channelId: string): AudioChannelState | undefined {
        const state = this.stateStore.getState();
        if (!state.audio) {
            return undefined;
        }
        return getAudioChannel(state, channelId);
    }
}
