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

// -- Test Fixtures --

function makeChannel(
    id: string,
    overrides: Partial<AudioChannelState> = {},
): AudioChannelState {
    return {
        id,
        tracks: new Map(),
        volume: 1.0,
        effects: [],
        ...overrides,
    };
}

function makeLayer(
    id: string,
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
                channels: new Map([["music", makeChannel("music")]]),
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
                channels: new Map(),
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
                channels: new Map(),
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
            const channel = makeChannel("ambient");

            const updated = setAudioChannel(state, "ambient", channel);

            expect(getAudioChannel(updated, "ambient")).toEqual(channel);
            expect(getAudioChannel(state, "ambient")).toBeUndefined();
        });

        test("should replace an existing channel", () => {
            const state = setAudioChannel({}, "music", makeChannel("music", { volume: 0.5 }));
            const replacement = makeChannel("music", { volume: 0.8 });

            const updated = setAudioChannel(state, "music", replacement);

            expect(getAudioChannel(updated, "music")?.volume).toBe(0.8);
            expect(getAudioChannel(state, "music")?.volume).toBe(0.5);
        });
    });

    describe("removeAudioChannel", () => {
        test("should remove an existing channel", () => {
            const state = setAudioChannel({}, "music", makeChannel("music"));
            const updated = removeAudioChannel(state, "music");

            expect(getAudioChannel(updated, "music")).toBeUndefined();
            expect(getAudioChannel(state, "music")).toBeDefined();
        });

        test("should be a no-op for non-existent channel", () => {
            const state: ApplicationState = {};
            const updated = removeAudioChannel(state, "nonexistent");

            expect(updated.audio?.channels.size).toBe(0);
        });
    });

    describe("updateAudioChannel", () => {
        test("should update an existing channel immutably", () => {
            const state = setAudioChannel({}, "music", makeChannel("music", { volume: 0.5 }));

            const updated = updateAudioChannel(state, "music", (ch) => ({
                ...ch,
                volume: 0.9,
            }));

            expect(getAudioChannel(updated, "music")?.volume).toBe(0.9);
            expect(getAudioChannel(state, "music")?.volume).toBe(0.5);
        });

        test("should be a no-op for non-existent channel", () => {
            const state: ApplicationState = {};

            const updated = updateAudioChannel(state, "nonexistent", (ch) => ({
                ...ch,
                volume: 0,
            }));

            expect(getAllAudioChannels(updated)).toHaveLength(0);
        });
    });

    describe("updateAudioChannels", () => {
        test("should provide a mutable copy of channels map", () => {
            const state = setAudioChannel({}, "a", makeChannel("a"));

            const updated = updateAudioChannels(state, (channels) => {
                channels.set("b", makeChannel("b"));
                return channels;
            });

            expect(getAudioChannel(updated, "a")).toBeDefined();
            expect(getAudioChannel(updated, "b")).toBeDefined();
            expect(getAudioChannel(state, "b")).toBeUndefined();
        });
    });

    describe("getAudioChannel", () => {
        test("should return undefined for empty state", () => {
            expect(getAudioChannel({}, "music")).toBeUndefined();
        });

        test("should return channel when it exists", () => {
            const channel = makeChannel("music");
            const state = setAudioChannel({}, "music", channel);

            expect(getAudioChannel(state, "music")).toEqual(channel);
        });
    });

    describe("getAllAudioChannels", () => {
        test("should return empty array for empty state", () => {
            expect(getAllAudioChannels({})).toEqual([]);
        });

        test("should return all channels", () => {
            let state: ApplicationState = {};
            state = setAudioChannel(state, "a", makeChannel("a"));
            state = setAudioChannel(state, "b", makeChannel("b"));

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
                layers: new Map([["bg", makeLayer("bg")]]),
            };
            const state: ApplicationState = { image: imageState };

            expect(getImageState(state)).toBe(imageState);
        });
    });

    describe("setImageState", () => {
        test("should set image state immutably", () => {
            const original: ApplicationState = {};
            const imageState: ImageState = { layers: new Map() };

            const updated = setImageState(original, imageState);

            expect(updated.image).toBe(imageState);
            expect(original.image).toBeUndefined();
        });
    });

    describe("setImageLayer", () => {
        test("should add a layer to empty state", () => {
            const layer = makeLayer("background");
            const updated = setImageLayer({}, "background", layer);

            expect(getImageLayer(updated, "background")).toEqual(layer);
        });

        test("should not mutate original state", () => {
            const state: ApplicationState = {};
            setImageLayer(state, "bg", makeLayer("bg"));

            expect(getImageLayer(state, "bg")).toBeUndefined();
        });
    });

    describe("updateImageLayer", () => {
        test("should update existing layer immutably", () => {
            const state = setImageLayer({}, "bg", makeLayer("bg", { opacity: 1.0 }));

            const updated = updateImageLayer(state, "bg", (l) => ({
                ...l,
                opacity: 0.5,
            }));

            expect(getImageLayer(updated, "bg")?.opacity).toBe(0.5);
            expect(getImageLayer(state, "bg")?.opacity).toBe(1.0);
        });

        test("should be a no-op for non-existent layer", () => {
            const updated = updateImageLayer({}, "nope", (l) => ({ ...l, opacity: 0 }));
            expect(getAllImageLayers(updated)).toHaveLength(0);
        });
    });

    describe("removeImageLayer", () => {
        test("should remove an existing layer", () => {
            const state = setImageLayer({}, "bg", makeLayer("bg"));
            const updated = removeImageLayer(state, "bg");

            expect(getImageLayer(updated, "bg")).toBeUndefined();
            expect(getImageLayer(state, "bg")).toBeDefined();
        });
    });

    describe("updateImageLayers", () => {
        test("should provide a mutable copy of layers map", () => {
            const state = setImageLayer({}, "a", makeLayer("a"));

            const updated = updateImageLayers(state, (layers) => {
                layers.set("b", makeLayer("b"));
                return layers;
            });

            expect(getImageLayer(updated, "b")).toBeDefined();
            expect(getImageLayer(state, "b")).toBeUndefined();
        });
    });

    describe("getImageLayer", () => {
        test("should return undefined for empty state", () => {
            expect(getImageLayer({}, "bg")).toBeUndefined();
        });
    });

    describe("getAllImageLayers", () => {
        test("should return empty array for empty state", () => {
            expect(getAllImageLayers({})).toEqual([]);
        });

        test("should return all layers", () => {
            let state: ApplicationState = {};
            state = setImageLayer(state, "a", makeLayer("a"));
            state = setImageLayer(state, "b", makeLayer("b"));

            expect(getAllImageLayers(state)).toHaveLength(2);
        });
    });
});
