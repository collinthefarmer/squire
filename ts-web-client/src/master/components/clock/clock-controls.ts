import { interval, animationFrameScheduler, type Subscription } from "rxjs";
import { cssSheet } from "@styles/adopt-styles";
import { takeUntil } from "rxjs/operators";
import { BaseComponent } from "@components/base/base-component";
import { ServiceRegistry } from "@services/service-registry";
import type { MasterClockService } from "@master/services/clock-service";
import type { ClockState } from "@services/clock-state";
import { getRemainingTime, formatTime } from "@services/clock-state";
import {
    containerStyles,
    sectionHeaderStyles,
    headerRowStyles,
    outlineButtonStyles,
    primaryButtonStyles,
    secondaryButtonStyles,
    dangerButtonStyles,
    inputStyles,
    selectStyles,
    checkboxStyles,
    flexColumn,
} from "@styles/common-styles";
// @ts-expect-error — Bun imports CSS as text
import clockControlsCss from "./clock-controls.css" with { type: "text" };
// @ts-expect-error — Bun imports CSS as text
import commonCss from "@styles/common.css" with { type: "text" };

/**
 * Clock controls panel for master client
 *
 * Provides UI to create, start, pause, adjust, and destroy
 * countdown clocks. Shows a list of active clocks with
 * per-clock controls.
 *
 * @example
 * ```html
 * <clock-controls></clock-controls>
 * ```
 */
export class ClockControls extends BaseComponent {
    private clockService!: MasterClockService;
    private animationSub: Subscription | null = null;

    override connectedCallback(): void {
        super.connectedCallback();

        this.clockService = ServiceRegistry.get<MasterClockService>("MasterClockService");

        this.adoptStyles(cssSheet(commonCss), cssSheet(clockControlsCss));

        this.render();
        this.setupEventListeners();
        this.setupSubscriptions();
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.animationSub?.unsubscribe();
    }
protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.innerHTML = `
            <div class="container">
                <div class="section-header">Clocks</div>

                <div class="flex-col">
                    <div class="create-form">
                        <div class="field">
                            <label for="clock-id">Name</label>
                            <input type="text" id="clock-id" placeholder="timer-1" />
                        </div>
                        <div class="field">
                            <label for="clock-duration">Seconds</label>
                            <input type="number" id="clock-duration" value="30" min="1" />
                        </div>
                        <button class="primary" id="create-btn" type="button">Create</button>
                    </div>
                    <div class="create-form">
                        <div class="field">
                            <label>
                                <input type="checkbox" id="clock-respect-ts" checked />
                                Time Scale
                            </label>
                        </div>
                        <div class="field">
                            <label for="clock-visibility">Visibility</label>
                            <select id="clock-visibility">
                                <option value="always">Always</option>
                                <option value="hidden">Hidden</option>
                                <option value="dm-only">DM Only</option>
                            </select>
                        </div>
                        <div class="field">
                            <label for="clock-on-complete">On Complete</label>
                            <select id="clock-on-complete">
                                <option value="persist">Persist</option>
                                <option value="auto-hide">Auto Hide</option>
                                <option value="auto-destroy">Auto Destroy</option>
                            </select>
                        </div>
                    </div>

                    <div class="clock-list" id="clock-list">
                        <div class="empty">No active clocks</div>
                    </div>
                </div>
            </div>
        `;
    }

    private setupEventListeners(): void {
        const createBtn = this.shadowRoot?.querySelector("#create-btn");
        createBtn?.addEventListener("click", () => this.handleCreate());
    }

    private setupSubscriptions(): void {
        this.subscribe(
            this.clockService.getClocks$(),
            (clocks) => {
                this.renderClockList(clocks);

                if (clocks.size > 0) {
                    this.startUpdateLoop();
                } else {
                    this.stopUpdateLoop();
                }
            },
        );
    }

    private handleCreate(): void {
        const idInput = this.shadowRoot?.querySelector("#clock-id") as HTMLInputElement;
        const durationInput = this.shadowRoot?.querySelector("#clock-duration") as HTMLInputElement;
        const respectTsInput = this.shadowRoot?.querySelector("#clock-respect-ts") as HTMLInputElement;
        const visibilityInput = this.shadowRoot?.querySelector("#clock-visibility") as HTMLSelectElement;
        const onCompleteInput = this.shadowRoot?.querySelector("#clock-on-complete") as HTMLSelectElement;

        if (!idInput || !durationInput) {
            return;
        }

        const id = idInput.value.trim() || `clock-${Date.now()}`;
        const seconds = parseInt(durationInput.value, 10);

        if (isNaN(seconds) || seconds < 1) {
            return;
        }

        this.clockService.createClock({
            id,
            duration: seconds * 1000,
            autoStart: true,
            respectTimeScale: respectTsInput?.checked ?? true,
            visibility: (visibilityInput?.value as "always" | "hidden" | "dm-only") ?? "always",
            onComplete: (onCompleteInput?.value as "persist" | "auto-hide" | "auto-destroy") ?? "persist",
        });

        idInput.value = "";
    }

    private renderClockList(clocks: Map<string, ClockState>): void {
        const list = this.shadowRoot?.querySelector("#clock-list");
        if (!list) {
            return;
        }

        if (clocks.size === 0) {
            list.innerHTML = '<div class="empty">No active clocks</div>';
            return;
        }

        list.innerHTML = "";

        for (const [id, clock] of clocks) {
            const item = document.createElement("div");
            item.className = "clock-item";
            item.dataset.clockId = id;

            const remaining = getRemainingTime(clock);

            item.innerHTML = `
                <div class="clock-info">
                    <span class="clock-id">${id}</span>
                    <span class="clock-time">${formatTime(remaining)}</span>
                </div>
                <div class="clock-actions">
                    <button class="secondary toggle-btn" type="button">
                        ${clock.running ? "Pause" : "Start"}
                    </button>
                    <button class="outline-button adjust-btn" data-delta="30000" type="button">+30s</button>
                    <button class="outline-button adjust-btn" data-delta="-30000" type="button">-30s</button>
                    <button class="danger destroy-btn" type="button">X</button>
                </div>
            `;

            // Bind button handlers
            const toggleBtn = item.querySelector(".toggle-btn") as HTMLButtonElement;
            toggleBtn.addEventListener("click", () => {
                if (clock.running) {
                    this.clockService.pauseClock(id);
                } else {
                    this.clockService.startClock(id);
                }
            });

            const adjustBtns = item.querySelectorAll(".adjust-btn");
            for (const btn of Array.from(adjustBtns)) {
                btn.addEventListener("click", () => {
                    const delta = parseInt((btn as HTMLElement).dataset.delta ?? "0", 10);
                    this.clockService.adjustClock(id, delta);
                });
            }

            const destroyBtn = item.querySelector(".destroy-btn") as HTMLButtonElement;
            destroyBtn.addEventListener("click", () => {
                this.clockService.destroyClock(id);
            });

            list.appendChild(item);
        }
    }

    // -- Live time update loop --

    private startUpdateLoop(): void {
        if (this.animationSub) {
            return;
        }

        this.animationSub = interval(0, animationFrameScheduler)
            .pipe(takeUntil(this.destroy$))
            .subscribe(() => this.updateClockTimes());
    }

    private stopUpdateLoop(): void {
        this.animationSub?.unsubscribe();
        this.animationSub = null;
    }

    private updateClockTimes(): void {
        const list = this.shadowRoot?.querySelector("#clock-list");
        if (!list) {
            return;
        }

        for (const [id, clock] of this.clockService.getClocks()) {
            const item = list.querySelector(`[data-clock-id="${id}"]`);
            if (!item) {
                continue;
            }

            const timeEl = item.querySelector(".clock-time");
            if (timeEl) {
                timeEl.textContent = formatTime(getRemainingTime(clock));
            }
        }
    }
}
