import type { Event } from "@types";
import type { TimeService } from "@services/time/time-service";
import { getAudioDuration } from "@api/handlers/assets-metadata";
import { computeGameTimeElapsed } from "@utils/game-time";
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
 * Accepts a TimeService reference for the replay filter that
 * excludes non-looping audio that has finished playing,
 * accounting for time-scale changes.
 */
export function createAudioReplay(timeService: TimeService) {
    return defineReplay("channel", {
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
                    source?: { ref?: string };
                };

                // Looping audio always replays
                if (payload.loop) {
                    return true;
                }

                // Paused audio hasn't finished
                if (sequence.some((e) => e.type === "audio.pause")) {
                    return true;
                }

                // Check if the file has finished based on duration
                const sourceRef = payload.source?.ref;
                if (!sourceRef) {
                    return true;
                }

                const duration = getAudioDuration(sourceRef);
                if (duration === undefined) {
                    return true; // Unknown duration, include to be safe
                }

                const durationMs = duration * 1000;

                const elapsed = payload.respectTimeScale !== false
                    ? computeGameTimeElapsed(
                          playEvent.metadata.timestamp,
                          timeService.getScaleHistory(),
                      )
                    : Date.now() - playEvent.metadata.timestamp;

                return elapsed < durationMs;
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
            "visual.image.transform": ["position", "scale"],
        },
        replaces: ["visual.image.effect", "visual.image.layer_config"],
    },
});

/**
 * Clock replay rules.
 */
export const clockReplay = defineReplay("id", {
    "ui.clock.create": {
        removes: ["ui.clock.destroy"],
        folds: {
            "ui.clock.update": ["position", "zIndex", "visible"],
        },
        replaces: ["ui.clock.start"],
        appends: ["ui.clock.pause", "ui.clock.adjust"],
    },
});
