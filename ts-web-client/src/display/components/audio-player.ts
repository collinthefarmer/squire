import { BaseComponent } from "@components/base/base-component";
import { ServiceRegistry } from "@services/service-registry";
import type { AudioService } from "@display/services/audio-service";
import type { AudioChannelState } from "@types";
import { AudioChannelCard } from "./audio-channel-card";
import { flexColumn } from "@styles/common-styles";
import { colors, spacing, borderRadius, alpha } from "@styles/theme";

/**
 * Audio player component
 *
 * Displays audio channel state as an overlay.
 * Audio playback is handled by AudioService via HTMLAudioElement instances.
 */
export class AudioPlayer extends BaseComponent {
    override connectedCallback(): void {
        super.connectedCallback();

        const audioService = ServiceRegistry.get<AudioService>("AudioService");

        this.subscribe(audioService.getChannels$(), (channels) => {
            this.render({ channels });
        });

        // Initial render
        this.render({ channels: audioService.getChannels() });
    }

    protected override getStyles(): string {
        return `
            :host {
                position: fixed;
                bottom: ${spacing.lg};
                left: ${spacing.lg};
                z-index: 9999;
                font-family: system-ui, -apple-system, sans-serif;
            }

            .audio-overlay {
                background: ${alpha(colors.black, 0.8)};
                border-radius: ${borderRadius.lg};
                padding: ${spacing.lg};
                min-width: 200px;
                max-width: 400px;
                color: ${colors.white};
                backdrop-filter: blur(10px);
            }

            .title {
                font-size: 0.875rem;
                font-weight: 600;
                margin-bottom: ${spacing.md};
                opacity: 0.7;
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }

            .empty-state {
                text-align: center;
                padding: ${spacing.lg};
                opacity: 0.5;
                font-size: 0.875rem;
            }

            .channels-container {
                ${flexColumn()}
            }
        `;
    }

    protected override render(state: {
        channels: Map<string, AudioChannelState>;
    }): void {
        if (!state) {
            return;
        }

        const channels = Array.from(state.channels.values());

        this.shadowRoot!.innerHTML = `
            ${this.styleTag(this.getStyles())}

            <div class="audio-overlay">
                <div class="title">Audio Channels</div>
                <div class="channels-container" id="channels-container">
                    ${channels.length === 0 ? '<div class="empty-state">No active channels</div>' : ""}
                </div>
            </div>
        `;

        // Add channel cards if there are any
        if (channels.length > 0) {
            const container =
                this.shadowRoot!.getElementById("channels-container");
            if (container) {
                channels.forEach((channel) => {
                    const card = new AudioChannelCard();
                    card.setChannel(channel);
                    container.appendChild(card);
                });
            }
        }
    }
}
