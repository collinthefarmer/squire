import { BaseComponent } from "@components/base/base-component";
import { emitDomEvent } from "@utils/dom-events";
import { colors, spacing, borderRadius, fontSize, transitions } from "@styles/theme";

/**
 * Toggle between File and Live audio source modes
 *
 * @fires source-type-change - When the source type selection changes
 */
export class SourceTypeSelector extends BaseComponent {
    private sourceType: "file" | "live" = "file";

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

            .toggle-group {
                display: flex;
                border-radius: ${borderRadius.md};
                overflow: hidden;
                border: 1px solid ${colors.gray[600]};
            }

            .toggle-btn {
                flex: 1;
                background: transparent;
                border: none;
                color: ${colors.gray[500]};
                cursor: pointer;
                padding: ${spacing.sm} ${spacing.md};
                font-size: ${fontSize.sm};
                font-weight: 500;
                transition: ${transitions.fast};
            }

            .toggle-btn:hover {
                color: ${colors.gray[200]};
            }

            .toggle-btn.active {
                background: ${colors.blue[500]};
                color: ${colors.white};
            }
        `;
    }

    protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.innerHTML = `
            ${this.styleTag(this.getStyles())}

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
