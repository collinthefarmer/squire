/**
 * Audio effect definitions
 *
 * Maps effect type strings to Web Audio API node factories.
 * Each definition knows how to create, configure, and connect
 * the nodes that implement the effect. All effects support a
 * wet/dry mix parameter.
 */

export interface EffectDefinition {
    type: string;
    label: string;
    defaultParams: Record<string, number>;
    paramRanges: Record<string, { min: number; max: number; step: number; unit: string }>;
    createNodes(ctx: AudioContext): AudioNode[];
    applyParams(nodes: AudioNode[], params: Record<string, unknown>): void;
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

    createNodes(ctx: AudioContext): AudioNode[] {
        const convolver = ctx.createConvolver();
        const wetGain = ctx.createGain();
        const dryGain = ctx.createGain();
        const merger = ctx.createGain();

        convolver.buffer = generateImpulseResponse(ctx, 3);

        // Parallel wet/dry: input splits to both paths, merges at output
        // Nodes: [convolver, wetGain, dryGain, merger]
        return [convolver, wetGain, dryGain, merger];
    },

    applyParams(nodes: AudioNode[], params: Record<string, unknown>): void {
        const [convolver, wetGain, dryGain] = nodes as [
            ConvolverNode,
            GainNode,
            GainNode,
            GainNode,
        ];

        const decay = (params.decay as number) ?? 3;
        const mix = (params.mix as number) ?? 0.5;

        convolver.buffer = generateImpulseResponse(
            convolver.context as AudioContext,
            decay,
        );
        wetGain.gain.value = mix;
        dryGain.gain.value = 1 - mix;
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

    createNodes(ctx: AudioContext): AudioNode[] {
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

        // Nodes: [delay, lfo, lfoGain, wetGain, dryGain, merger]
        return [delay, lfo, lfoGain, wetGain, dryGain, merger];
    },

    applyParams(nodes: AudioNode[], params: Record<string, unknown>): void {
        const [delay, lfo, lfoGain, wetGain, dryGain] = nodes as [
            DelayNode,
            OscillatorNode,
            GainNode,
            GainNode,
            GainNode,
            GainNode,
        ];

        const rate = (params.rate as number) ?? 1.5;
        const depth = (params.depth as number) ?? 7;
        const mix = (params.mix as number) ?? 0.5;

        lfo.frequency.value = rate;
        lfoGain.gain.value = depth / 1000;
        delay.delayTime.value = 0.015;
        wetGain.gain.value = mix;
        dryGain.gain.value = 1 - mix;
    },
};

// -- Distortion --

function makeDistortionCurve(amount: number): Float32Array<ArrayBuffer> {
    const samples = 44100;
    const curve = new Float32Array(samples);
    const k = amount;

    for (let i = 0; i < samples; i++) {
        const x = (i * 2) / samples - 1;
        curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
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

    createNodes(ctx: AudioContext): AudioNode[] {
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

        // Nodes: [waveshaper, toneFilter, wetGain, dryGain, merger]
        return [waveshaper, toneFilter, wetGain, dryGain, merger];
    },

    applyParams(nodes: AudioNode[], params: Record<string, unknown>): void {
        const [waveshaper, toneFilter, wetGain, dryGain] = nodes as [
            WaveShaperNode,
            BiquadFilterNode,
            GainNode,
            GainNode,
            GainNode,
        ];

        const amount = (params.amount as number) ?? 50;
        const tone = (params.tone as number) ?? 3000;
        const mix = (params.mix as number) ?? 0.5;

        waveshaper.curve = makeDistortionCurve(amount);
        toneFilter.frequency.value = tone;
        wetGain.gain.value = mix;
        dryGain.gain.value = 1 - mix;
    },
};

// -- Registry --

const definitions = new Map<string, EffectDefinition>();

definitions.set("reverb", reverbDefinition);
definitions.set("chorus", chorusDefinition);
definitions.set("distortion", distortionDefinition);

export function getEffectDefinition(type: string): EffectDefinition | undefined {
    return definitions.get(type);
}

export function getAllEffectDefinitions(): EffectDefinition[] {
    return Array.from(definitions.values());
}
