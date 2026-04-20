import { BaseComponent } from "@components/base/base-component";
import { cssSheet } from "@styles/adopt-styles";
import { emitDomEvent } from "@utils/dom-events";
import type { BlendMode } from "@types";
import {
    flexColumn,
    labelStyles,
    selectStyles,
    inputStyles,
    rangeInputStyles,
    checkboxStyles,
    primaryButtonStyles,
    sectionTitleStyles,
    sliderRowStyles,
    valueDisplayStyles,
} from "@styles/common-styles";
// @ts-expect-error — Bun imports CSS as text
import layerConfigControlsCss from "./layer-config-controls.css" with { type: "text" };
// @ts-expect-error — Bun imports CSS as text
import commonCss from "@styles/common.css" with { type: "text" };

/**
 * Layer config controls component
 *
 * Provides opacity slider, blend mode selector, z-index input, visibility toggle, and Apply Config button
 */
export class LayerConfigControls extends BaseComponent {
    private opacity = 1.0;
    private blendMode: BlendMode = "normal";
    private zIndex = 0;
    private visible = true;

    override connectedCallback(): void {
        super.connectedCallback();
        this.adoptStyles(cssSheet(commonCss), cssSheet(layerConfigControlsCss));

        this.render();
        this.setupEventListeners();
    }
    protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.innerHTML = `
            <div class="layer-config-controls">
                <div class="section-title">Layer Configuration</div>

                <div class="form-group">
                    <label>Opacity</label>
                    <div class="slider-row">
                        <input type="range" id="opacity" min="0" max="1" step="0.01" value="1">
                        <span class="value-display" id="opacity-value">100%</span>
                    </div>
                </div>

                <div class="form-group">
                    <label for="blend-mode">Blend Mode</label>
                    <select id="blend-mode">
                        <option value="normal">Normal</option>
                        <option value="multiply">Multiply</option>
                        <option value="screen">Screen</option>
                        <option value="overlay">Overlay</option>
                        <option value="add">Add</option>
                    </select>
                </div>

                <div class="form-group">
                    <label for="z-index">Z-Index</label>
                    <input type="number" id="z-index" value="0">
                </div>

                <div class="checkbox-row">
                    <input type="checkbox" id="visible" checked>
                    <label for="visible">Visible</label>
                </div>

                <button id="apply-config" class="primary">Apply Configuration</button>
            </div>
        `;
    }

    private setupEventListeners(): void {
        const opacitySlider = this.shadowRoot?.querySelector(
            "#opacity",
        ) as HTMLInputElement;
        const opacityValue = this.shadowRoot?.querySelector(
            "#opacity-value",
        ) as HTMLSpanElement;
        const blendModeSelect = this.shadowRoot?.querySelector(
            "#blend-mode",
        ) as HTMLSelectElement;
        const zIndexInput = this.shadowRoot?.querySelector(
            "#z-index",
        ) as HTMLInputElement;
        const visibleCheckbox = this.shadowRoot?.querySelector(
            "#visible",
        ) as HTMLInputElement;
        const applyBtn = this.shadowRoot?.querySelector(
            "#apply-config",
        ) as HTMLButtonElement;

        if (
            !opacitySlider ||
            !opacityValue ||
            !blendModeSelect ||
            !zIndexInput ||
            !visibleCheckbox ||
            !applyBtn
        ) {
            return;
        }

        opacitySlider.addEventListener("input", () => {
            this.opacity = parseFloat(opacitySlider.value);
            opacityValue.textContent = `${Math.round(this.opacity * 100)}%`;
        });

        blendModeSelect.addEventListener("change", () => {
            this.blendMode = blendModeSelect.value as BlendMode;
        });

        zIndexInput.addEventListener("input", () => {
            this.zIndex = parseInt(zIndexInput.value) || 0;
        });

        visibleCheckbox.addEventListener("change", () => {
            this.visible = visibleCheckbox.checked;
        });

        applyBtn.addEventListener("click", () => {
            emitDomEvent(this, "apply-config", {
                opacity: this.opacity,
                blendMode: this.blendMode,
                zIndex: this.zIndex,
                visible: this.visible,
            });
        });
    }
}
