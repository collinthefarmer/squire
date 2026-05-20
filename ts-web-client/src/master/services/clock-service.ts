import { type Observable, map } from "rxjs";
import { ClockEventHandler } from "@services/clock-event-handler";
import { CLOCK_DISPLAY } from "@services/clock-state";
import type { ClockState } from "@services/clock-state";
import { calculatePosition } from "@utils/canvas-renderer";
import { DISPLAY } from "@shared/constants/display";
import { EventBuilder } from "./event-builder";
import type { ConnectionService } from "@services/connection-service";
import type { EventBus } from "@services/event-bus";
import type { CanvasObjectProvider } from "./canvas-object-provider";
import type { CanvasObject, DisplayBounds } from "./visual-service";
import type { ImagePosition } from "@types";

/**
 * Clock service for master client
 *
 * Extends ClockEventHandler for shared event/state logic.
 * Adds canvas-object computation and command dispatch.
 */
export class MasterClockService extends ClockEventHandler implements CanvasObjectProvider {
    private connectionService: ConnectionService;

    private readonly canvasObjects$ = this.clocks$.pipe(
        map((clocks) => this.computeCanvasObjects(clocks)),
    );

    constructor(connectionService: ConnectionService, eventBus: EventBus) {
        super("MasterClockService", eventBus);
        this.connectionService = connectionService;
    }

    // -- Canvas overlay integration --

    getCanvasObjects$(): Observable<CanvasObject[]> {
        return this.canvasObjects$;
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
                scale: clock.scale,
                zIndex: clock.zIndex,
            });
        }

        return objects;
    }

    private computeBounds(clock: ClockState): DisplayBounds {
        const baseW = CLOCK_DISPLAY.width;
        const baseH = CLOCK_DISPLAY.height;

        const x = calculatePosition(clock.position.x, DISPLAY.WIDTH, baseW);
        const y = calculatePosition(clock.position.y, DISPLAY.HEIGHT, baseH);

        const centerX = x + baseW / 2;
        const centerY = y + baseH / 2;
        const finalW = baseW * clock.scale;
        const finalH = baseH * clock.scale;

        return {
            x: centerX - finalW / 2,
            y: centerY - finalH / 2,
            width: finalW,
            height: finalH,
        };
    }

    // -- Commands --

    createClock(params: {
        id: string;
        duration: number;
        autoStart?: boolean;
        position?: ImagePosition;
        zIndex?: number;
        font?: string;
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
     * CanvasObjectProvider implementation — delegates to transformClock.
     */
    transformObject(
        id: string,
        position: ImagePosition,
        scale?: number,
    ): void {
        this.transformClock(id, position, scale);
    }

    transformClock(id: string, position: ImagePosition, scale?: number): void {
        this.logger.info("Transforming clock", { id, position, scale });
        this.connectionService.send(EventBuilder.clockUpdate({ id, position, scale }));
    }

    scaleClockDisplay(id: string, delta: number): void {
        const clock = this.getClocks().get(id);
        if (!clock) {
            return;
        }

        const newScale = Math.max(0.25, clock.scale + delta);
        this.logger.info("Scaling clock display", { id, scale: newScale });
        this.connectionService.send(EventBuilder.clockUpdate({ id, scale: newScale }));
    }
}
