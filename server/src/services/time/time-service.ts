import type { EventStore } from "@core/events/event-store";
import type { StateStore } from "@core/state/state-store";
import type { ClientRegistry } from "@core/transport/client-registry";
import type { TimeEvent, TimeScaleChangedEvent } from "@types";
import { Logger } from "@utils/logger";

const logger = new Logger("TimeService");

/**
 * Time-scale service
 *
 * Manages the global time-scale multiplier. Validates scale values,
 * stores the current scale in StateStore, and broadcasts changes
 * to all clients.
 */
export class TimeService {
    constructor(
        private eventStore: EventStore,
        private stateStore: StateStore,
        private clientRegistry: ClientRegistry,
    ) {
        this.setupEventListeners();
        logger.info("TimeService initialized");
    }

    private setupEventListeners(): void {
        this.eventStore.ofType<TimeEvent>("time.*").subscribe((event) => {
            this.handleEvent(event);
        });
    }

    private handleEvent(event: TimeEvent): void {
        switch (event.type) {
            case "time.scale_changed":
                this.handleScaleChanged(event);
                break;
        }
    }

    private handleScaleChanged(event: TimeScaleChangedEvent): void {
        const scale = Math.max(0, Math.min(10, event.payload.scale));

        logger.info("Time scale changed", { scale });

        this.stateStore.updateState((state) => ({
            ...state,
            time: { scale },
        }));

        this.clientRegistry.broadcast({
            ...event,
            payload: { scale },
        });
    }
}
