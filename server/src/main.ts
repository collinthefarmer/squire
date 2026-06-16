import { mkdirSync } from "node:fs";
import { TOKENS } from "@core/di/container";
import { initializeContainer } from "@core/di/setup";
import {
    createWebSocketHandlers,
    getUpgradeData,
} from "@core/transport/websocket-handlers";
import { handleStaticFile } from "@api/handlers/static-files";
import { Logger } from "@utils/logger";
import { preloadAudioDurations } from "@api/handlers/assets-metadata";
import {
    createAudioReplay,
    createClockReplay,
    imageReplay,
} from "@core/events/replay-configs";
import { Router } from "@core/http/router";
import { registerRoutes } from "@api/routes";
import type { EventStore } from "@core/events/event-store";
import type { ClientRegistry } from "@core/transport/client-registry";
import type { AudioService } from "@services/audio/audio-service";
import type { ImageService } from "@services/image/image-service";
import type { CountdownService } from "@services/countdown/countdown-service";
import type { TimeService } from "@services/time/time-service";
import type { WebSocketData } from "@types";

const PUBLIC_DIR = "public";
const logger = new Logger("Main");

/**
 * Extract a readable error string that preserves stack traces.
 */
function extractErrorDetail(error: unknown): string {
    if (error instanceof Error) {
        return error.stack ?? error.message;
    }
    return String(error);
}

/**
 * Main entry point
 */
async function main() {
    logger.info("Starting Squire Server...");

    mkdirSync(PUBLIC_DIR, { recursive: true });

    // Initialize DI container and resolve services
    const container = initializeContainer();

    container.resolve<AudioService>(TOKENS.AudioService);
    container.resolve<ImageService>(TOKENS.ImageService);
    container.resolve<CountdownService>(TOKENS.CountdownService);
    const timeService = container.resolve<TimeService>(TOKENS.TimeService);
    const clientRegistry = container.resolve<ClientRegistry>(TOKENS.ClientRegistry);
    const eventStore = container.resolve<EventStore>(TOKENS.EventStore);

    // Register all replay domains before accepting connections
    eventStore.registerDomain("visual.image.", imageReplay);
    eventStore.registerDomain("audio.", createAudioReplay(timeService));
    eventStore.registerDomain("ui.clock.", createClockReplay(timeService));

    logger.info("Services initialized");

    // Pre-populate audio duration cache before accepting connections
    await preloadAudioDurations();
    logger.info("Audio durations loaded");

    // Create and configure router
    const router = new Router();
    registerRoutes(router);

    // Start server
    const PORT = parseInt(process.env.PORT ?? "3000", 10);
    const startTime = Date.now();

    const certPath = "./certs/cert.pem";
    const keyPath = "./certs/key.pem";
    const hasCerts =
        (await Bun.file(certPath).exists()) &&
        (await Bun.file(keyPath).exists());

    const websocket = createWebSocketHandlers(container, eventStore, clientRegistry);

    const server = Bun.serve<WebSocketData>({
        port: PORT,
        ...(hasCerts && {
            tls: {
                cert: Bun.file(certPath),
                key: Bun.file(keyPath),
            },
        }),

        async fetch(req, server) {
            const url = new URL(req.url);

            // Upgrade HTTP to WebSocket (only when client requests it)
            if (req.headers.get("upgrade") === "websocket") {
                const clientType =
                    url.searchParams.get("type") === "master"
                        ? ("master" as const)
                        : ("display" as const);
                const upgraded = server.upgrade(req, {
                    data: getUpgradeData(clientType),
                });

                if (upgraded) {
                    return undefined;
                }
            }

            // Try router match first
            const match = router.match(req.method, url.pathname);
            if (match) {
                try {
                    return await match.handler(req, match.params);
                } catch (error) {
                    logger.error("Route handler error", { path: url.pathname, error: extractErrorDetail(error) });
                    return new Response("Internal Server Error", { status: 500 });
                }
            }

            // Health check
            if (url.pathname.startsWith("/health")) {
                const allClients = clientRegistry.getAllClients();

                let master = 0;
                let display = 0;
                for (const c of allClients) {
                    if (c.type === "master") {
                        master++;
                    } else {
                        display++;
                    }
                }

                return new Response(
                    JSON.stringify({
                        status: "healthy",
                        uptime: Math.floor((Date.now() - startTime) / 1000),
                        clients: clientRegistry.getCount(),
                        clientsByRole: { master, display },
                    }),
                    { headers: { "Content-Type": "application/json" } },
                );
            }

            // Static file serving
            const staticResponse = await handleStaticFile(req, url);
            if (staticResponse) {
                return staticResponse;
            }

            return new Response("Squire Server", { status: 200 });
        },

        websocket,
    });

    const protocol = hasCerts ? "https" : "http";
    logger.info(`Server running on ${protocol}://${server.hostname}:${server.port}`);
    logger.info(`WebSocket endpoint: ws://localhost:${PORT}`);
    logger.info(`Health check: http://localhost:${PORT}/health`);
}

// Start server
main().catch((error) => {
    logger.error("Fatal error:", { error: extractErrorDetail(error) });
    process.exit(1);
});
