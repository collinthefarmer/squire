import type { Event } from "@types";
import type { TimeService } from "@services/time/time-service";
import { getAudioDuration } from "@core/http/handlers/assets-metadata";
import { computeGameTimeElapsed } from "@utils/game-time";
import {
    withGameTimestamp,
    extractRunIntervals,
    sumIntervals,
} from "@utils/time-scale-replay";
import { defineReplay } from "./replay-domain";

/**
 * Custom transform for audio.resume.
 *
 * Finds the pause event in the sequence, calculates how long
 * the audio was paused, shifts the play event's timestamp
 * forward by that duration, and returns a sequence with just
 * the adjusted play event (removing the pause).
 */
function handleAudioResume(sequence: Event[], resumeEvent: Event): Event[] {
    const playEvent = sequence.find((e) => e.type === "audio.play");
    const pauseEvent = sequence.find((e) => e.type === "audio.pause");

    if (!playEvent) {
        return sequence;
    }

    if (!pauseEvent) {
        return [playEvent];
    }

    const pausedAt = pauseEvent.metadata.timestamp;
    const resumedAt = resumeEvent.metadata.timestamp;
    const pauseDuration = resumedAt - pausedAt;

    const adjustedPlay: Event = {
        ...playEvent,
        metadata: {
            ...playEvent.metadata,
            timestamp: playEvent.metadata.timestamp + pauseDuration,
        },
    };

    return [adjustedPlay];
}

/**
 * Create audio replay rules.
 *
 * Includes a replayFilter that excludes finished non-looping audio,
 * and a replayTransform that adds gameTimestamp for time-scale-aware
 * playback position computation.
 */
export function createAudioReplay(timeService: TimeService) {
    // Key by trackId (stamped by server on play events) with channel as fallback
    const audioKey = (event: Event) => {
        const payload = event.payload as { trackId?: string; channel?: string };
        return payload.trackId ?? payload.channel;
    };

    return defineReplay(audioKey, {
        "audio.play": {
            removes: ["audio.stop"],
            folds: {
                "audio.volume": ["volume"],
                "audio.resume": { transform: handleAudioResume },
            },
            replaces: ["audio.pause"],

            replayFilter: (sequence) => {
                const playEvent = sequence.find((e) => e.type === "audio.play");
                if (!playEvent) {
                    return false;
                }

                const payload = playEvent.payload as {
                    loop?: boolean;
                    respectTimeScale?: boolean;
                    source?: { type?: string; ref?: string };
                };

                // Live audio can't be replayed — master re-offers WebRTC
                if (payload.source?.type === "live") {
                    return false;
                }

                if (payload.loop) {
                    return true;
                }

                if (sequence.some((e) => e.type === "audio.pause")) {
                    return true;
                }

                const sourceRef = payload.source?.ref;
                if (!sourceRef) {
                    return true;
                }

                const duration = getAudioDuration(sourceRef);
                if (duration === undefined) {
                    return true;
                }

                const durationMs = duration * 1000;
                const elapsed =
                    payload.respectTimeScale !== false
                        ? computeGameTimeElapsed(
                              playEvent.metadata.timestamp,
                              timeService.getScaleHistory(),
                          )
                        : Date.now() - playEvent.metadata.timestamp;

                return elapsed < durationMs;
            },

            replayTransform: (sequence) => {
                const play = sequence.find((e) => e.type === "audio.play");
                if (!play) {
                    return sequence;
                }

                const payload = play.payload as { respectTimeScale?: boolean };
                if (!payload.respectTimeScale) {
                    return sequence;
                }

                // Paused audio doesn't need timestamp adjustment
                if (sequence.some((e) => e.type === "audio.pause")) {
                    return sequence;
                }

                const scaleHistory = timeService.getScaleHistory();
                return sequence.map((e) =>
                    e === play ? withGameTimestamp(play, scaleHistory) : e,
                );
            },
        },
    });
}

/**
 * Image replay rules.
 */
export const imageReplay = defineReplay("layer", {
    "visual.image.set": {
        removes: ["visual.image.clear"],
        folds: {
            "visual.image.transform": ["position", "scale", "rotation"],
        },
        replaces: ["visual.image.effect", "visual.image.layer_config"],
    },
});

/**
 * Create clock replay rules.
 *
 * Includes a replayTransform that collapses the lifecycle event
 * sequence into a single create event with the correct remaining
 * duration, accounting for time-scale changes.
 */
export function createClockReplay(timeService: TimeService) {
    return defineReplay("id", {
        "ui.clock.create": {
            removes: ["ui.clock.destroy"],
            folds: {
                "ui.clock.update": ["position", "zIndex", "visible", "scale", "font"],
            },
            replaces: ["ui.clock.start"],
            appends: ["ui.clock.pause", "ui.clock.adjust"],

            replayTransform: (sequence) => {
                const create = sequence.find(
                    (e) => e.type === "ui.clock.create",
                );
                if (!create) {
                    return sequence;
                }

                const payload = create.payload as {
                    duration?: number;
                    autoStart?: boolean;
                    respectTimeScale?: boolean;
                };

                const respectsScale = payload.respectTimeScale !== false;
                const scaleHistory = timeService.getScaleHistory();

                const { intervals, running } = extractRunIntervals(
                    sequence,
                    ["ui.clock.start"],
                    ["ui.clock.pause"],
                    (e) =>
                        e.type === "ui.clock.create" &&
                        (e.payload as { autoStart?: boolean }).autoStart ===
                            true,
                );

                const elapsed = sumIntervals(
                    intervals,
                    scaleHistory,
                    respectsScale,
                );
                const remaining = Math.max(
                    0,
                    (payload.duration ?? 0) - elapsed,
                );

                return [
                    {
                        ...create,
                        payload: {
                            ...(create.payload as Record<string, unknown>),
                            duration: remaining,
                            autoStart: running,
                        },
                        metadata: {
                            ...create.metadata,
                            timestamp: Date.now(),
                        },
                    },
                ];
            },
        },
    });
}
