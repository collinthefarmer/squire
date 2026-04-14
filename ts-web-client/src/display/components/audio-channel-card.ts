import { BaseComponent } from "@components/base/base-component";
import type { AudioChannelState } from "@types";
import { colors, spacing, borderRadius, transitions, alpha } from "@styles/theme";

/**
 * Audio channel card component
 *
 * Renders a single audio channel's state
 */
export class AudioChannelCard extends BaseComponent {
    private channel: AudioChannelState | null = null;

    static observedAttributes = ["channel-id"];

    /**
     * Set channel data
     */
    setChannel(channel: AudioChannelState): void {
        this.channel = channel;
        this.render();
    }

    protected override getStyles(): string {
        return `
            :host {
                display: block;
            }

            .channel {
                margin-bottom: ${spacing.md};
                padding: ${spacing.md};
                background: ${alpha(colors.white, 0.05)};
                border-radius: ${borderRadius.md};
                border-left: 3px solid;
            }

            .channel.playing {
                border-left-color: ${colors.green[400]};
            }

            .channel.paused {
                border-left-color: ${colors.amber[400]};
            }

            .channel-name {
                font-weight: 600;
                margin-bottom: ${spacing.xs};
            }

            .channel-source {
                font-size: 0.75rem;
                opacity: 0.7;
                margin-bottom: ${spacing.sm};
            }

            .channel-status {
                display: flex;
                align-items: center;
                gap: ${spacing.sm};
                font-size: 0.75rem;
            }

            .status-indicator {
                width: 8px;
                height: 8px;
                border-radius: ${borderRadius.full};
                animation: pulse 2s infinite;
            }

            .status-indicator.playing {
                background: ${colors.green[400]};
            }

            .status-indicator.paused {
                background: ${colors.amber[400]};
                animation: none;
            }

            .volume-bar {
                display: flex;
                align-items: center;
                gap: ${spacing.sm};
                margin-top: ${spacing.sm};
            }

            .volume-label {
                font-size: 0.75rem;
                opacity: 0.7;
                min-width: 3rem;
            }

            .volume-track {
                flex: 1;
                height: 4px;
                background: ${alpha(colors.white, 0.1)};
                border-radius: 2px;
                overflow: hidden;
            }

            .volume-fill {
                height: 100%;
                background: linear-gradient(90deg, ${colors.green[400]}, ${colors.green[500]});
                transition: width 0.2s ease;
            }

            @keyframes pulse {
                0%, 100% {
                    opacity: 1;
                }
                50% {
                    opacity: 0.5;
                }
            }
        `;
    }

    protected override render(): void {
        if (!this.channel) {
            this.shadowRoot!.innerHTML = "";
            return;
        }

        const channel = this.channel;

        this.shadowRoot!.innerHTML = `
            ${this.styleTag(this.getStyles())}

            <div class="channel ${channel.playing ? "playing" : "paused"}">
                <div class="channel-name">${channel.id}</div>
                <div class="channel-source">${channel.source?.ref || "Unknown"}</div>
                <div class="channel-status">
                    <span class="status-indicator ${channel.playing ? "playing" : "paused"}"></span>
                    <span>${channel.playing ? "Playing" : "Paused"}</span>
                    ${channel.loop ? " • Loop" : ""}
                </div>
                <div class="volume-bar">
                    <span class="volume-label">Vol: ${Math.round(channel.volume * 100)}%</span>
                    <div class="volume-track">
                        <div class="volume-fill" style="width: ${channel.volume * 100}%"></div>
                    </div>
                </div>
            </div>
        `;
    }
}
