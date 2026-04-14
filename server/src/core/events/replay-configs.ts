import type { Event } from "@types";
import { defineReplay } from "./replay-domain";

/**
 * Custom transform for audio.resume.
 *
 * Finds the pause event in the sequence, calculates how long
 * the audio was paused, shifts the play event's timestamp
 * forward by that duration, and returns a sequence with just
 * the adjusted play event (removing the pause).
 *
 * On replay, the adjusted timestamp makes the audio start
 * at the correct position as if the pause never happened.
 */
function handleAudioResume(sequence: Event[], resumeEvent: Event): Event[] {
    const playEvent = sequence.find((e) => e.type === "audio.play");
    const pauseEvent = sequence.find((e) => e.type === "audio.pause");

    if (!playEvent) {
        return sequence;
    }

    if (!pauseEvent) {
        // No pause to resume from — keep just the play event
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
 * Audio replay rules.
 *
 * audio.play is the creation event. Volume folds into it.
 * Resume uses a custom transform to adjust the play timestamp
 * and remove the pause. Pause is stored as a replace (only
 * latest matters). Stop removes the channel.
 */
export const audioReplay = defineReplay("channel", {
    "audio.play": {
        removes: ["audio.stop"],
        folds: {
            "audio.volume": ["volume"],
            "audio.resume": { transform: handleAudioResume },
        },
        replaces: ["audio.pause"],
    },
});

/**
 * Image replay rules.
 *
 * visual.image.set is the creation event. Transform folds
 * position/scale into it. Effect and layer_config are stored
 * as replace entries (only latest of each type).
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
 *
 * ui.clock.create is the creation event. Update folds position/
 * zIndex/visible into it. Start is a replace (only latest matters).
 * Pause and adjust are appended (timeline sequence for elapsed
 * time computation).
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
