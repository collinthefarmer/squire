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
} from "@types";
import {
    setAudioChannel,
    updateAudioChannel,
    getAudioChannel,
    getAllAudioChannels,
} from "@utils/state-helpers";
import { Logger } from "@utils/logger";

const logger = new Logger("AudioService");

/**
 * Audio service handles audio playback events
 *
 * Subscribes to EventStore for audio events and maintains
 * a materialized view in StateStore for quick lookups.
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
        // Subscribe to all audio events from EventStore
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

        logger.info(`Audio play: channel=${channel}, source=${source.ref}`);

        // Update materialized view
        this.stateStore.updateState((state) => {
            const channelState: AudioChannelState = {
                id: channel,
                source,
                playing: true,
                position: 0,
                volume,
                loop,
                effects: effects || [],
                respectTimeScale,
            };

            return setAudioChannel(state, channel, channelState);
        });

        // Broadcast to all clients
        this.clientRegistry.broadcast(event);
    }

    private handlePause(event: AudioPauseEvent): void {
        const { channel } = event.payload;

        logger.info(`Audio pause: channel=${channel}`);

        // Update materialized view
        this.stateStore.updateState((state) => {
            return updateAudioChannel(state, channel, (channelState) => ({
                ...channelState,
                playing: false,
            }));
        });

        // Broadcast to all clients
        this.clientRegistry.broadcast(event);
    }

    private handleResume(event: AudioResumeEvent): void {
        const { channel } = event.payload;

        // Check if channel exists and is paused
        const channelState = this.getChannel(channel);
        if (!channelState) {
            logger.debug(`Audio resume: channel=${channel} does not exist, no-op`);
            return;
        }

        if (channelState.playing) {
            logger.debug(`Audio resume: channel=${channel} already playing, no-op`);
            return;
        }

        logger.info(`Audio resume: channel=${channel}`);

        // Update materialized view
        this.stateStore.updateState((state) => {
            return updateAudioChannel(state, channel, (ch) => ({
                ...ch,
                playing: true,
            }));
        });

        // Broadcast to all clients
        this.clientRegistry.broadcast(event);
    }

    private handleStop(event: AudioStopEvent): void {
        const { channel } = event.payload;

        logger.info(`Audio stop: channel=${channel}`);

        // Update materialized view
        this.stateStore.updateState((state) => {
            return updateAudioChannel(state, channel, (channelState) => ({
                ...channelState,
                playing: false,
                position: 0,
            }));
        });

        // Broadcast to all clients
        this.clientRegistry.broadcast(event);
    }

    private handleVolumeChange(event: AudioVolumeEvent): void {
        const { channel, volume } = event.payload;

        logger.info(`Audio volume: channel=${channel}, volume=${volume}`);

        // Update materialized view
        this.stateStore.updateState((state) => {
            return updateAudioChannel(state, channel, (channelState) => ({
                ...channelState,
                volume,
            }));
        });

        // Broadcast to all clients
        this.clientRegistry.broadcast(event);
    }

    /**
     * Get all channels from materialized view
     */
    getAllChannels(): AudioChannelState[] {
        const state = this.stateStore.getState();
        if (!state.audio) {
            return [];
        }
        return getAllAudioChannels(state);
    }

    /**
     * Get channel state from materialized view
     */
    getChannel(channelId: string): AudioChannelState | undefined {
        const state = this.stateStore.getState();
        if (!state.audio) {
            return undefined;
        }
        return getAudioChannel(state, channelId);
    }
}
