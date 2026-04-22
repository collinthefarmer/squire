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
    ClockEvent,
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
    private timeScaleService: TimeScaleService;

    constructor(private eventBus: EventBus) {
        this.timeScaleService =
            ServiceRegistry.get<TimeScaleService>("TimeScaleService");
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
        return this.timeScaleService.getScale();
    }

    private setupEventListeners(): void {
        this.eventBus.on("server:ui.clock.*", (event: unknown) => {
            try {
                this.handleEvent(event as ClockEvent);
            } catch (error) {
                this.logger.error("Failed to handle clock event", { error: String(error) });
            }
        });
    }

    private setupTimeScaleListener(): void {
        this.eventBus.on("server:time.scale_changed", (event: unknown) => {
            try {
                const { scale } = (event as { payload: { scale: number } }).payload;
                this.logger.info("Time scale changed, updating clocks", { scale });
                const updated = applyTimeScaleChange(this.clocks$.value, scale);
                this.clocks$.next(updated);
            } catch (error) {
                this.logger.error("Failed to handle time scale change", { error: String(error) });
            }
        });
    }

    private handleEvent(event: ClockEvent): void {
        const current = this.clocks$.value;
        const scale = this.getTimeScale();

        const handlers: {
            [K in ClockEvent["type"]]: (e: Extract<ClockEvent, { type: K }>) => Map<string, ClockState>;
        } = {
            "ui.clock.create": (e) => applyClockCreate(current, e, scale),
            "ui.clock.start": (e) => applyClockStart(current, e, scale),
            "ui.clock.pause": (e) => applyClockPause(current, e),
            "ui.clock.adjust": (e) => applyClockAdjust(current, e),
            "ui.clock.destroy": (e) => applyClockDestroy(current, e),
            "ui.clock.update": (e) => applyClockUpdate(current, e),
        };

        const handler = handlers[event.type];
        const updated = (handler as (e: ClockEvent) => Map<string, ClockState>)(event);

        this.logger.info(event.type, { id: event.payload.id });
        this.clocks$.next(updated);
    }
}
