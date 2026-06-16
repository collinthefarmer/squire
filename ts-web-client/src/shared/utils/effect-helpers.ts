import type { AudioEffect } from "@types";

/**
 * Deep-clone an AudioEffect while preserving the discriminated union type.
 *
 * TypeScript loses discriminated union narrowing when using the spread
 * operator across union members. This helper uses JSON round-trip to
 * create a structural clone, then asserts the result back to AudioEffect.
 * Safe because AudioEffect contains only serializable primitives.
 */
export function cloneAudioEffect(effect: AudioEffect): AudioEffect {
    return JSON.parse(JSON.stringify(effect)) as AudioEffect;
}

/**
 * Deep-clone an array of AudioEffects.
 */
export function cloneAudioEffects(effects: AudioEffect[]): AudioEffect[] {
    return effects.map(cloneAudioEffect);
}
