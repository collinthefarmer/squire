import type { EventStore } from "@core/events/event-store";
import type { StateStore } from "@core/state/state-store";
import type { ClientRegistry } from "@core/transport/client-registry";
import type { TimeEvent, TimeScaleChangedEvent } from "@types";
import { Logger } from "@utils/logger";

const logger = new Logger("TimeService");

export interface TimeScaleEntry {
    timestamp: number;
    scale: number;
}

/**
 * Time-scale service
 *
 * Manages the global time-scale multiplier. Validates scale values,
 * stores the current scale in StateStore, maintains a history of
 * scale changes for elapsed-time computation, and broadcasts
 * changes to all clients.
 */
export class TimeService {
    private scaleHistory: TimeScaleEntry[] = [];

    constructor(
        private eventStore: EventStore,
        private stateStore: StateStore,
        private clientRegistry: ClientRegistry,
    ) {
        this.setupEventListeners();
        logger.info("TimeService initialized");
    }

    /**
     * Get the full scale history for elapsed-time computation.
     */
    getScaleHistory(): TimeScaleEntry[] {
        return this.scaleHistory;
    }

    /**
     * Get the current time scale.
     */
    getCurrentScale(): number {
        const last = this.scaleHistory[this.scaleHistory.length - 1];
        return last?.scale ?? 1.0;
    }

    private setupEventListeners(): void {
        this.eventStore.ofType<TimeEvent>("time.*").subscribe((event) => {
            try {
                this.handleEvent(event);
            } catch (error) {
                logger.error("Failed to handle time event", { type: event.type, error: String(error) });
            }
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

        this.scaleHistory.push({
            timestamp: event.metadata.timestamp,
            scale,
        });

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
