import { combineLatest, map } from "rxjs";
import { BaseComponent } from "@components/base/base-component";
import { cssSheet } from "@styles/adopt-styles";
import { ServiceRegistry } from "@services/service-registry";
import { TOKENS } from "@services/service-tokens";
import { getRemainingTime, formatTime } from "@services/clock-state";
import type { MasterAudioService } from "@master/services/master-audio-service";
import type { MasterVisualService } from "@master/services/visual-service";
import type { MasterClockService } from "@master/services/clock-service";
import type { TimeScaleService } from "@services/time-scale-service";
import type { SceneService } from "@master/services/scene-service";
import type { AudioChannelState, ImageLayerState } from "@types";
import type { ClockState } from "@services/clock-state";
import type { SceneSelection } from "@master/services/scene-types";
// @ts-expect-error — Bun imports CSS as text
import sceneSaveFormCss from "./scene-save-form.css" with { type: "text" };
// @ts-expect-error — Bun imports CSS as text
import commonCss from "@styles/common.css" with { type: "text" };

interface CurrentState {
    channels: Map<string, AudioChannelState>;
    layers: Map<string, ImageLayerState>;
    clocks: Map<string, ClockState>;
    timeScale: number;
}

/**
 * Entity picker form for saving a scene.
 *
 * Subscribes to live service state and renders checkboxes
 * for each audio channel, image layer, clock, and time scale.
 * On save, collects checked IDs and delegates to SceneService.
 */
export class SceneSaveForm extends BaseComponent {
    private sceneService!: SceneService;
    private currentState: CurrentState = {
        channels: new Map(),
        layers: new Map(),
        clocks: new Map(),
        timeScale: 1.0,
    };

    override connectedCallback(): void {
        super.connectedCallback();

        this.sceneService = ServiceRegistry.get(TOKENS.SceneService);

        const audioService = ServiceRegistry.get(TOKENS.MasterAudioService) as MasterAudioService;
        const visualService = ServiceRegistry.get(TOKENS.MasterVisualService) as MasterVisualService;
        const clockService = ServiceRegistry.get(TOKENS.MasterClockService) as MasterClockService;
        const timeScaleService = ServiceRegistry.get(TOKENS.TimeScaleService) as TimeScaleService;

        this.adoptStyles(cssSheet(commonCss), cssSheet(sceneSaveFormCss));
        this.render();

        this.subscribe(
            combineLatest([
                audioService.getChannels$(),
                visualService.getLayers$(),
                clockService.getClocks$(),
                timeScaleService.getScale$(),
            ]).pipe(
                map(([channels, layers, clocks, timeScale]) => ({
                    channels,
                    layers,
                    clocks,
                    timeScale,
                })),
            ),
            (state) => {
                this.currentState = state;
                this.renderForm();
            },
        );
    }

    protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.innerHTML = `<div class="save-form" id="form"></div>`;
    }

    private renderForm(): void {
        const form = this.shadowRoot?.querySelector("#form");
        if (!form) {
            return;
        }

        const { channels, layers, clocks, timeScale } = this.currentState;
        const sections: string[] = [];

        // Visuals
        if (layers.size > 0) {
            const entities = Array.from(layers.entries())
                .map(
                    ([id, layer]) => `
                    <label class="entity-row">
                        <input type="checkbox" data-domain="image" data-id="${id}" checked />
                        <span class="entity-label">${id}</span>
                        <span class="entity-detail">${layer.imageRef ?? "(empty)"}</span>
                    </label>`,
                )
                .join("");

            sections.push(`
                <div class="domain-section">
                    <label class="domain-header">
                        <input type="checkbox" data-domain-toggle="image" checked />
                        Visuals
                    </label>
                    <div class="entity-list">${entities}</div>
                </div>
            `);
        }

        // Audio
        if (channels.size > 0) {
            const entities = Array.from(channels.entries())
                .map(([id, channel]) => {
                    const trackCount = channel.tracks.size;
                    const detail =
                        trackCount === 0
                            ? "(no tracks)"
                            : `${trackCount} track${trackCount > 1 ? "s" : ""}`;
                    return `
                    <label class="entity-row">
                        <input type="checkbox" data-domain="audio" data-id="${id}" checked />
                        <span class="entity-label">${id}</span>
                        <span class="entity-detail">${detail}</span>
                    </label>`;
                })
                .join("");

            sections.push(`
                <div class="domain-section">
                    <label class="domain-header">
                        <input type="checkbox" data-domain-toggle="audio" checked />
                        Audio
                    </label>
                    <div class="entity-list">${entities}</div>
                </div>
            `);
        }

        // Clocks
        if (clocks.size > 0) {
            const entities = Array.from(clocks.entries())
                .map(([id, clock]) => {
                    const remaining = formatTime(getRemainingTime(clock));
                    return `
                    <label class="entity-row">
                        <input type="checkbox" data-domain="clock" data-id="${id}" checked />
                        <span class="entity-label">${id}</span>
                        <span class="entity-detail">${remaining}</span>
                    </label>`;
                })
                .join("");

            sections.push(`
                <div class="domain-section">
                    <label class="domain-header">
                        <input type="checkbox" data-domain-toggle="clock" checked />
                        Clocks
                    </label>
                    <div class="entity-list">${entities}</div>
                </div>
            `);
        }

        // Time scale
        sections.push(`
            <label class="entity-row">
                <input type="checkbox" data-domain="time" checked />
                <span class="entity-label">Time Scale</span>
                <span class="entity-detail">${timeScale.toFixed(1)}x</span>
            </label>
        `);

        if (sections.length === 1 && layers.size === 0 && channels.size === 0 && clocks.size === 0) {
            // Only time scale, no entities
            sections.unshift(`<div class="empty-hint">No active entities to save</div>`);
        }

        // Name input + save button
        sections.push(`
            <div class="name-row">
                <input type="text" id="scene-name" placeholder="Scene name" />
                <button class="primary" id="save-btn" type="button">Save</button>
            </div>
        `);

        form.innerHTML = sections.join("");

        // Bind domain toggles
        const domainToggles = form.querySelectorAll<HTMLInputElement>("[data-domain-toggle]");
        for (const toggle of Array.from(domainToggles)) {
            toggle.addEventListener("change", () => {
                const domain = toggle.dataset.domainToggle!;
                const checkboxes = form.querySelectorAll<HTMLInputElement>(
                    `[data-domain="${domain}"]`,
                );
                for (const cb of Array.from(checkboxes)) {
                    cb.checked = toggle.checked;
                }
            });
        }

        // Bind save
        const saveBtn = form.querySelector("#save-btn");
        saveBtn?.addEventListener("click", () => this.handleSave());
    }

    private handleSave(): void {
        const form = this.shadowRoot?.querySelector("#form");
        if (!form) {
            return;
        }

        const nameInput = form.querySelector("#scene-name") as HTMLInputElement;
        const name = nameInput?.value.trim();
        if (!name) {
            nameInput?.focus();
            return;
        }

        const selection: SceneSelection = {};

        const audioIds = this.getCheckedIds(form, "audio");
        if (audioIds.length > 0) {
            selection.audio = audioIds;
        }

        const imageIds = this.getCheckedIds(form, "image");
        if (imageIds.length > 0) {
            selection.image = imageIds;
        }

        const clockIds = this.getCheckedIds(form, "clock");
        if (clockIds.length > 0) {
            selection.clock = clockIds;
        }

        const timeCheckbox = form.querySelector<HTMLInputElement>('[data-domain="time"]');
        if (timeCheckbox?.checked) {
            selection.time = true;
        }

        this.sceneService.saveScene(name, selection);
        nameInput.value = "";
    }

    private getCheckedIds(container: Element, domain: string): string[] {
        const checkboxes = container.querySelectorAll<HTMLInputElement>(
            `[data-domain="${domain}"][data-id]:checked`,
        );
        return Array.from(checkboxes).map((cb) => cb.dataset.id!);
    }
}
