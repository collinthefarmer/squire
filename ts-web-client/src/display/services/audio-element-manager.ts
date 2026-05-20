import { Logger } from "@utils/logger";

const logger = new Logger("AudioElementManager");

/**
 * Manages HTMLAudioElement lifecycle: creation, seeking, playback,
 * pausing, stopping, and cleanup.
 *
 * Extracted from AudioService to isolate DOM audio concerns.
 */
export class AudioElementManager {
    /** Audio elements keyed by trackId */
    private audioElements = new Map<string, HTMLAudioElement>();
    /** Track-to-channel mapping for volume/time-scale lookups */
    private trackChannels = new Map<string, string>();
    /** Cleanup callbacks for live audio subscriptions */
    private liveCleanups = new Map<string, () => void>();

    // -- Element access --

    get(trackId: string): HTMLAudioElement | undefined {
        return this.audioElements.get(trackId);
    }

    getChannel(trackId: string): string | undefined {
        return this.trackChannels.get(trackId);
    }

    /** Iterate all trackIds for a given channel */
    *trackIdsForChannel(_channel: string, channelTracks: Iterable<string>): Generator<string> {
        for (const tid of channelTracks) {
            if (this.audioElements.has(tid)) {
                yield tid;
            }
        }
    }

    // -- Lifecycle --

    /**
     * Create and configure an audio element with optional seek-to-position.
     */
    create(
        trackId: string,
        channel: string,
        source: string,
        volume: number,
        loop: boolean,
        startPosition: number = 0,
    ): HTMLAudioElement {
        const audio = new Audio();
        audio.crossOrigin = "anonymous";
        audio.volume = volume;
        audio.loop = loop;
        audio.preload = "auto";

        const play = () => {
            logger.info("Starting audio playback", {
                channel,
                currentTime: audio.currentTime,
            });
            audio.play().catch((error) => {
                logger.error("Failed to play audio", { channel, error });
            });
        };

        if (startPosition > 0) {
            const attemptSeek = () => {
                logger.info("Attempting seek", {
                    channel,
                    duration: audio.duration,
                    targetPosition: startPosition,
                    buffered: this.getBufferedRanges(audio),
                });

                if (this.isPositionBuffered(audio, startPosition)) {
                    audio.currentTime = startPosition;
                    logger.info("Seek successful", {
                        channel,
                        currentTime: audio.currentTime,
                    });
                    play();
                } else {
                    logger.info("Position not buffered yet, waiting...", {
                        channel,
                        targetPosition: startPosition,
                    });
                    audio.addEventListener(
                        "progress",
                        () => {
                            if (this.isPositionBuffered(audio, startPosition)) {
                                audio.currentTime = startPosition;
                                logger.info("Seek successful after buffering", {
                                    channel,
                                    currentTime: audio.currentTime,
                                });
                                play();
                            }
                        },
                        { once: true },
                    );

                    audio.addEventListener(
                        "canplaythrough",
                        () => {
                            if (audio.currentTime !== startPosition) {
                                audio.currentTime = startPosition;
                                logger.info("Seek on canplaythrough", {
                                    channel,
                                    currentTime: audio.currentTime,
                                });
                            }
                            if (audio.paused) {
                                play();
                            }
                        },
                        { once: true },
                    );
                }
            };

            audio.addEventListener("loadedmetadata", attemptSeek, { once: true });
        } else {
            audio.addEventListener("canplay", play, { once: true });
        }

        audio.addEventListener("error", (e) => {
            logger.error("Audio playback error", { channel, source, error: e });
        });

        // Set src after adding event listeners to trigger loading
        audio.src = source;

        this.audioElements.set(trackId, audio);
        this.trackChannels.set(trackId, channel);

        return audio;
    }

    /**
     * Create a live audio element (WebRTC source).
     */
    createLive(
        trackId: string,
        channel: string,
        volume: number,
    ): HTMLAudioElement {
        const audio = new Audio();
        audio.volume = volume;
        audio.autoplay = true;

        this.audioElements.set(trackId, audio);
        this.trackChannels.set(trackId, channel);

        return audio;
    }

    /** Register a cleanup callback for a live audio track */
    setLiveCleanup(trackId: string, cleanup: () => void): void {
        this.liveCleanups.set(trackId, cleanup);
    }

    /**
     * Apply a callback to track audio elements matching a channel
     * and optional trackId. If trackId is undefined, applies to all
     * tracks in the channel.
     */
    forEachTrackElement(
        _channel: string,
        trackId: string | undefined,
        channelTrackIds: Iterable<string>,
        callback: (audio: HTMLAudioElement) => void,
    ): void {
        if (trackId) {
            const audio = this.audioElements.get(trackId);
            if (audio) {
                callback(audio);
            }
            return;
        }

        for (const tid of channelTrackIds) {
            const audio = this.audioElements.get(tid);
            if (audio) {
                callback(audio);
            }
        }
    }

    /**
     * Stop and clean up audio element for a track.
     */
    stopTrack(trackId: string): void {
        try {
            const unsub = this.liveCleanups.get(trackId);
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
            this.liveCleanups.delete(trackId);
            this.audioElements.delete(trackId);
            this.trackChannels.delete(trackId);
        }
    }

    /**
     * Stop and clean up all audio elements.
     */
    stopAll(): void {
        for (const trackId of Array.from(this.audioElements.keys())) {
            this.stopTrack(trackId);
        }
    }

    // -- Private helpers --

    private isPositionBuffered(
        audio: HTMLAudioElement,
        position: number,
    ): boolean {
        for (let i = 0; i < audio.buffered.length; i++) {
            if (
                position >= audio.buffered.start(i) &&
                position <= audio.buffered.end(i)
            ) {
                return true;
            }
        }
        return false;
    }

    private getBufferedRanges(audio: HTMLAudioElement): string {
        const ranges: string[] = [];
        for (let i = 0; i < audio.buffered.length; i++) {
            ranges.push(
                `${audio.buffered.start(i).toFixed(2)}-${audio.buffered.end(i).toFixed(2)}`,
            );
        }
        return ranges.join(", ") || "none";
    }
}
