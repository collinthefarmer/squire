import { BaseComponent } from "@components/base/base-component";
import {
    selectStyles,
    labelStyles,
    flexColumn,
} from "@styles/common-styles";
import { spacing } from "@styles/theme";

/**
 * Layer selector component
 *
 * Provides dropdown for selecting image layer
 */
export class LayerSelector extends BaseComponent {
    private selectedLayer = "background";

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

            .layer-selector {
                ${flexColumn(spacing.sm)}
            }

            ${labelStyles()}
            ${selectStyles()}

            select {
                font-size: 0.875rem;
                cursor: pointer;
            }
        `;
    }

    protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.innerHTML = `
            ${this.styleTag(this.getStyles())}

            <div class="layer-selector">
                <label for="layer">Layer</label>
                <select id="layer">
                    <option value="background">Background</option>
                    <option value="midground">Midground</option>
                    <option value="foreground">Foreground</option>
                    <option value="overlay">Overlay</option>
                </select>
            </div>
        `;
    }

    private setupEventListeners(): void {
        const select = this.shadowRoot?.querySelector("#layer") as HTMLSelectElement;
        if (!select) {
            return;
        }

        select.addEventListener("change", () => {
            this.selectedLayer = select.value;
            this.dispatchEvent(
                new CustomEvent("layer-change", {
                    detail: { layer: this.selectedLayer },
                    bubbles: true,
                    composed: true,
                })
            );
        });
    }

    /**
     * Get currently selected layer
     */
    getSelectedLayer(): string {
        return this.selectedLayer;
    }
}
