import { Subject, Observable, Subscription } from "rxjs";
import { filter } from "rxjs/operators";
import type { Event } from "@types";
import { Logger } from "@utils/logger";

const logger = new Logger("EventBus");

type EventHandler<T = any> = (event: T) => void | Promise<void>;

/**
 * Central event bus for pub/sub
 *
 * Refactored to use RxJS internally while maintaining backward-compatible API.
 */
export class EventBus {
    private events$ = new Subject<Event>();
    private subscriptions = new Map<EventHandler, Subscription>();

    /**
     * Subscribe to events (legacy API - maintains compatibility)
     *
     * Supports exact match and wildcard patterns:
     * - "audio.play" matches only audio.play
     * - "audio.*" matches audio.play, audio.pause, etc.
     */
    on<T = any>(eventType: string, handler: EventHandler<T>): () => void {
        const subscription = this.events$
            .pipe(filter((e) => this.matchesPattern(e.type, eventType)))
            .subscribe((event) => {
                try {
                    handler(event as T);
                } catch (error) {
                    logger.error(`Error in event handler for ${eventType}:`, error);
                }
            });

        this.subscriptions.set(handler, subscription);

        return () => {
            subscription.unsubscribe();
            this.subscriptions.delete(handler);
        };
    }

    /**
     * Unsubscribe from events (legacy API)
     */
    off(_eventType: string, handler: EventHandler): void {
        const subscription = this.subscriptions.get(handler);
        if (subscription) {
            subscription.unsubscribe();
            this.subscriptions.delete(handler);
        }
    }

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
