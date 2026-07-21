/**
 * Reactive application store
 *
 * Wraps pure reducers from state/ with RxJS BehaviorSubjects.
 * Single source of truth for all client-side state.
 *
 * dispatch() applies locally + sends to server (optimistic).
 * applyEvent() applies locally only (incoming/replay events).
 */

import { BehaviorSubject, type Observable } from "rxjs";
import type {
    AudioChannelState,
    ImageLayerState,
    DomainEvent,
    ChannelId,
    LayerId,
    ClockId,
} from "@types";
import type { ClockState } from "@state/clock-state";

import {
    applyAudioPlay,
    applyAudioPause,
    applyAudioResume,
    applyAudioStop,
    applyAudioLoop,
    applyAudioVolume,
    applyAudioChannelEffects,
} from "@state/audio-channel-state";

import {
    applyImageSet,
    applyImageClear,
    applyImageTransform,
    applyImageEffect,
    applyImageLayerConfig,
} from "@state/layer-state";

import {
    applyClockCreate,
    applyClockStart,
    applyClockPause,
    applyClockAdjust,
    applyClockDestroy,
    applyClockUpdate,
    applyTimeScaleChange,
} from "@state/clock-state";

import { EventBus } from "./event-bus";
import { Logger } from "@utils/logger";

const logger = new Logger("Store");

export class AppStore {
    private readonly _channels$ = new BehaviorSubject<
        Map<ChannelId, AudioChannelState>
    >(new Map());
    private readonly _layers$ = new BehaviorSubject<
        Map<LayerId, ImageLayerState>
    >(new Map());
    private readonly _clocks$ = new BehaviorSubject<Map<ClockId, ClockState>>(
        new Map(),
    );
    private readonly _timeScale$ = new BehaviorSubject<number>(1.0);
    private readonly _clientId$ = new BehaviorSubject<string | null>(null);

    constructor(
        readonly eventBus: EventBus,
        private readonly sendToServer: (event: DomainEvent) => void,
    ) {}

    // -- Read-only observables --

    get channels$(): Observable<Map<ChannelId, AudioChannelState>> {
        return this._channels$.asObservable();
    }

    get layers$(): Observable<Map<LayerId, ImageLayerState>> {
        return this._layers$.asObservable();
    }

    get clocks$(): Observable<Map<ClockId, ClockState>> {
        return this._clocks$.asObservable();
    }

    get timeScale$(): Observable<number> {
        return this._timeScale$.asObservable();
    }

    get clientId$(): Observable<string | null> {
        return this._clientId$.asObservable();
    }

    // -- Sync getters --

    get channels(): Map<ChannelId, AudioChannelState> {
        return this._channels$.value;
    }

    get layers(): Map<LayerId, ImageLayerState> {
        return this._layers$.value;
    }

    get clocks(): Map<ClockId, ClockState> {
        return this._clocks$.value;
    }

    get timeScale(): number {
        return this._timeScale$.value;
    }

    get clientId(): string | null {
        return this._clientId$.value;
    }

    /**
     * Dispatch an event: apply locally then send to server.
     */
    dispatch(event: DomainEvent): void {
        this.applyEvent(event);
        this.sendToServer(event);
    }

    /**
     * Apply an event locally only.
     * Used for incoming live events from the server.
     */
    applyEvent(event: DomainEvent): void {
        this.routeToReducer(event);
        this.eventBus.emit(event);
    }

    /**
     * Apply a batch of replay events.
     *
     * Applies all reducers without per-event bus emission.
     * Emits a single replay_complete signal when done.
     */
    applyReplay(events: DomainEvent[]): void {
        for (const event of events) {
            this.routeToReducer(event);
        }

        this.eventBus.emit({
            type: "system.replay_complete",
            payload: { count: events.length },
            metadata: { timestamp: Date.now(), source: "store" },
        });
    }

    setClientId(clientId: string): void {
        this._clientId$.next(clientId);
    }

    /**
     * Reset all state. Called before replaying on reconnect.
     */
    reset(): void {
        this._channels$.next(new Map());
        this._layers$.next(new Map());
        this._clocks$.next(new Map());
        this._timeScale$.next(1.0);
    }

    // -- Private --

    private routeToReducer(event: DomainEvent): void {
        switch (event.type) {
            case "audio.play":
                this._channels$.next(
                    applyAudioPlay(this._channels$.value, event),
                );
                break;

            case "audio.pause":
                this._channels$.next(
                    applyAudioPause(this._channels$.value, event),
                );
                break;

            case "audio.resume":
                this._channels$.next(
                    applyAudioResume(this._channels$.value, event),
                );
                break;

            case "audio.stop":
                this._channels$.next(
                    applyAudioStop(this._channels$.value, event),
                );
                break;

            case "audio.loop":
                this._channels$.next(
                    applyAudioLoop(this._channels$.value, event),
                );
                break;

            case "audio.volume":
                this._channels$.next(
                    applyAudioVolume(this._channels$.value, event),
                );
                break;

            case "audio.channel_effects":
                this._channels$.next(
                    applyAudioChannelEffects(this._channels$.value, event),
                );
                break;

            case "visual.image.set":
                this._layers$.next(applyImageSet(this._layers$.value, event));
                break;

            case "visual.image.clear":
                this._layers$.next(applyImageClear(this._layers$.value, event));
                break;

            case "visual.image.transform":
                this._layers$.next(
                    applyImageTransform(this._layers$.value, event),
                );
                break;

            case "visual.image.effect":
                this._layers$.next(
                    applyImageEffect(this._layers$.value, event),
                );
                break;

            case "visual.image.layer_config":
                this._layers$.next(
                    applyImageLayerConfig(this._layers$.value, event),
                );
                break;

            case "ui.clock.create":
                this._clocks$.next(
                    applyClockCreate(
                        this._clocks$.value,
                        event,
                        this._timeScale$.value,
                    ),
                );
                break;

            case "ui.clock.start":
                this._clocks$.next(
                    applyClockStart(
                        this._clocks$.value,
                        event,
                        this._timeScale$.value,
                    ),
                );
                break;

            case "ui.clock.pause":
                this._clocks$.next(applyClockPause(this._clocks$.value, event));
                break;

            case "ui.clock.adjust":
                this._clocks$.next(
                    applyClockAdjust(this._clocks$.value, event),
                );
                break;

            case "ui.clock.destroy":
                this._clocks$.next(
                    applyClockDestroy(this._clocks$.value, event),
                );
                break;

            case "ui.clock.update":
                this._clocks$.next(
                    applyClockUpdate(this._clocks$.value, event),
                );
                break;

            case "time.scale_changed":
                this._clocks$.next(
                    applyTimeScaleChange(
                        this._clocks$.value,
                        event.payload.scale,
                    ),
                );
                this._timeScale$.next(event.payload.scale);
                break;

            default:
                logger.debug("Unhandled event type", {
                    type: (event as DomainEvent).type,
                });
        }
    }
}
