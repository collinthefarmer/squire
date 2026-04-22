import type { ServerWebSocket } from "bun";
import { Logger } from "@utils/logger";
import type { Container } from "@core/di/container";
import type { EventStore } from "@core/events/event-store";
import type { ClientRegistry } from "./client-registry";
import type { Event, ConnectedClient, WebSocketData } from "@types";
import { eventSchema } from "@schemas";
import { ZodError } from "zod";
import { TOKENS } from "@core/di/container";

const logger = new Logger("WebSocket");

/**
 * Generate unique client ID
 */
function generateClientId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

/**
 * Route incoming message to EventStore
 */
export function routeMessage(
    container: Container,
    clientRegistry: ClientRegistry,
    clientId: string,
    message: string,
): void {
    try {
        const parsed = JSON.parse(message);

        const validationResult = eventSchema.safeParse(parsed);

        if (!validationResult.success) {
            logger.error("Invalid event received:", {
                clientId,
                errors: validationResult.error.format,
                receivedData: parsed,
            });
            return;
        }

        const event = validationResult.data;

        const validatedEvent: Event = {
            ...event,
            metadata: {
                ...event.metadata,
                timestamp: Date.now(),
                source: clientId,
            },
        };

        // WebRTC signaling: relay to target client, don't store
        if (event.type.startsWith("webrtc.")) {
            const targetId = (event.payload as { targetClientId: string })
                .targetClientId;
            clientRegistry.sendToClient(targetId, validatedEvent);
            return;
        }

        const eventStore = container.resolve<EventStore>(TOKENS.EventStore);
        eventStore.append(validatedEvent);
    } catch (error) {
        if (error instanceof ZodError) {
            logger.error("Validation error", { errors: error.format() });
        } else {
            logger.error("Failed to route message", { clientId, error: String(error) });
        }
    }
}

/**
 * Broadcast the current display client list to all master clients.
 */
function broadcastClientList(clientRegistry: ClientRegistry): void {
    const allClients = clientRegistry.getAllClients();
    const displays = allClients
        .filter((c) => c.type === "display")
        .map((c) => ({ id: c.id, type: c.type }));

    const event: Event = {
        type: "system.client_list",
        payload: { displays },
        metadata: { timestamp: Date.now(), source: "server" },
    };

    for (const client of allClients) {
        if (client.type === "master") {
            clientRegistry.sendToClient(client.id, event);
        }
    }
}

/**
 * Create WebSocket handlers for Bun.serve().
 */
export function createWebSocketHandlers(
    container: Container,
    eventStore: EventStore,
    clientRegistry: ClientRegistry,
) {
    return {
        open(ws: ServerWebSocket<WebSocketData>) {
            const { clientId, clientType } = ws.data;

            const client: ConnectedClient = {
                id: clientId,
                type: clientType,
                ws,
                connectedAt: Date.now(),
            };

            clientRegistry.register(client);

            // Tell the client its own ID
            ws.send(
                JSON.stringify({
                    type: "system.connected",
                    payload: { clientId },
                    metadata: { timestamp: Date.now(), source: "server" },
                }),
            );

            // Replay events from EventStore (preserves original timestamps)
            const replayEvents = eventStore.getReplayEvents();

            if (replayEvents.length > 0) {
                ws.send(JSON.stringify(replayEvents));
            }

            logger.debug(
                `Client ${clientId} (${clientType}) synced with ${replayEvents.length} events`,
            );

            // Notify master clients of the updated display list
            broadcastClientList(clientRegistry);
        },

        message(
            ws: ServerWebSocket<WebSocketData>,
            message: string | Buffer,
        ) {
            const clientId = ws.data.clientId;
            const messageStr =
                typeof message === "string" ? message : message.toString();

            routeMessage(container, clientRegistry, clientId, messageStr);
        },

        close(ws: ServerWebSocket<WebSocketData>) {
            const clientId = ws.data.clientId;
            clientRegistry.unregister(clientId);
            broadcastClientList(clientRegistry);
        },
    };
}

/**
 * Get the upgrade data for a new WebSocket connection.
 */
export function getUpgradeData(clientType: "master" | "display"): WebSocketData {
    return {
        clientId: generateClientId(),
        clientType,
    };
}
