import type { EventStore } from "@core/events/event-store";
import type { StateStore } from "@core/state/state-store";
import type { ClientRegistry } from "@core/transport/client-registry";
import type {
    AudioPlayEvent,
    AudioPauseEvent,
    AudioResumeEvent,
    AudioStopEvent,
    AudioVolumeEvent,
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
            this.handleEvent(event);
        });
    }

    private handleEvent(event: AudioEvent): void {
        switch (event.type) {
            case "audio.play":
                this.handlePlay(event);
                break;
            case "audio.pause":
                this.handlePause(event);
                break;
            case "audio.resume":
                this.handleResume(event);
                break;
            case "audio.stop":
                this.handleStop(event);
                break;
            case "audio.volume":
                this.handleVolumeChange(event);
                break;
        }
    }

    private handlePlay(event: AudioPlayEvent): void {
        const { channel, source, volume, loop, effects, respectTimeScale } =
            event.payload;

        const trackId = event.payload.trackId ?? generateTrackId();

        logger.info(`Audio play: channel=${channel}, track=${trackId}, source=${source.ref}`);

        const track = createTrackState(trackId, source, {
            loop, effects, respectTimeScale,
        });

        this.stateStore.updateState((state) => {
            const ch = getOrCreateChannel(
                state.audio?.channels ?? new Map(),
                channel,
                volume,
            );
            ch.tracks.set(trackId, track);
            return setAudioChannel(state, channel, ch);
        });

        const broadcastEvent: Event = {
            ...event,
            payload: { ...event.payload, trackId },
        };
        this.clientRegistry.broadcast(broadcastEvent);
    }

    private handlePause(event: AudioPauseEvent): void {
        const { channel, trackId } = event.payload;

        logger.info(`Audio pause: channel=${channel}, track=${trackId ?? "all"}`);

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
            logger.debug(`Audio resume: channel=${channel} does not exist, no-op`);
            return;
        }

        logger.info(`Audio resume: channel=${channel}, track=${trackId ?? "all"}`);

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

        logger.info(`Audio stop: channel=${channel}, track=${trackId ?? "all"}`);

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

        logger.info(`Audio volume: channel=${channel}, track=${trackId ?? "channel"}, volume=${volume}`);

        this.stateStore.updateState((state) => {
            if (trackId) {
                return updateAudioChannel(state, channel, (ch) => ({
                    ...ch,
                    tracks: updateTracksConditional(ch.tracks, trackId, (t) => ({
                        ...t,
                        volume,
                    })),
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
