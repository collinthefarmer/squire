import { test, expect, describe, beforeEach, mock } from "bun:test";
import { TimeService } from "./time-service";
import { EventStore } from "@core/events/event-store";
import { StateStore } from "@core/state/state-store";
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

describe("TimeService", () => {
    let eventStore: EventStore;
    let stateStore: StateStore;
    let clientRegistry: ClientRegistry;
    let service: TimeService;

    beforeEach(() => {
        eventStore = new EventStore();
        stateStore = new StateStore();
        clientRegistry = new ClientRegistry();
        service = new TimeService(eventStore, stateStore, clientRegistry);
    });

    describe("getCurrentScale", () => {
        test("should return 1.0 when no scale changes have occurred", () => {
            expect(service.getCurrentScale()).toBe(1.0);
        });

        test("should return the most recent scale after changes", () => {
            eventStore.append({
                type: "time.scale_changed",
                payload: { scale: 2.5 },
                metadata: makeMetadata(),
            });

            expect(service.getCurrentScale()).toBe(2.5);
        });
    });

    describe("getScaleHistory", () => {
        test("should return empty array initially", () => {
            expect(service.getScaleHistory()).toEqual([]);
        });

        test("should track all scale changes in order", () => {
            const meta1 = makeMetadata({ timestamp: 1000 });
            const meta2 = makeMetadata({ timestamp: 2000 });
            const meta3 = makeMetadata({ timestamp: 3000 });

            eventStore.append({ type: "time.scale_changed", payload: { scale: 1.5 }, metadata: meta1 });
            eventStore.append({ type: "time.scale_changed", payload: { scale: 3.0 }, metadata: meta2 });
            eventStore.append({ type: "time.scale_changed", payload: { scale: 0.5 }, metadata: meta3 });

            const history = service.getScaleHistory();
            expect(history).toHaveLength(3);
            expect(history[0]).toEqual({ timestamp: 1000, scale: 1.5 });
            expect(history[1]).toEqual({ timestamp: 2000, scale: 3.0 });
            expect(history[2]).toEqual({ timestamp: 3000, scale: 0.5 });
        });
    });

    describe("scale validation", () => {
        test("should clamp scale to minimum of 0", () => {
            eventStore.append({
                type: "time.scale_changed",
                payload: { scale: -5 },
                metadata: makeMetadata(),
            });

            expect(service.getCurrentScale()).toBe(0);
            expect(stateStore.getState().time?.scale).toBe(0);
        });

        test("should clamp scale to maximum of 10", () => {
            eventStore.append({
                type: "time.scale_changed",
                payload: { scale: 15 },
                metadata: makeMetadata(),
            });

            expect(service.getCurrentScale()).toBe(10);
            expect(stateStore.getState().time?.scale).toBe(10);
        });

        test("should accept scale at lower boundary (0)", () => {
            eventStore.append({
                type: "time.scale_changed",
                payload: { scale: 0 },
                metadata: makeMetadata(),
            });

            expect(service.getCurrentScale()).toBe(0);
        });

        test("should accept scale at upper boundary (10)", () => {
            eventStore.append({
                type: "time.scale_changed",
                payload: { scale: 10 },
                metadata: makeMetadata(),
            });

            expect(service.getCurrentScale()).toBe(10);
        });

        test("should accept fractional scale values within range", () => {
            eventStore.append({
                type: "time.scale_changed",
                payload: { scale: 0.001 },
                metadata: makeMetadata(),
            });

            expect(service.getCurrentScale()).toBe(0.001);
        });
    });

    describe("state updates", () => {
        test("should update state store with clamped scale", () => {
            eventStore.append({
                type: "time.scale_changed",
                payload: { scale: 5.0 },
                metadata: makeMetadata(),
            });

            expect(stateStore.getState().time).toEqual({ scale: 5.0 });
        });

        test("should overwrite previous time state", () => {
            eventStore.append({
                type: "time.scale_changed",
                payload: { scale: 2.0 },
                metadata: makeMetadata(),
            });

            eventStore.append({
                type: "time.scale_changed",
                payload: { scale: 7.0 },
                metadata: makeMetadata(),
            });

            expect(stateStore.getState().time).toEqual({ scale: 7.0 });
        });
    });

    describe("event broadcasting", () => {
        test("should broadcast scale_changed event to all clients", () => {
            const client = makeMockClient("c1");
            clientRegistry.register(client);

            eventStore.append({
                type: "time.scale_changed",
                payload: { scale: 3.0 },
                metadata: makeMetadata(),
            });

            expect(client.ws.send).toHaveBeenCalledTimes(1);

            const sent = JSON.parse((client.ws.send as ReturnType<typeof mock>).mock.calls[0][0] as string);
            expect(sent.type).toBe("time.scale_changed");
            expect(sent.payload.scale).toBe(3.0);
        });

        test("should broadcast the clamped scale value, not the original", () => {
            const client = makeMockClient("c1");
            clientRegistry.register(client);

            eventStore.append({
                type: "time.scale_changed",
                payload: { scale: 99 },
                metadata: makeMetadata(),
            });

            const sent = JSON.parse((client.ws.send as ReturnType<typeof mock>).mock.calls[0][0] as string);
            expect(sent.payload.scale).toBe(10);
        });

        test("should broadcast to multiple clients", () => {
            const client1 = makeMockClient("c1");
            const client2 = makeMockClient("c2");
            clientRegistry.register(client1);
            clientRegistry.register(client2);

            eventStore.append({
                type: "time.scale_changed",
                payload: { scale: 1.0 },
                metadata: makeMetadata(),
            });

            expect(client1.ws.send).toHaveBeenCalledTimes(1);
            expect(client2.ws.send).toHaveBeenCalledTimes(1);
        });
    });

    describe("error handling", () => {
        test("should catch errors during event handling without crashing", () => {
            const failingClient: ConnectedClient = {
                id: "fail",
                type: "display",
                ws: {
                    send: mock(() => {
                        throw new Error("connection lost");
                    }),
                } as unknown as ConnectedClient["ws"],
                connectedAt: Date.now(),
            };
            clientRegistry.register(failingClient);

            // ClientRegistry.broadcast catches send errors internally,
            // so this should not throw
            expect(() => {
                eventStore.append({
                    type: "time.scale_changed",
                    payload: { scale: 2.0 },
                    metadata: makeMetadata(),
                });
            }).not.toThrow();

            // State and history should still be updated despite broadcast failure
            expect(service.getCurrentScale()).toBe(2.0);
            expect(stateStore.getState().time?.scale).toBe(2.0);
        });
    });
});
