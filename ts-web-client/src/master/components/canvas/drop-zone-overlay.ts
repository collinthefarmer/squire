import { BaseComponent } from "@components/base/base-component";
import { colors, spacing, borderRadius, alpha } from "@styles/theme";

/**
 * Visual overlay indicating a valid drop target.
 *
 * Shows a dashed-border overlay with "Drop image here" text.
 * Manages active (visible) and hover (intensified) visual states.
 *
 * @example
 * ```html
 * <drop-zone-overlay></drop-zone-overlay>
 * ```
 */
export class DropZoneOverlay extends BaseComponent {
    override connectedCallback(): void {
        super.connectedCallback();
        this.render();
        this.setupEventListeners();
    }

    protected override getStyles(): string {
        return `
            :host {
                position: absolute;
                inset: 0;
                display: none;
                align-items: center;
                justify-content: center;
                pointer-events: none;
                z-index: 10;
            }

            :host(.active) {
                display: flex;
                pointer-events: auto;
            }

            .overlay {
                position: absolute;
                inset: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                background: ${alpha(colors.blue[500], 0.2)};
                border: 3px dashed ${colors.blue[500]};
                border-radius: ${borderRadius.md};
            }

            :host(.hover) .overlay {
                background: ${alpha(colors.blue[500], 0.4)};
                border-color: ${colors.blue[400]};
            }

            .text {
                color: ${colors.white};
                font-size: 1rem;
                font-weight: 500;
                text-shadow: 0 1px 3px ${alpha(colors.black, 0.5)};
                padding: ${spacing.md};
                background: ${alpha(colors.black, 0.5)};
                border-radius: ${borderRadius.sm};
            }
        `;
    }

    protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.innerHTML = `
            ${this.styleTag(this.getStyles())}
            <div class="overlay">
                <span class="text">Drop image here</span>
            </div>
        `;
    }

    /**
     * Show the drop zone overlay.
     */
    activate(): void {
        this.classList.add("active");
    }

    /**
     * Hide the drop zone overlay and remove hover state.
     */
    deactivate(): void {
        this.classList.remove("active", "hover");
    }

    private setupEventListeners(): void {
        this.addEventListener("mouseenter", () => {
            this.classList.add("hover");
        });

        this.addEventListener("mouseleave", () => {
            this.classList.remove("hover");
        });
    }
}
