import { ClockEventHandler } from "@services/clock-event-handler";
import { getRemainingTime } from "@services/clock-state";
import type { ClockState } from "@services/clock-state";
import type { EventBus } from "@services/event-bus";

/**
 * Clock service for display client
 *
 * Inherits event handling and state management from ClockEventHandler.
 * Adds convenience accessors for the display renderer.
 */
export class DisplayClockService extends ClockEventHandler {
    constructor(eventBus: EventBus) {
        super("DisplayClockService", eventBus);
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
}
