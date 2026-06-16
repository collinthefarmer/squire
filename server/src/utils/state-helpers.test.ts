import { test, expect, describe } from "bun:test";
import {
    getAudioState,
    setAudioState,
    updateAudioChannels,
    setAudioChannel,
    removeAudioChannel,
    updateAudioChannel,
    getAudioChannel,
    getAllAudioChannels,
    getImageState,
    setImageState,
    updateImageLayers,
    setImageLayer,
    updateImageLayer,
    getImageLayer,
    getAllImageLayers,
    removeImageLayer,
} from "./state-helpers";
import type {
    ApplicationState,
    AudioChannelState,
    AudioState,
    ImageLayerState,
    ImageState,
} from "../types";
import { channelId, layerId } from "../types";
import type { ChannelId, LayerId, TrackId } from "../types";

// -- Test Fixtures --

function makeChannel(
    id: ChannelId,
    overrides: Partial<AudioChannelState> = {},
): AudioChannelState {
    return {
        id,
        tracks: new Map<TrackId, import("../types").AudioTrackState>(),
        volume: 1.0,
        effects: [],
        ...overrides,
    };
}

function makeLayer(
    id: LayerId,
    overrides: Partial<ImageLayerState> = {},
): ImageLayerState {
    return {
        id,
        imageRef: null,
        aspectRatio: "cover",
        position: { x: "center", y: "center" },
        scale: 1.0,
        rotation: 0,
        blendMode: "normal",
        opacity: 1.0,
        zIndex: 0,
        visible: true,
        effects: [],
        ...overrides,
    };
}

// Convenience branded IDs for tests
const CH_MUSIC = channelId("music");
const CH_AMBIENT = channelId("ambient");
const CH_A = channelId("a");
const CH_B = channelId("b");
const CH_NONEXISTENT = channelId("nonexistent");

const LY_BG = layerId("bg");
const LY_BACKGROUND = layerId("background");
const LY_A = layerId("a");
const LY_B = layerId("b");
const LY_NOPE = layerId("nope");

// -- Audio State Helpers --

describe("Audio State Helpers", () => {
    describe("getAudioState", () => {
        test("should return default audio state when none exists", () => {
            const state: ApplicationState = {};
            const audio = getAudioState(state);

            expect(audio.channels.size).toBe(0);
            expect(audio.masterVolume).toBe(1.0);
        });

        test("should return existing audio state", () => {
            const audioState: AudioState = {
                channels: new Map<ChannelId, AudioChannelState>([[CH_MUSIC, makeChannel(CH_MUSIC)]]),
                masterVolume: 0.5,
            };
            const state: ApplicationState = { audio: audioState };

            expect(getAudioState(state)).toBe(audioState);
        });
    });

    describe("setAudioState", () => {
        test("should set audio state immutably", () => {
            const original: ApplicationState = {};
            const audioState: AudioState = {
                channels: new Map<ChannelId, AudioChannelState>(),
                masterVolume: 0.8,
            };

            const updated = setAudioState(original, audioState);

            expect(updated.audio).toBe(audioState);
            expect(original.audio).toBeUndefined();
        });

        test("should preserve other state fields", () => {
            const original: ApplicationState = {
                time: { scale: 2.0 },
            };
            const audioState: AudioState = {
                channels: new Map<ChannelId, AudioChannelState>(),
                masterVolume: 1.0,
            };

            const updated = setAudioState(original, audioState);

            expect(updated.time).toEqual({ scale: 2.0 });
            expect(updated.audio).toBe(audioState);
        });
    });

    describe("setAudioChannel", () => {
        test("should add a channel to empty state", () => {
            const state: ApplicationState = {};
            const channel = makeChannel(CH_AMBIENT);

            const updated = setAudioChannel(state, CH_AMBIENT, channel);

            expect(getAudioChannel(updated, CH_AMBIENT)).toEqual(channel);
            expect(getAudioChannel(state, CH_AMBIENT)).toBeUndefined();
        });

        test("should replace an existing channel", () => {
            const state = setAudioChannel({}, CH_MUSIC, makeChannel(CH_MUSIC, { volume: 0.5 }));
            const replacement = makeChannel(CH_MUSIC, { volume: 0.8 });

            const updated = setAudioChannel(state, CH_MUSIC, replacement);

            expect(getAudioChannel(updated, CH_MUSIC)?.volume).toBe(0.8);
            expect(getAudioChannel(state, CH_MUSIC)?.volume).toBe(0.5);
        });
    });

    describe("removeAudioChannel", () => {
        test("should remove an existing channel", () => {
            const state = setAudioChannel({}, CH_MUSIC, makeChannel(CH_MUSIC));
            const updated = removeAudioChannel(state, CH_MUSIC);

            expect(getAudioChannel(updated, CH_MUSIC)).toBeUndefined();
            expect(getAudioChannel(state, CH_MUSIC)).toBeDefined();
        });

        test("should be a no-op for non-existent channel", () => {
            const state: ApplicationState = {};
            const updated = removeAudioChannel(state, CH_NONEXISTENT);

            expect(updated.audio?.channels.size).toBe(0);
        });
    });

    describe("updateAudioChannel", () => {
        test("should update an existing channel immutably", () => {
            const state = setAudioChannel({}, CH_MUSIC, makeChannel(CH_MUSIC, { volume: 0.5 }));

            const updated = updateAudioChannel(state, CH_MUSIC, (ch) => ({
                ...ch,
                volume: 0.9,
            }));

            expect(getAudioChannel(updated, CH_MUSIC)?.volume).toBe(0.9);
            expect(getAudioChannel(state, CH_MUSIC)?.volume).toBe(0.5);
        });

        test("should be a no-op for non-existent channel", () => {
            const state: ApplicationState = {};

            const updated = updateAudioChannel(state, CH_NONEXISTENT, (ch) => ({
                ...ch,
                volume: 0,
            }));

            expect(getAllAudioChannels(updated)).toHaveLength(0);
        });
    });

    describe("updateAudioChannels", () => {
        test("should provide a mutable copy of channels map", () => {
            const state = setAudioChannel({}, CH_A, makeChannel(CH_A));

            const updated = updateAudioChannels(state, (channels) => {
                channels.set(CH_B, makeChannel(CH_B));
                return channels;
            });

            expect(getAudioChannel(updated, CH_A)).toBeDefined();
            expect(getAudioChannel(updated, CH_B)).toBeDefined();
            expect(getAudioChannel(state, CH_B)).toBeUndefined();
        });
    });

    describe("getAudioChannel", () => {
        test("should return undefined for empty state", () => {
            expect(getAudioChannel({}, CH_MUSIC)).toBeUndefined();
        });

        test("should return channel when it exists", () => {
            const channel = makeChannel(CH_MUSIC);
            const state = setAudioChannel({}, CH_MUSIC, channel);

            expect(getAudioChannel(state, CH_MUSIC)).toEqual(channel);
        });
    });

    describe("getAllAudioChannels", () => {
        test("should return empty array for empty state", () => {
            expect(getAllAudioChannels({})).toEqual([]);
        });

        test("should return all channels", () => {
            let state: ApplicationState = {};
            state = setAudioChannel(state, CH_A, makeChannel(CH_A));
            state = setAudioChannel(state, CH_B, makeChannel(CH_B));

            const channels = getAllAudioChannels(state);
            expect(channels).toHaveLength(2);
        });
    });
});

// -- Image State Helpers --

describe("Image State Helpers", () => {
    describe("getImageState", () => {
        test("should return default image state when none exists", () => {
            const image = getImageState({});
            expect(image.layers.size).toBe(0);
        });

        test("should return existing image state", () => {
            const imageState: ImageState = {
                layers: new Map<LayerId, ImageLayerState>([[LY_BG, makeLayer(LY_BG)]]),
            };
            const state: ApplicationState = { image: imageState };

            expect(getImageState(state)).toBe(imageState);
        });
    });

    describe("setImageState", () => {
        test("should set image state immutably", () => {
            const original: ApplicationState = {};
            const imageState: ImageState = { layers: new Map<LayerId, ImageLayerState>() };

            const updated = setImageState(original, imageState);

            expect(updated.image).toBe(imageState);
            expect(original.image).toBeUndefined();
        });
    });

    describe("setImageLayer", () => {
        test("should add a layer to empty state", () => {
            const layer = makeLayer(LY_BACKGROUND);
            const updated = setImageLayer({}, LY_BACKGROUND, layer);

            expect(getImageLayer(updated, LY_BACKGROUND)).toEqual(layer);
        });

        test("should not mutate original state", () => {
            const state: ApplicationState = {};
            setImageLayer(state, LY_BG, makeLayer(LY_BG));

            expect(getImageLayer(state, LY_BG)).toBeUndefined();
        });
    });

    describe("updateImageLayer", () => {
        test("should update existing layer immutably", () => {
            const state = setImageLayer({}, LY_BG, makeLayer(LY_BG, { opacity: 1.0 }));

            const updated = updateImageLayer(state, LY_BG, (l) => ({
                ...l,
                opacity: 0.5,
            }));

            expect(getImageLayer(updated, LY_BG)?.opacity).toBe(0.5);
            expect(getImageLayer(state, LY_BG)?.opacity).toBe(1.0);
        });

        test("should be a no-op for non-existent layer", () => {
            const updated = updateImageLayer({}, LY_NOPE, (l) => ({ ...l, opacity: 0 }));
            expect(getAllImageLayers(updated)).toHaveLength(0);
        });
    });

    describe("removeImageLayer", () => {
        test("should remove an existing layer", () => {
            const state = setImageLayer({}, LY_BG, makeLayer(LY_BG));
            const updated = removeImageLayer(state, LY_BG);

            expect(getImageLayer(updated, LY_BG)).toBeUndefined();
            expect(getImageLayer(state, LY_BG)).toBeDefined();
        });
    });

    describe("updateImageLayers", () => {
        test("should provide a mutable copy of layers map", () => {
            const state = setImageLayer({}, LY_A, makeLayer(LY_A));

            const updated = updateImageLayers(state, (layers) => {
                layers.set(LY_B, makeLayer(LY_B));
                return layers;
            });

            expect(getImageLayer(updated, LY_B)).toBeDefined();
            expect(getImageLayer(state, LY_B)).toBeUndefined();
        });
    });

    describe("getImageLayer", () => {
        test("should return undefined for empty state", () => {
            expect(getImageLayer({}, LY_BG)).toBeUndefined();
        });
    });

    describe("getAllImageLayers", () => {
        test("should return empty array for empty state", () => {
            expect(getAllImageLayers({})).toEqual([]);
        });

        test("should return all layers", () => {
            let state: ApplicationState = {};
            state = setImageLayer(state, LY_A, makeLayer(LY_A));
            state = setImageLayer(state, LY_B, makeLayer(LY_B));

            expect(getAllImageLayers(state)).toHaveLength(2);
        });
    });
});
