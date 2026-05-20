/**
 * Shared clock event handling logic
 *
 * Both display and master clock services subscribe to the same
 * server events and apply identical state transformations. This
 * class encapsulates that shared behavior so each client only
 * adds its own concerns (display: nothing extra, master: canvas
 * objects + commands).
 */

import { BehaviorSubject, type Observable } from "rxjs";
import { Logger } from "@utils/logger";
import { ServiceRegistry } from "@services/service-registry";
import { TOKENS } from "@services/service-tokens";
import type { EventBus } from "@services/event-bus";
import type { TimeScaleService } from "@services/time-scale-service";
import type { ClockState } from "@services/clock-state";
import {
    applyClockCreate,
    applyClockStart,
    applyClockPause,
    applyClockAdjust,
    applyClockDestroy,
    applyClockUpdate,
    applyTimeScaleChange,
} from "@services/clock-state";
import type { ClockEvent } from "@types";

export class ClockEventHandler {
    protected logger: Logger;
    protected clocks$ = new BehaviorSubject<Map<string, ClockState>>(new Map());
    protected timeScaleService: TimeScaleService;

    constructor(loggerName: string, eventBus: EventBus) {
        this.logger = new Logger(loggerName);
        this.timeScaleService = ServiceRegistry.get(TOKENS.TimeScaleService);
        this.setupReconnectionListener(eventBus);
        this.setupClockEventListeners(eventBus);
        this.setupTimeScaleListener(eventBus);
    }

    getClocks$(): Observable<Map<string, ClockState>> {
        return this.clocks$.asObservable();
    }

    getClocks(): Map<string, ClockState> {
        return this.clocks$.value;
    }

    protected getTimeScale(): number {
        return this.timeScaleService.getScale();
    }

    private setupReconnectionListener(eventBus: EventBus): void {
        eventBus.on("server:system.connected", () => {
            this.logger.info("Resetting clock state for reconnection sync");
            this.clocks$.next(new Map());
        });
    }

    private setupClockEventListeners(eventBus: EventBus): void {
        eventBus.on("server:ui.clock.*", (event: unknown) => {
            try {
                this.handleClockEvent(event as ClockEvent);
            } catch (error) {
                this.logger.error("Failed to handle clock event", { error: String(error) });
            }
        });
    }

    private setupTimeScaleListener(eventBus: EventBus): void {
        eventBus.on("server:time.scale_changed", (event: unknown) => {
            try {
                const { scale } = (event as { payload: { scale: number } }).payload;
                const updated = applyTimeScaleChange(this.clocks$.value, scale);
                this.clocks$.next(updated);
            } catch (error) {
                this.logger.error("Failed to handle time scale change", { error: String(error) });
            }
        });
    }

    private handleClockEvent(event: ClockEvent): void {
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

        this.clocks$.next(updated);
    }
}
