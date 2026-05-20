import { BaseComponent } from "@components/base/base-component";
import { cssSheet } from "@styles/adopt-styles";
import { bindAllRangeFills, updateRangeFill } from "@utils/range-fill";
import { ServiceRegistry } from "@services/service-registry";
import { TOKENS } from "@services/service-tokens";
import type { TimeScaleService } from "@services/time-scale-service";
// @ts-expect-error — Bun imports CSS as text
import timeScaleControlsCss from "./time-scale-controls.css" with { type: "text" };
// @ts-expect-error — Bun imports CSS as text
import commonCss from "@styles/common.css" with { type: "text" };

/**
 * Time-scale controls for master client
 *
 * Provides a slider for adjusting the global time scale (0–8x)
 * and displays the current value.
 */
export class TimeScaleControls extends BaseComponent {
    private timeScaleService!: TimeScaleService;

    override connectedCallback(): void {
        super.connectedCallback();

        this.timeScaleService =
            ServiceRegistry.get(TOKENS.TimeScaleService);

        this.adoptStyles(cssSheet(commonCss), cssSheet(timeScaleControlsCss));

        this.render();
        this.setupEventListeners();
        this.setupSubscriptions();
        this.cleanup.push(bindAllRangeFills(this.shadowRoot!));
    }

    protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.innerHTML = `
            <div class="container">
                <div class="section-header">Time Scale</div>
                <div class="slider-row">
                    <input type="range" id="scale-slider" min="0" max="8" step="0.1" value="1" />
                    <span class="scale-value" id="scale-value">1.0x</span>
                    <button class="reset-btn" id="reset-btn" title="Reset to 1x">↺</button>
                </div>
            </div>
        `;
    }

    private setupEventListeners(): void {
        const slider = this.shadowRoot?.querySelector("#scale-slider") as HTMLInputElement;
        if (!slider) {
            return;
        }

        slider.addEventListener("input", () => {
            const scale = parseFloat(slider.value);
            this.timeScaleService.setScale(scale);
        });

        const resetBtn = this.shadowRoot?.querySelector("#reset-btn") as HTMLButtonElement;
        if (resetBtn) {
            resetBtn.addEventListener("click", () => {
                this.timeScaleService.setScale(1);
            });
        }
    }

    private setupSubscriptions(): void {
        this.subscribe(this.timeScaleService.getScale$(), (scale) => {
            this.updateDisplay(scale);
        });
    }

    private updateDisplay(scale: number): void {
        const slider = this.shadowRoot?.querySelector("#scale-slider") as HTMLInputElement;
        const display = this.shadowRoot?.querySelector("#scale-value");

        if (slider && this.shadowRoot?.activeElement !== slider) {
            slider.value = String(scale);
            updateRangeFill(slider);
        }

        if (display) {
            display.textContent = `${scale.toFixed(1)}x`;
        }
    }
}
