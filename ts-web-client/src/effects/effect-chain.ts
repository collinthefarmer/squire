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
import type { EffectNodes } from "./effect-definitions";
import type { AudioEffect } from "@types";

const logger = new Logger("EffectChain");

interface EffectSlot {
    type: string;
    nodes: EffectNodes;
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

            currentSource = nodes.merger;
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
     *   source → effect nodes → wetGain ─→ merger → next stage
     *          → dryGain ─────────────────→
     */
    private connectWetDry(source: AudioNode, nodes: EffectNodes): void {
        const { effectNodes, wetGain, dryGain, merger } = nodes;

        // Wet path: source → first effect node → ... → wetGain → merger
        const firstNode = effectNodes[0];
        if (firstNode) {
            source.connect(firstNode);

            // Internal connections (e.g. waveshaper→toneFilter) are handled in createNodes.
            // Connect the last effect node to wetGain.
            const lastNode = effectNodes.at(-1) ?? firstNode;
            lastNode.connect(wetGain);
        } else {
            source.connect(wetGain);
        }

        wetGain.connect(merger);

        // Dry path: source → dryGain → merger
        source.connect(dryGain);
        dryGain.connect(merger);
    }

    private teardownSlots(): void {
        for (const slot of this.slots) {
            const allNodes = [
                ...slot.nodes.effectNodes,
                slot.nodes.wetGain,
                slot.nodes.dryGain,
                slot.nodes.merger,
            ];

            for (const node of allNodes) {
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
