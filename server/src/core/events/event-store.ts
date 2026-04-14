import { Subject, Observable } from "rxjs";
import { filter } from "rxjs/operators";
import type { Event } from "@types";
import { Logger } from "@utils/logger";
import { audioReplay, imageReplay, clockReplay } from "./replay-configs";
import type { ReplayDomain } from "./replay-domain";

const logger = new Logger("EventStore");

/**
 * EventStore configuration
 */
export interface EventStoreConfig {
    bufferSize?: number;
}

/**
 * EventStore - Source of truth for all events
 *
 * Maintains event streams with replay capability for client synchronization.
 * Domain replay behavior is defined declaratively in replay-configs.ts
 * using the creation-centric rule system (see ReplayDomain).
 */
export class EventStore {
    private events$ = new Subject<Event>();

    private domains: Array<{ prefix: string; domain: ReplayDomain }> = [
        { prefix: "audio.", domain: audioReplay },
        { prefix: "visual.image.", domain: imageReplay },
        { prefix: "ui.clock.", domain: clockReplay },
    ];

    private currentTimeEvent: Event | null = null;

    constructor(_config: EventStoreConfig = {}) {
        logger.info("EventStore initialized", { bufferSize: _config.bufferSize });
    }

    /**
     * Append event to store and notify subscribers
     */
    append(event: Event): void {
        this.events$.next(event);
        this.updateDomainStore(event);
        logger.debug("Event appended", { type: event.type });
    }

    /**
     * Get all events stream
     */
    all$(): Observable<Event> {
        return this.events$.asObservable();
    }

    /**
     * Get events matching a type pattern
     *
     * Supports exact match and wildcard patterns:
     * - "audio.play" matches only audio.play
     * - "audio.*" matches audio.play, audio.pause, etc.
     * - "*" matches all events
     */
    ofType<T extends Event = Event>(pattern: string): Observable<T> {
        return this.events$.pipe(
            filter((e) => this.matchesPattern(e.type, pattern)),
        ) as Observable<T>;
    }

    /**
     * Get events to replay for a new client.
     *
     * Returns the "current effective" events from all domains.
     * Each domain's replay rules determine what events are included.
     */
    getReplayEvents(): Event[] {
        const events: Event[] = [];

        for (const { domain } of this.domains) {
            events.push(...domain.getReplayEvents());
        }

        if (this.currentTimeEvent) {
            events.push(this.currentTimeEvent);
        }

        logger.debug("Replay events retrieved", { count: events.length });
        return events;
    }

    /**
     * Route events to the appropriate replay domain.
     */
    private updateDomainStore(event: Event): void {
        for (const { prefix, domain } of this.domains) {
            if (event.type.startsWith(prefix)) {
                domain.update(event);
                return;
            }
        }

        // Time events: simple replacement (no domain needed)
        if (event.type.startsWith("time.")) {
            this.currentTimeEvent = event;
        }
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
