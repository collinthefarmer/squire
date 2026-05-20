import { BehaviorSubject, type Observable } from "rxjs";
import { Logger } from "@utils/logger";
import type { EventBus } from "@services/event-bus";
import type { ConnectionService } from "@services/connection-service";
import type { TimeScaleChangedEvent } from "@types";

/**
 * Client-side time-scale service
 *
 * Subscribes to server time-scale events and exposes the current
 * global time-scale multiplier as a reactive observable. Shared
 * between display and master clients.
 */
export class TimeScaleService {
    private logger = new Logger("TimeScaleService");
    private scale$ = new BehaviorSubject<number>(1.0);
    private connectionService: ConnectionService | null;

    constructor(eventBus: EventBus, connectionService?: ConnectionService) {
        this.connectionService = connectionService ?? null;

        eventBus.on("server:system.connected", () => {
            this.scale$.next(1.0);
        });

        eventBus.on("server:time.scale_changed", (event: unknown) => {
            const { scale } = (event as TimeScaleChangedEvent).payload;
            this.logger.info("Time scale changed", { scale });
            this.scale$.next(scale);
        });
    }

    getScale$(): Observable<number> {
        return this.scale$.asObservable();
    }

    getScale(): number {
        return this.scale$.value;
    }

    setScale(scale: number): void {
        if (!this.connectionService) {
            this.logger.warn("Cannot set scale — no connection service");
            return;
        }

        this.connectionService.send({
            type: "time.scale_changed",
            payload: { scale },
            metadata: { timestamp: Date.now(), source: "master-client" },
        });
    }
}
