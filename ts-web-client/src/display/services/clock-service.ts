import { BehaviorSubject, type Observable } from "rxjs";
import { Logger } from "@utils/logger";
import { ServiceRegistry } from "@services/service-registry";
import type { EventBus } from "@services/event-bus";
import type { TimeScaleService } from "@services/time-scale-service";
import type { ClockState } from "@services/clock-state";
import {
    getRemainingTime,
    applyClockCreate,
    applyClockStart,
    applyClockPause,
    applyClockAdjust,
    applyClockDestroy,
    applyClockUpdate,
    applyTimeScaleChange,
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
 * timestamps. Time-scale changes adjust running clocks' effective
 * countdown rate.
 */
export class DisplayClockService {
    private logger = new Logger("DisplayClockService");
    private clocks$ = new BehaviorSubject<Map<string, ClockState>>(new Map());

    constructor(private eventBus: EventBus) {
        this.setupEventListeners();
        this.setupTimeScaleListener();
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

    private getTimeScale(): number {
        try {
            const ts = ServiceRegistry.get<TimeScaleService>("TimeScaleService");
            return ts.getScale();
        } catch {
            return 1.0;
        }
    }

    private setupEventListeners(): void {
        this.eventBus.on("server:ui.clock.*", (event: unknown) => {
            this.handleEvent(event as { type: string });
        });
    }

    private setupTimeScaleListener(): void {
        this.eventBus.on("server:time.scale_changed", (event: unknown) => {
            const { scale } = (event as { payload: { scale: number } }).payload;
            this.logger.info("Time scale changed, updating clocks", { scale });
            const updated = applyTimeScaleChange(this.clocks$.value, scale);
            this.clocks$.next(updated);
        });
    }

    private handleEvent(event: { type: string }): void {
        const current = this.clocks$.value;
        const scale = this.getTimeScale();
        let updated: Map<string, ClockState>;

        switch (event.type) {
            case "ui.clock.create":
                updated = applyClockCreate(current, event as ClockCreateEvent, scale);
                this.logger.info("Clock created", { id: (event as ClockCreateEvent).payload.id });
                break;
            case "ui.clock.start":
                updated = applyClockStart(current, event as ClockStartEvent, scale);
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
