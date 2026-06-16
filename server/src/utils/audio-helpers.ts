import type {
    AudioChannelState,
    AudioTrackState,
    AudioEffect,
    ChannelId,
    TrackId,
} from "@types";
import { trackId } from "@types";

/**
 * Generate a unique track ID
 */
export function generateTrackId(): TrackId {
    return trackId(`track-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`);
}

/**
 * Get an existing channel or create a new one with the given volume.
 * Returns a new object with a copied tracks map (safe for mutation).
 */
export function getOrCreateChannel(
    channels: ReadonlyMap<ChannelId, AudioChannelState>,
    channelId: ChannelId,
    volume: number,
): AudioChannelState {
    const existing = channels.get(channelId);

    if (existing) {
        return { ...existing, tracks: new Map(existing.tracks) };
    }

    return { id: channelId, tracks: new Map<TrackId, AudioTrackState>(), volume, effects: [] };
}

/**
 * Update tracks matching a trackId (or all tracks if trackId is undefined).
 * Returns a new Map.
 */
export function updateTracksConditional(
    tracks: ReadonlyMap<TrackId, AudioTrackState>,
    targetTrackId: TrackId | undefined,
    updater: (track: AudioTrackState) => AudioTrackState,
): Map<TrackId, AudioTrackState> {
    const updated = new Map(tracks);

    for (const [id, track] of updated) {
        if (!targetTrackId || id === targetTrackId) {
            updated.set(id, updater(track));
        }
    }

    return updated;
}

/**
 * Remove a track from a channel. Returns the updated channel.
 */
export function removeTrack(
    channel: AudioChannelState,
    targetTrackId: TrackId,
): AudioChannelState {
    const tracks = new Map(channel.tracks);
    tracks.delete(targetTrackId);
    return { ...channel, tracks };
}

/**
 * Check if a channel has no tracks.
 */
export function isChannelEmpty(channel: AudioChannelState): boolean {
    return channel.tracks.size === 0;
}

/**
 * Check if any track in the channel is currently playing.
 */
export function hasAnyPlaying(channel: AudioChannelState): boolean {
    for (const track of channel.tracks.values()) {
        if (track.playing) {
            return true;
        }
    }
    return false;
}

/**
 * Create a default AudioTrackState for a new play event.
 */
export function createTrackState(
    id: TrackId,
    source: { type: "file" | "stream" | "live"; ref: string },
    options: {
        volume?: number;
        loop?: boolean;
        effects?: AudioEffect[];
        respectTimeScale?: boolean;
    },
): AudioTrackState {
    return {
        id,
        source,
        playing: true,
        position: 0,
        volume: options.volume ?? 1.0,
        loop: options.loop ?? false,
        effects: options.effects ?? [],
        respectTimeScale: options.respectTimeScale ?? true,
    };
}
