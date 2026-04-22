import { test, expect, describe, beforeEach } from "bun:test";
import { routeMessage } from "./websocket-handlers";
import { Container, TOKENS } from "@core/di/container";
import { EventStore } from "@core/events/event-store";
import { ClientRegistry } from "@core/transport/client-registry";
import type { Event } from "@types";

describe("routeMessage", () => {
    let container: Container;
    let eventStore: EventStore;
    let clientRegistry: ClientRegistry;
    let appendedEvents: Event[];

    beforeEach(() => {
        container = new Container();
        eventStore = new EventStore();
        clientRegistry = new ClientRegistry();

        container.registerInstance(TOKENS.EventStore, eventStore);

        appendedEvents = [];
        const originalAppend = eventStore.append.bind(eventStore);
        eventStore.append = (event: Event) => {
            appendedEvents.push(event);
            originalAppend(event);
        };
    });

    test("should append valid event to EventStore", () => {
        const message = JSON.stringify({
            type: "audio.play",
            payload: {
                channel: "music",
                source: { type: "file", ref: "song.mp3" },
                volume: 1.0,
                loop: false,
                respectTimeScale: true,
            },
            metadata: { timestamp: Date.now(), source: "test" },
        });

        routeMessage(container, clientRegistry, "client-1", message);

        expect(appendedEvents).toHaveLength(1);
        expect(appendedEvents[0].type).toBe("audio.play");
        expect(appendedEvents[0].metadata.source).toBe("client-1");
    });

    test("should reject invalid event and not append", () => {
        const message = JSON.stringify({
            type: "not.a.real.event",
            payload: {},
            metadata: { timestamp: Date.now(), source: "test" },
        });

        routeMessage(container, clientRegistry, "client-1", message);

        expect(appendedEvents).toHaveLength(0);
    });

    test("should reject malformed JSON", () => {
        routeMessage(container, clientRegistry, "client-1", "not json");
        expect(appendedEvents).toHaveLength(0);
    });

    test("should reject event missing required fields", () => {
        const message = JSON.stringify({
            type: "audio.play",
            payload: {
                // Missing required fields
            },
            metadata: { timestamp: Date.now(), source: "test" },
        });

        routeMessage(container, clientRegistry, "client-1", message);
        expect(appendedEvents).toHaveLength(0);
    });

    test("should stamp event with server timestamp and client source", () => {
        const message = JSON.stringify({
            type: "audio.stop",
            payload: { channel: "music" },
            metadata: { timestamp: 1, source: "original" },
        });

        const before = Date.now();
        routeMessage(container, clientRegistry, "client-42", message);
        const after = Date.now();

        expect(appendedEvents).toHaveLength(1);
        expect(appendedEvents[0].metadata.source).toBe("client-42");
        expect(appendedEvents[0].metadata.timestamp).toBeGreaterThanOrEqual(before);
        expect(appendedEvents[0].metadata.timestamp).toBeLessThanOrEqual(after);
    });

    test("should relay WebRTC events to target client without storing", () => {
        // Register a target client with a mock ws
        const sentMessages: string[] = [];
        clientRegistry.register({
            id: "display-1",
            type: "display",
            ws: {
                send: (msg: string) => sentMessages.push(msg),
                data: { clientId: "display-1", clientType: "display" },
            } as any,
            connectedAt: Date.now(),
        });

        const message = JSON.stringify({
            type: "webrtc.offer",
            payload: {
                targetClientId: "display-1",
                channel: "mic",
                sdp: "test-sdp",
            },
            metadata: { timestamp: Date.now(), source: "test" },
        });

        routeMessage(container, clientRegistry, "master-1", message);

        // Should NOT be stored in EventStore
        expect(appendedEvents).toHaveLength(0);

        // Should be relayed to target client
        expect(sentMessages).toHaveLength(1);
        const relayed = JSON.parse(sentMessages[0]);
        expect(relayed.type).toBe("webrtc.offer");
        expect(relayed.metadata.source).toBe("master-1");
    });
});
