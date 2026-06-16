import { BehaviorSubject, type Observable } from "rxjs";
import { Logger } from "@utils/logger";
import { setInMap, updateInMap } from "@utils/state-helpers";
import {
    applyAudioStop,
    updateMatchingTracks,
    applyAudioVolume,
} from "@services/audio-channel-state";
import { generateTrackId } from "@utils/audio-helpers";
import { ServiceRegistry } from "@services/service-registry";
import { TOKENS } from "@services/service-tokens";
import { AudioElementManager } from "./audio-element-manager";
import { AudioEffectChainManager } from "./audio-effect-chain-manager";
import type { EventBus } from "@services/event-bus";
import type { ConfigService } from "@services/config-service";
import type { AudioEffect } from "@types";
import type {
    AudioChannelState,
    AudioTrackState,
    AudioPlayEvent,
    AudioPauseEvent,
    AudioResumeEvent,
    AudioStopEvent,
    AudioVolumeEvent,
} from "@types";

/**
 * Audio service for display client
 *
 * Coordinates audio channel state, delegates playback to
 * AudioElementManager and effect routing to AudioEffectChainManager.
 */
export class DisplayAudioService {
    private logger = new Logger("DisplayAudioService");
    private channels$ = new BehaviorSubject<Map<string, AudioChannelState>>(
        new Map(),
    );
    private elements = new AudioElementManager();
    private effects = new AudioEffectChainManager();
    private apiUrl: string;

    constructor(
        private eventBus: EventBus,
        config: ConfigService,
    ) {
        this.apiUrl = config.getApiUrl();
        this.setupEventListeners();
        this.setupTimeScaleListener();
    }

    getChannels$(): Observable<Map<string, AudioChannelState>> {
        return this.channels$.asObservable();
    }

    getChannels(): Map<string, AudioChannelState> {
        return this.channels$.value;
    }

    getChannel(id: string): AudioChannelState | undefined {
        return this.channels$.value.get(id);
    }

    getAllChannels(): AudioChannelState[] {
        return Array.from(this.channels$.value.values());
    }

    // -- Event setup --

    private setupEventListeners(): void {
        this.eventBus.on("server:system.connected", () => {
            this.logger.info("Resetting audio state for reconnection sync");
            this.elements.stopAll();
            this.channels$.next(new Map());
        });

        this.onAudioEvent<AudioPlayEvent>("audio.play", (e) =>
            this.handlePlay(e),
        );
        this.onAudioEvent<AudioPauseEvent>("audio.pause", (e) =>
            this.handlePause(e),
        );
        this.onAudioEvent<AudioResumeEvent>("audio.resume", (e) =>
            this.handleResume(e),
        );
        this.onAudioEvent<AudioStopEvent>("audio.stop", (e) =>
            this.handleStop(e),
        );
        this.onAudioEvent<AudioVolumeEvent>("audio.volume", (e) =>
            this.handleVolume(e),
        );
        this.onAudioEvent<{ payload: { channel: string; trackId: string; loop: boolean } }>(
            "audio.loop",
            (e) => this.handleLoop(e),
        );
        this.onAudioEvent<{ payload: { channel: string; effects: AudioEffect[] } }>(
            "audio.channel_effects",
            (e) => this.handleChannelEffects(e),
        );
    }

    private onAudioEvent<T>(type: string, handler: (event: T) => void): void {
        this.eventBus.on(`server:${type}`, (event: unknown) => {
            try {
                handler(event as T);
            } catch (error) {
                this.logger.error("Failed to handle audio event", { type, error: String(error) });
            }
        });
    }

    private setupTimeScaleListener(): void {
        this.onAudioEvent<{ payload: { scale: number } }>(
            "time.scale_changed",
            (event) => {
                const { scale } = event.payload;
                this.logger.info("Time scale changed, adjusting audio", { scale });

                for (const [, channel] of this.channels$.value) {
                    for (const [trackId, track] of channel.tracks) {
                        if (!track.respectTimeScale) {
                            continue;
                        }

                        const audio = this.elements.get(trackId);
                        if (!audio) {
                            continue;
                        }

                        if (scale === 0) {
                            audio.pause();
                        } else {
                            audio.playbackRate = scale;
                            if (track.playing && audio.paused && !audio.ended) {
                                audio.play().catch(() => {});
                            }
                        }
                    }
                }
            },
        );
    }

    // -- Event handlers --

    private handlePlay(event: AudioPlayEvent): void {
        const { channel, source, volume, loop, effects, respectTimeScale } =
            event.payload;
        const trackId = event.payload.trackId ?? generateTrackId();

        if (source.type === "live") {
            this.handleLivePlay(trackId, channel, source, volume, effects, respectTimeScale);
            return;
        }

        const eventTimestamp =
            event.metadata.gameTimestamp ?? event.metadata.timestamp;
        const now = Date.now();
        const elapsedSeconds = (now - eventTimestamp) / 1000;
        const startPosition = Math.max(0, elapsedSeconds);

        this.logger.info("Audio play (file)", {
            channel,
            trackId,
            source: source.ref,
            startPosition: startPosition.toFixed(2),
        });

        const audio = this.elements.create(
            trackId,
            channel,
            this.buildAudioUrl(source.ref),
            volume,
            loop,
            startPosition,
        );

        // Wire ended handler for state update
        audio.addEventListener("ended", () => {
            if (loop) {
                return;
            }
            this.logger.info("Audio ended", { channel });
            const updated = updateInMap(this.channels$.value, channel, (ch) => ({
                ...ch,
                playing: false,
            }));
            this.channels$.next(updated);
        });

        if (this.effects.hasChain(channel)) {
            this.effects.routeThroughChain(trackId, audio, channel);
        }

        this.updateChannelState(channel, trackId, {
            id: trackId,
            source,
            playing: true,
            position: startPosition,
            volume: 1.0,
            loop,
            effects: effects || [],
            respectTimeScale,
        }, volume);
    }

    private handleLivePlay(
        trackId: string,
        channel: string,
        source: { type: string; ref: string },
        volume: number,
        effects: { type: string; params: Record<string, unknown> }[] | undefined,
        respectTimeScale: boolean,
    ): void {
        this.logger.info("Audio play (live)", { channel, trackId });

        const receiver = ServiceRegistry.get(TOKENS.WebRTCReceiverService);

        const audio = this.elements.createLive(trackId, channel, volume);

        const sub = receiver.getStream$().subscribe((stream) => {
            if (!stream || audio.srcObject === stream) {
                return;
            }

            audio.srcObject = stream;
            audio.play().catch((err) => {
                this.logger.error("Failed to play live audio", { channel, error: err });
            });
        });

        this.elements.setLiveCleanup(trackId, () => sub.unsubscribe());

        this.updateChannelState(channel, trackId, {
            id: trackId,
            source: source as { type: "file" | "stream" | "live"; ref: string },
            playing: true,
            position: 0,
            volume: 1.0,
            loop: false,
            effects: effects || [],
            respectTimeScale,
        }, volume);
    }

    private updateChannelState(
        channel: string,
        trackId: string,
        track: AudioTrackState,
        volume: number,
    ): void {
        const current = this.channels$.value;
        const existing = current.get(channel);

        const tracks = new Map(existing?.tracks ?? []);
        tracks.set(trackId, track);

        const channelState: AudioChannelState = existing
            ? { ...existing, tracks }
            : { id: channel, tracks, volume, effects: [] };

        const updated = setInMap(current, channel, channelState);
        this.channels$.next(updated);
    }

    private handlePause(event: AudioPauseEvent): void {
        const { channel, trackId } = event.payload;
        this.logger.info("Audio pause", { channel, trackId: trackId ?? "all" });

        const ch = this.channels$.value.get(channel);
        const trackIds = ch ? Array.from(ch.tracks.keys()) : [];

        this.elements.forEachTrackElement(channel, trackId, trackIds, (audio) => {
            audio.pause();
        });

        this.channels$.next(
            updateMatchingTracks(this.channels$.value, channel, trackId, (track) => ({
                ...track,
                playing: false,
            })),
        );
    }

    private handleResume(event: AudioResumeEvent): void {
        const { channel, trackId } = event.payload;
        this.logger.info("Audio resume", { channel, trackId: trackId ?? "all" });

        const ch = this.channels$.value.get(channel);
        const trackIds = ch ? Array.from(ch.tracks.keys()) : [];

        this.elements.forEachTrackElement(channel, trackId, trackIds, (audio) => {
            audio.play().catch((error) => {
                this.logger.error("Failed to resume audio", { channel, error });
            });
        });

        this.channels$.next(
            updateMatchingTracks(this.channels$.value, channel, trackId, (track) => ({
                ...track,
                playing: true,
            })),
        );
    }

    private handleStop(event: AudioStopEvent): void {
        const { channel, trackId } = event.payload;
        this.logger.info("Audio stop", { channel, trackId: trackId ?? "all" });

        if (trackId) {
            this.elements.stopTrack(trackId);
        } else {
            const ch = this.channels$.value.get(channel);
            if (ch) {
                for (const tid of ch.tracks.keys()) {
                    this.elements.stopTrack(tid);
                }
            }
        }

        this.channels$.next(
            applyAudioStop(this.channels$.value, channel, trackId),
        );
    }

    private handleChannelEffects(event: {
        payload: { channel: string; effects: AudioEffect[] };
    }): void {
        const { channel, effects } = event.payload;
        this.logger.info("Channel effects", { channel, count: effects.length });

        const ch = this.channels$.value.get(channel);
        if (ch) {
            const updated = updateInMap(this.channels$.value, channel, (c) => ({
                ...c,
                effects,
            }));
            this.channels$.next(updated);
        }

        const prevEffects = ch?.effects ?? [];

        // Collect channel track audio elements for the effect chain manager
        const channelTracks: [string, HTMLAudioElement][] = [];
        if (ch) {
            for (const tid of ch.tracks.keys()) {
                const audio = this.elements.get(tid);
                if (audio) {
                    channelTracks.push([tid, audio]);
                }
            }
        }

        this.effects.updateChannelEffects(channel, effects, prevEffects, channelTracks);
    }

    private handleLoop(event: {
        payload: { channel: string; trackId: string; loop: boolean };
    }): void {
        const { channel, trackId, loop } = event.payload;
        this.logger.info("Audio loop", { channel, trackId, loop });

        const audio = this.elements.get(trackId);
        if (audio) {
            audio.loop = loop;
        }

        this.channels$.next(
            updateMatchingTracks(this.channels$.value, channel, trackId, (track) => ({
                ...track,
                loop,
            })),
        );
    }

    private handleVolume(event: AudioVolumeEvent): void {
        const { channel, volume, trackId } = event.payload;
        this.logger.info("Audio volume", {
            channel,
            trackId: trackId ?? "channel",
            volume,
        });

        const updated = applyAudioVolume(this.channels$.value, channel, volume, trackId);
        this.channels$.next(updated);

        const ch = updated.get(channel);
        if (!ch) {
            return;
        }

        if (trackId) {
            const audio = this.elements.get(trackId);
            if (audio) {
                audio.volume = volume * ch.volume;
            }
        } else {
            for (const [tid, track] of ch.tracks) {
                const audio = this.elements.get(tid);
                if (audio) {
                    audio.volume = track.volume * volume;
                }
            }
        }
    }

    private buildAudioUrl(ref: string) {
        return `${this.apiUrl}/public/audio/${ref}`;
    }
}
