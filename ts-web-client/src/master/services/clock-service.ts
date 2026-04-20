import { BehaviorSubject, type Observable } from "rxjs";
import { map } from "rxjs";
import { Logger } from "@utils/logger";
import { ServiceRegistry } from "@services/service-registry";
import type { EventBus } from "@services/event-bus";
import type { ConnectionService } from "@services/connection-service";
import type { ClockState } from "@services/clock-state";
import type { TimeScaleService } from "@services/time-scale-service";
import {
    CLOCK_DISPLAY,
    applyClockCreate,
    applyClockStart,
    applyClockPause,
    applyClockAdjust,
    applyClockDestroy,
    applyClockUpdate,
    applyTimeScaleChange,
} from "@services/clock-state";
import { calculatePosition } from "@utils/canvas-renderer";
import { DISPLAY } from "@shared/constants/display";
import { EventBuilder } from "./event-builder";
import type { CanvasObjectProvider } from "./canvas-object-provider";
import type { CanvasObject, DisplayBounds } from "./visual-service";
import type {
    ImagePosition,
    ClockCreateEvent,
    ClockStartEvent,
    ClockPauseEvent,
    ClockAdjustEvent,
    ClockDestroyEvent,
    ClockUpdateEvent,
} from "@types";

/**
 * Clock service for master client
 *
 * Manages client-computed clock state and produces CanvasObject
 * entries for the canvas overlay system. Subscribes to server
 * events to receive its own events back for state confirmation.
 */
export class MasterClockService implements CanvasObjectProvider {
    private logger = new Logger("MasterClockService");
    private connectionService: ConnectionService;
    private timeScaleService: TimeScaleService;
    private clocks$ = new BehaviorSubject<Map<string, ClockState>>(new Map());

    constructor(connectionService: ConnectionService, eventBus: EventBus) {
        this.connectionService = connectionService;
        this.timeScaleService =
            ServiceRegistry.get<TimeScaleService>("TimeScaleService");
        this.setupEventListeners(eventBus);
        this.setupTimeScaleListener(eventBus);
    }

    private getTimeScale(): number {
        return this.timeScaleService.getScale();
    }

    private setupTimeScaleListener(eventBus: EventBus): void {
        eventBus.on("server:time.scale_changed", (event: unknown) => {
            const { scale } = (event as { payload: { scale: number } }).payload;
            const updated = applyTimeScaleChange(this.clocks$.value, scale);
            this.clocks$.next(updated);
        });
    }

    // -- State access --

    getClocks$(): Observable<Map<string, ClockState>> {
        return this.clocks$.asObservable();
    }

    getClocks(): Map<string, ClockState> {
        return this.clocks$.value;
    }

    // -- Canvas overlay integration --

    getCanvasObjects$(): Observable<CanvasObject[]> {
        return this.clocks$.pipe(
            map((clocks) => this.computeCanvasObjects(clocks)),
        );
    }

    private computeCanvasObjects(
        clocks: Map<string, ClockState>,
    ): CanvasObject[] {
        const objects: CanvasObject[] = [];

        for (const [id, clock] of clocks) {
            if (!clock.visible) {
                continue;
            }

            objects.push({
                id,
                type: "clock",
                bounds: this.computeBounds(clock),
                scale: 1,
                zIndex: clock.zIndex,
            });
        }

        return objects;
    }

    private computeBounds(clock: ClockState): DisplayBounds {
        const x = calculatePosition(
            clock.position.x,
            DISPLAY.WIDTH,
            CLOCK_DISPLAY.width,
        );
        const y = calculatePosition(
            clock.position.y,
            DISPLAY.HEIGHT,
            CLOCK_DISPLAY.height,
        );

        return {
            x,
            y,
            width: CLOCK_DISPLAY.width,
            height: CLOCK_DISPLAY.height,
        };
    }

    // -- Commands --

    createClock(params: {
        id: string;
        duration: number;
        autoStart?: boolean;
        position?: ImagePosition;
        zIndex?: number;
        respectTimeScale?: boolean;
        visibility?: "always" | "hidden" | "dm-only";
        onComplete?: "persist" | "auto-hide" | "auto-destroy";
    }): void {
        this.logger.info("Creating clock", params);
        this.connectionService.send(EventBuilder.clockCreate(params));
    }

    startClock(id: string): void {
        this.logger.info("Starting clock", { id });
        this.connectionService.send(EventBuilder.clockStart({ id }));
    }

    pauseClock(id: string): void {
        this.logger.info("Pausing clock", { id });
        this.connectionService.send(EventBuilder.clockPause({ id }));
    }

    adjustClock(id: string, delta: number): void {
        this.logger.info("Adjusting clock", { id, delta });
        this.connectionService.send(EventBuilder.clockAdjust({ id, delta }));
    }

    destroyClock(id: string): void {
        this.logger.info("Destroying clock", { id });
        this.connectionService.send(EventBuilder.clockDestroy({ id }));
    }

    /**
     * Reposition a clock on the display.
     */
    /**
     * CanvasObjectProvider implementation — delegates to transformClock.
     */
    transformObject(
        id: string,
        position: ImagePosition,
        _scale?: number,
    ): void {
        this.transformClock(id, position);
    }

    transformClock(id: string, position: ImagePosition): void {
        this.logger.info("Transforming clock", { id, position });
        this.connectionService.send(EventBuilder.clockUpdate({ id, position }));
    }

    // -- Event handling --

    private setupEventListeners(eventBus: EventBus): void {
        eventBus.on("server:ui.clock.*", (event: unknown) => {
            this.handleEvent(event as { type: string });
        });
    }

    private handleEvent(event: { type: string }): void {
        const current = this.clocks$.value;
        const scale = this.getTimeScale();
        let updated: Map<string, ClockState>;

        switch (event.type) {
            case "ui.clock.create":
                updated = applyClockCreate(
                    current,
                    event as ClockCreateEvent,
                    scale,
                );
                break;
            case "ui.clock.start":
                updated = applyClockStart(
                    current,
                    event as ClockStartEvent,
                    scale,
                );
                break;
            case "ui.clock.pause":
                updated = applyClockPause(current, event as ClockPauseEvent);
                break;
            case "ui.clock.adjust":
                updated = applyClockAdjust(current, event as ClockAdjustEvent);
                break;
            case "ui.clock.destroy":
                updated = applyClockDestroy(
                    current,
                    event as ClockDestroyEvent,
                );
                break;
            case "ui.clock.update":
                updated = applyClockUpdate(current, event as ClockUpdateEvent);
                break;
            default:
                return;
        }

        this.clocks$.next(updated);
    }
}
