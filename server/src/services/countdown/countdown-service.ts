import type { EventStore } from "@core/events/event-store";
import type { ClientRegistry } from "@core/transport/client-registry";
import type { ClockEvent } from "@types";
import { Logger } from "@utils/logger";

const logger = new Logger("CountdownService");

/**
 * Countdown clock relay service
 *
 * Validates and rebroadcasts clock lifecycle events to all clients.
 * Clock timing is computed client-side from event timestamps —
 * the server is stateless with respect to clock time.
 *
 * Events are persisted in EventStore so new clients can reconstruct
 * clock state by replaying the lifecycle event history.
 */
export class CountdownService {
    constructor(
        private eventStore: EventStore,
        private clientRegistry: ClientRegistry,
    ) {
        this.setupEventListeners();
        logger.info("CountdownService initialized");
    }

    private setupEventListeners(): void {
        this.eventStore.ofType<ClockEvent>("ui.clock.*").subscribe((event) => {
            try {
                this.handleEvent(event);
            } catch (error) {
                logger.error("Failed to handle clock event", { type: event.type, error: String(error) });
            }
        });
    }

    private handleEvent(event: ClockEvent): void {
        logger.info(`Clock event: ${event.type}`, { id: event.payload.id });
        this.clientRegistry.broadcast(event);
    }
}
