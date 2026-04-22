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
} from "@types";

/**
 * Apply an audio.play event.
 *
 * Creates the channel if it doesn't exist, then adds or replaces the track.
 */
export function applyAudioPlay(
    channels: Map<string, AudioChannelState>,
    params: {
        channel: string;
        trackId: string;
        source: { type: "file" | "stream" | "live"; ref: string };
        volume: number;
        loop: boolean;
        effects?: AudioEffect[];
        respectTimeScale: boolean;
    },
): Map<string, AudioChannelState> {
    const { channel, trackId, source, volume, loop, effects, respectTimeScale } = params;
    const existing = channels.get(channel);

    const ch: AudioChannelState = existing
        ? { ...existing, tracks: new Map(existing.tracks) }
        : { id: channel, tracks: new Map(), volume, effects: [] };

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

    return setInMap(channels, channel, ch);
}

/**
 * Apply an audio.stop event.
 *
 * Removes the specified track, or the entire channel if no trackId given.
 * Removes the channel entirely if it becomes empty after track removal.
 */
export function applyAudioStop(
    channels: Map<string, AudioChannelState>,
    channel: string,
    trackId: string | undefined,
): Map<string, AudioChannelState> {
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
    channels: Map<string, AudioChannelState>,
    channel: string,
    trackId: string | undefined,
    updater: (track: AudioTrackState) => AudioTrackState,
): Map<string, AudioChannelState> {
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
    channels: Map<string, AudioChannelState>,
    channel: string,
    volume: number,
    trackId: string | undefined,
): Map<string, AudioChannelState> {
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
    channels: Map<string, AudioChannelState>,
    channel: string,
    effects: AudioEffect[],
): Map<string, AudioChannelState> {
    return updateInMap(channels, channel, (ch) => ({ ...ch, effects }));
}

/**
 * Iterate over track IDs matching a trackId filter (or all tracks in channel).
 */
export function forEachMatchingTrack(
    channels: Map<string, AudioChannelState>,
    channel: string,
    trackId: string | undefined,
    callback: (trackId: string) => void,
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
