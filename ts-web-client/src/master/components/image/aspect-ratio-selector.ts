import { BaseComponent } from "@components/base/base-component";
import type { AspectRatioMode } from "@types";
import { colors, spacing, borderRadius } from "@styles/theme";

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

            .button-group {
                display: flex;
                border-radius: ${borderRadius.md};
                overflow: hidden;
                border: 1px solid ${colors.gray[600]};
            }

            .option {
                flex: 1;
                padding: ${spacing.sm} ${spacing.md};
                background: ${colors.gray[800]};
                color: ${colors.gray[200]};
                border: none;
                font-size: 0.75rem;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.15s ease;
                text-align: center;
            }

            .option:not(:last-child) {
                border-right: 1px solid ${colors.gray[600]};
            }

            .option:hover:not(.selected) {
                background: ${colors.gray[700]};
            }

            .option.selected {
                background: ${colors.blue[600]};
                color: ${colors.white};
            }

            .option:focus {
                outline: none;
                box-shadow: inset 0 0 0 2px ${colors.blue[400]};
            }
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
