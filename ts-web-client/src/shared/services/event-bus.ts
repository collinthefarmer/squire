/**
 * Typed event bus
 *
 * Strongly typed pub/sub for domain and system events.
 * No `any` types — subscribers receive properly narrowed
 * event types via the EventTypeMap interface.
 */

import { Subject, type Observable } from "rxjs";
import { filter } from "rxjs/operators";
import type {
    Event,
    AudioPlayEvent,
    AudioPauseEvent,
    AudioResumeEvent,
    AudioStopEvent,
    AudioVolumeEvent,
    AudioLoopEvent,
    AudioChannelEffectsEvent,
    ImageSetEvent,
    ImageClearEvent,
    ImageTransformEvent,
    ImageEffectEvent,
    ImageLayerConfigEvent,
    ClockCreateEvent,
    ClockStartEvent,
    ClockPauseEvent,
    ClockAdjustEvent,
    ClockDestroyEvent,
    ClockUpdateEvent,
    TimeScaleChangedEvent,
    SystemConnectedEvent,
    SystemClientListEvent,
    EventMetadata,
} from "@types";

/**
 * Exhaustive map from event type string literal to TypeScript type.
 */
export interface EventTypeMap {
    "audio.play": AudioPlayEvent;
    "audio.pause": AudioPauseEvent;
    "audio.resume": AudioResumeEvent;
    "audio.stop": AudioStopEvent;
    "audio.volume": AudioVolumeEvent;
    "audio.loop": AudioLoopEvent;
    "audio.channel_effects": AudioChannelEffectsEvent;
    "visual.image.set": ImageSetEvent;
    "visual.image.clear": ImageClearEvent;
    "visual.image.transform": ImageTransformEvent;
    "visual.image.effect": ImageEffectEvent;
    "visual.image.layer_config": ImageLayerConfigEvent;
    "ui.clock.create": ClockCreateEvent;
    "ui.clock.start": ClockStartEvent;
    "ui.clock.pause": ClockPauseEvent;
    "ui.clock.adjust": ClockAdjustEvent;
    "ui.clock.destroy": ClockDestroyEvent;
    "ui.clock.update": ClockUpdateEvent;
    "time.scale_changed": TimeScaleChangedEvent;
}

/**
 * Extract the union of event types whose key starts with a given prefix.
 */
type EventsWithPrefix<P extends string> = {
    [K in keyof EventTypeMap]: K extends `${P}${string}`
        ? EventTypeMap[K]
        : never;
}[keyof EventTypeMap];

/**
 * Client-only system event — emitted after replay completes.
 */
export interface SystemReplayCompleteEvent {
    type: "system.replay_complete";
    payload: { count: number };
    metadata: EventMetadata;
}

/** All events the bus can carry. */
export type BusEvent =
    | Event
    | SystemConnectedEvent
    | SystemClientListEvent
    | SystemReplayCompleteEvent;

export class EventBus {
    private readonly events$ = new Subject<BusEvent>();

    /**
     * Subscribe to a specific event type with full type narrowing.
     *
     *   bus.on("audio.play")  // Observable<AudioPlayEvent>
     */
    on<T extends keyof EventTypeMap>(type: T): Observable<EventTypeMap[T]> {
        return this.events$.pipe(
            filter((e): e is EventTypeMap[T] => e.type === type),
        );
    }

    /**
     * Subscribe to all events matching a prefix.
     *
     *   bus.onPrefix("audio.")  // Observable<AudioPlayEvent | AudioPauseEvent | ...>
     */
    onPrefix<P extends string>(prefix: P): Observable<EventsWithPrefix<P>> {
        return this.events$.pipe(
            filter((e): e is EventsWithPrefix<P> => e.type.startsWith(prefix)),
        );
    }

    /**
     * Subscribe to all events.
     */
    all$(): Observable<BusEvent> {
        return this.events$.asObservable();
    }

    /**
     * Emit an event to all subscribers.
     */
    emit(event: BusEvent): void {
        this.events$.next(event);
    }
}
