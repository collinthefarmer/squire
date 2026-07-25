/**
 * Audio effect definitions
 *
 * Maps effect type strings to Web Audio API node factories.
 * Each definition knows how to create, configure, and connect
 * the nodes that implement the effect. All effects support a
 * wet/dry mix parameter.
 */

import type { AudioEffect, AudioEffectType } from "@types";

/**
 * Typed structure returned by createNodes.
 *
 * Separates the effect-specific processing nodes from the
 * wet/dry routing nodes, eliminating positional array conventions.
 */
export interface EffectNodes {
    /** Effect-specific processing nodes (e.g., convolver, delay+lfo) */
    effectNodes: AudioNode[];
    wetGain: GainNode;
    dryGain: GainNode;
    merger: GainNode;
}

export interface EffectDefinition {
    type: AudioEffectType;
    label: string;
    defaultParams: Record<string, number>;
    paramRanges: Record<
        string,
        { min: number; max: number; step: number; unit: string }
    >;
    createNodes(ctx: AudioContext): EffectNodes;
    applyParams(nodes: EffectNodes, params: Record<string, unknown>): void;
}

/**
 * Create a typed AudioEffect from an EffectDefinition and optional params.
 *
 * Bridges the gap between the generic EffectDefinition interface (which
 * uses Record<string, number> for flexibility) and the discriminated
 * AudioEffect union. The type field narrows the discriminant; params
 * are structurally compatible because each definition's defaultParams
 * contain exactly the keys required by the corresponding AudioEffect variant.
 */
export function createEffectFromDefinition(
    def: EffectDefinition,
    params?: Record<string, number>,
): AudioEffect {
    const merged = params
        ? { ...def.defaultParams, ...params }
        : { ...def.defaultParams };

    // The definition's type field is an AudioEffectType literal,
    // and the merged params structurally match the expected shape.
    return { type: def.type, params: merged } as AudioEffect;
}

// -- Reverb --

function generateImpulseResponse(
    ctx: AudioContext,
    decay: number,
): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * decay);
    const buffer = ctx.createBuffer(2, length, sampleRate);

    for (let ch = 0; ch < 2; ch++) {
        const data = buffer.getChannelData(ch);
        for (let i = 0; i < length; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
        }
    }

    return buffer;
}

const reverbDefinition: EffectDefinition = {
    type: "reverb",
    label: "Reverb",
    defaultParams: { decay: 3, mix: 0.5 },
    paramRanges: {
        decay: { min: 0.1, max: 10, step: 0.1, unit: "s" },
        mix: { min: 0, max: 1, step: 0.01, unit: "" },
    },

    createNodes(ctx: AudioContext): EffectNodes {
        const convolver = ctx.createConvolver();
        const wetGain = ctx.createGain();
        const dryGain = ctx.createGain();
        const merger = ctx.createGain();

        convolver.buffer = generateImpulseResponse(ctx, 3);

        return { effectNodes: [convolver], wetGain, dryGain, merger };
    },

    applyParams(nodes: EffectNodes, params: Record<string, unknown>): void {
        const convolver = nodes.effectNodes[0] as ConvolverNode;
        const decay = (params.decay as number) ?? 3;
        const mix = (params.mix as number) ?? 0.5;

        convolver.buffer = generateImpulseResponse(
            convolver.context as AudioContext,
            decay,
        );
        nodes.wetGain.gain.value = mix;
        nodes.dryGain.gain.value = 1 - mix;
    },
};

// -- Chorus --

const chorusDefinition: EffectDefinition = {
    type: "chorus",
    label: "Chorus",
    defaultParams: { rate: 1.5, depth: 7, mix: 0.5 },
    paramRanges: {
        rate: { min: 0.1, max: 10, step: 0.1, unit: "Hz" },
        depth: { min: 1, max: 20, step: 0.5, unit: "ms" },
        mix: { min: 0, max: 1, step: 0.01, unit: "" },
    },

    createNodes(ctx: AudioContext): EffectNodes {
        const delay = ctx.createDelay(0.05);
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        const wetGain = ctx.createGain();
        const dryGain = ctx.createGain();
        const merger = ctx.createGain();

        delay.delayTime.value = 0.015;

        lfo.type = "sine";
        lfo.frequency.value = 1.5;
        lfoGain.gain.value = 0.007;

        lfo.connect(lfoGain);
        lfoGain.connect(delay.delayTime);
        lfo.start();

        return { effectNodes: [delay, lfo, lfoGain], wetGain, dryGain, merger };
    },

    applyParams(nodes: EffectNodes, params: Record<string, unknown>): void {
        const [delay, lfo, lfoGain] = nodes.effectNodes as [
            DelayNode,
            OscillatorNode,
            GainNode,
        ];

        const rate = (params.rate as number) ?? 1.5;
        const depth = (params.depth as number) ?? 7;
        const mix = (params.mix as number) ?? 0.5;

        lfo.frequency.value = rate;
        lfoGain.gain.value = depth / 1000;
        delay.delayTime.value = 0.015;
        nodes.wetGain.gain.value = mix;
        nodes.dryGain.gain.value = 1 - mix;
    },
};

// -- Distortion --

function makeDistortionCurve(amount: number): Float32Array<ArrayBuffer> {
    const samples = 44100;
    const curve = new Float32Array(samples);
    const k = amount;

    for (let i = 0; i < samples; i++) {
        const x = (i * 2) / samples - 1;
        curve[i] =
            ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
    }

    return curve;
}

const distortionDefinition: EffectDefinition = {
    type: "distortion",
    label: "Distortion",
    defaultParams: { amount: 50, tone: 3000, mix: 0.5 },
    paramRanges: {
        amount: { min: 0, max: 100, step: 1, unit: "" },
        tone: { min: 200, max: 8000, step: 100, unit: "Hz" },
        mix: { min: 0, max: 1, step: 0.01, unit: "" },
    },

    createNodes(ctx: AudioContext): EffectNodes {
        const waveshaper = ctx.createWaveShaper();
        const toneFilter = ctx.createBiquadFilter();
        const wetGain = ctx.createGain();
        const dryGain = ctx.createGain();
        const merger = ctx.createGain();

        waveshaper.curve = makeDistortionCurve(50);
        waveshaper.oversample = "4x";

        toneFilter.type = "lowpass";
        toneFilter.frequency.value = 3000;

        // Wet path: waveshaper → tone filter
        waveshaper.connect(toneFilter);

        return {
            effectNodes: [waveshaper, toneFilter],
            wetGain,
            dryGain,
            merger,
        };
    },

    applyParams(nodes: EffectNodes, params: Record<string, unknown>): void {
        const [waveshaper, toneFilter] = nodes.effectNodes as [
            WaveShaperNode,
            BiquadFilterNode,
        ];

        const amount = (params.amount as number) ?? 50;
        const tone = (params.tone as number) ?? 3000;
        const mix = (params.mix as number) ?? 0.5;

        waveshaper.curve = makeDistortionCurve(amount);
        toneFilter.frequency.value = tone;
        nodes.wetGain.gain.value = mix;
        nodes.dryGain.gain.value = 1 - mix;
    },
};

// -- Registry --

const definitions = new Map<string, EffectDefinition>([
    ["reverb", reverbDefinition],
    ["chorus", chorusDefinition],
    ["distortion", distortionDefinition],
]);

export function getEffectDefinition(
    type: string,
): EffectDefinition | undefined {
    return definitions.get(type);
}

export function getAllEffectDefinitions(): EffectDefinition[] {
    return Array.from(definitions.values());
}
