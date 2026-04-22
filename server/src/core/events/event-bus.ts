import { Subject, Observable, filter } from "rxjs";
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
            filter((e) => this.matchesPattern(e.type, pattern)),
        ) as Observable<T>;
    }

    /**
     * Get the raw event stream (new RxJS API)
     */
    all$(): Observable<Event> {
        return this.events$.asObservable();
    }

    /**
     * Emit event (legacy API)
     */
    async emit<T = any>(_eventType: string, event: T): Promise<void> {
        this.events$.next(event as Event);
    }

    /**
     * Emit event synchronously (legacy API - same behavior with RxJS)
     */
    emitSync<T = any>(_eventType: string, event: T): void {
        this.events$.next(event as Event);
    }

    private matchesPattern(type: string, pattern: string): boolean {
        if (pattern === "*") {
            return true;
        }

        if (pattern.endsWith(".*")) {
            const prefix = pattern.slice(0, -1);
            return type.startsWith(prefix);
        }

        return type === pattern;
    }
}
