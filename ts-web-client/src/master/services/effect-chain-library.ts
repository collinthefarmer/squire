import { BehaviorSubject, type Observable } from "rxjs";
import { Logger } from "@utils/logger";
import { EFFECT_PRESETS } from "@shared/constants/effect-presets";
import { cloneAudioEffects } from "@utils/effect-helpers";
import type { LocalStore } from "@services/local-store";
import type { AudioEffect } from "@types";

export interface NamedChain {
    id: string;
    label: string;
    effects: AudioEffect[];
    builtIn: boolean;
}

interface StoredChain {
    id: string;
    label: string;
    effects: AudioEffect[];
}

const STORE_KEY = "audio.effectChains";

/**
 * Manages named effect chains as persistent, reusable objects.
 *
 * Built-in presets are always available (read-only). User-created
 * chains are persisted in LocalStore. All consumers subscribe to
 * getChains$() for a unified list.
 */
export class EffectChainLibrary {
    private logger = new Logger("EffectChainLibrary");
    private chains$ = new BehaviorSubject<NamedChain[]>([]);
    private userChains: StoredChain[] = [];

    constructor(private localStore: LocalStore) {
        this.loadFromStore();
        this.subscribe();
    }

    getChains$(): Observable<NamedChain[]> {
        return this.chains$.asObservable();
    }

    getChains(): NamedChain[] {
        return this.chains$.value;
    }

    getChain(id: string): NamedChain | undefined {
        return this.chains$.value.find((c) => c.id === id);
    }

    /**
     * Find a chain whose effects match the given array.
     * Returns the chain ID or undefined if no match.
     */
    findMatchingChain(effects: AudioEffect[]): string | undefined {
        if (effects.length === 0) {
            return undefined;
        }

        const match = this.chains$.value.find(
            (c) =>
                c.effects.length === effects.length &&
                c.effects.every(
                    (e, i) =>
                        effects[i]?.type === e.type &&
                        JSON.stringify(effects[i]?.params) ===
                            JSON.stringify(e.params),
                ),
        );

        return match?.id;
    }

    createChain(label: string, effects: AudioEffect[] = []): string {
        const id = this.generateId(label);

        this.userChains.push({ id, label, effects });
        this.persist();
        this.emit();

        this.logger.info("Chain created", { id, label });
        return id;
    }

    updateChain(id: string, effects: AudioEffect[]): void {
        const chain = this.userChains.find((c) => c.id === id);
        if (!chain) {
            return;
        }

        chain.effects = effects;
        this.persist();
        this.emit();
    }

    renameChain(id: string, label: string): void {
        const chain = this.userChains.find((c) => c.id === id);
        if (!chain) {
            return;
        }

        chain.label = label;
        this.persist();
        this.emit();

        this.logger.info("Chain renamed", { id, label });
    }

    deleteChain(id: string): void {
        const index = this.userChains.findIndex((c) => c.id === id);
        if (index === -1) {
            return;
        }

        this.userChains.splice(index, 1);
        this.persist();
        this.emit();

        this.logger.info("Chain deleted", { id });
    }

    /**
     * Duplicate a chain (built-in or user) as a new user chain.
     * Returns the new chain's ID.
     */
    duplicateChain(id: string, labelSuffix = " (copy)"): string {
        const source = this.getChain(id);
        if (!source) {
            return this.createChain("New Chain");
        }

        return this.createChain(
            source.label + labelSuffix,
            cloneAudioEffects(source.effects),
        );
    }

    // -- Internal --

    private loadFromStore(): void {
        const stored =
            this.localStore.get<StoredChain[]>(STORE_KEY) ?? [];
        this.userChains = stored;
        this.emit();
    }

    private subscribe(): void {
        this.localStore.get$<StoredChain[]>(STORE_KEY).subscribe((stored) => {
            this.userChains = stored ?? [];
            this.emit();
        });
    }

    private persist(): void {
        this.localStore.set(STORE_KEY, this.userChains);
    }

    private emit(): void {
        const builtIn: NamedChain[] = Object.entries(EFFECT_PRESETS).map(
            ([id, preset]) => ({
                id,
                label: preset.label,
                effects: preset.effects,
                builtIn: true,
            }),
        );

        const user: NamedChain[] = this.userChains.map((c) => ({
            ...c,
            builtIn: false,
        }));

        this.chains$.next([...builtIn, ...user]);
    }

    private generateId(label: string): string {
        const base = label.toLowerCase().replace(/\s+/g, "-");
        const existing = new Set(this.chains$.value.map((c) => c.id));

        let id = base;
        let counter = 1;

        while (existing.has(id)) {
            id = `${base}-${counter}`;
            counter++;
        }

        return id;
    }
}
