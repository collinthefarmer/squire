import type { ServerWebSocket } from "bun";
import { mkdirSync } from "node:fs";
import { Container, TOKENS } from "@core/di/container";
import { EventBus } from "@core/events/event-bus";
import { EventStore } from "@core/events/event-store";
import { StateStore } from "@core/state/state-store";
import { ClientRegistry } from "@core/transport/client-registry";
import { AudioService } from "@services/audio/audio-service";
import { ImageService } from "@services/image/image-service";
import { CountdownService } from "@services/countdown/countdown-service";
import { TimeService } from "@services/time/time-service";
import { ImageResizeService } from "@services/image/image-resize-service";
import { Logger } from "@utils/logger";
import { preloadAudioDurations } from "@api/handlers/assets-metadata";
import { createAudioReplay, createClockReplay } from "@core/events/replay-configs";
import type { Event, ConnectedClient } from "@types";
import { eventSchema } from "@schemas";
import { ZodError } from "zod";
import { Router } from "@core/http/router";
import { registerRoutes } from "@api/routes";

const PUBLIC_DIR = "public";

const logger = new Logger("Main");

/**
 * Initialize DI container
 */
function initializeContainer(): Container {
    const container = new Container();

    // Register core services
    container.registerInstance(TOKENS.EventBus, new EventBus());
    container.registerInstance(TOKENS.EventStore, new EventStore());
    container.registerInstance(TOKENS.StateStore, new StateStore({}));
    container.registerInstance(TOKENS.ClientRegistry, new ClientRegistry());

    // Register feature services
    container.registerFactory(TOKENS.AudioService, () => {
        return new AudioService(
            container.resolve(TOKENS.EventStore),
            container.resolve(TOKENS.StateStore),
            container.resolve(TOKENS.ClientRegistry),
        );
    });

    container.registerFactory(TOKENS.ImageService, () => {
        return new ImageService(
            container.resolve(TOKENS.EventStore),
            container.resolve(TOKENS.StateStore),
            container.resolve(TOKENS.ClientRegistry),
        );
    });

    container.registerFactory(TOKENS.CountdownService, () => {
        return new CountdownService(
            container.resolve(TOKENS.EventStore),
            container.resolve(TOKENS.ClientRegistry),
        );
    });

    container.registerFactory(TOKENS.TimeService, () => {
        return new TimeService(
            container.resolve(TOKENS.EventStore),
            container.resolve(TOKENS.StateStore),
            container.resolve(TOKENS.ClientRegistry),
        );
    });

    return container;
}

/**
 * Route incoming message to EventStore
 */
function routeMessage(
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
            const targetId = (event.payload as { targetClientId: string }).targetClientId;
            clientRegistry.sendToClient(targetId, validatedEvent);
            return;
        }

        const eventStore = container.resolve<EventStore>(TOKENS.EventStore);
        eventStore.append(validatedEvent);
    } catch (error) {
        if (error instanceof ZodError) {
            logger.error("Validation error:", error.format);
        } else {
            logger.error("Failed to route message:", error);
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
 * Generate unique client ID
 */
function generateClientId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

/**
 * Main entry point
 */
async function main() {
    logger.info("Starting Squire Server...");

    mkdirSync(PUBLIC_DIR, { recursive: true });

    // Initialize container
    const container = initializeContainer();

    // Initialize services (resolving instantiates them via DI)
    container.resolve<AudioService>(TOKENS.AudioService);
    container.resolve<ImageService>(TOKENS.ImageService);
    container.resolve<CountdownService>(TOKENS.CountdownService);
    const timeService = container.resolve<TimeService>(TOKENS.TimeService);
    const clientRegistry = container.resolve<ClientRegistry>(
        TOKENS.ClientRegistry,
    );
    const eventStore = container.resolve<EventStore>(TOKENS.EventStore);

    // Register time-scale-aware replay domains
    eventStore.registerDomain("audio.", createAudioReplay(timeService));
    eventStore.registerDomain("ui.clock.", createClockReplay(timeService));

    logger.info("Services initialized");

    // Pre-populate audio duration cache before accepting connections
    // so the replay filter can exclude finished audio
    await preloadAudioDurations();
    logger.info("Audio durations loaded");

    // Create and configure router
    const router = new Router();
    registerRoutes(router);

    // Initialize image resize service
    const imageResizeService = new ImageResizeService();

    // Start WebSocket server
    const PORT = parseInt(process.env.PORT ?? "3000", 10);
    const server = Bun.serve<{ clientId: string; clientType: "master" | "display" }>({
        port: PORT,

        async fetch(req, server) {
            const url = new URL(req.url);

            // Upgrade HTTP to WebSocket
            const clientType = url.searchParams.get("type") === "master" ? "master" : "display";
            const upgraded = server.upgrade(req, {
                data: {
                    clientId: generateClientId(),
                    clientType,
                },
            });

            if (upgraded) {
                return undefined;
            }

            // Try router match first
            const match = router.match(req.method, url.pathname);
            if (match) {
                return match.handler(req, match.params);
            }

            // Handle HTTP requests
            if (url.pathname.startsWith("/health")) {
                return new Response(
                    JSON.stringify({
                        status: "healthy",
                        clients: clientRegistry.getCount(),
                    }),
                    {
                        headers: { "Content-Type": "application/json" },
                    },
                );
            }

            if (url.pathname.startsWith(`/${PUBLIC_DIR}/`)) {
                // Handle image resize requests
                if (url.pathname.startsWith(`/${PUBLIC_DIR}/images/`)) {
                    const filename = url.pathname.replace(`/${PUBLIC_DIR}/images/`, "");

                    // Parse resize parameters
                    const widthParam = url.searchParams.get("w");
                    const heightParam = url.searchParams.get("h");
                    const width = widthParam ? parseInt(widthParam, 10) : null;
                    const height = heightParam ? parseInt(heightParam, 10) : null;

                    // If resize params provided, use resize service
                    if (width || height) {
                        const resized = await imageResizeService.getResizedImage(filename, width, height);
                        if (!resized) {
                            return new Response("Not Found", { status: 404 });
                        }

                        return new Response(resized.buffer, {
                            headers: {
                                "Content-Type": resized.contentType,
                                "Cache-Control": "public, max-age=31536000",
                                "Access-Control-Allow-Origin": "*",
                            },
                        });
                    }
                }

                // Serve original file (no resize params)
                const filePath = "." + url.pathname;
                const file = Bun.file(filePath);

                // Check if file exists
                if (!(await file.exists())) {
                    return new Response("Not Found", { status: 404 });
                }

                const fileSize = file.size;
                const rangeHeader = req.headers.get("Range");

                // Handle Range requests for seeking in audio/video
                if (rangeHeader) {
                    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
                    if (match) {
                        const start = parseInt(match[1], 10);
                        const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
                        const chunkSize = end - start + 1;

                        const slice = file.slice(start, end + 1);

                        return new Response(slice, {
                            status: 206,
                            headers: {
                                "Content-Range": `bytes ${start}-${end}/${fileSize}`,
                                "Accept-Ranges": "bytes",
                                "Content-Length": String(chunkSize),
                                "Content-Type": file.type,
                                "Access-Control-Allow-Origin": "*",
                            },
                        });
                    }
                }

                // Regular request - return full file with Accept-Ranges header
                return new Response(file, {
                    headers: {
                        "Accept-Ranges": "bytes",
                        "Content-Length": String(fileSize),
                        "Content-Type": file.type,
                        "Access-Control-Allow-Origin": "*",
                    },
                });
            }

            return new Response("Squire Server", { status: 200 });
        },

        websocket: {
            open(ws: ServerWebSocket<{ clientId: string; clientType: "master" | "display" }>) {
                const { clientId, clientType } = ws.data;

                const client: ConnectedClient = {
                    id: clientId,
                    type: clientType,
                    ws,
                    connectedAt: Date.now(),
                };

                clientRegistry.register(client);

                // Tell the client its own ID
                ws.send(JSON.stringify({
                    type: "system.connected",
                    payload: { clientId },
                    metadata: { timestamp: Date.now(), source: "server" },
                }));

                // Replay events from EventStore (preserves original timestamps)
                const replayEvents = eventStore.getReplayEvents();

                if (replayEvents.length > 0) {
                    ws.send(JSON.stringify(replayEvents));
                }

                logger.debug(`Client ${clientId} (${clientType}) synced with ${replayEvents.length} events`);

                // Notify master clients of the updated display list
                broadcastClientList(clientRegistry);
            },

            message(
                ws: ServerWebSocket<{ clientId: string; clientType: "master" | "display" }>,
                message: string | Buffer,
            ) {
                const clientId = ws.data.clientId;
                const messageStr =
                    typeof message === "string" ? message : message.toString();

                routeMessage(container, clientRegistry, clientId, messageStr);
            },

            close(ws: ServerWebSocket<{ clientId: string; clientType: "master" | "display" }>) {
                const clientId = ws.data.clientId;
                clientRegistry.unregister(clientId);
                broadcastClientList(clientRegistry);
            },
        },
    });

    logger.info(`Server running on ${server.hostname}:${server.port}`);
    logger.info(`WebSocket endpoint: ws://localhost:${PORT}`);
    logger.info(`Health check: http://localhost:${PORT}/health`);
}

// Start server
main().catch((error) => {
    logger.error("Fatal error:", error);
    process.exit(1);
});
