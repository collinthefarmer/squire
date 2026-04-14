import { BehaviorSubject, type Observable } from "rxjs";
import { Logger } from "@utils/logger";
import type { EventBus } from "@services/event-bus";
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

    constructor(eventBus: EventBus) {
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
}
