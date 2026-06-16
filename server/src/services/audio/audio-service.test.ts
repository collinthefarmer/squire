import { test, expect, describe, beforeEach } from "bun:test";
import { AudioService } from "./audio-service";
import { EventStore } from "@core/events/event-store";
import { StateStore } from "@core/state/state-store";
import { ClientRegistry } from "@core/transport/client-registry";
import { getAudioChannel, getAllAudioChannels } from "@utils/state-helpers";
import { makeMetadata } from "../../test-utils/factories";
import { channelId, trackId } from "@types";

const CH_MUSIC = channelId("music");
const CH_SFX = channelId("sfx");
const T1 = trackId("t1");
const T2 = trackId("t2");

describe("AudioService", () => {
    let eventStore: EventStore;
    let stateStore: StateStore;
    let clientRegistry: ClientRegistry;
    let service: AudioService;

    beforeEach(() => {
        eventStore = new EventStore();
        stateStore = new StateStore();
        clientRegistry = new ClientRegistry();
        service = new AudioService(eventStore, stateStore, clientRegistry);
    });

    describe("handlePlay", () => {
        test("should create channel and track on audio.play", () => {
            eventStore.append({
                type: "audio.play",
                payload: {
                    channel: "music",
                    trackId: "t1",
                    source: { type: "file", ref: "song.mp3" },
                    volume: 0.8,
                    loop: true,
                    respectTimeScale: false,
                },
                metadata: makeMetadata(),
            });

            const channel = getAudioChannel(stateStore.getState(), CH_MUSIC);
            expect(channel).toBeDefined();
            expect(channel!.volume).toBe(0.8);
            expect(channel!.tracks.size).toBe(1);

            const track = channel!.tracks.get(T1);
            expect(track).toBeDefined();
            expect(track!.playing).toBe(true);
            expect(track!.source.ref).toBe("song.mp3");
            expect(track!.loop).toBe(true);
        });

        test("should generate trackId when not provided", () => {
            eventStore.append({
                type: "audio.play",
                payload: {
                    channel: "sfx",
                    source: { type: "file", ref: "boom.mp3" },
                    volume: 1.0,
                    loop: false,
                    respectTimeScale: true,
                },
                metadata: makeMetadata(),
            });

            const channel = getAudioChannel(stateStore.getState(), CH_SFX);
            expect(channel).toBeDefined();
            expect(channel!.tracks.size).toBe(1);
        });

        test("should add multiple tracks to same channel", () => {
            eventStore.append({
                type: "audio.play",
                payload: {
                    channel: "music",
                    trackId: "t1",
                    source: { type: "file", ref: "a.mp3" },
                    volume: 0.5,
                    loop: false,
                    respectTimeScale: true,
                },
                metadata: makeMetadata(),
            });

            eventStore.append({
                type: "audio.play",
                payload: {
                    channel: "music",
                    trackId: "t2",
                    source: { type: "file", ref: "b.mp3" },
                    volume: 0.5,
                    loop: false,
                    respectTimeScale: true,
                },
                metadata: makeMetadata(),
            });

            const channel = getAudioChannel(stateStore.getState(), CH_MUSIC);
            expect(channel!.tracks.size).toBe(2);
        });
    });

    describe("handlePause", () => {
        test("should pause specific track", () => {
            eventStore.append({
                type: "audio.play",
                payload: {
                    channel: "music",
                    trackId: "t1",
                    source: { type: "file", ref: "a.mp3" },
                    volume: 1.0,
                    loop: false,
                    respectTimeScale: true,
                },
                metadata: makeMetadata(),
            });

            eventStore.append({
                type: "audio.pause",
                payload: { channel: "music", trackId: "t1" },
                metadata: makeMetadata(),
            });

            const channel = getAudioChannel(stateStore.getState(), CH_MUSIC);
            expect(channel!.tracks.get(T1)!.playing).toBe(false);
        });

        test("should pause all tracks when no trackId", () => {
            eventStore.append({
                type: "audio.play",
                payload: {
                    channel: "music",
                    trackId: "t1",
                    source: { type: "file", ref: "a.mp3" },
                    volume: 1.0,
                    loop: false,
                    respectTimeScale: true,
                },
                metadata: makeMetadata(),
            });

            eventStore.append({
                type: "audio.pause",
                payload: { channel: "music" },
                metadata: makeMetadata(),
            });

            const channel = getAudioChannel(stateStore.getState(), CH_MUSIC);
            expect(channel!.tracks.get(T1)!.playing).toBe(false);
        });
    });

    describe("handleResume", () => {
        test("should resume paused track", () => {
            eventStore.append({
                type: "audio.play",
                payload: {
                    channel: "music",
                    trackId: "t1",
                    source: { type: "file", ref: "a.mp3" },
                    volume: 1.0,
                    loop: false,
                    respectTimeScale: true,
                },
                metadata: makeMetadata(),
            });

            eventStore.append({
                type: "audio.pause",
                payload: { channel: "music", trackId: "t1" },
                metadata: makeMetadata(),
            });

            eventStore.append({
                type: "audio.resume",
                payload: { channel: "music", trackId: "t1" },
                metadata: makeMetadata(),
            });

            const channel = getAudioChannel(stateStore.getState(), CH_MUSIC);
            expect(channel!.tracks.get(T1)!.playing).toBe(true);
        });

        test("should be no-op for non-existent channel", () => {
            eventStore.append({
                type: "audio.resume",
                payload: { channel: "nonexistent" },
                metadata: makeMetadata(),
            });

            expect(getAllAudioChannels(stateStore.getState())).toHaveLength(0);
        });
    });

    describe("handleStop", () => {
        test("should remove entire channel when no trackId", () => {
            eventStore.append({
                type: "audio.play",
                payload: {
                    channel: "music",
                    trackId: "t1",
                    source: { type: "file", ref: "a.mp3" },
                    volume: 1.0,
                    loop: false,
                    respectTimeScale: true,
                },
                metadata: makeMetadata(),
            });

            eventStore.append({
                type: "audio.stop",
                payload: { channel: "music" },
                metadata: makeMetadata(),
            });

            expect(getAudioChannel(stateStore.getState(), CH_MUSIC)).toBeUndefined();
        });

        test("should remove specific track and clean up empty channel", () => {
            eventStore.append({
                type: "audio.play",
                payload: {
                    channel: "music",
                    trackId: "t1",
                    source: { type: "file", ref: "a.mp3" },
                    volume: 1.0,
                    loop: false,
                    respectTimeScale: true,
                },
                metadata: makeMetadata(),
            });

            eventStore.append({
                type: "audio.stop",
                payload: { channel: "music", trackId: "t1" },
                metadata: makeMetadata(),
            });

            // Channel removed because it became empty
            expect(getAudioChannel(stateStore.getState(), CH_MUSIC)).toBeUndefined();
        });

        test("should keep channel when other tracks remain", () => {
            eventStore.append({
                type: "audio.play",
                payload: {
                    channel: "music",
                    trackId: "t1",
                    source: { type: "file", ref: "a.mp3" },
                    volume: 1.0,
                    loop: false,
                    respectTimeScale: true,
                },
                metadata: makeMetadata(),
            });

            eventStore.append({
                type: "audio.play",
                payload: {
                    channel: "music",
                    trackId: "t2",
                    source: { type: "file", ref: "b.mp3" },
                    volume: 1.0,
                    loop: false,
                    respectTimeScale: true,
                },
                metadata: makeMetadata(),
            });

            eventStore.append({
                type: "audio.stop",
                payload: { channel: "music", trackId: "t1" },
                metadata: makeMetadata(),
            });

            const channel = getAudioChannel(stateStore.getState(), CH_MUSIC);
            expect(channel).toBeDefined();
            expect(channel!.tracks.size).toBe(1);
            expect(channel!.tracks.has(T2)).toBe(true);
        });
    });

    describe("handleVolumeChange", () => {
        test("should update channel volume", () => {
            eventStore.append({
                type: "audio.play",
                payload: {
                    channel: "music",
                    trackId: "t1",
                    source: { type: "file", ref: "a.mp3" },
                    volume: 1.0,
                    loop: false,
                    respectTimeScale: true,
                },
                metadata: makeMetadata(),
            });

            eventStore.append({
                type: "audio.volume",
                payload: { channel: "music", volume: 0.3 },
                metadata: makeMetadata(),
            });

            const channel = getAudioChannel(stateStore.getState(), CH_MUSIC);
            expect(channel!.volume).toBe(0.3);
        });

        test("should update track volume when trackId specified", () => {
            eventStore.append({
                type: "audio.play",
                payload: {
                    channel: "music",
                    trackId: "t1",
                    source: { type: "file", ref: "a.mp3" },
                    volume: 1.0,
                    loop: false,
                    respectTimeScale: true,
                },
                metadata: makeMetadata(),
            });

            eventStore.append({
                type: "audio.volume",
                payload: { channel: "music", volume: 0.5, trackId: "t1" },
                metadata: makeMetadata(),
            });

            const track = getAudioChannel(stateStore.getState(), CH_MUSIC)!
                .tracks.get(T1);
            expect(track!.volume).toBe(0.5);
        });
    });

    describe("handleLoopChange", () => {
        test("should toggle loop on track", () => {
            eventStore.append({
                type: "audio.play",
                payload: {
                    channel: "music",
                    trackId: "t1",
                    source: { type: "file", ref: "a.mp3" },
                    volume: 1.0,
                    loop: false,
                    respectTimeScale: true,
                },
                metadata: makeMetadata(),
            });

            eventStore.append({
                type: "audio.loop",
                payload: { channel: "music", trackId: "t1", loop: true },
                metadata: makeMetadata(),
            });

            const track = getAudioChannel(stateStore.getState(), CH_MUSIC)!
                .tracks.get(T1);
            expect(track!.loop).toBe(true);
        });
    });

    describe("public getters", () => {
        test("getAllChannels should return all channels", () => {
            eventStore.append({
                type: "audio.play",
                payload: {
                    channel: "music",
                    trackId: "t1",
                    source: { type: "file", ref: "a.mp3" },
                    volume: 1.0,
                    loop: false,
                    respectTimeScale: true,
                },
                metadata: makeMetadata(),
            });

            expect(service.getAllChannels()).toHaveLength(1);
        });

        test("getChannel should return specific channel", () => {
            eventStore.append({
                type: "audio.play",
                payload: {
                    channel: "music",
                    trackId: "t1",
                    source: { type: "file", ref: "a.mp3" },
                    volume: 0.7,
                    loop: false,
                    respectTimeScale: true,
                },
                metadata: makeMetadata(),
            });

            const channel = service.getChannel(CH_MUSIC);
            expect(channel).toBeDefined();
            expect(channel!.volume).toBe(0.7);
        });

        test("getChannel should return undefined for missing channel", () => {
            expect(service.getChannel(channelId("nonexistent"))).toBeUndefined();
        });
    });
});
