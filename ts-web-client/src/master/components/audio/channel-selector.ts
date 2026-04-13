import { BaseComponent } from "@components/base/base-component";
import { selectStyles, labelStyles, flexColumn } from "@styles/common-styles";
import { spacing } from "@styles/theme";

/**
 * Channel selector component
 *
 * Provides input/dropdown for selecting audio channel
 */
export class ChannelSelector extends BaseComponent {
    private selectedChannel = "ambient";

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

            .channel-selector {
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

            <div class="channel-selector">
                <label for="channel">Channel</label>
                <select id="channel">
                    <option value="ambient">Ambient</option>
                    <option value="music">Music</option>
                    <option value="sfx">SFX</option>
                    <option value="voice">Voice</option>
                </select>
            </div>
        `;
    }

    private setupEventListeners(): void {
        const select = this.shadowRoot?.querySelector(
            "#channel",
        ) as HTMLSelectElement;
        if (!select) {
            return;
        }

        select.addEventListener("change", () => {
            this.selectedChannel = select.value;
            this.dispatchEvent(
                new CustomEvent("channel-change", {
                    detail: { channel: this.selectedChannel },
                    bubbles: true,
                    composed: true,
                }),
            );
        });
    }

    /**
     * Get currently selected channel
     */
    getSelectedChannel(): string {
        return this.selectedChannel;
    }
}
