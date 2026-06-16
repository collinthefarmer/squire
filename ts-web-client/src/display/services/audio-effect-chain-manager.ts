import { EffectChain } from "@services/effect-chain";
import type { AudioEffect } from "@types";

/**
 * Manages Web Audio API effect chains per channel.
 *
 * Owns AudioContext creation, MediaElementSourceNode routing,
 * and EffectChain lifecycle. Extracted from DisplayAudioService to
 * isolate Web Audio concerns from playback management.
 */
export class AudioEffectChainManager {
    /** Per-channel effect chains (only created when effects are active) */
    private channelChains = new Map<string, EffectChain>();
    private channelContexts = new Map<string, AudioContext>();
    /** MediaElementSourceNodes keyed by trackId (permanently bound to their element) */
    private sourceNodes = new Map<string, MediaElementAudioSourceNode>();

    hasChain(channel: string): boolean {
        return this.channelChains.has(channel);
    }

    /**
     * Route an audio element through the channel's effect chain.
     *
     * If no chain exists, routes directly to the AudioContext destination.
     * MediaElementSourceNode is created once per trackId and reused.
     */
    routeThroughChain(
        trackId: string,
        audio: HTMLAudioElement,
        channel: string,
    ): void {
        const chain = this.channelChains.get(channel);
        const ctx = this.channelContexts.get(channel);

        if (!ctx) {
            return;
        }

        // MediaElementAudioSourceNode is permanently bound to its element.
        // Create once and reuse.
        let sourceNode = this.sourceNodes.get(trackId);
        if (!sourceNode) {
            sourceNode = ctx.createMediaElementSource(audio);
            this.sourceNodes.set(trackId, sourceNode);
        }

        try {
            sourceNode.disconnect();
        } catch {
            // Not connected yet
        }

        if (chain) {
            sourceNode.connect(chain.getInput());
        } else {
            sourceNode.connect(ctx.destination);
        }
    }

    /**
     * Rebuild or update channel effects.
     *
     * If the effect chain structure changed (types or count), rebuilds
     * the entire chain. Otherwise, updates parameters in-place.
     */
    updateChannelEffects(
        channel: string,
        effects: AudioEffect[],
        prevEffects: AudioEffect[],
        channelTrackIds: Iterable<[string, HTMLAudioElement]>,
    ): void {
        const structureChanged =
            effects.length !== prevEffects.length ||
            effects.some((e, i) => e.type !== prevEffects[i]?.type);

        const chain = this.channelChains.get(channel);

        if (structureChanged || !chain) {
            this.rebuildChannelEffects(channel, effects, channelTrackIds);
        } else {
            for (const effect of effects) {
                chain.updateParams(effect.type, effect.params);
            }
        }
    }

    private rebuildChannelEffects(
        channel: string,
        effects: AudioEffect[],
        channelTrackIds: Iterable<[string, HTMLAudioElement]>,
    ): void {
        // Ensure a persistent AudioContext for this channel
        let ctx = this.channelContexts.get(channel);
        if (!ctx) {
            ctx = new AudioContext();
            this.channelContexts.set(channel, ctx);
        }

        const existingChain = this.channelChains.get(channel);

        if (effects.length === 0) {
            if (existingChain) {
                existingChain.dispose();
                this.channelChains.delete(channel);
            }

            // Reconnect source nodes directly to ctx.destination
            for (const [trackId] of channelTrackIds) {
                const sourceNode = this.sourceNodes.get(trackId);
                if (!sourceNode) {
                    continue;
                }

                try {
                    sourceNode.disconnect();
                } catch {
                    // Already disconnected
                }

                sourceNode.connect(ctx.destination);
            }

            return;
        }

        let chain = existingChain;
        if (!chain) {
            chain = new EffectChain(ctx);
            chain.getOutput().connect(ctx.destination);
            this.channelChains.set(channel, chain);
        }

        chain.setEffects(effects);

        // Route all existing tracks on this channel through the chain
        for (const [trackId, audio] of channelTrackIds) {
            this.routeThroughChain(trackId, audio, channel);
        }
    }
}
