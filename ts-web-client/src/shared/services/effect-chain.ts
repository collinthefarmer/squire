/**
 * Web Audio API effect chain manager
 *
 * Builds and manages a graph of effect nodes between a source
 * and destination. Each effect uses a parallel wet/dry topology:
 *
 *   input → dry gain ──────────────┐
 *         → wet path (effect) → wet gain → merger → next stage
 *
 * The chain is rebuilt when effects change. Parameter updates
 * modify existing nodes without rebuilding.
 */

import { Logger } from "@utils/logger";
import { getEffectDefinition } from "./effect-definitions";
import type { AudioEffect } from "@types";

const logger = new Logger("EffectChain");

interface EffectSlot {
    type: string;
    nodes: AudioNode[];
}

export class EffectChain {
    private slots: EffectSlot[] = [];
    private inputNode: GainNode;
    private outputNode: GainNode;
    constructor(private context: AudioContext) {
        this.inputNode = context.createGain();
        this.outputNode = context.createGain();
        this.inputNode.connect(this.outputNode);
    }

    getInput(): AudioNode {
        return this.inputNode;
    }

    getOutput(): AudioNode {
        return this.outputNode;
    }

    setEffects(effects: AudioEffect[]): void {
        this.teardownSlots();
        this.inputNode.disconnect();

        if (effects.length === 0) {
            this.inputNode.connect(this.outputNode);
            logger.info("Chain cleared");
            return;
        }

        this.slots = [];
        let currentSource: AudioNode = this.inputNode;

        for (const effect of effects) {
            const definition = getEffectDefinition(effect.type);
            if (!definition) {
                logger.warn("Unknown effect type, skipping", { type: effect.type });
                continue;
            }

            const nodes = definition.createNodes(this.context);
            const slot: EffectSlot = { type: effect.type, nodes };
            this.slots.push(slot);

            this.connectWetDry(currentSource, nodes);
            definition.applyParams(nodes, effect.params);

            // The merger (last node) becomes the source for the next stage
            const merger = nodes[nodes.length - 1];
            if (merger) {
                currentSource = merger;
            }
        }

        currentSource.connect(this.outputNode);

        logger.info("Chain built", {
            effects: effects.map((e) => e.type),
        });
    }

    updateParams(type: string, params: Record<string, unknown>): void {
        const slot = this.slots.find((s) => s.type === type);
        if (!slot) {
            return;
        }

        const definition = getEffectDefinition(type);
        if (!definition) {
            return;
        }

        definition.applyParams(slot.nodes, params);
    }

    dispose(): void {
        this.teardownSlots();
        this.inputNode.disconnect();
        this.outputNode.disconnect();
    }

    /**
     * Connect a wet/dry parallel topology for an effect.
     *
     * All effects use the convention:
     *   nodes[-3] = wetGain
     *   nodes[-2] = dryGain
     *   nodes[-1] = merger
     *
     * The wet path goes through effect-specific nodes (nodes[0..n-4])
     * before reaching wetGain. The dry path goes directly from source
     * to dryGain. Both merge into the merger node.
     */
    private connectWetDry(source: AudioNode, nodes: AudioNode[]): void {
        if (nodes.length < 4) {
            // Simple passthrough — not enough nodes for wet/dry
            source.connect(nodes[0]!);
            return;
        }

        const wetGain = nodes[nodes.length - 3]!;
        const dryGain = nodes[nodes.length - 2]!;
        const merger = nodes[nodes.length - 1]!;

        // Wet path: source → first effect node → ... → wetGain → merger
        source.connect(nodes[0]!);

        // Connect effect-specific nodes to wetGain
        // (Internal connections like waveshaper→toneFilter are handled in createNodes)
        const lastEffectNode = nodes[nodes.length - 4] ?? nodes[0]!;
        lastEffectNode.connect(wetGain);
        wetGain.connect(merger);

        // Dry path: source → dryGain → merger
        source.connect(dryGain);
        dryGain.connect(merger);
    }

    private teardownSlots(): void {
        for (const slot of this.slots) {
            for (const node of slot.nodes) {
                try {
                    node.disconnect();

                    if (node instanceof OscillatorNode) {
                        node.stop();
                    }
                } catch {
                    // Node may not be connected
                }
            }
        }

        this.slots = [];
    }
}
