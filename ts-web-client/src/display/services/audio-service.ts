import { BehaviorSubject, type Observable } from "rxjs";
import { Logger } from "@utils/logger";
import { setInMap, updateInMap, removeFromMap } from "@utils/state-helpers";
import { generateTrackId } from "@utils/audio-helpers";
import { ServiceRegistry } from "@services/service-registry";
import type { EventBus } from "@services/event-bus";
import type { ConfigService } from "@services/config-service";
import type { WebRTCReceiverService } from "@display/services/webrtc-receiver-service";
import type {
    AudioChannelState,
    AudioPlayEvent,
    AudioPauseEvent,
    AudioResumeEvent,
    AudioStopEvent,
    AudioVolumeEvent,
} from "@types";

/**
 * Audio service for display client
 *
 * Manages audio channel state, subscribes to server events,
 * and provides observables for components to render
 */
export class AudioService {
    private logger = new Logger("AudioService");
    private channels$ = new BehaviorSubject<Map<string, AudioChannelState>>(
        new Map(),
    );
    /** Audio elements keyed by trackId */
    private audioElements = new Map<string, HTMLAudioElement>();
    /** Track-to-channel mapping for volume/time-scale lookups */
    private trackChannels = new Map<string, string>();
    private liveSubscriptions = new Map<string, () => void>();
    private apiUrl: string;

    constructor(
        private eventBus: EventBus,
        private config: ConfigService,
    ) {
        this.apiUrl = config.getApiUrl();
        this.setupEventListeners();
        this.setupTimeScaleListener();
    }

    /**
     * Get channels observable
     */
    getChannels$(): Observable<Map<string, AudioChannelState>> {
        return this.channels$.asObservable();
    }

    /**
     * Get current channels value
     */
    getChannels(): Map<string, AudioChannelState> {
        return this.channels$.value;
    }

    /**
     * Get current channel state
     */
    getChannel(id: string): AudioChannelState | undefined {
        return this.channels$.value.get(id);
    }

    /**
     * Get all channels
     */
    getAllChannels(): AudioChannelState[] {
        return Array.from(this.channels$.value.values());
    }

    /**
     * Setup event listeners for server events
     */
    private setupEventListeners(): void {
        this.onAudioEvent<AudioPlayEvent>("audio.play", (e) => this.handlePlay(e));
        this.onAudioEvent<AudioPauseEvent>("audio.pause", (e) => this.handlePause(e));
        this.onAudioEvent<AudioResumeEvent>("audio.resume", (e) => this.handleResume(e));
        this.onAudioEvent<AudioStopEvent>("audio.stop", (e) => this.handleStop(e));
        this.onAudioEvent<AudioVolumeEvent>("audio.volume", (e) => this.handleVolume(e));
    }

    /**
     * Typed event subscription — consolidates the any→T cast
     * to a single documented location.
     */
    private onAudioEvent<T>(type: string, handler: (event: T) => void): void {
        this.eventBus.on(`server:${type}`, (event: unknown) => {
            handler(event as T);
        });
    }

    /**
     * Adjust audio playback rate when time scale changes.
     * Channels with respectTimeScale=true play at the new rate.
     * Scale 0 pauses; resuming restores the last non-zero rate.
     */
    private setupTimeScaleListener(): void {
        this.onAudioEvent<{ payload: { scale: number } }>("time.scale_changed", (event) => {
            const { scale } = event.payload;
            this.logger.info("Time scale changed, adjusting audio", { scale });

            for (const [, channel] of this.channels$.value) {
                for (const [trackId, track] of channel.tracks) {
                    if (!track.respectTimeScale) {
                        continue;
                    }

                    const audio = this.audioElements.get(trackId);
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
        });
    }

    /**
     * Handle audio.play event
     *
     * Calculates start position from event timestamp for time synchronization.
     * When a new client connects, replayed events retain their original timestamps,
     * allowing the client to start playback at the correct position.
     */
    private handlePlay(event: AudioPlayEvent): void {
        const { channel, source, volume, loop, effects, respectTimeScale } =
            event.payload;
        const trackId = event.payload.trackId ?? generateTrackId();

        if (source.type === "live") {
            this.handleLivePlay(trackId, channel, source, volume, effects, respectTimeScale);
            return;
        }

        const eventTimestamp = event.metadata.gameTimestamp ?? event.metadata.timestamp;
        const now = Date.now();
        const elapsedSeconds = (now - eventTimestamp) / 1000;
        const startPosition = Math.max(0, elapsedSeconds);

        this.logger.info("Audio play (file)", {
            channel, trackId,
            source: source.ref,
            startPosition: startPosition.toFixed(2),
        });

        const audio = this.createAudioElement(
            trackId,
            this.buildAudioUrl(source.ref),
            volume,
            loop,
            startPosition,
        );

        this.audioElements.set(trackId, audio);
        this.trackChannels.set(trackId, channel);

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

        const receiver = ServiceRegistry.get<WebRTCReceiverService>("WebRTCReceiverService");

        const audio = new Audio();
        audio.volume = volume;
        audio.autoplay = true;

        const existingStream = receiver.getStream();
        if (existingStream) {
            audio.srcObject = existingStream;
            audio.play().catch((err) => {
                this.logger.error("Failed to play live audio", { channel, error: err });
            });
        }

        const sub = receiver.getStream$().subscribe((stream) => {
            if (!stream) {
                return;
            }
            audio.srcObject = stream;
            audio.play().catch((err) => {
                this.logger.error("Failed to play live audio", { channel, error: err });
            });
        });

        this.audioElements.set(trackId, audio);
        this.trackChannels.set(trackId, channel);
        this.liveSubscriptions.set(trackId, () => sub.unsubscribe());

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
        track: AudioChannelState extends { tracks: Map<string, infer T> } ? T : never,
        volume: number,
    ): void {
        const current = this.channels$.value;
        const existing = current.get(channel);

        const channelState: AudioChannelState = existing
            ? { ...existing, tracks: new Map(existing.tracks) }
            : { id: channel, tracks: new Map(), volume };

        channelState.tracks.set(trackId, track);

        const updated = setInMap(current, channel, channelState);
        this.channels$.next(updated);
    }

    /**
     * Handle audio.pause event
     *
     * When receiving a pause event during replay, the event timestamp indicates
     * when the audio was paused. For live events, we use the audio element's
     * current position.
     */
    private handlePause(event: AudioPauseEvent): void {
        const { channel, trackId } = event.payload;

        this.logger.info("Audio pause", { channel, trackId: trackId ?? "all" });

        this.forEachTrackElement(channel, trackId, (audio) => {
            audio.pause();
        });

        const updated = this.updateTracks(channel, trackId, (track) => ({
            ...track,
            playing: false,
        }));
        this.channels$.next(updated);
    }

    private handleResume(event: AudioResumeEvent): void {
        const { channel, trackId } = event.payload;

        this.logger.info("Audio resume", { channel, trackId: trackId ?? "all" });

        this.forEachTrackElement(channel, trackId, (audio) => {
            audio.play().catch((error) => {
                this.logger.error("Failed to resume audio", { channel, error });
            });
        });

        const updated = this.updateTracks(channel, trackId, (track) => ({
            ...track,
            playing: true,
        }));
        this.channels$.next(updated);
    }

    private handleStop(event: AudioStopEvent): void {
        const { channel, trackId } = event.payload;

        this.logger.info("Audio stop", { channel, trackId: trackId ?? "all" });

        if (trackId) {
            this.stopTrack(trackId);

            const ch = this.channels$.value.get(channel);
            if (ch) {
                const tracks = new Map(ch.tracks);
                tracks.delete(trackId);

                const updated = tracks.size === 0
                    ? removeFromMap(this.channels$.value, channel)
                    : updateInMap(this.channels$.value, channel, () => ({ ...ch, tracks }));
                this.channels$.next(updated);
            }
        } else {
            // Stop all tracks on the channel
            const ch = this.channels$.value.get(channel);
            if (ch) {
                for (const tid of ch.tracks.keys()) {
                    this.stopTrack(tid);
                }
            }

            const updated = removeFromMap(this.channels$.value, channel);
            this.channels$.next(updated);
        }
    }

    private handleVolume(event: AudioVolumeEvent): void {
        const { channel, volume, trackId } = event.payload;

        this.logger.info("Audio volume", { channel, trackId: trackId ?? "channel", volume });

        // Update state first, then apply computed volumes from the updated state
        if (trackId) {
            const updated = updateInMap(this.channels$.value, channel, (c) => {
                const tracks = new Map(c.tracks);
                const track = tracks.get(trackId);
                if (track) {
                    tracks.set(trackId, { ...track, volume });
                }
                return { ...c, tracks };
            });
            this.channels$.next(updated);

            const ch = updated.get(channel);
            const audio = this.audioElements.get(trackId);
            if (audio && ch) {
                audio.volume = volume * ch.volume;
            }
        } else {
            const updated = updateInMap(this.channels$.value, channel, (c) => ({
                ...c,
                volume,
            }));
            this.channels$.next(updated);

            const ch = updated.get(channel);
            if (ch) {
                for (const [tid, track] of ch.tracks) {
                    const audio = this.audioElements.get(tid);
                    if (audio) {
                        audio.volume = track.volume * volume;
                    }
                }
            }
        }
    }

    /**
     * Apply a callback to track audio elements matching a channel
     * and optional trackId. If trackId is undefined, applies to all
     * tracks in the channel.
     */
    private forEachTrackElement(
        channel: string,
        trackId: string | undefined,
        callback: (audio: HTMLAudioElement) => void,
    ): void {
        if (trackId) {
            const audio = this.audioElements.get(trackId);
            if (audio) {
                callback(audio);
            }
            return;
        }

        const ch = this.channels$.value.get(channel);
        if (!ch) {
            return;
        }

        for (const tid of ch.tracks.keys()) {
            const audio = this.audioElements.get(tid);
            if (audio) {
                callback(audio);
            }
        }
    }

    /**
     * Update track states within a channel, returning the new channels map.
     */
    private updateTracks(
        channel: string,
        trackId: string | undefined,
        updater: (track: import("@types").AudioTrackState) => import("@types").AudioTrackState,
    ): Map<string, AudioChannelState> {
        return updateInMap(this.channels$.value, channel, (ch) => {
            const tracks = new Map(ch.tracks);

            for (const [id, track] of tracks) {
                if (!trackId || id === trackId) {
                    tracks.set(id, updater(track));
                }
            }

            return { ...ch, tracks };
        });
    }

    /**
     * Create and configure audio element for a channel
     *
     * For seeking to work reliably, we need to:
     * 1. Wait for enough data to be buffered
     * 2. Set currentTime
     * 3. Verify the seek succeeded
     * 4. Then play
     */
    private createAudioElement(
        channel: string,
        source: string,
        volume: number,
        loop: boolean,
        startPosition: number = 0,
    ): HTMLAudioElement {
        const audio = new Audio();
        audio.volume = volume;
        audio.loop = loop;
        audio.preload = "auto";

        const play = () => {
            this.logger.info("Starting audio playback", {
                channel,
                currentTime: audio.currentTime,
            });
            audio.play().catch((error) => {
                this.logger.error("Failed to play audio", { channel, error });
            });
        };

        if (startPosition > 0) {
            // For seeking, we need to wait for enough data to be buffered
            const attemptSeek = () => {
                this.logger.info("Attempting seek", {
                    channel,
                    duration: audio.duration,
                    targetPosition: startPosition,
                    buffered: this.getBufferedRanges(audio),
                });

                // Check if target position is buffered
                if (this.isPositionBuffered(audio, startPosition)) {
                    audio.currentTime = startPosition;
                    this.logger.info("Seek successful", {
                        channel,
                        currentTime: audio.currentTime,
                    });
                    play();
                } else {
                    // Wait for more data to buffer
                    this.logger.info("Position not buffered yet, waiting...", {
                        channel,
                        targetPosition: startPosition,
                    });
                    audio.addEventListener("progress", () => {
                        if (this.isPositionBuffered(audio, startPosition)) {
                            audio.currentTime = startPosition;
                            this.logger.info("Seek successful after buffering", {
                                channel,
                                currentTime: audio.currentTime,
                            });
                            play();
                        }
                    }, { once: true });

                    // Fallback: if canplaythrough fires, we should have enough data
                    audio.addEventListener("canplaythrough", () => {
                        if (audio.currentTime !== startPosition) {
                            audio.currentTime = startPosition;
                            this.logger.info("Seek on canplaythrough", {
                                channel,
                                currentTime: audio.currentTime,
                            });
                        }
                        if (audio.paused) {
                            play();
                        }
                    }, { once: true });
                }
            };

            audio.addEventListener("loadedmetadata", attemptSeek, { once: true });
        } else {
            // No seeking needed, play when ready
            audio.addEventListener("canplay", play, { once: true });
        }

        audio.addEventListener("error", (e) => {
            this.logger.error("Audio playback error", {
                channel,
                source,
                error: e,
            });
        });

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

        // Set src after adding event listeners to trigger loading
        audio.src = source;

        return audio;
    }

    /**
     * Check if a position is within the buffered ranges
     */
    private isPositionBuffered(audio: HTMLAudioElement, position: number): boolean {
        for (let i = 0; i < audio.buffered.length; i++) {
            if (position >= audio.buffered.start(i) && position <= audio.buffered.end(i)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Get buffered ranges as a string for logging
     */
    private getBufferedRanges(audio: HTMLAudioElement): string {
        const ranges: string[] = [];
        for (let i = 0; i < audio.buffered.length; i++) {
            ranges.push(`${audio.buffered.start(i).toFixed(2)}-${audio.buffered.end(i).toFixed(2)}`);
        }
        return ranges.join(", ") || "none";
    }

    /**
     * Stop and clean up audio element for a channel
     */
    private stopTrack(trackId: string): void {
        try {
            const unsub = this.liveSubscriptions.get(trackId);
            if (unsub) {
                unsub();
            }

            const audio = this.audioElements.get(trackId);
            if (audio) {
                audio.pause();
                audio.srcObject = null;
                audio.currentTime = 0;
                audio.src = "";
            }
        } finally {
            this.liveSubscriptions.delete(trackId);
            this.audioElements.delete(trackId);
            this.trackChannels.delete(trackId);
        }
    }

    private buildAudioUrl(ref: string) {
        return `${this.apiUrl}/public/audio/${ref}`;
    }
}
