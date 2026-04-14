import { Subject, Observable } from "rxjs";
import { filter } from "rxjs/operators";
import type {
    Event,
    AudioPlayPayload,
    AudioVolumeEvent,
} from "@types";
import { Logger } from "@utils/logger";

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
 * Events are stored per-domain with smart supersession rules.
 */
export class EventStore {
    private events$ = new Subject<Event>();

    // Track "current effective" events per entity for replay
    private currentAudioState = new Map<string, Event[]>();
    private currentImageState = new Map<string, Event[]>();
    private currentClockState = new Map<string, Event[]>();

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
     * Get events to replay for a new client
     *
     * Returns only the "current effective" events, not full history.
     * Audio channels return event sequences (play, possibly pause/resume).
     * Image layers return set + config + effects events.
     */
    getReplayEvents(): Event[] {
        const events: Event[] = [];

        for (const channelEvents of this.currentAudioState.values()) {
            events.push(...channelEvents);
        }

        for (const layerEvents of this.currentImageState.values()) {
            events.push(...layerEvents);
        }

        for (const clockEvents of this.currentClockState.values()) {
            events.push(...clockEvents);
        }

        logger.debug("Replay events retrieved", { count: events.length });
        return events;
    }

    /**
     * Update domain-specific tracking for smart replay
     */
    private updateDomainStore(event: Event): void {
        if (event.type.startsWith("audio.")) {
            this.updateAudioStore(event);
        } else if (event.type.startsWith("visual.image.")) {
            this.updateImageStore(event);
        } else if (event.type.startsWith("ui.clock.")) {
            this.updateClockStore(event);
        }
    }

    private updateAudioStore(event: Event): void {
        const payload = event.payload as { channel: string };
        const channelId = payload.channel;

        switch (event.type) {
            case "audio.play":
                // Start fresh replay sequence with play event
                this.currentAudioState.set(channelId, [event]);
                break;

            case "audio.stop":
                // Remove from replay - nothing to sync
                this.currentAudioState.delete(channelId);
                break;

            case "audio.pause": {
                // Append pause event to replay sequence
                const pauseEvents = this.currentAudioState.get(channelId);
                if (pauseEvents) {
                    // Remove any previous pause (in case of pause→resume→pause)
                    const filtered = pauseEvents.filter(
                        (e) => e.type !== "audio.pause",
                    );
                    filtered.push(event);
                    this.currentAudioState.set(channelId, filtered);
                }
                break;
            }

            case "audio.resume": {
                // Resume removes the pause event from sequence
                const resumeEvents = this.currentAudioState.get(channelId);
                if (resumeEvents) {
                    // Find the pause event to calculate elapsed time
                    const pauseEvent = resumeEvents.find(
                        (e) => e.type === "audio.pause",
                    );
                    const playEvent = resumeEvents.find(
                        (e) => e.type === "audio.play",
                    );

                    if (pauseEvent && playEvent) {
                        // Calculate time spent paused and adjust play timestamp
                        const pausedAt = pauseEvent.metadata.timestamp;
                        const resumedAt = event.metadata.timestamp;
                        const pauseDuration = resumedAt - pausedAt;

                        // Create adjusted play event with shifted timestamp
                        const adjustedPlay: Event = {
                            ...playEvent,
                            metadata: {
                                ...playEvent.metadata,
                                timestamp:
                                    playEvent.metadata.timestamp + pauseDuration,
                            },
                        };

                        this.currentAudioState.set(channelId, [adjustedPlay]);
                    } else {
                        // No pause to resume from, just keep play event
                        const filtered = resumeEvents.filter(
                            (e) => e.type === "audio.play",
                        );
                        this.currentAudioState.set(channelId, filtered);
                    }
                }
                break;
            }

            case "audio.volume": {
                // Volume changes update the play event's volume
                const volEvents = this.currentAudioState.get(channelId);
                if (volEvents && volEvents.length > 0) {
                    const playIndex = volEvents.findIndex(
                        (e) => e.type === "audio.play",
                    );
                    if (playIndex !== -1) {
                        const playEvent = volEvents[playIndex];
                        const volPayload = (event as AudioVolumeEvent).payload;

                        const updatedPlay: Event = {
                            ...playEvent,
                            payload: {
                                ...(playEvent.payload as AudioPlayPayload),
                                volume: volPayload.volume,
                            },
                        };

                        volEvents[playIndex] = updatedPlay;
                    }
                }
                break;
            }
        }
    }

    private updateImageStore(event: Event): void {
        const payload = event.payload as { layer: string };
        const layerId = payload.layer;

        switch (event.type) {
            case "visual.image.set":
                // Start fresh for this layer
                this.currentImageState.set(layerId, [event]);
                break;

            case "visual.image.clear":
                // Remove from replay
                this.currentImageState.delete(layerId);
                break;

            case "visual.image.transform": {
                // Replace any existing transform event
                const transformEvents = this.currentImageState.get(layerId);
                if (transformEvents) {
                    const filtered = transformEvents.filter(
                        (e) => e.type !== "visual.image.transform",
                    );
                    filtered.push(event);
                    this.currentImageState.set(layerId, filtered);
                }
                break;
            }

            case "visual.image.effect": {
                // Replace any existing effect event (effects are always complete)
                const effectEvents = this.currentImageState.get(layerId);
                if (effectEvents) {
                    const filtered = effectEvents.filter(
                        (e) => e.type !== "visual.image.effect",
                    );
                    filtered.push(event);
                    this.currentImageState.set(layerId, filtered);
                }
                break;
            }

            case "visual.image.layer_config": {
                // Replace any existing config event
                const configEvents = this.currentImageState.get(layerId);
                if (configEvents) {
                    const filtered = configEvents.filter(
                        (e) => e.type !== "visual.image.layer_config",
                    );
                    filtered.push(event);
                    this.currentImageState.set(layerId, filtered);
                }
                break;
            }
        }
    }

    private updateClockStore(event: Event): void {
        const payload = event.payload as { id: string };
        const clockId = payload.id;

        switch (event.type) {
            case "ui.clock.create":
                this.currentClockState.set(clockId, [event]);
                break;

            case "ui.clock.destroy":
                this.currentClockState.delete(clockId);
                break;

            case "ui.clock.start": {
                const events = this.currentClockState.get(clockId);
                if (events) {
                    // Only the latest start matters — remove any previous
                    const filtered = events.filter((e) => e.type !== "ui.clock.start");
                    filtered.push(event);
                    this.currentClockState.set(clockId, filtered);
                }
                break;
            }

            case "ui.clock.pause":
            case "ui.clock.adjust": {
                const events = this.currentClockState.get(clockId);
                if (events) {
                    events.push(event);
                }
                break;
            }

            case "ui.clock.update": {
                const events = this.currentClockState.get(clockId);
                if (events) {
                    const filtered = events.filter((e) => e.type !== "ui.clock.update");
                    filtered.push(event);
                    this.currentClockState.set(clockId, filtered);
                }
                break;
            }
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
