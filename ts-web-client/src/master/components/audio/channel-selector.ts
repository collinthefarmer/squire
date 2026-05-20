import { BaseComponent } from "@components/base/base-component";
import { cssSheet } from "@styles/adopt-styles";
import { emitDomEvent } from "@utils/dom-events";
// @ts-expect-error — Bun imports CSS as text
import channelSelectorCss from "./channel-selector.css" with { type: "text" };
// @ts-expect-error — Bun imports CSS as text
import commonCss from "@styles/common.css" with { type: "text" };

/**
 * Channel selector component
 *
 * Provides input/dropdown for selecting audio channel
 */
export class ChannelSelector extends BaseComponent {
    private selectedChannel = "ambient";

    override connectedCallback(): void {
        super.connectedCallback();

        this.adoptStyles(cssSheet(commonCss), cssSheet(channelSelectorCss));

        this.render();
        this.setupEventListeners();
    }
    protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.innerHTML = `
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
            emitDomEvent(this, "channel-change", {
                channel: this.selectedChannel,
            });
        });
    }

    /**
     * Get currently selected channel
     */
    getSelectedChannel(): string {
        return this.selectedChannel;
    }
}
