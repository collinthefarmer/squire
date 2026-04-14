import { BehaviorSubject, type Observable } from "rxjs";
import { Logger } from "@utils/logger";
import type { EventBus } from "@services/event-bus";
import type { ClockState } from "@services/clock-state";
import {
    getRemainingTime,
    applyClockCreate,
    applyClockStart,
    applyClockPause,
    applyClockAdjust,
    applyClockDestroy,
    applyClockUpdate,
} from "@services/clock-state";
import type {
    ClockCreateEvent,
    ClockStartEvent,
    ClockPauseEvent,
    ClockAdjustEvent,
    ClockDestroyEvent,
    ClockUpdateEvent,
} from "@types";

/**
 * Clock service for display client
 *
 * Subscribes to server clock events and maintains client-side
 * clock state. Remaining time is computed locally from event
 * timestamps — no server-side tick required.
 */
export class DisplayClockService {
    private logger = new Logger("DisplayClockService");
    private clocks$ = new BehaviorSubject<Map<string, ClockState>>(new Map());

    constructor(private eventBus: EventBus) {
        this.setupEventListeners();
    }

    getClocks$(): Observable<Map<string, ClockState>> {
        return this.clocks$.asObservable();
    }

    getClocks(): Map<string, ClockState> {
        return this.clocks$.value;
    }

    getClock(id: string): ClockState | undefined {
        return this.clocks$.value.get(id);
    }

    getRemainingTime(id: string): number {
        const clock = this.clocks$.value.get(id);
        if (!clock) {
            return 0;
        }
        return getRemainingTime(clock);
    }

    private setupEventListeners(): void {
        this.eventBus.on("server:ui.clock.*", (event: unknown) => {
            this.handleEvent(event as { type: string });
        });
    }

    private handleEvent(event: { type: string }): void {
        const current = this.clocks$.value;
        let updated: Map<string, ClockState>;

        switch (event.type) {
            case "ui.clock.create":
                updated = applyClockCreate(current, event as ClockCreateEvent);
                this.logger.info("Clock created", { id: (event as ClockCreateEvent).payload.id });
                break;
            case "ui.clock.start":
                updated = applyClockStart(current, event as ClockStartEvent);
                this.logger.info("Clock started", { id: (event as ClockStartEvent).payload.id });
                break;
            case "ui.clock.pause":
                updated = applyClockPause(current, event as ClockPauseEvent);
                this.logger.info("Clock paused", { id: (event as ClockPauseEvent).payload.id });
                break;
            case "ui.clock.adjust":
                updated = applyClockAdjust(current, event as ClockAdjustEvent);
                this.logger.info("Clock adjusted", { id: (event as ClockAdjustEvent).payload.id });
                break;
            case "ui.clock.destroy":
                updated = applyClockDestroy(current, event as ClockDestroyEvent);
                this.logger.info("Clock destroyed", { id: (event as ClockDestroyEvent).payload.id });
                break;
            case "ui.clock.update":
                updated = applyClockUpdate(current, event as ClockUpdateEvent);
                this.logger.info("Clock updated", { id: (event as ClockUpdateEvent).payload.id });
                break;
            default:
                return;
        }

        this.clocks$.next(updated);
    }
}
