import type { AudioEffect } from "@types";
import { EFFECT_PRESETS } from "./effect-presets";

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
    return effects.map((effect) => cloneAudioEffect(effect));
}

/**
 * Get a flat list of preset IDs and labels for UI display.
 */
export function getPresetList(): { id: string; label: string }[] {
    return Object.entries(EFFECT_PRESETS).map(([id, preset]) => ({
        id,
        label: preset.label,
    }));
}
