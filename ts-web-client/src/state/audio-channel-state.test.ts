import { test, expect, describe } from "bun:test";
import {
    applyAudioPlay,
    applyAudioStop,
    applyAudioPause,
    applyAudioResume,
    applyAudioLoop,
    applyAudioVolume,
    applyAudioChannelEffects,
} from "./audio-channel-state";
import type {
    AudioChannelState,
    AudioTrackState,
    ChannelId,
    TrackId,
} from "@types";
import { channelId, trackId } from "@types";
import { makeChannels, makeMetadata, makeTrack } from "../test-utils/factories";

const CH_MUSIC = channelId("music");
const T1 = trackId("t1");
const T2 = trackId("t2");

function playEvent(overrides?: {
    channel?: ChannelId;
    trackId?: TrackId;
    source?: string;
    volume?: number;
    loop?: boolean;
    respectTimeScale?: boolean;
}) {
    return {
        type: "audio.play" as const,
        payload: {
            channel: overrides?.channel ?? CH_MUSIC,
            trackId: overrides?.trackId ?? T1,
            source: {
                type: "file" as const,
                ref: overrides?.source ?? "a.mp3",
            },
            volume: overrides?.volume ?? 1.0,
            loop: overrides?.loop ?? false,
            effects: undefined,
            respectTimeScale: overrides?.respectTimeScale ?? true,
        },
        metadata: makeMetadata(),
    };
}

describe("audio-channel-state reducers", () => {
    describe("applyAudioPlay", () => {
        test("should create channel and track", () => {
            const result = applyAudioPlay(
                new Map(),
                playEvent({
                    source: "song.mp3",
                    volume: 0.8,
                    loop: true,
                    respectTimeScale: false,
                }),
            );

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

            const result = applyAudioPlay(channels, playEvent({ volume: 0.8 }));

            expect(result.get(CH_MUSIC)!.volume).toBe(0.5); // Preserved
            expect(result.get(CH_MUSIC)!.tracks.size).toBe(1);
        });

        test("should not mutate original map", () => {
            const original = new Map<ChannelId, AudioChannelState>();

            applyAudioPlay(original, playEvent());

            expect(original.size).toBe(0);
        });
    });

    describe("applyAudioStop", () => {
        test("should remove entire channel when no trackId", () => {
            const channels = makeChannels([CH_MUSIC, {}]);
            const result = applyAudioStop(channels, {
                type: "audio.stop",
                payload: { channel: CH_MUSIC },
                metadata: makeMetadata(),
            });

            expect(result.has(CH_MUSIC)).toBe(false);
        });

        test("should remove specific track", () => {
            const tracks = new Map<TrackId, AudioTrackState>([
                [
                    T1,
                    makeTrack({
                        id: T1,
                        source: { type: "file", ref: "a.mp3" },
                    }),
                ],
                [
                    T2,
                    makeTrack({
                        id: T2,
                        source: { type: "file", ref: "b.mp3" },
                    }),
                ],
            ]);
            const channels = makeChannels([CH_MUSIC, { tracks }]);

            const result = applyAudioStop(channels, {
                type: "audio.stop",
                payload: { channel: CH_MUSIC, trackId: T1 },
                metadata: makeMetadata(),
            });

            expect(result.get(CH_MUSIC)!.tracks.size).toBe(1);
            expect(result.get(CH_MUSIC)!.tracks.has(T2)).toBe(true);
        });

        test("should remove channel when last track removed", () => {
            const tracks = new Map<TrackId, AudioTrackState>([
                [T1, makeTrack({ id: T1 })],
            ]);
            const channels = makeChannels([CH_MUSIC, { tracks }]);

            const result = applyAudioStop(channels, {
                type: "audio.stop",
                payload: { channel: CH_MUSIC, trackId: T1 },
                metadata: makeMetadata(),
            });

            expect(result.has(CH_MUSIC)).toBe(false);
        });

        test("should return same map for non-existent channel", () => {
            const channels = new Map<ChannelId, AudioChannelState>();
            const result = applyAudioStop(channels, {
                type: "audio.stop",
                payload: { channel: CH_MUSIC, trackId: T1 },
                metadata: makeMetadata(),
            });

            expect(result).toBe(channels);
        });
    });

    describe("applyAudioPause", () => {
        test("should set track to not playing", () => {
            const channels = applyAudioPlay(new Map(), playEvent());

            const result = applyAudioPause(channels, {
                type: "audio.pause",
                payload: { channel: CH_MUSIC, trackId: T1 },
                metadata: makeMetadata(),
            });

            expect(result.get(CH_MUSIC)!.tracks.get(T1)!.playing).toBe(false);
        });

        test("should pause all tracks when no trackId", () => {
            let channels = applyAudioPlay(new Map(), playEvent());
            channels = applyAudioPlay(
                channels,
                playEvent({ trackId: T2, source: "b.mp3" }),
            );

            const result = applyAudioPause(channels, {
                type: "audio.pause",
                payload: { channel: CH_MUSIC },
                metadata: makeMetadata(),
            });

            expect(result.get(CH_MUSIC)!.tracks.get(T1)!.playing).toBe(false);
            expect(result.get(CH_MUSIC)!.tracks.get(T2)!.playing).toBe(false);
        });
    });

    describe("applyAudioResume", () => {
        test("should set track to playing", () => {
            let channels = applyAudioPlay(new Map(), playEvent());
            channels = applyAudioPause(channels, {
                type: "audio.pause",
                payload: { channel: CH_MUSIC, trackId: T1 },
                metadata: makeMetadata(),
            });

            const result = applyAudioResume(channels, {
                type: "audio.resume",
                payload: { channel: CH_MUSIC, trackId: T1 },
                metadata: makeMetadata(),
            });

            expect(result.get(CH_MUSIC)!.tracks.get(T1)!.playing).toBe(true);
        });
    });

    describe("applyAudioLoop", () => {
        test("should set loop flag on track", () => {
            const channels = applyAudioPlay(
                new Map(),
                playEvent({ loop: false }),
            );

            const result = applyAudioLoop(channels, {
                type: "audio.loop",
                payload: { channel: CH_MUSIC, trackId: T1, loop: true },
                metadata: makeMetadata(),
            });

            expect(result.get(CH_MUSIC)!.tracks.get(T1)!.loop).toBe(true);
        });
    });

    describe("applyAudioVolume", () => {
        test("should update channel volume", () => {
            const channels = makeChannels([CH_MUSIC, { volume: 1.0 }]);

            const result = applyAudioVolume(channels, {
                type: "audio.volume",
                payload: { channel: CH_MUSIC, volume: 0.5 },
                metadata: makeMetadata(),
            });

            expect(result.get(CH_MUSIC)!.volume).toBe(0.5);
        });

        test("should update track volume when trackId given", () => {
            const channels = applyAudioPlay(new Map(), playEvent());

            const result = applyAudioVolume(channels, {
                type: "audio.volume",
                payload: { channel: CH_MUSIC, volume: 0.3, trackId: T1 },
                metadata: makeMetadata(),
            });

            expect(result.get(CH_MUSIC)!.tracks.get(T1)!.volume).toBe(0.3);
        });
    });

    describe("applyAudioChannelEffects", () => {
        test("should set channel effects", () => {
            const channels = makeChannels([CH_MUSIC, {}]);
            const effects = [
                { type: "reverb" as const, params: { decay: 3, mix: 0.5 } },
            ];

            const result = applyAudioChannelEffects(channels, {
                type: "audio.channel_effects",
                payload: { channel: CH_MUSIC, effects },
                metadata: makeMetadata(),
            });

            expect(result.get(CH_MUSIC)!.effects).toEqual(effects);
        });
    });
});
