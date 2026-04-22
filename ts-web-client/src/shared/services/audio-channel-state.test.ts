import { test, expect, describe } from "bun:test";
import {
    applyAudioPlay,
    applyAudioStop,
    updateMatchingTracks,
    applyAudioVolume,
    applyAudioChannelEffects,
    forEachMatchingTrack,
} from "./audio-channel-state";
import type { AudioChannelState } from "@types";

function makeChannels(
    ...entries: [string, Partial<AudioChannelState>][]
): Map<string, AudioChannelState> {
    const map = new Map<string, AudioChannelState>();

    for (const [id, overrides] of entries) {
        map.set(id, {
            id,
            tracks: new Map(),
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
                channel: "music",
                trackId: "t1",
                source: { type: "file", ref: "song.mp3" },
                volume: 0.8,
                loop: true,
                respectTimeScale: false,
            });

            const ch = result.get("music")!;
            expect(ch.volume).toBe(0.8);
            expect(ch.tracks.size).toBe(1);

            const track = ch.tracks.get("t1")!;
            expect(track.playing).toBe(true);
            expect(track.source.ref).toBe("song.mp3");
            expect(track.loop).toBe(true);
            expect(track.respectTimeScale).toBe(false);
        });

        test("should add track to existing channel preserving volume", () => {
            const channels = makeChannels(["music", { volume: 0.5 }]);

            const result = applyAudioPlay(channels, {
                channel: "music",
                trackId: "t1",
                source: { type: "file", ref: "a.mp3" },
                volume: 0.8,
                loop: false,
                respectTimeScale: true,
            });

            expect(result.get("music")!.volume).toBe(0.5); // Preserved
            expect(result.get("music")!.tracks.size).toBe(1);
        });

        test("should not mutate original map", () => {
            const original = new Map<string, AudioChannelState>();

            applyAudioPlay(original, {
                channel: "music",
                trackId: "t1",
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
            const channels = makeChannels(["music", {}]);
            const result = applyAudioStop(channels, "music", undefined);

            expect(result.has("music")).toBe(false);
        });

        test("should remove specific track", () => {
            const tracks = new Map([
                ["t1", { id: "t1", source: { type: "file" as const, ref: "a.mp3" }, playing: true, position: 0, volume: 1, loop: false, effects: [], respectTimeScale: true }],
                ["t2", { id: "t2", source: { type: "file" as const, ref: "b.mp3" }, playing: true, position: 0, volume: 1, loop: false, effects: [], respectTimeScale: true }],
            ]);
            const channels = makeChannels(["music", { tracks }]);

            const result = applyAudioStop(channels, "music", "t1");

            expect(result.get("music")!.tracks.size).toBe(1);
            expect(result.get("music")!.tracks.has("t2")).toBe(true);
        });

        test("should remove channel when last track removed", () => {
            const tracks = new Map([
                ["t1", { id: "t1", source: { type: "file" as const, ref: "a.mp3" }, playing: true, position: 0, volume: 1, loop: false, effects: [], respectTimeScale: true }],
            ]);
            const channels = makeChannels(["music", { tracks }]);

            const result = applyAudioStop(channels, "music", "t1");

            expect(result.has("music")).toBe(false);
        });

        test("should return same map for non-existent channel", () => {
            const channels = new Map<string, AudioChannelState>();
            const result = applyAudioStop(channels, "music", "t1");

            expect(result).toBe(channels);
        });
    });

    describe("updateMatchingTracks", () => {
        test("should update specific track", () => {
            const result = applyAudioPlay(new Map(), {
                channel: "music",
                trackId: "t1",
                source: { type: "file", ref: "a.mp3" },
                volume: 1.0,
                loop: false,
                respectTimeScale: true,
            });

            const updated = updateMatchingTracks(result, "music", "t1", (t) => ({
                ...t,
                playing: false,
            }));

            expect(updated.get("music")!.tracks.get("t1")!.playing).toBe(false);
        });

        test("should update all tracks when no trackId", () => {
            let channels = applyAudioPlay(new Map(), {
                channel: "music",
                trackId: "t1",
                source: { type: "file", ref: "a.mp3" },
                volume: 1.0,
                loop: false,
                respectTimeScale: true,
            });
            channels = applyAudioPlay(channels, {
                channel: "music",
                trackId: "t2",
                source: { type: "file", ref: "b.mp3" },
                volume: 1.0,
                loop: false,
                respectTimeScale: true,
            });

            const updated = updateMatchingTracks(channels, "music", undefined, (t) => ({
                ...t,
                playing: false,
            }));

            expect(updated.get("music")!.tracks.get("t1")!.playing).toBe(false);
            expect(updated.get("music")!.tracks.get("t2")!.playing).toBe(false);
        });
    });

    describe("applyAudioVolume", () => {
        test("should update channel volume", () => {
            const channels = makeChannels(["music", { volume: 1.0 }]);

            const result = applyAudioVolume(channels, "music", 0.5, undefined);

            expect(result.get("music")!.volume).toBe(0.5);
        });

        test("should update track volume when trackId given", () => {
            const channels = applyAudioPlay(new Map(), {
                channel: "music",
                trackId: "t1",
                source: { type: "file", ref: "a.mp3" },
                volume: 1.0,
                loop: false,
                respectTimeScale: true,
            });

            const result = applyAudioVolume(channels, "music", 0.3, "t1");

            expect(result.get("music")!.tracks.get("t1")!.volume).toBe(0.3);
        });
    });

    describe("applyAudioChannelEffects", () => {
        test("should set channel effects", () => {
            const channels = makeChannels(["music", {}]);
            const effects = [{ type: "reverb", params: { wet: 0.5 } }];

            const result = applyAudioChannelEffects(channels, "music", effects);

            expect(result.get("music")!.effects).toEqual(effects);
        });
    });

    describe("forEachMatchingTrack", () => {
        test("should iterate specific track when trackId given", () => {
            const channels = applyAudioPlay(new Map(), {
                channel: "music",
                trackId: "t1",
                source: { type: "file", ref: "a.mp3" },
                volume: 1.0,
                loop: false,
                respectTimeScale: true,
            });

            const visited: string[] = [];
            forEachMatchingTrack(channels, "music", "t1", (tid) => visited.push(tid));

            expect(visited).toEqual(["t1"]);
        });

        test("should iterate all tracks when no trackId", () => {
            let channels = applyAudioPlay(new Map(), {
                channel: "music",
                trackId: "t1",
                source: { type: "file", ref: "a.mp3" },
                volume: 1.0,
                loop: false,
                respectTimeScale: true,
            });
            channels = applyAudioPlay(channels, {
                channel: "music",
                trackId: "t2",
                source: { type: "file", ref: "b.mp3" },
                volume: 1.0,
                loop: false,
                respectTimeScale: true,
            });

            const visited: string[] = [];
            forEachMatchingTrack(channels, "music", undefined, (tid) => visited.push(tid));

            expect(visited).toHaveLength(2);
        });

        test("should be no-op for non-existent channel", () => {
            const visited: string[] = [];
            forEachMatchingTrack(new Map(), "music", undefined, (tid) => visited.push(tid));

            expect(visited).toHaveLength(0);
        });
    });
});
