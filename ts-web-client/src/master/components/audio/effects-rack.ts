import { Subject, throttleTime } from "rxjs";
import { BaseComponent } from "@components/base/base-component";
import { cssSheet } from "@styles/adopt-styles";
import { ServiceRegistry } from "@services/service-registry";
import type { MasterAudioService } from "@master/services/master-audio-service";
import type {
    EffectChainLibrary,
    NamedChain,
} from "@master/services/effect-chain-library";
import {
    getAllEffectDefinitions,
    getEffectDefinition,
} from "@services/effect-definitions";
import type { AudioEffect } from "@types";

// @ts-expect-error — Bun imports CSS as text
import effectsRackCss from "./effects-rack.css" with { type: "text" };
// @ts-expect-error — Bun imports CSS as text
import commonCss from "@styles/common.css" with { type: "text" };

/**
 * Floating effects rack popover
 *
 * Appended to document.body (outside Shadow DOM) so it renders
 * above all other content. Opens when a channel lane's gear button
 * is clicked, anchored near the button. Edits are live — parameter
 * changes immediately affect the playing audio.
 *
 * Built-in chains are read-only; the first edit auto-forks to a
 * user chain.
 */
export class EffectsRack extends BaseComponent {
    private audioService!: MasterAudioService;
    private library!: EffectChainLibrary;
    private paramChange$ = new Subject<void>();

    private targetChannel = "";
    private chainId = "";
    private chain: NamedChain | null = null;
    private effects: AudioEffect[] = [];

    override connectedCallback(): void {
        super.connectedCallback();

        this.audioService =
            ServiceRegistry.get<MasterAudioService>("MasterAudioService");
        this.library =
            ServiceRegistry.get<EffectChainLibrary>("EffectChainLibrary");

        this.adoptStyles(cssSheet(commonCss), cssSheet(effectsRackCss));
        this.render();
        this.setupDismissListeners();
        this.setupParamThrottle();
    }

    show(x: number, y: number, channel: string, chainId: string): void {
        this.targetChannel = channel;
        this.chainId = chainId;
        this.chain = this.library.getChain(chainId) ?? null;
        this.effects = this.chain
            ? this.chain.effects.map((e) => ({
                  ...e,
                  params: { ...e.params },
              }))
            : [];

        this.classList.add("visible");
        this.renderContent();
        this.positionAt(x, y);
    }

    hide(): void {
        this.classList.remove("visible");
        this.targetChannel = "";
        this.chainId = "";
        this.chain = null;
        this.effects = [];
    }

    isVisible(): boolean {
        return this.classList.contains("visible");
    }

    protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.innerHTML = `<div class="rack" id="rack"></div>`;
    }

    private renderContent(): void {
        const rack = this.shadowRoot?.querySelector("#rack");
        if (!rack) {
            return;
        }

        rack.innerHTML = "";

        // Header
        const header = document.createElement("div");
        header.className = "rack-header";

        const title = document.createElement("span");
        title.className = "rack-title";
        title.textContent = this.chain?.label ?? "New Chain";

        const closeBtn = document.createElement("button");
        closeBtn.className = "strip-btn close-btn";
        closeBtn.textContent = "×";
        closeBtn.addEventListener("click", () => this.hide());

        header.appendChild(title);
        header.appendChild(closeBtn);
        rack.appendChild(header);

        // Effect blocks
        const list = document.createElement("div");
        list.className = "effect-list";

        if (this.effects.length === 0) {
            const hint = document.createElement("div");
            hint.className = "empty-hint";
            hint.textContent = "No effects — add one below";
            list.appendChild(hint);
        } else {
            for (let i = 0; i < this.effects.length; i++) {
                list.appendChild(this.createEffectBlock(this.effects[i]!, i));
            }
        }

        rack.appendChild(list);

        // Add effect dropdown
        const addRow = document.createElement("div");
        addRow.className = "rack-add";

        const addSelect = document.createElement("select");
        addSelect.className = "add-select";
        addSelect.innerHTML = `<option value="">+ Add Effect</option>${getAllEffectDefinitions()
            .map((d) => `<option value="${d.type}">${d.label}</option>`)
            .join("")}`;

        addSelect.addEventListener("change", () => {
            if (!addSelect.value) {
                return;
            }

            const def = getEffectDefinition(addSelect.value);
            if (!def) {
                return;
            }

            this.ensureUserChain();
            this.effects.push({
                type: def.type,
                params: { ...def.defaultParams },
            });
            this.applyAndSave();
            this.renderContent();
        });

        addRow.appendChild(addSelect);
        rack.appendChild(addRow);

        // Footer actions
        const footer = document.createElement("div");
        footer.className = "rack-footer";

        const saveAsBtn = document.createElement("button");
        saveAsBtn.className = "outline-button";
        saveAsBtn.textContent = "Save as\u2026";
        saveAsBtn.addEventListener("click", () => this.handleSaveAs());

        const renameBtn = document.createElement("button");
        renameBtn.className = "outline-button";
        renameBtn.textContent = "Rename";
        renameBtn.disabled = this.chain?.builtIn ?? true;
        renameBtn.addEventListener("click", () => this.handleRename());

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "outline-button";
        deleteBtn.textContent = "Delete";
        deleteBtn.disabled = this.chain?.builtIn ?? true;
        deleteBtn.addEventListener("click", () => this.handleDelete());

        footer.appendChild(saveAsBtn);
        footer.appendChild(renameBtn);
        footer.appendChild(deleteBtn);
        rack.appendChild(footer);
    }

    private createEffectBlock(
        effect: AudioEffect,
        index: number,
    ): HTMLElement {
        const def = getEffectDefinition(effect.type);
        if (!def) {
            return document.createElement("div");
        }

        const block = document.createElement("div");
        block.className = "effect-block";

        const header = document.createElement("div");
        header.className = "effect-header";

        const title = document.createElement("span");
        title.className = "effect-type";
        title.textContent = def.label;

        const removeBtn = document.createElement("button");
        removeBtn.className = "strip-btn remove-btn";
        removeBtn.textContent = "−";
        removeBtn.title = "Remove effect";
        removeBtn.addEventListener("click", () => {
            this.ensureUserChain();
            this.effects.splice(index, 1);
            this.applyAndSave();
            this.renderContent();
        });

        header.appendChild(title);
        header.appendChild(removeBtn);
        block.appendChild(header);

        const params = document.createElement("div");
        params.className = "effect-params";

        for (const [key, range] of Object.entries(def.paramRanges)) {
            const value = (effect.params[key] as number) ?? range.min;
            params.appendChild(
                this.createParamSlider(effect, key, value, range),
            );
        }

        block.appendChild(params);
        return block;
    }

    private createParamSlider(
        effect: AudioEffect,
        key: string,
        value: number,
        range: { min: number; max: number; step: number; unit: string },
    ): HTMLElement {
        const row = document.createElement("div");
        row.className = "param-row";

        const label = document.createElement("label");
        label.className = "param-label";
        label.textContent = key;

        const slider = document.createElement("input");
        slider.type = "range";
        slider.className = "param-slider";
        slider.min = String(range.min);
        slider.max = String(range.max);
        slider.step = String(range.step);
        slider.value = String(value);

        const display = document.createElement("span");
        display.className = "param-value";
        display.textContent = this.formatValue(value, range.unit);

        slider.addEventListener("input", () => {
            const newValue = parseFloat(slider.value);
            effect.params[key] = newValue;
            display.textContent = this.formatValue(newValue, range.unit);
            this.ensureUserChain();
            this.paramChange$.next();
        });

        row.appendChild(label);
        row.appendChild(slider);
        row.appendChild(display);
        return row;
    }

    // -- Actions --

    /**
     * If editing a built-in chain, fork it as a user chain
     * so the original stays untouched.
     */
    private ensureUserChain(): void {
        if (!this.chain?.builtIn) {
            return;
        }

        const newId = this.library.duplicateChain(
            this.chainId,
            " (custom)",
        );
        this.chainId = newId;
        this.chain = this.library.getChain(newId) ?? null;

        // Update the title in the header
        const title = this.shadowRoot?.querySelector(".rack-title");
        if (title) {
            title.textContent = this.chain?.label ?? "Custom";
        }

        // Enable rename/delete buttons
        const renameBtn = this.shadowRoot?.querySelector(
            ".rack-footer .outline-button:nth-child(2)",
        ) as HTMLButtonElement;
        const deleteBtn = this.shadowRoot?.querySelector(
            ".rack-footer .outline-button:nth-child(3)",
        ) as HTMLButtonElement;
        if (renameBtn) renameBtn.disabled = false;
        if (deleteBtn) deleteBtn.disabled = false;
    }

    private applyAndSave(): void {
        if (this.chainId && !this.chain?.builtIn) {
            this.library.updateChain(this.chainId, this.effects);
        }

        if (this.targetChannel) {
            this.audioService.setChannelEffects(
                this.targetChannel,
                this.effects,
            );
        }
    }

    private handleSaveAs(): void {
        const name = prompt("Chain name:");
        if (!name) {
            return;
        }

        const newId = this.library.createChain(
            name,
            this.effects.map((e) => ({ ...e, params: { ...e.params } })),
        );
        this.chainId = newId;
        this.chain = this.library.getChain(newId) ?? null;

        if (this.targetChannel) {
            this.audioService.setChannelEffects(
                this.targetChannel,
                this.effects,
            );
        }

        this.renderContent();
    }

    private handleRename(): void {
        if (!this.chain || this.chain.builtIn) {
            return;
        }

        const name = prompt("New name:", this.chain.label);
        if (!name) {
            return;
        }

        this.library.renameChain(this.chainId, name);
        this.chain = this.library.getChain(this.chainId) ?? null;
        this.renderContent();
    }

    private handleDelete(): void {
        if (!this.chain || this.chain.builtIn) {
            return;
        }

        this.library.deleteChain(this.chainId);

        if (this.targetChannel) {
            this.audioService.setChannelEffects(this.targetChannel, []);
        }

        this.hide();
    }

    // -- Positioning --

    private positionAt(x: number, y: number): void {
        this.style.left = `${x}px`;
        this.style.top = `${y}px`;

        requestAnimationFrame(() => {
            const rack = this.shadowRoot?.querySelector("#rack") as HTMLElement;
            if (!rack) {
                return;
            }

            const rect = rack.getBoundingClientRect();
            const viewW = window.innerWidth;
            const viewH = window.innerHeight;

            if (rect.right > viewW) {
                this.style.left = `${x - rect.width}px`;
            }

            if (rect.bottom > viewH) {
                this.style.top = `${Math.max(0, viewH - rect.height - 8)}px`;
            }
        });
    }

    // -- Dismiss --

    private setupDismissListeners(): void {
        document.addEventListener("click", (e) => {
            if (!this.isVisible()) {
                return;
            }

            if (!this.contains(e.target as Node)) {
                this.hide();
            }
        });

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && this.isVisible()) {
                this.hide();
            }
        });
    }

    private setupParamThrottle(): void {
        this.subscribe(
            this.paramChange$.pipe(
                throttleTime(100, undefined, {
                    leading: true,
                    trailing: true,
                }),
            ),
            () => this.applyAndSave(),
        );
    }

    // -- Helpers --

    private formatValue(value: number, unit: string): string {
        const formatted = value % 1 === 0 ? String(value) : value.toFixed(1);
        return unit ? `${formatted}${unit}` : formatted;
    }
}
