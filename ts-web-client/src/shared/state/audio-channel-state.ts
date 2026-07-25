/**
 * Pure reducer functions for audio channel state
 *
 * Each function takes the current channels map and event payload data,
 * returning a new map. Used by both display and master audio services
 * to keep state update logic DRY and testable.
 *
 * Follows the apply{Domain}{Action} convention from layer-state.ts.
 */

import { setInMap, updateInMap, removeFromMap } from "./state-helpers";
import { generateTrackId } from "@utils/audio-helpers";
import type {
    AudioChannelState,
    AudioTrackState,
    AudioPlayEvent,
    AudioStopEvent,
    AudioPauseEvent,
    AudioResumeEvent,
    AudioLoopEvent,
    AudioVolumeEvent,
    AudioChannelEffectsEvent,
    ChannelId,
    TrackId,
} from "@types";

/**
 * Apply an audio.play event.
 *
 * Creates the channel if it doesn't exist, then adds or replaces the track.
 */
export function applyAudioPlay(
    channels: Map<ChannelId, AudioChannelState>,
    event: AudioPlayEvent,
): Map<ChannelId, AudioChannelState> {
    const { channel, source, volume, loop, effects, respectTimeScale } =
        event.payload;
    const resolvedTrackId = event.payload.trackId ?? generateTrackId();
    const existing = channels.get(channel);

    const newTrack: AudioTrackState = {
        id: resolvedTrackId,
        source,
        playing: true,
        position: 0,
        volume: 1.0,
        loop,
        effects: effects ?? [],
        respectTimeScale,
    };

    const tracks = new Map<TrackId, AudioTrackState>([
        ...(existing?.tracks ?? []),
        [resolvedTrackId, newTrack],
    ]);

    const ch: AudioChannelState = existing
        ? { ...existing, tracks }
        : { id: channel, tracks, volume, effects: [] };

    return setInMap(channels, channel, ch);
}

/**
 * Apply an audio.stop event.
 *
 * Dispatches to applyAudioStopTrack or applyAudioStopChannel
 * based on whether a trackId is present.
 */
export function applyAudioStop(
    channels: Map<ChannelId, AudioChannelState>,
    event: AudioStopEvent,
): Map<ChannelId, AudioChannelState> {
    if (event.payload.trackId) {
        return applyAudioStopTrack(
            channels,
            event.payload.channel,
            event.payload.trackId,
        );
    }

    return applyAudioStopChannel(channels, event.payload.channel);
}

/**
 * Remove an entire channel and all its tracks.
 */
export function applyAudioStopChannel(
    channels: Map<ChannelId, AudioChannelState>,
    channel: ChannelId,
): Map<ChannelId, AudioChannelState> {
    return removeFromMap(channels, channel);
}

/**
 * Remove a specific track from a channel.
 *
 * Removes the channel entirely if it becomes empty after track removal.
 */
export function applyAudioStopTrack(
    channels: Map<ChannelId, AudioChannelState>,
    channel: ChannelId,
    trackId: TrackId,
): Map<ChannelId, AudioChannelState> {
    const ch = channels.get(channel);
    if (!ch) {
        return channels;
    }

    const tracks = new Map(ch.tracks);
    tracks.delete(trackId);

    if (tracks.size === 0) {
        return removeFromMap(channels, channel);
    }

    return updateInMap(channels, channel, () => ({ ...ch, tracks }));
}

/**
 * Update tracks matching a trackId (or all tracks if trackId is undefined).
 *
 * Shared iteration + immutable update pattern used by pause, resume, loop, volume.
 */
function updateMatchingTracks(
    channels: Map<ChannelId, AudioChannelState>,
    channel: ChannelId,
    trackId: TrackId | undefined,
    updater: (track: AudioTrackState) => AudioTrackState,
): Map<ChannelId, AudioChannelState> {
    return updateInMap(channels, channel, (ch) => {
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
 * Apply an audio.pause event.
 *
 * Sets matching tracks to playing=false.
 */
export function applyAudioPause(
    channels: Map<ChannelId, AudioChannelState>,
    event: AudioPauseEvent,
): Map<ChannelId, AudioChannelState> {
    const { channel, trackId } = event.payload;
    return updateMatchingTracks(channels, channel, trackId, (t) => ({
        ...t,
        playing: false,
    }));
}

/**
 * Apply an audio.resume event.
 *
 * Sets matching tracks to playing=true.
 */
export function applyAudioResume(
    channels: Map<ChannelId, AudioChannelState>,
    event: AudioResumeEvent,
): Map<ChannelId, AudioChannelState> {
    const { channel, trackId } = event.payload;
    return updateMatchingTracks(channels, channel, trackId, (t) => ({
        ...t,
        playing: true,
    }));
}

/**
 * Apply an audio.loop event.
 *
 * Sets the track's loop flag.
 */
export function applyAudioLoop(
    channels: Map<ChannelId, AudioChannelState>,
    event: AudioLoopEvent,
): Map<ChannelId, AudioChannelState> {
    const { channel, trackId, loop } = event.payload;
    return updateMatchingTracks(channels, channel, trackId, (t) => ({
        ...t,
        loop,
    }));
}

/**
 * Apply an audio.volume event.
 *
 * When trackId is specified, updates that track's volume.
 * Otherwise updates the channel-level volume.
 */
export function applyAudioVolume(
    channels: Map<ChannelId, AudioChannelState>,
    event: AudioVolumeEvent,
): Map<ChannelId, AudioChannelState> {
    const { channel, volume, trackId } = event.payload;

    if (trackId) {
        return updateMatchingTracks(channels, channel, trackId, (t) => ({
            ...t,
            volume,
        }));
    }

    return updateInMap(channels, channel, (ch) => ({ ...ch, volume }));
}

/**
 * Apply an audio.channel_effects event.
 */
export function applyAudioChannelEffects(
    channels: Map<ChannelId, AudioChannelState>,
    event: AudioChannelEffectsEvent,
): Map<ChannelId, AudioChannelState> {
    const { channel, effects } = event.payload;
    return updateInMap(channels, channel, (ch) => ({ ...ch, effects }));
}
