import { test, expect, describe } from "bun:test";
import { EventBus } from "./event-bus";

describe("EventBus pattern matching", () => {
    test("should match exact event type", () => {
        const eventBus = new EventBus();
        let received = false;

        eventBus.on("server:audio.play", () => {
            received = true;
        });

        eventBus.emit("server:audio.play", { test: true });

        expect(received).toBe(true);
    });

    test("should match wildcard pattern server:audio.*", () => {
        const eventBus = new EventBus();
        const receivedEvents: string[] = [];

        eventBus.on("server:audio.*", (event: any) => {
            receivedEvents.push(event.type);
        });

        eventBus.emit("server:audio.play", { type: "audio.play" });
        eventBus.emit("server:audio.pause", { type: "audio.pause" });
        eventBus.emit("server:audio.stop", { type: "audio.stop" });
        eventBus.emit("server:visual.image.set", { type: "visual.image.set" });

        expect(receivedEvents).toEqual(["audio.play", "audio.pause", "audio.stop"]);
    });

    test("should match wildcard pattern server:*", () => {
        const eventBus = new EventBus();
        const receivedEvents: string[] = [];

        eventBus.on("server:*", (event: any) => {
            receivedEvents.push(event.type);
        });

        eventBus.emit("server:audio.play", { type: "audio.play" });
        eventBus.emit("server:visual.image.set", { type: "visual.image.set" });
        eventBus.emit("client:modal.open", { type: "modal.open" });

        expect(receivedEvents).toEqual(["audio.play", "visual.image.set"]);
    });

    test("should match nested wildcard pattern server:visual.image.*", () => {
        const eventBus = new EventBus();
        const receivedEvents: string[] = [];

        eventBus.on("server:visual.image.*", (event: any) => {
            receivedEvents.push(event.type);
        });

        eventBus.emit("server:visual.image.set", { type: "visual.image.set" });
        eventBus.emit("server:visual.image.clear", { type: "visual.image.clear" });
        eventBus.emit("server:audio.play", { type: "audio.play" });

        expect(receivedEvents).toEqual(["visual.image.set", "visual.image.clear"]);
    });

    test("should handle multiple wildcards in pattern", () => {
        const eventBus = new EventBus();
        let received = false;

        eventBus.on("server:*.*", (event: any) => {
            received = true;
        });

        eventBus.emit("server:audio.play", { type: "audio.play" });

        expect(received).toBe(true);
    });

    test("should not match when pattern does not match", () => {
        const eventBus = new EventBus();
        let received = false;

        eventBus.on("server:audio.*", () => {
            received = true;
        });

        eventBus.emit("server:visual.image.set", { test: true });

        expect(received).toBe(false);
    });

    test("should support multiple handlers for same pattern", () => {
        const eventBus = new EventBus();
        let count = 0;

        eventBus.on("server:audio.play", () => {
            count++;
        });
        eventBus.on("server:audio.play", () => {
            count++;
        });

        eventBus.emit("server:audio.play", { test: true });

        expect(count).toBe(2);
    });

    test("should unsubscribe when cleanup function is called", () => {
        const eventBus = new EventBus();
        let received = false;

        const unsubscribe = eventBus.on("server:audio.play", () => {
            received = true;
        });

        unsubscribe();
        eventBus.emit("server:audio.play", { test: true });

        expect(received).toBe(false);
    });
});
