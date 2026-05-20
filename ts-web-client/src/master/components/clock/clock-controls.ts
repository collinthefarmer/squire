import { interval, animationFrameScheduler, type Subscription, takeUntil } from "rxjs";
import { cssSheet } from "@styles/adopt-styles";
import { BaseComponent } from "@components/base/base-component";
import { ServiceRegistry } from "@services/service-registry";
import { TOKENS } from "@services/service-tokens";
import type { MasterClockService } from "@master/services/clock-service";
import type { AssetService } from "@master/services/asset-service";
import type { ClockState } from "@services/clock-state";
import { getRemainingTime, formatTime } from "@services/clock-state";
// @ts-expect-error — Bun imports CSS as text
import clockControlsCss from "./clock-controls.css" with { type: "text" };
// @ts-expect-error — Bun imports CSS as text
import commonCss from "@styles/common.css" with { type: "text" };

/**
 * Clock controls panel for master client
 *
 * Provides UI to create, start, pause, adjust, and destroy
 * countdown clocks. Includes a font picker populated from
 * the server's public/fonts/ directory.
 */
export class ClockControls extends BaseComponent {
    private clockService!: MasterClockService;
    private assetService!: AssetService;
    private animationSub: Subscription | null = null;

    override connectedCallback(): void {
        super.connectedCallback();

        this.clockService =
            ServiceRegistry.get(TOKENS.MasterClockService);
        this.assetService =
            ServiceRegistry.get(TOKENS.AssetService);

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
                            <label for="clock-days">Days</label>
                            <input type="number" id="clock-days" value="0" min="0" />
                        </div>
                        <div class="field">
                            <label for="clock-hours">Hrs</label>
                            <input type="number" id="clock-hours" value="0" min="0" max="23" />
                        </div>
                        <div class="field">
                            <label for="clock-minutes">Min</label>
                            <input type="number" id="clock-minutes" value="0" min="0" max="59" />
                        </div>
                        <div class="field">
                            <label for="clock-seconds">Sec</label>
                            <input type="number" id="clock-seconds" value="30" min="0" max="59" />
                        </div>
                        <button class="primary" id="create-btn" type="button">Create</button>
                    </div>

                    <div class="font-row">
                        <label for="clock-font">Font</label>
                        <select id="clock-font">
                            <option value="Courier New">Courier New</option>
                        </select>
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
        this.subscribe(this.clockService.getClocks$(), (clocks) => {
            this.renderClockList(clocks);

            if (clocks.size > 0) {
                this.startUpdateLoop();
            } else {
                this.stopUpdateLoop();
            }
        });

        this.subscribe(this.assetService.getFontAssets$(), (fonts) => {
            this.populateFontDropdown(fonts);
        });
    }

    private populateFontDropdown(fonts: { name: string }[]): void {
        const select = this.shadowRoot?.querySelector("#clock-font") as HTMLSelectElement;
        if (!select) {
            return;
        }

        const currentValue = select.value;

        select.innerHTML = '<option value="Courier New">Courier New</option>';

        for (const font of fonts) {
            const option = document.createElement("option");
            option.value = font.name;
            option.textContent = font.name;
            option.style.fontFamily = font.name;
            select.appendChild(option);
        }

        // Restore selection if it still exists
        if (currentValue) {
            select.value = currentValue;
        }
    }

    private handleCreate(): void {
        const days = this.readNumericInput("#clock-days");
        const hours = this.readNumericInput("#clock-hours");
        const minutes = this.readNumericInput("#clock-minutes");
        const seconds = this.readNumericInput("#clock-seconds");

        const fontSelect = this.shadowRoot?.querySelector("#clock-font") as HTMLSelectElement;
        const font = fontSelect?.value || "Courier New";

        const totalMs =
            ((days * 86400) + (hours * 3600) + (minutes * 60) + seconds) * 1000;

        if (totalMs <= 0) {
            return;
        }

        this.clockService.createClock({
            id: `clock-${Date.now()}`,
            duration: totalMs,
            autoStart: true,
            font,
        });
    }

    private readNumericInput(selector: string): number {
        const input = this.shadowRoot?.querySelector(selector) as HTMLInputElement;
        const value = parseInt(input?.value ?? "0", 10);
        return isNaN(value) ? 0 : Math.max(0, value);
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
                <span class="clock-time">${formatTime(remaining)}</span>
                <div class="clock-actions">
                    <button class="outline-button size-btn" data-size-delta="-0.25" type="button" title="Decrease size">−</button>
                    <button class="outline-button size-btn" data-size-delta="0.25" type="button" title="Increase size">+</button>
                    <button class="secondary toggle-btn" type="button">
                        ${clock.running ? "Pause" : "Start"}
                    </button>
                    <button class="outline-button adjust-btn" data-delta="30000" type="button">+30s</button>
                    <button class="outline-button adjust-btn" data-delta="-30000" type="button">-30s</button>
                    <button class="danger destroy-btn" type="button">X</button>
                </div>
            `;

            // Bind button handlers
            const toggleBtn = item.querySelector(
                ".toggle-btn",
            ) as HTMLButtonElement;
            toggleBtn.addEventListener("click", () => {
                if (clock.running) {
                    this.clockService.pauseClock(id);
                } else {
                    this.clockService.startClock(id);
                }
            });

            const sizeBtns = item.querySelectorAll(".size-btn");
            for (const btn of Array.from(sizeBtns)) {
                btn.addEventListener("click", () => {
                    const delta = parseFloat(
                        (btn as HTMLElement).dataset.sizeDelta ?? "0",
                    );
                    this.clockService.scaleClockDisplay(id, delta);
                });
            }

            const adjustBtns = item.querySelectorAll(".adjust-btn");
            for (const btn of Array.from(adjustBtns)) {
                btn.addEventListener("click", () => {
                    const delta = parseInt(
                        (btn as HTMLElement).dataset.delta ?? "0",
                        10,
                    );
                    this.clockService.adjustClock(id, delta);
                });
            }

            const destroyBtn = item.querySelector(
                ".destroy-btn",
            ) as HTMLButtonElement;
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
