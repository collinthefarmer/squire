import { test, expect, describe, mock } from "bun:test";
import { AppStore } from "./store";
import { EventBus } from "./event-bus";
import { channelId, trackId, layerId, clockId, imageRef } from "@types";
import type { DomainEvent, AudioChannelState, ImageLayerState } from "@types";
import type { ClockState } from "@state/clock-state";
import { makeMetadata } from "@test-utils/factories";

function createStore() {
    const eventBus = new EventBus();
    const sendToServer = mock<(event: DomainEvent) => void>(() => {});
    const store = new AppStore(eventBus, sendToServer);
    return { store, eventBus, sendToServer };
}

const CH = channelId("music");
const T1 = trackId("t1");
const BG = layerId("bg");

function audioPlayEvent(
    channel = CH,
    tid = T1,
): DomainEvent {
    return {
        type: "audio.play",
        payload: {
            channel,
            trackId: tid,
            source: { type: "file", ref: "a.mp3" },
            volume: 0.8,
            loop: false,
            respectTimeScale: true,
        },
        metadata: makeMetadata(),
    };
}

describe("AppStore", () => {
    describe("applyEvent", () => {
        test("should apply audio.play to channels state", () => {
            const { store } = createStore();

            store.applyEvent(audioPlayEvent());

            expect(store.channels.size).toBe(1);
            expect(store.channels.get(CH)!.tracks.get(T1)!.playing).toBe(true);
        });

        test("should apply audio.pause to channels state", () => {
            const { store } = createStore();
            store.applyEvent(audioPlayEvent());

            store.applyEvent({
                type: "audio.pause",
                payload: { channel: CH, trackId: T1 },
                metadata: makeMetadata(),
            });

            expect(store.channels.get(CH)!.tracks.get(T1)!.playing).toBe(
                false,
            );
        });

        test("should apply audio.resume to channels state", () => {
            const { store } = createStore();
            store.applyEvent(audioPlayEvent());
            store.applyEvent({
                type: "audio.pause",
                payload: { channel: CH, trackId: T1 },
                metadata: makeMetadata(),
            });

            store.applyEvent({
                type: "audio.resume",
                payload: { channel: CH, trackId: T1 },
                metadata: makeMetadata(),
            });

            expect(store.channels.get(CH)!.tracks.get(T1)!.playing).toBe(true);
        });

        test("should apply audio.stop to channels state", () => {
            const { store } = createStore();
            store.applyEvent(audioPlayEvent());

            store.applyEvent({
                type: "audio.stop",
                payload: { channel: CH },
                metadata: makeMetadata(),
            });

            expect(store.channels.size).toBe(0);
        });

        test("should apply audio.volume to channels state", () => {
            const { store } = createStore();
            store.applyEvent(audioPlayEvent());

            store.applyEvent({
                type: "audio.volume",
                payload: { channel: CH, volume: 0.3, trackId: T1 },
                metadata: makeMetadata(),
            });

            expect(store.channels.get(CH)!.tracks.get(T1)!.volume).toBe(0.3);
        });

        test("should apply audio.loop to channels state", () => {
            const { store } = createStore();
            store.applyEvent(audioPlayEvent());

            store.applyEvent({
                type: "audio.loop",
                payload: { channel: CH, trackId: T1, loop: true },
                metadata: makeMetadata(),
            });

            expect(store.channels.get(CH)!.tracks.get(T1)!.loop).toBe(true);
        });

        test("should apply visual.image.set to layers state", () => {
            const { store } = createStore();

            store.applyEvent({
                type: "visual.image.set",
                payload: {
                    layer: BG,
                    imageRef: imageRef("forest.png"),
                    aspectRatio: "cover",
                },
                metadata: makeMetadata(),
            });

            expect(store.layers.size).toBe(1);
            expect(store.layers.get(BG)!.imageRef).toBe(imageRef("forest.png"));
        });

        test("should apply visual.image.clear to layers state", () => {
            const { store } = createStore();
            store.applyEvent({
                type: "visual.image.set",
                payload: {
                    layer: BG,
                    imageRef: imageRef("forest.png"),
                    aspectRatio: "cover",
                },
                metadata: makeMetadata(),
            });

            store.applyEvent({
                type: "visual.image.clear",
                payload: { layer: BG },
                metadata: makeMetadata(),
            });

            expect(store.layers.size).toBe(0);
        });

        test("should apply ui.clock.create to clocks state", () => {
            const { store } = createStore();

            store.applyEvent({
                type: "ui.clock.create",
                payload: { id: clockId("c1"), duration: 60000 },
                metadata: makeMetadata(),
            });

            expect(store.clocks.size).toBe(1);
            expect(store.clocks.get(clockId("c1"))!.duration).toBe(60000);
        });

        test("should apply ui.clock.destroy to clocks state", () => {
            const { store } = createStore();
            store.applyEvent({
                type: "ui.clock.create",
                payload: { id: clockId("c1"), duration: 60000 },
                metadata: makeMetadata(),
            });

            store.applyEvent({
                type: "ui.clock.destroy",
                payload: { id: clockId("c1") },
                metadata: makeMetadata(),
            });

            expect(store.clocks.size).toBe(0);
        });

        test("should apply time.scale_changed to timeScale and clocks", () => {
            const { store } = createStore();

            store.applyEvent({
                type: "time.scale_changed",
                payload: { scale: 2.0 },
                metadata: makeMetadata(),
            });

            expect(store.timeScale).toBe(2.0);
        });

        test("should emit event on event bus", () => {
            const { store, eventBus } = createStore();
            const received: unknown[] = [];

            eventBus.on("audio.play").subscribe((e) => received.push(e));
            store.applyEvent(audioPlayEvent());

            expect(received).toHaveLength(1);
        });
    });

    describe("dispatch", () => {
        test("should apply locally and send to server", () => {
            const { store, sendToServer } = createStore();
            const event = audioPlayEvent();

            store.dispatch(event);

            expect(store.channels.size).toBe(1);
            expect(sendToServer).toHaveBeenCalledTimes(1);
            expect(sendToServer).toHaveBeenCalledWith(event);
        });
    });

    describe("applyReplay", () => {
        test("should apply all events without per-event bus emission", () => {
            const { store, eventBus } = createStore();
            const domainEvents: unknown[] = [];

            eventBus.on("audio.play").subscribe((e) => domainEvents.push(e));

            store.applyReplay([
                audioPlayEvent(),
                audioPlayEvent(CH, trackId("t2")),
            ]);

            expect(store.channels.get(CH)!.tracks.size).toBe(2);
            expect(domainEvents).toHaveLength(0);
        });

        test("should emit replay_complete after all events applied", () => {
            const { store, eventBus } = createStore();
            const systemEvents: unknown[] = [];

            eventBus.all$().subscribe((e) => {
                if ((e as { type: string }).type === "system.replay_complete") {
                    systemEvents.push(e);
                }
            });

            store.applyReplay([audioPlayEvent()]);

            expect(systemEvents).toHaveLength(1);
        });
    });

    describe("reset", () => {
        test("should clear all state", () => {
            const { store } = createStore();

            store.applyEvent(audioPlayEvent());
            store.applyEvent({
                type: "visual.image.set",
                payload: {
                    layer: BG,
                    imageRef: imageRef("forest.png"),
                    aspectRatio: "cover",
                },
                metadata: makeMetadata(),
            });
            store.applyEvent({
                type: "ui.clock.create",
                payload: { id: clockId("c1"), duration: 60000 },
                metadata: makeMetadata(),
            });
            store.applyEvent({
                type: "time.scale_changed",
                payload: { scale: 3.0 },
                metadata: makeMetadata(),
            });

            store.reset();

            expect(store.channels.size).toBe(0);
            expect(store.layers.size).toBe(0);
            expect(store.clocks.size).toBe(0);
            expect(store.timeScale).toBe(1.0);
        });
    });

    describe("observables", () => {
        test("channels$ should emit on audio events", () => {
            const { store } = createStore();
            const values: Map<unknown, AudioChannelState>[] = [];

            store.channels$.subscribe((v) => values.push(v));
            store.applyEvent(audioPlayEvent());

            // Initial empty + after play
            expect(values).toHaveLength(2);
            expect(values.at(-1)!.size).toBe(1);
        });

        test("layers$ should emit on image events", () => {
            const { store } = createStore();
            const values: Map<unknown, ImageLayerState>[] = [];

            store.layers$.subscribe((v) => values.push(v));
            store.applyEvent({
                type: "visual.image.set",
                payload: {
                    layer: BG,
                    imageRef: imageRef("forest.png"),
                    aspectRatio: "cover",
                },
                metadata: makeMetadata(),
            });

            expect(values).toHaveLength(2);
            expect(values.at(-1)!.size).toBe(1);
        });

        test("clocks$ should emit on clock events", () => {
            const { store } = createStore();
            const values: Map<unknown, ClockState>[] = [];

            store.clocks$.subscribe((v) => values.push(v));
            store.applyEvent({
                type: "ui.clock.create",
                payload: { id: clockId("c1"), duration: 60000 },
                metadata: makeMetadata(),
            });

            expect(values).toHaveLength(2);
            expect(values.at(-1)!.size).toBe(1);
        });

        test("clientId$ should emit on setClientId", () => {
            const { store } = createStore();
            const values: (string | null)[] = [];

            store.clientId$.subscribe((v) => values.push(v));
            store.setClientId("client-123");

            expect(values).toEqual([null, "client-123"]);
        });
    });
});
