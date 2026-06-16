/**
 * Pure reducer functions for audio channel state
 *
 * Each function takes the current channels map and event payload data,
 * returning a new map. Used by both display and master audio services
 * to keep state update logic DRY and testable.
 *
 * Follows the apply{Domain}{Action} convention from layer-state.ts.
 */

import { setInMap, updateInMap, removeFromMap } from "@utils/state-helpers";
import type {
    AudioChannelState,
    AudioTrackState,
    AudioEffect,
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
    params: {
        channel: ChannelId;
        trackId: TrackId;
        source: { type: "file" | "stream" | "live"; ref: string };
        volume: number;
        loop: boolean;
        effects?: AudioEffect[];
        respectTimeScale: boolean;
    },
): Map<ChannelId, AudioChannelState> {
    const { channel, trackId, source, volume, loop, effects, respectTimeScale } = params;
    const existing = channels.get(channel);

    const tracks = new Map<TrackId, AudioTrackState>(existing?.tracks ?? []);
    tracks.set(trackId, {
        id: trackId,
        source,
        playing: true,
        position: 0,
        volume: 1.0,
        loop,
        effects: effects ?? [],
        respectTimeScale,
    });

    const ch: AudioChannelState = existing
        ? { ...existing, tracks }
        : { id: channel, tracks, volume, effects: [] };

    return setInMap(channels, channel, ch);
}

/**
 * Apply an audio.stop event.
 *
 * Removes the specified track, or the entire channel if no trackId given.
 * Removes the channel entirely if it becomes empty after track removal.
 */
export function applyAudioStop(
    channels: Map<ChannelId, AudioChannelState>,
    channel: ChannelId,
    trackId: TrackId | undefined,
): Map<ChannelId, AudioChannelState> {
    if (!trackId) {
        return removeFromMap(channels, channel);
    }

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
export function updateMatchingTracks(
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
 * Apply an audio.volume event.
 *
 * When trackId is specified, updates that track's volume.
 * Otherwise updates the channel-level volume.
 */
export function applyAudioVolume(
    channels: Map<ChannelId, AudioChannelState>,
    channel: ChannelId,
    volume: number,
    trackId: TrackId | undefined,
): Map<ChannelId, AudioChannelState> {
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
    channel: ChannelId,
    effects: AudioEffect[],
): Map<ChannelId, AudioChannelState> {
    return updateInMap(channels, channel, (ch) => ({ ...ch, effects }));
}

/**
 * Iterate over track IDs matching a trackId filter (or all tracks in channel).
 */
export function forEachMatchingTrack(
    channels: Map<ChannelId, AudioChannelState>,
    channel: ChannelId,
    trackId: TrackId | undefined,
    callback: (trackId: TrackId) => void,
): void {
    const ch = channels.get(channel);
    if (!ch) {
        return;
    }

    for (const tid of ch.tracks.keys()) {
        if (!trackId || tid === trackId) {
            callback(tid);
        }
    }
}
