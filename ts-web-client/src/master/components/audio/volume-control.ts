import { BaseComponent } from "@components/base/base-component";
import { cssSheet } from "@styles/adopt-styles";
import { emitDomEvent } from "@utils/dom-events";
import { bindAllRangeFills } from "@utils/range-fill";
// @ts-expect-error — Bun imports CSS as text
import volumeControlCss from "./volume-control.css" with { type: "text" };
// @ts-expect-error — Bun imports CSS as text
import commonCss from "@styles/common.css" with { type: "text" };

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

        this.adoptStyles(cssSheet(commonCss), cssSheet(volumeControlCss));

        this.render();
        this.setupEventListeners();
        this.cleanup.push(bindAllRangeFills(this.shadowRoot!));
    }
    protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.innerHTML = `
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
            emitDomEvent(this, "volume-change", { volume: this.volume });
        });

        loopCheckbox.addEventListener("change", () => {
            this.loop = loopCheckbox.checked;
            emitDomEvent(this, "loop-change", { loop: this.loop });
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
