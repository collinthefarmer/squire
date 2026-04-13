import { BaseComponent } from "@components/base/base-component";
import {
    rangeInputStyles,
    checkboxStyles,
    labelStyles,
    flexColumn,
} from "@styles/common-styles";
import { spacing, colors } from "@styles/theme";

/**
 * Volume control component
 *
 * Provides volume slider and loop toggle
 */
export class VolumeControl extends BaseComponent {
    private volume = 1.0;
    private loop = false;

    override connectedCallback(): void {
        super.connectedCallback();

        this.render();
        this.setupEventListeners();
    }

    protected override getStyles(): string {
        return `
            :host {
                display: block;
            }

            .volume-control {
                ${flexColumn(spacing.lg)}
            }

            .volume-section {
                ${flexColumn(spacing.sm)}
            }

            .volume-row {
                display: flex;
                align-items: center;
                gap: ${spacing.md};
            }

            ${labelStyles()}
            ${rangeInputStyles()}
            ${checkboxStyles()}

            label {
                font-size: 0.875rem;
            }

            input[type="range"] {
                flex: 1;
                outline: none;
            }

            .volume-value {
                min-width: 3rem;
                text-align: right;
                font-size: 0.875rem;
                color: ${colors.gray[500]};
            }

            .loop-section {
                display: flex;
                align-items: center;
                gap: ${spacing.sm};
            }

            input[type="checkbox"] {
                width: 1rem;
                height: 1rem;
            }
        `;
    }

    protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.innerHTML = `
            ${this.styleTag(this.getStyles())}

            <div class="volume-control">
                <div class="volume-section">
                    <label>Volume</label>
                    <div class="volume-row">
                        <input type="range" id="volume" min="0" max="1" step="0.01" value="1">
                        <span class="volume-value" id="volume-value">100%</span>
                    </div>
                </div>

                <div class="loop-section">
                    <input type="checkbox" id="loop">
                    <label for="loop">Loop</label>
                </div>
            </div>
        `;
    }

    private setupEventListeners(): void {
        const volumeSlider = this.shadowRoot?.querySelector(
            "#volume",
        ) as HTMLInputElement;
        const volumeValue = this.shadowRoot?.querySelector(
            "#volume-value",
        ) as HTMLSpanElement;
        const loopCheckbox = this.shadowRoot?.querySelector(
            "#loop",
        ) as HTMLInputElement;

        if (!volumeSlider || !volumeValue || !loopCheckbox) {
            return;
        }

        volumeSlider.addEventListener("input", () => {
            this.volume = parseFloat(volumeSlider.value);
            volumeValue.textContent = `${Math.round(this.volume * 100)}%`;
            this.dispatchEvent(
                new CustomEvent("volume-change", {
                    detail: { volume: this.volume },
                    bubbles: true,
                    composed: true,
                }),
            );
        });

        loopCheckbox.addEventListener("change", () => {
            this.loop = loopCheckbox.checked;
            this.dispatchEvent(
                new CustomEvent("loop-change", {
                    detail: { loop: this.loop },
                    bubbles: true,
                    composed: true,
                }),
            );
        });
    }

    /**
     * Get current volume
     */
    getVolume(): number {
        return this.volume;
    }

    /**
     * Get current loop setting
     */
    getLoop(): boolean {
        return this.loop;
    }
}
