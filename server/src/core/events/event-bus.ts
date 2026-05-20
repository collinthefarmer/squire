import { Subject, Observable, filter } from "rxjs";
import { matchesPattern } from "@utils/event-pattern";
import type { Event } from "@types";

/**
 * Central event bus for pub/sub
 *
 * Refactored to use RxJS internally while maintaining backward-compatible API.
 */
export class EventBus {
    private events$ = new Subject<Event>();

    /**
     * Get observable for event type (new RxJS API)
     */
    ofType$<T extends Event = Event>(pattern: string): Observable<T> {
        return this.events$.pipe(
            filter((e) => matchesPattern(e.type, pattern)),
        ) as Observable<T>;
    }

    /**
     * Get the raw event stream (new RxJS API)
     */
    all$(): Observable<Event> {
        return this.events$.asObservable();
    }

    /**
     * Emit an event to all subscribers
     */
    emit<T extends Event = Event>(event: T): void {
        this.events$.next(event);
    }

}
