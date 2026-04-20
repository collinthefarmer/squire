import { BaseComponent } from "@components/base/base-component";
import { cssSheet } from "@styles/adopt-styles";
import { emitDomEvent } from "@utils/dom-events";
// @ts-expect-error — Bun imports CSS as text
import sourceTypeSelectorCss from "./source-type-selector.css" with { type: "text" };
// @ts-expect-error — Bun imports CSS as text
import commonCss from "@styles/common.css" with { type: "text" };

/**
 * Toggle between File and Live audio source modes
 *
 * @fires source-type-change - When the source type selection changes
 */
export class SourceTypeSelector extends BaseComponent {
    private sourceType: "file" | "live" = "file";

    override connectedCallback(): void {
        super.connectedCallback();
        this.adoptStyles(cssSheet(commonCss), cssSheet(sourceTypeSelectorCss));

        this.render();
        this.setupEventListeners();
    }
protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.innerHTML = `
            <div class="toggle-group" role="radiogroup" aria-label="Audio source">
                <button
                    type="button"
                    class="toggle-btn ${this.sourceType === "file" ? "active" : ""}"
                    data-value="file"
                    role="radio"
                    aria-checked="${this.sourceType === "file"}"
                >File</button>
                <button
                    type="button"
                    class="toggle-btn ${this.sourceType === "live" ? "active" : ""}"
                    data-value="live"
                    role="radio"
                    aria-checked="${this.sourceType === "live"}"
                >Live Mic</button>
            </div>
        `;
    }

    private setupEventListeners(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.querySelector(".toggle-group")?.addEventListener("click", (e) => {
            const target = e.target as HTMLElement;
            const value = target.dataset.value as "file" | "live" | undefined;

            if (!value || value === this.sourceType) {
                return;
            }

            this.sourceType = value;
            this.updateSelection();
            emitDomEvent(this, "source-type-change", { sourceType: value });
        });
    }

    private updateSelection(): void {
        const buttons = this.shadowRoot?.querySelectorAll(".toggle-btn");
        if (!buttons) {
            return;
        }

        for (const btn of Array.from(buttons)) {
            const el = btn as HTMLElement;
            const isActive = el.dataset.value === this.sourceType;
            el.classList.toggle("active", isActive);
            el.setAttribute("aria-checked", String(isActive));
        }
    }
}
