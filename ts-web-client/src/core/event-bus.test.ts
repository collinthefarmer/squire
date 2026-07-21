import { test, expect, describe } from "bun:test";
import { EventBus } from "./event-bus";
import type { EventTypeMap } from "./event-bus";
import { channelId, trackId, layerId } from "@types";
import { makeMetadata } from "../test-utils/factories";

function makeEvent<T extends keyof EventTypeMap>(
    type: T,
    payload: EventTypeMap[T]["payload"],
): EventTypeMap[T] {
    return { type, payload, metadata: makeMetadata() } as EventTypeMap[T];
}

describe("EventBus", () => {
    describe("on", () => {
        test("should emit matching events", () => {
            const bus = new EventBus();
            const received: unknown[] = [];

            bus.on("audio.play").subscribe((e) => received.push(e));

            bus.emit(
                makeEvent("audio.play", {
                    channel: channelId("music"),
                    trackId: trackId("t1"),
                    source: { type: "file", ref: "a.mp3" },
                    volume: 1,
                    loop: false,
                    respectTimeScale: true,
                }),
            );

            expect(received).toHaveLength(1);
            expect((received[0] as { type: string }).type).toBe("audio.play");
        });

        test("should not emit non-matching events", () => {
            const bus = new EventBus();
            const received: unknown[] = [];

            bus.on("audio.play").subscribe((e) => received.push(e));

            bus.emit(
                makeEvent("audio.stop", {
                    channel: channelId("music"),
                }),
            );

            expect(received).toHaveLength(0);
        });
    });

    describe("onPrefix", () => {
        test("should emit events matching prefix", () => {
            const bus = new EventBus();
            const received: unknown[] = [];

            bus.onPrefix("audio.").subscribe((e) => received.push(e));

            bus.emit(
                makeEvent("audio.play", {
                    channel: channelId("music"),
                    trackId: trackId("t1"),
                    source: { type: "file", ref: "a.mp3" },
                    volume: 1,
                    loop: false,
                    respectTimeScale: true,
                }),
            );
            bus.emit(
                makeEvent("audio.stop", {
                    channel: channelId("music"),
                }),
            );

            expect(received).toHaveLength(2);
        });

        test("should not emit events with different prefix", () => {
            const bus = new EventBus();
            const received: unknown[] = [];

            bus.onPrefix("audio.").subscribe((e) => received.push(e));

            bus.emit(
                makeEvent("visual.image.set", {
                    layer: layerId("bg"),
                    imageRef: "forest.png",
                    aspectRatio: "cover",
                }),
            );

            expect(received).toHaveLength(0);
        });
    });

    describe("all$", () => {
        test("should emit all events", () => {
            const bus = new EventBus();
            const received: unknown[] = [];

            bus.all$().subscribe((e) => received.push(e));

            bus.emit(
                makeEvent("audio.stop", {
                    channel: channelId("music"),
                }),
            );
            bus.emit(
                makeEvent("visual.image.clear", {
                    layer: layerId("bg"),
                }),
            );

            expect(received).toHaveLength(2);
        });
    });

    describe("system events", () => {
        test("should emit replay_complete via all$", () => {
            const bus = new EventBus();
            const received: unknown[] = [];

            bus.all$().subscribe((e) => received.push(e));

            bus.emit({
                type: "system.replay_complete",
                payload: { count: 10 },
                metadata: makeMetadata(),
            });

            expect(received).toHaveLength(1);
        });
    });
});
