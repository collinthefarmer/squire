import { BaseComponent } from "@components/base/base-component";
import { emitDomEvent } from "@utils/dom-events";
import { selectStyles, labelStyles, flexColumn } from "@styles/common-styles";
import { spacing, fontSize } from "@styles/theme";

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
                font-size: ${fontSize.base};
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
            emitDomEvent(this, "channel-change", { channel: this.selectedChannel });
        });
    }

    /**
     * Get currently selected channel
     */
    getSelectedChannel(): string {
        return this.selectedChannel;
    }
}
