/**
 * Built-in effect chain presets
 *
 * Each preset defines a label and an ordered array of effects.
 * Effect order matters — later effects process the output of
 * earlier ones.
 */

import type { AudioEffect } from "@types";

export interface EffectPreset {
    label: string;
    effects: AudioEffect[];
}

export const EFFECT_PRESETS: Record<string, EffectPreset> = {
    cave: {
        label: "Cave Voice",
        effects: [
            { type: "reverb", params: { decay: 6, mix: 0.7 } },
            { type: "chorus", params: { rate: 0.3, depth: 5, mix: 0.3 } },
        ],
    },
    demonic: {
        label: "Demonic",
        effects: [
            { type: "distortion", params: { amount: 60, tone: 800, mix: 0.5 } },
            { type: "reverb", params: { decay: 4, mix: 0.6 } },
        ],
    },
    ghostly: {
        label: "Ghostly Whisper",
        effects: [
            { type: "reverb", params: { decay: 8, mix: 0.8 } },
            { type: "chorus", params: { rate: 0.5, depth: 12, mix: 0.5 } },
        ],
    },
    underwater: {
        label: "Underwater",
        effects: [
            { type: "chorus", params: { rate: 0.8, depth: 15, mix: 0.6 } },
            { type: "reverb", params: { decay: 5, mix: 0.7 } },
        ],
    },
    megaphone: {
        label: "Megaphone",
        effects: [
            {
                type: "distortion",
                params: { amount: 30, tone: 2000, mix: 0.4 },
            },
        ],
    },
};
