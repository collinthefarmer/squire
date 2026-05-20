import { test, expect, describe } from "bun:test";
import { EventBus } from "./event-bus";
import { makeEvent } from "../../test-utils/factories";
import type { Event } from "@types";

describe("EventBus", () => {
    describe("ofType$", () => {
        test("should receive exact-match events", () => {
            const bus = new EventBus();
            const received: Event[] = [];

            bus.ofType$("audio.play").subscribe((e) => received.push(e));
            bus.emit(makeEvent("audio.play"));

            expect(received).toHaveLength(1);
            expect(received[0].type).toBe("audio.play");
        });

        test("should not receive non-matching events", () => {
            const bus = new EventBus();
            const received: Event[] = [];

            bus.ofType$("audio.play").subscribe((e) => received.push(e));
            bus.emit(makeEvent("audio.pause"));

            expect(received).toHaveLength(0);
        });

        test("should support wildcard prefix patterns", () => {
            const bus = new EventBus();
            const received: Event[] = [];

            bus.ofType$("audio.*").subscribe((e) => received.push(e));

            bus.emit(makeEvent("audio.play"));
            bus.emit(makeEvent("audio.pause"));
            bus.emit(makeEvent("visual.image.set"));

            expect(received).toHaveLength(2);
            expect(received[0].type).toBe("audio.play");
            expect(received[1].type).toBe("audio.pause");
        });

        test("should support global wildcard", () => {
            const bus = new EventBus();
            const received: Event[] = [];

            bus.ofType$("*").subscribe((e) => received.push(e));

            bus.emit(makeEvent("audio.play"));
            bus.emit(makeEvent("visual.image.set"));

            expect(received).toHaveLength(2);
        });

        test("should support nested prefix wildcards", () => {
            const bus = new EventBus();
            const received: Event[] = [];

            bus.ofType$("visual.image.*").subscribe((e) => received.push(e));

            bus.emit(makeEvent("visual.image.set"));
            bus.emit(makeEvent("visual.image.clear"));
            bus.emit(makeEvent("visual.other"));

            expect(received).toHaveLength(2);
        });
    });

    describe("all$", () => {
        test("should receive all events", () => {
            const bus = new EventBus();
            const received: Event[] = [];

            bus.all$().subscribe((e) => received.push(e));

            bus.emit(makeEvent("a"));
            bus.emit(makeEvent("b"));

            expect(received).toHaveLength(2);
        });
    });

    describe("emit", () => {
        test("should deliver to subscribers synchronously", () => {
            const bus = new EventBus();
            const received: Event[] = [];

            bus.ofType$("test").subscribe((e) => received.push(e));
            bus.emit(makeEvent("test"));

            expect(received).toHaveLength(1);
        });
    });

    describe("multiple subscribers", () => {
        test("should deliver events to all matching subscribers", () => {
            const bus = new EventBus();
            const sub1: Event[] = [];
            const sub2: Event[] = [];

            bus.ofType$("audio.play").subscribe((e) => sub1.push(e));
            bus.ofType$("audio.*").subscribe((e) => sub2.push(e));

            bus.emit(makeEvent("audio.play"));

            expect(sub1).toHaveLength(1);
            expect(sub2).toHaveLength(1);
        });
    });
});
