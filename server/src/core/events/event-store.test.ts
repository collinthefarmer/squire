import { test, expect, describe } from "bun:test";
import { EventStore } from "./event-store";
import { defineReplay } from "./replay-domain";
import { makeEvent } from "../../test-utils/factories";
import type { Event } from "@types";

describe("EventStore", () => {
    describe("append and all$", () => {
        test("should emit appended events on all$", () => {
            const store = new EventStore();
            const received: Event[] = [];

            store.all$().subscribe((e) => received.push(e));
            store.append(makeEvent("audio.play"));

            expect(received).toHaveLength(1);
            expect(received[0].type).toBe("audio.play");
        });

        test("should emit multiple events in order", () => {
            const store = new EventStore();
            const received: Event[] = [];

            store.all$().subscribe((e) => received.push(e));

            store.append(makeEvent("a"));
            store.append(makeEvent("b"));
            store.append(makeEvent("c"));

            expect(received.map((e) => e.type)).toEqual(["a", "b", "c"]);
        });
    });

    describe("ofType", () => {
        test("should filter events by exact type", () => {
            const store = new EventStore();
            const received: Event[] = [];

            store.ofType("audio.play").subscribe((e) => received.push(e));

            store.append(makeEvent("audio.play"));
            store.append(makeEvent("audio.pause"));

            expect(received).toHaveLength(1);
            expect(received[0].type).toBe("audio.play");
        });

        test("should support wildcard patterns", () => {
            const store = new EventStore();
            const received: Event[] = [];

            store.ofType("audio.*").subscribe((e) => received.push(e));

            store.append(makeEvent("audio.play"));
            store.append(makeEvent("audio.pause"));
            store.append(makeEvent("visual.image.set"));

            expect(received).toHaveLength(2);
        });

        test("should support global wildcard", () => {
            const store = new EventStore();
            const received: Event[] = [];

            store.ofType("*").subscribe((e) => received.push(e));

            store.append(makeEvent("audio.play"));
            store.append(makeEvent("visual.image.set"));

            expect(received).toHaveLength(2);
        });
    });

    describe("domain routing", () => {
        test("should route events to registered domains", () => {
            const store = new EventStore();
            const testDomain = defineReplay("id", {
                "test.create": {
                    removes: ["test.destroy"],
                },
            });

            store.registerDomain("test.", testDomain);
            store.append(makeEvent("test.create", { id: "entity1" }));

            const replay = store.getReplayEvents();
            const testEvents = replay.filter((e) => e.type.startsWith("test."));

            expect(testEvents).toHaveLength(1);
            expect(testEvents[0].type).toBe("test.create");
        });

        test("should handle removal events through domains", () => {
            const store = new EventStore();
            const testDomain = defineReplay("id", {
                "test.create": {
                    removes: ["test.destroy"],
                },
            });

            store.registerDomain("test.", testDomain);

            store.append(makeEvent("test.create", { id: "e1" }));
            store.append(makeEvent("test.destroy", { id: "e1" }));

            const replay = store.getReplayEvents();
            const testEvents = replay.filter((e) => e.type.startsWith("test."));

            expect(testEvents).toHaveLength(0);
        });
    });

    describe("time events", () => {
        test("should store latest time event for replay", () => {
            const store = new EventStore();

            store.append(makeEvent("time.scale_changed", { scale: 1.0 }));
            store.append(makeEvent("time.scale_changed", { scale: 2.0 }));

            const replay = store.getReplayEvents();
            const timeEvents = replay.filter((e) =>
                e.type.startsWith("time."),
            );

            expect(timeEvents).toHaveLength(1);
            expect((timeEvents[0].payload as { scale: number }).scale).toBe(
                2.0,
            );
        });

        test("should place time event first in replay", () => {
            const store = new EventStore();

            // Image domain is registered by default (visual.image.*)
            store.append(
                makeEvent("visual.image.set", {
                    layer: "bg",
                    imageRef: "test.png",
                }),
            );
            store.append(makeEvent("time.scale_changed", { scale: 1.5 }));

            const replay = store.getReplayEvents();
            expect(replay[0].type).toBe("time.scale_changed");
        });
    });

    describe("getReplayEvents with image domain", () => {
        test("should include image.set events in replay", () => {
            const store = new EventStore();

            store.append(
                makeEvent("visual.image.set", {
                    layer: "bg",
                    imageRef: "forest.png",
                }),
            );

            const replay = store.getReplayEvents();
            const imageEvents = replay.filter((e) =>
                e.type.startsWith("visual.image."),
            );

            expect(imageEvents).toHaveLength(1);
            expect(imageEvents[0].type).toBe("visual.image.set");
        });

        test("should not include cleared images in replay", () => {
            const store = new EventStore();

            store.append(
                makeEvent("visual.image.set", {
                    layer: "bg",
                    imageRef: "forest.png",
                }),
            );
            store.append(makeEvent("visual.image.clear", { layer: "bg" }));

            const replay = store.getReplayEvents();
            const imageEvents = replay.filter((e) =>
                e.type.startsWith("visual.image."),
            );

            expect(imageEvents).toHaveLength(0);
        });
    });
});
