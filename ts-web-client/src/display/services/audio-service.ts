import { BehaviorSubject, type Observable } from "rxjs";
import { Logger } from "@utils/logger";
import { setInMap, updateInMap, removeFromMap } from "@utils/state-helpers";
import type { EventBus } from "@services/event-bus";
import type { ConfigService } from "@services/config-service";
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
    private audioElements = new Map<string, HTMLAudioElement>();
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
        this.eventBus.on("server:audio.*", (event: any) => {
            this.handleAudioEvent(event);
        });
    }

    /**
     * Adjust audio playback rate when time scale changes.
     * Channels with respectTimeScale=true play at the new rate.
     * Scale 0 pauses; resuming restores the last non-zero rate.
     */
    private setupTimeScaleListener(): void {
        this.eventBus.on("server:time.scale_changed", (event: unknown) => {
            const { scale } = (event as { payload: { scale: number } }).payload;
            this.logger.info("Time scale changed, adjusting audio", { scale });

            for (const [channel, state] of this.channels$.value) {
                if (!state.respectTimeScale) {
                    continue;
                }

                const audio = this.audioElements.get(channel);
                if (!audio) {
                    continue;
                }

                if (scale === 0) {
                    audio.pause();
                } else {
                    audio.playbackRate = scale;
                    if (state.playing && audio.paused) {
                        audio.play().catch(() => {});
                    }
                }
            }
        });
    }

    /**
     * Route audio events to appropriate handlers
     */
    private handleAudioEvent(event: any): void {
        switch (event.type) {
            case "audio.play":
                this.handlePlay(event as AudioPlayEvent);
                break;
            case "audio.pause":
                this.handlePause(event as AudioPauseEvent);
                break;
            case "audio.resume":
                this.handleResume(event as AudioResumeEvent);
                break;
            case "audio.stop":
                this.handleStop(event as AudioStopEvent);
                break;
            case "audio.volume":
                this.handleVolume(event as AudioVolumeEvent);
                break;
        }
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

        // Calculate elapsed time from event timestamp for sync
        // Event timestamp is when audio originally started playing
        const eventTimestamp = event.metadata.timestamp;
        const now = Date.now();
        const elapsedSeconds = (now - eventTimestamp) / 1000;

        // Use elapsed time as start position, but clamp to reasonable values
        // (negative would mean future, very large would mean event is stale)
        const startPosition = Math.max(0, elapsedSeconds);

        this.logger.info("Audio play", {
            channel,
            source: source.ref,
            eventTimestamp,
            now,
            elapsedSeconds: elapsedSeconds.toFixed(2),
            startPosition: startPosition.toFixed(2),
        });

        this.stopAudio(channel);

        const audio = this.createAudioElement(
            channel,
            this.buildAudioUrl(source.ref),
            volume,
            loop,
            startPosition,
        );

        this.audioElements.set(channel, audio);

        // Don't call play() here - createAudioElement handles it after seeking

        const channelState: AudioChannelState = {
            id: channel,
            source,
            playing: true,
            position: startPosition,
            volume,
            loop,
            effects: effects || [],
            respectTimeScale,
        };

        const updated = setInMap(this.channels$.value, channel, channelState);
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
        const { channel } = event.payload;

        this.logger.info("Audio pause", { channel });

        const audio = this.audioElements.get(channel);
        let currentPosition = 0;

        if (audio) {
            audio.pause();
            currentPosition = audio.currentTime;
        }

        const updated = updateInMap(this.channels$.value, channel, (ch) => ({
            ...ch,
            playing: false,
            position: currentPosition,
        }));

        this.channels$.next(updated);
    }

    /**
     * Handle audio.resume event
     */
    private handleResume(event: AudioResumeEvent): void {
        const { channel } = event.payload;

        this.logger.info("Audio resume", { channel });

        const audio = this.audioElements.get(channel);
        if (audio) {
            audio.play().catch((error) => {
                this.logger.error("Failed to resume audio", { channel, error });
            });
        }

        const updated = updateInMap(this.channels$.value, channel, (ch) => ({
            ...ch,
            playing: true,
        }));

        this.channels$.next(updated);
    }

    /**
     * Handle audio.stop event
     */
    private handleStop(event: AudioStopEvent): void {
        const { channel } = event.payload;

        this.logger.info("Audio stop", { channel });

        this.stopAudio(channel);

        const updated = removeFromMap(this.channels$.value, channel);
        this.channels$.next(updated);
    }

    /**
     * Handle audio.volume event
     */
    private handleVolume(event: AudioVolumeEvent): void {
        const { channel, volume } = event.payload;

        this.logger.info("Audio volume", { channel, volume });

        const audio = this.audioElements.get(channel);
        if (audio) {
            audio.volume = volume;
        }

        const updated = updateInMap(this.channels$.value, channel, (ch) => ({
            ...ch,
            volume,
        }));

        this.channels$.next(updated);
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
    private stopAudio(channel: string): void {
        const audio = this.audioElements.get(channel);
        if (audio) {
            audio.pause();
            audio.currentTime = 0;
            audio.src = "";
            this.audioElements.delete(channel);
        }
    }

    private buildAudioUrl(ref: string) {
        return `${this.apiUrl}/public/audio/${ref}`;
    }
}
