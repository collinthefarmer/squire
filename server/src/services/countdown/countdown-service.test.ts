import { test, expect, describe, beforeEach, mock } from "bun:test";
import { CountdownService } from "./countdown-service";
import { EventStore } from "@core/events/event-store";
import { ClientRegistry } from "@core/transport/client-registry";
import { makeMetadata } from "../../test-utils/factories";
import type { ConnectedClient } from "@types";

function makeMockClient(id: string): ConnectedClient {
    return {
        id,
        type: "display",
        ws: { send: mock(() => {}) } as unknown as ConnectedClient["ws"],
        connectedAt: Date.now(),
    };
}

describe("CountdownService", () => {
    let eventStore: EventStore;
    let clientRegistry: ClientRegistry;

    beforeEach(() => {
        eventStore = new EventStore();
        clientRegistry = new ClientRegistry();
    });

    describe("event subscription", () => {
        test("should subscribe to ui.clock.* events on construction", () => {
            const client = makeMockClient("c1");
            clientRegistry.register(client);

            new CountdownService(eventStore, clientRegistry);

            eventStore.append({
                type: "ui.clock.create",
                payload: { id: "clock-1", duration: 60000, onComplete: "persist" },
                metadata: makeMetadata(),
            });

            expect(client.ws.send).toHaveBeenCalledTimes(1);
        });
    });

    describe("rebroadcast", () => {
        test("should broadcast ui.clock.create events to all clients", () => {
            const client1 = makeMockClient("c1");
            const client2 = makeMockClient("c2");
            clientRegistry.register(client1);
            clientRegistry.register(client2);

            new CountdownService(eventStore, clientRegistry);

            const event = {
                type: "ui.clock.create" as const,
                payload: { id: "clock-1", duration: 60000, onComplete: "persist" as const },
                metadata: makeMetadata(),
            };
            eventStore.append(event);

            expect(client1.ws.send).toHaveBeenCalledTimes(1);
            expect(client2.ws.send).toHaveBeenCalledTimes(1);

            const sent = JSON.parse((client1.ws.send as ReturnType<typeof mock>).mock.calls[0][0] as string);
            expect(sent.type).toBe("ui.clock.create");
            expect(sent.payload.id).toBe("clock-1");
        });

        test("should broadcast ui.clock.start events", () => {
            const client = makeMockClient("c1");
            clientRegistry.register(client);

            new CountdownService(eventStore, clientRegistry);

            eventStore.append({
                type: "ui.clock.start",
                payload: { id: "clock-1" },
                metadata: makeMetadata(),
            });

            expect(client.ws.send).toHaveBeenCalledTimes(1);
        });

        test("should broadcast ui.clock.pause events", () => {
            const client = makeMockClient("c1");
            clientRegistry.register(client);

            new CountdownService(eventStore, clientRegistry);

            eventStore.append({
                type: "ui.clock.pause",
                payload: { id: "clock-1" },
                metadata: makeMetadata(),
            });

            expect(client.ws.send).toHaveBeenCalledTimes(1);
        });

        test("should broadcast ui.clock.destroy events", () => {
            const client = makeMockClient("c1");
            clientRegistry.register(client);

            new CountdownService(eventStore, clientRegistry);

            eventStore.append({
                type: "ui.clock.destroy",
                payload: { id: "clock-1" },
                metadata: makeMetadata(),
            });

            expect(client.ws.send).toHaveBeenCalledTimes(1);
        });

        test("should not broadcast non-clock events", () => {
            const client = makeMockClient("c1");
            clientRegistry.register(client);

            new CountdownService(eventStore, clientRegistry);

            eventStore.append({
                type: "audio.play",
                payload: {
                    channel: "music",
                    source: { type: "file", ref: "song.mp3" },
                    volume: 1.0,
                    loop: false,
                    respectTimeScale: false,
                },
                metadata: makeMetadata(),
            });

            expect(client.ws.send).not.toHaveBeenCalled();
        });
    });

    describe("error handling", () => {
        test("should catch and log errors during broadcast without crashing", () => {
            const failingClient: ConnectedClient = {
                id: "fail",
                type: "display",
                ws: {
                    send: mock(() => {
                        throw new Error("WebSocket closed");
                    }),
                } as unknown as ConnectedClient["ws"],
                connectedAt: Date.now(),
            };
            clientRegistry.register(failingClient);

            new CountdownService(eventStore, clientRegistry);

            // Should not throw even though the client's ws.send throws
            expect(() => {
                eventStore.append({
                    type: "ui.clock.create",
                    payload: { id: "clock-1", duration: 30000, onComplete: "persist" },
                    metadata: makeMetadata(),
                });
            }).not.toThrow();
        });
    });
});
