import { test, expect, describe } from "bun:test";
import {
    applyAudioPlay,
    applyAudioStop,
    updateMatchingTracks,
    applyAudioVolume,
    applyAudioChannelEffects,
    forEachMatchingTrack,
} from "./audio-channel-state";
import type { AudioChannelState, AudioTrackState } from "@types";
import { channelId, trackId } from "@types";
import type { ChannelId, TrackId } from "@types";

const CH_MUSIC = channelId("music");
const T1 = trackId("t1");
const T2 = trackId("t2");

function makeChannels(
    ...entries: [ChannelId, Partial<AudioChannelState>][]
): Map<ChannelId, AudioChannelState> {
    const map = new Map<ChannelId, AudioChannelState>();

    for (const [id, overrides] of entries) {
        map.set(id, {
            id,
            tracks: new Map<TrackId, AudioTrackState>(),
            volume: 1.0,
            effects: [],
            ...overrides,
        });
    }

    return map;
}

describe("audio-channel-state reducers", () => {
    describe("applyAudioPlay", () => {
        test("should create channel and track", () => {
            const result = applyAudioPlay(new Map(), {
                channel: CH_MUSIC,
                trackId: T1,
                source: { type: "file", ref: "song.mp3" },
                volume: 0.8,
                loop: true,
                respectTimeScale: false,
            });

            const ch = result.get(CH_MUSIC)!;
            expect(ch.volume).toBe(0.8);
            expect(ch.tracks.size).toBe(1);

            const track = ch.tracks.get(T1)!;
            expect(track.playing).toBe(true);
            expect(track.source.ref).toBe("song.mp3");
            expect(track.loop).toBe(true);
            expect(track.respectTimeScale).toBe(false);
        });

        test("should add track to existing channel preserving volume", () => {
            const channels = makeChannels([CH_MUSIC, { volume: 0.5 }]);

            const result = applyAudioPlay(channels, {
                channel: CH_MUSIC,
                trackId: T1,
                source: { type: "file", ref: "a.mp3" },
                volume: 0.8,
                loop: false,
                respectTimeScale: true,
            });

            expect(result.get(CH_MUSIC)!.volume).toBe(0.5); // Preserved
            expect(result.get(CH_MUSIC)!.tracks.size).toBe(1);
        });

        test("should not mutate original map", () => {
            const original = new Map<ChannelId, AudioChannelState>();

            applyAudioPlay(original, {
                channel: CH_MUSIC,
                trackId: T1,
                source: { type: "file", ref: "a.mp3" },
                volume: 1.0,
                loop: false,
                respectTimeScale: true,
            });

            expect(original.size).toBe(0);
        });
    });

    describe("applyAudioStop", () => {
        test("should remove entire channel when no trackId", () => {
            const channels = makeChannels([CH_MUSIC, {}]);
            const result = applyAudioStop(channels, CH_MUSIC, undefined);

            expect(result.has(CH_MUSIC)).toBe(false);
        });

        test("should remove specific track", () => {
            const tracks = new Map<TrackId, AudioTrackState>([
                [T1, { id: T1, source: { type: "file" as const, ref: "a.mp3" }, playing: true, position: 0, volume: 1, loop: false, effects: [], respectTimeScale: true }],
                [T2, { id: T2, source: { type: "file" as const, ref: "b.mp3" }, playing: true, position: 0, volume: 1, loop: false, effects: [], respectTimeScale: true }],
            ]);
            const channels = makeChannels([CH_MUSIC, { tracks }]);

            const result = applyAudioStop(channels, CH_MUSIC, T1);

            expect(result.get(CH_MUSIC)!.tracks.size).toBe(1);
            expect(result.get(CH_MUSIC)!.tracks.has(T2)).toBe(true);
        });

        test("should remove channel when last track removed", () => {
            const tracks = new Map<TrackId, AudioTrackState>([
                [T1, { id: T1, source: { type: "file" as const, ref: "a.mp3" }, playing: true, position: 0, volume: 1, loop: false, effects: [], respectTimeScale: true }],
            ]);
            const channels = makeChannels([CH_MUSIC, { tracks }]);

            const result = applyAudioStop(channels, CH_MUSIC, T1);

            expect(result.has(CH_MUSIC)).toBe(false);
        });

        test("should return same map for non-existent channel", () => {
            const channels = new Map<ChannelId, AudioChannelState>();
            const result = applyAudioStop(channels, CH_MUSIC, T1);

            expect(result).toBe(channels);
        });
    });

    describe("updateMatchingTracks", () => {
        test("should update specific track", () => {
            const result = applyAudioPlay(new Map(), {
                channel: CH_MUSIC,
                trackId: T1,
                source: { type: "file", ref: "a.mp3" },
                volume: 1.0,
                loop: false,
                respectTimeScale: true,
            });

            const updated = updateMatchingTracks(result, CH_MUSIC, T1, (t) => ({
                ...t,
                playing: false,
            }));

            expect(updated.get(CH_MUSIC)!.tracks.get(T1)!.playing).toBe(false);
        });

        test("should update all tracks when no trackId", () => {
            let channels = applyAudioPlay(new Map(), {
                channel: CH_MUSIC,
                trackId: T1,
                source: { type: "file", ref: "a.mp3" },
                volume: 1.0,
                loop: false,
                respectTimeScale: true,
            });
            channels = applyAudioPlay(channels, {
                channel: CH_MUSIC,
                trackId: T2,
                source: { type: "file", ref: "b.mp3" },
                volume: 1.0,
                loop: false,
                respectTimeScale: true,
            });

            const updated = updateMatchingTracks(channels, CH_MUSIC, undefined, (t) => ({
                ...t,
                playing: false,
            }));

            expect(updated.get(CH_MUSIC)!.tracks.get(T1)!.playing).toBe(false);
            expect(updated.get(CH_MUSIC)!.tracks.get(T2)!.playing).toBe(false);
        });
    });

    describe("applyAudioVolume", () => {
        test("should update channel volume", () => {
            const channels = makeChannels([CH_MUSIC, { volume: 1.0 }]);

            const result = applyAudioVolume(channels, CH_MUSIC, 0.5, undefined);

            expect(result.get(CH_MUSIC)!.volume).toBe(0.5);
        });

        test("should update track volume when trackId given", () => {
            const channels = applyAudioPlay(new Map(), {
                channel: CH_MUSIC,
                trackId: T1,
                source: { type: "file", ref: "a.mp3" },
                volume: 1.0,
                loop: false,
                respectTimeScale: true,
            });

            const result = applyAudioVolume(channels, CH_MUSIC, 0.3, T1);

            expect(result.get(CH_MUSIC)!.tracks.get(T1)!.volume).toBe(0.3);
        });
    });

    describe("applyAudioChannelEffects", () => {
        test("should set channel effects", () => {
            const channels = makeChannels([CH_MUSIC, {}]);
            const effects = [{ type: "reverb" as const, params: { decay: 3, mix: 0.5 } }];

            const result = applyAudioChannelEffects(channels, CH_MUSIC, effects);

            expect(result.get(CH_MUSIC)!.effects).toEqual(effects);
        });
    });

    describe("forEachMatchingTrack", () => {
        test("should iterate specific track when trackId given", () => {
            const channels = applyAudioPlay(new Map(), {
                channel: CH_MUSIC,
                trackId: T1,
                source: { type: "file", ref: "a.mp3" },
                volume: 1.0,
                loop: false,
                respectTimeScale: true,
            });

            const visited: string[] = [];
            forEachMatchingTrack(channels, CH_MUSIC, T1, (tid) => visited.push(tid));

            expect(visited).toEqual(["t1"]);
        });

        test("should iterate all tracks when no trackId", () => {
            let channels = applyAudioPlay(new Map(), {
                channel: CH_MUSIC,
                trackId: T1,
                source: { type: "file", ref: "a.mp3" },
                volume: 1.0,
                loop: false,
                respectTimeScale: true,
            });
            channels = applyAudioPlay(channels, {
                channel: CH_MUSIC,
                trackId: T2,
                source: { type: "file", ref: "b.mp3" },
                volume: 1.0,
                loop: false,
                respectTimeScale: true,
            });

            const visited: string[] = [];
            forEachMatchingTrack(channels, CH_MUSIC, undefined, (tid) => visited.push(tid));

            expect(visited).toHaveLength(2);
        });

        test("should be no-op for non-existent channel", () => {
            const visited: string[] = [];
            forEachMatchingTrack(new Map(), CH_MUSIC, undefined, (tid) => visited.push(tid));

            expect(visited).toHaveLength(0);
        });
    });
});
