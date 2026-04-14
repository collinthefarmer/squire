import { BaseComponent } from "@components/base/base-component";
import type { AspectRatioMode } from "@types";
import { segmentedButtonStyles } from "@styles/common-styles";

/**
 * Aspect ratio selector with flush radio button styling
 *
 * Provides a segmented button group for selecting between cover and contain modes.
 *
 * @fires aspect-ratio-change - When aspect ratio selection changes
 *   - detail.aspectRatio: AspectRatioMode
 */
export class AspectRatioSelector extends BaseComponent {
    private aspectRatio: AspectRatioMode = "contain";

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

            ${segmentedButtonStyles()}
        `;
    }

    protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.innerHTML = `
            ${this.styleTag(this.getStyles())}

            <div class="button-group" role="radiogroup" aria-label="Aspect ratio">
                <button
                    type="button"
                    class="option ${this.aspectRatio === "cover" ? "selected" : ""}"
                    data-value="cover"
                    role="radio"
                    aria-checked="${this.aspectRatio === "cover"}"
                >
                    Cover
                </button>
                <button
                    type="button"
                    class="option ${this.aspectRatio === "contain" ? "selected" : ""}"
                    data-value="contain"
                    role="radio"
                    aria-checked="${this.aspectRatio === "contain"}"
                >
                    Contain
                </button>
            </div>
        `;
    }

    private setupEventListeners(): void {
        if (!this.shadowRoot) {
            return;
        }

        const buttons = this.shadowRoot.querySelectorAll(".option");
        buttons.forEach((button) => {
            button.addEventListener("click", (e) => {
                const target = e.currentTarget as HTMLButtonElement;
                const value = target.dataset.value as AspectRatioMode;

                if (value === this.aspectRatio) {
                    return;
                }

                this.aspectRatio = value;
                this.updateSelection();
                this.emitChange();
            });
        });
    }

    private updateSelection(): void {
        if (!this.shadowRoot) {
            return;
        }

        const buttons = this.shadowRoot.querySelectorAll(".option");
        buttons.forEach((button) => {
            const btn = button as HTMLButtonElement;
            const isSelected = btn.dataset.value === this.aspectRatio;
            btn.classList.toggle("selected", isSelected);
            btn.setAttribute("aria-checked", String(isSelected));
        });
    }

    private emitChange(): void {
        this.dispatchEvent(
            new CustomEvent("aspect-ratio-change", {
                detail: { aspectRatio: this.aspectRatio },
                bubbles: true,
                composed: true,
            }),
        );
    }
}
