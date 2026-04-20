import {
    BehaviorSubject,
    interval,
    animationFrameScheduler,
    of,
    type Observable,
} from "rxjs";
import { map, distinctUntilChanged, switchMap } from "rxjs/operators";
import { Logger } from "@utils/logger";
import { generateTrackId } from "@utils/audio-helpers";
import { setInMap, updateInMap, removeFromMap } from "@utils/state-helpers";
import type { EventBus } from "@services/event-bus";
import type { ConnectionService } from "@services/connection-service";
import type { AssetService, AudioAsset } from "./asset-service";
import { EventBuilder } from "./event-builder";
import type {
    AudioChannelState,
    AudioTrackState,
    AudioPlayEvent,
    AudioStopEvent,
    AudioVolumeEvent,
} from "@types";

export interface MixState {
    muted: Set<string>;
    solo: string | null;
}

/**
 * Per-track progress state for computing elapsed playback time.
 *
 * Accounts for pause/resume cycles and time-scale changes.
 * All times are wall-clock milliseconds (Date.now()).
 */
interface TrackProgress {
    playStartTime: number;
    accumulatedMs: number;
    pausedAt: number | null;
    timeScale: number;
    respectTimeScale: boolean;
}

/**
 * Audio state service for master client
 *
 * Maintains a reactive map of channel state by subscribing to
 * server audio events. Components subscribe to channels$ instead
 * of listening to raw events, ensuring a single source of truth.
 *
 * Also tracks per-track progress timing so the timeline can show
 * accurate progress bars that account for pause and time-scale.
 */
export class MasterAudioService {
    private logger = new Logger("MasterAudioService");
    private channels$ = new BehaviorSubject<Map<string, AudioChannelState>>(
        new Map(),
    );
    private mixState$ = new BehaviorSubject<MixState>({
        muted: new Set(),
        solo: null,
    });
    private intendedVolumes = new Map<string, number>();
    private progress = new Map<string, TrackProgress>();
    private currentTimeScale = 1.0;
    private connectionService: ConnectionService;
    private assetService: AssetService;

    constructor(
        eventBus: EventBus,
        connectionService: ConnectionService,
        assetService: AssetService,
    ) {
        this.connectionService = connectionService;
        this.assetService = assetService;
        this.setupEventListeners(eventBus);
    }

    getChannels$(): Observable<Map<string, AudioChannelState>> {
        return this.channels$.asObservable();
    }

    getChannels(): Map<string, AudioChannelState> {
        return this.channels$.value;
    }

    getChannel(channelId: string): AudioChannelState | undefined {
        return this.channels$.value.get(channelId);
    }

    findTrack(trackId: string): AudioTrackState | undefined {
        for (const ch of this.channels$.value.values()) {
            const track = ch.tracks.get(trackId);
            if (track) {
                return track;
            }
        }
        return undefined;
    }

    /**
     * Observable of channel IDs (active + defaults), emitting only
     * when the set of IDs changes.
     */
    getChannelIds$(defaults: string[] = []): Observable<string[]> {
        return this.channels$.pipe(
            map((channels) => {
                const ids = new Set([...defaults, ...channels.keys()]);
                return Array.from(ids).sort();
            }),
            distinctUntilChanged((a, b) => a.join(",") === b.join(",")),
        );
    }

    /**
     * Observable for a specific channel's state.
     * Emits null when the channel is removed.
     */
    getChannel$(channelId: string): Observable<AudioChannelState | null> {
        return this.channels$.pipe(
            map((channels) => channels.get(channelId) ?? null),
            distinctUntilChanged(),
        );
    }

    /**
     * Observable for a specific track's state.
     * Emits null when the track is removed.
     */
    getTrack$(trackId: string): Observable<AudioTrackState | null> {
        return this.channels$.pipe(
            map(() => this.findTrack(trackId) ?? null),
            distinctUntilChanged(),
        );
    }

    /**
     * Observable of elapsed seconds for a track.
     * Emits on every animation frame while playing,
     * a single frozen value when paused, and stops
     * when the track is removed.
     */
    getTrackElapsed$(trackId: string): Observable<number> {
        return this.getTrack$(trackId).pipe(
            switchMap((track) => {
                if (!track) {
                    return of(0);
                }

                if (!track.playing || track.source.type === "live") {
                    return of(this.getTrackElapsed(trackId));
                }

                return interval(0, animationFrameScheduler).pipe(
                    map(() => this.getTrackElapsed(trackId)),
                );
            }),
        );
    }

    /**
     * Compute the current elapsed playback time in seconds for a track,
     * accounting for pause/resume cycles and time-scale.
     */
    getTrackElapsed(trackId: string): number {
        const prog = this.progress.get(trackId);
        if (!prog) {
            return 0;
        }

        const scale = prog.respectTimeScale ? prog.timeScale : 1.0;

        if (prog.pausedAt !== null) {
            return prog.accumulatedMs / 1000;
        }

        const sinceLastResume = (Date.now() - prog.playStartTime) * scale;
        return (prog.accumulatedMs + sinceLastResume) / 1000;
    }

    // -- Commands --

    playAudio(
        channel: string,
        source: string,
        options?: {
            trackId?: string;
            volume?: number;
            loop?: boolean;
            respectTimeScale?: boolean;
        },
    ): void {
        this.connectionService.send(
            EventBuilder.audioPlay({
                channel,
                source,
                trackId: options?.trackId,
                volume: options?.volume,
                loop: options?.loop,
                respectTimeScale: options?.respectTimeScale,
            }),
        );
    }

    pauseAudio(channel: string, trackId?: string): void {
        this.connectionService.send(
            EventBuilder.audioPause({ channel, trackId }),
        );
    }

    resumeAudio(channel: string, trackId?: string): void {
        this.connectionService.send(
            EventBuilder.audioResume({ channel, trackId }),
        );
    }

    stopAudio(channel: string, trackId?: string): void {
        this.connectionService.send(
            EventBuilder.audioStop({ channel, trackId }),
        );
    }

    /**
     * Set channel or track volume. For channel-level volume (no trackId),
     * this updates the intended volume and reapplies mix state so mute/solo
     * are respected. For per-track volume, sends directly.
     */
    setVolume(channel: string, volume: number, trackId?: string): void {
        if (trackId) {
            this.sendVolume(channel, volume, trackId);
            return;
        }

        this.intendedVolumes.set(channel, volume);
        this.applyMixState();
    }

    private sendVolume(
        channel: string,
        volume: number,
        trackId?: string,
    ): void {
        this.connectionService.send(
            EventBuilder.audioVolume({ channel, volume, trackId }),
        );
    }

    // -- Mix controls --

    getMixState$(): Observable<MixState> {
        return this.mixState$.asObservable();
    }

    getMixState(): MixState {
        return this.mixState$.value;
    }

    toggleMute(channel: string): void {
        const current = this.mixState$.value;
        const muted = new Set(current.muted);

        if (muted.has(channel)) {
            muted.delete(channel);
        } else {
            muted.add(channel);
        }

        this.mixState$.next({ ...current, muted });
        this.applyMixState();
    }

    toggleSolo(channel: string): void {
        const current = this.mixState$.value;
        const solo = current.solo === channel ? null : channel;

        this.mixState$.next({ ...current, solo });
        this.applyMixState();
    }

    /**
     * Derive effective volume for every channel from mix state + intended volumes.
     *
     * A channel is silenced if it's muted OR if solo is active and it's not the
     * solo'd channel. Otherwise it plays at its intended volume. This is purely
     * declarative — no saved/restored state to track.
     */
    private applyMixState(): void {
        const { muted, solo } = this.mixState$.value;

        for (const [id] of this.channels$.value) {
            const intended = this.intendedVolumes.get(id) ?? 1.0;
            const silenced = muted.has(id) || (solo !== null && solo !== id);

            this.sendVolume(id, silenced ? 0 : intended);
        }
    }

    // -- Event handlers --

    private setupEventListeners(eventBus: EventBus): void {
        const on = <T>(type: string, handler: (event: T) => void): void => {
            eventBus.on(`server:${type}`, (event: unknown) => {
                handler(event as T);
            });
        };

        on<AudioPlayEvent>("audio.play", (e) => this.handlePlay(e));
        on<AudioStopEvent>("audio.stop", (e) => this.handleStop(e));
        on<{ payload: { channel: string; trackId?: string } }>(
            "audio.pause",
            (e) => this.handlePause(e),
        );
        on<{ payload: { channel: string; trackId?: string } }>(
            "audio.resume",
            (e) => this.handleResume(e),
        );
        on<AudioVolumeEvent>("audio.volume", (e) => this.handleVolume(e));
        on<{ payload: { scale: number } }>("time.scale_changed", (e) =>
            this.handleTimeScaleChanged(e),
        );
    }

    private handlePlay(event: AudioPlayEvent): void {
        const { channel, source, volume, loop, effects, respectTimeScale } =
            event.payload;
        const trackId = event.payload.trackId ?? generateTrackId();

        const current = this.channels$.value;
        const existing = current.get(channel);

        const ch: AudioChannelState = existing
            ? { ...existing, tracks: new Map(existing.tracks) }
            : { id: channel, tracks: new Map(), volume };

        if (!this.intendedVolumes.has(channel)) {
            this.intendedVolumes.set(channel, volume);
        }

        ch.tracks.set(trackId, {
            id: trackId,
            source,
            playing: true,
            position: 0,
            volume: 1.0,
            loop,
            effects: effects ?? [],
            respectTimeScale,
        });

        this.progress.set(trackId, {
            playStartTime: Date.now(),
            accumulatedMs: 0,
            pausedAt: null,
            timeScale: this.currentTimeScale,
            respectTimeScale,
        });

        this.channels$.next(setInMap(current, channel, ch));
    }

    private handleStop(event: AudioStopEvent): void {
        const { channel, trackId } = event.payload;

        if (!trackId) {
            const ch = this.channels$.value.get(channel);
            if (ch) {
                for (const tid of ch.tracks.keys()) {
                    this.progress.delete(tid);
                }
            }
            this.intendedVolumes.delete(channel);
            this.channels$.next(removeFromMap(this.channels$.value, channel));
            return;
        }

        this.progress.delete(trackId);

        const ch = this.channels$.value.get(channel);
        if (!ch) {
            return;
        }

        const tracks = new Map(ch.tracks);
        tracks.delete(trackId);

        if (tracks.size === 0) {
            this.intendedVolumes.delete(channel);
            this.channels$.next(removeFromMap(this.channels$.value, channel));
        } else {
            this.channels$.next(
                updateInMap(this.channels$.value, channel, () => ({
                    ...ch,
                    tracks,
                })),
            );
        }
    }

    private handlePause(event: {
        payload: { channel: string; trackId?: string };
    }): void {
        const { channel, trackId } = event.payload;

        this.forEachMatchingTrack(channel, trackId, (tid) => {
            const prog = this.progress.get(tid);
            if (prog && prog.pausedAt === null) {
                const scale = prog.respectTimeScale ? prog.timeScale : 1.0;
                const sinceLastResume =
                    (Date.now() - prog.playStartTime) * scale;
                prog.accumulatedMs += sinceLastResume;
                prog.pausedAt = Date.now();
            }
        });

        this.updateTrackPlaying(channel, trackId, false);
    }

    private handleResume(event: {
        payload: { channel: string; trackId?: string };
    }): void {
        const { channel, trackId } = event.payload;

        this.forEachMatchingTrack(channel, trackId, (tid) => {
            const prog = this.progress.get(tid);
            if (!prog || prog.pausedAt === null) {
                return;
            }

            // If the track has elapsed past its duration, it finished
            // naturally — resuming restarts it from the beginning
            const track = this.findTrack(tid);
            if (track && !track.loop) {
                const asset = this.findAsset(track.source.ref);
                if (asset && prog.accumulatedMs / 1000 >= asset.duration) {
                    prog.accumulatedMs = 0;
                }
            }

            prog.playStartTime = Date.now();
            prog.pausedAt = null;
        });

        this.updateTrackPlaying(channel, trackId, true);
    }

    private handleVolume(event: AudioVolumeEvent): void {
        const { channel, volume, trackId } = event.payload;

        const ch = this.channels$.value.get(channel);
        if (!ch) {
            return;
        }

        if (trackId) {
            const tracks = new Map(ch.tracks);
            const track = tracks.get(trackId);
            if (track) {
                tracks.set(trackId, { ...track, volume });
                this.channels$.next(
                    updateInMap(this.channels$.value, channel, () => ({
                        ...ch,
                        tracks,
                    })),
                );
            }
        } else {
            this.channels$.next(
                updateInMap(this.channels$.value, channel, () => ({
                    ...ch,
                    volume,
                })),
            );
        }
    }

    private handleTimeScaleChanged(event: {
        payload: { scale: number };
    }): void {
        const newScale = event.payload.scale;
        const now = Date.now();

        // Accumulate elapsed time at the old scale, then start fresh at the new scale
        for (const prog of this.progress.values()) {
            if (!prog.respectTimeScale || prog.pausedAt !== null) {
                continue;
            }

            const sinceLastResume = (now - prog.playStartTime) * prog.timeScale;
            prog.accumulatedMs += sinceLastResume;
            prog.playStartTime = now;
            prog.timeScale = newScale;
        }

        this.currentTimeScale = newScale;
    }

    // -- Helpers --

    private updateTrackPlaying(
        channel: string,
        trackId: string | undefined,
        playing: boolean,
    ): void {
        const ch = this.channels$.value.get(channel);
        if (!ch) {
            return;
        }

        const tracks = new Map(ch.tracks);

        for (const [id, track] of tracks) {
            if (!trackId || id === trackId) {
                tracks.set(id, { ...track, playing });
            }
        }

        this.channels$.next(
            updateInMap(this.channels$.value, channel, () => ({
                ...ch,
                tracks,
            })),
        );
    }

    private findAsset(name: string): AudioAsset | undefined {
        return this.assetService.getAudioAssets().find((a) => a.name === name);
    }

    private forEachMatchingTrack(
        channel: string,
        trackId: string | undefined,
        callback: (trackId: string) => void,
    ): void {
        const ch = this.channels$.value.get(channel);
        if (!ch) {
            return;
        }

        for (const tid of ch.tracks.keys()) {
            if (!trackId || tid === trackId) {
                callback(tid);
            }
        }
    }
}
