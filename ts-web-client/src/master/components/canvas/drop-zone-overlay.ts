import { BaseComponent } from "@components/base/base-component";
import { cssSheet } from "@styles/adopt-styles";
// @ts-expect-error — Bun imports CSS as text
import dropZoneOverlayCss from "./drop-zone-overlay.css" with { type: "text" };
// @ts-expect-error — Bun imports CSS as text
import commonCss from "@styles/common.css" with { type: "text" };

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
        this.adoptStyles(cssSheet(commonCss), cssSheet(dropZoneOverlayCss));

        this.render();
        this.setupEventListeners();
    }
    protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.innerHTML = `
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
