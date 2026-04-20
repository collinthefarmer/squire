import { BaseComponent } from "@components/base/base-component";
import type { AudioChannelState } from "@types";
import { colors, spacing, borderRadius, transitions, alpha } from "@styles/theme";

/**
 * Audio channel card component
 *
 * Renders a single audio channel's state, showing all active tracks.
 */
export class AudioChannelCard extends BaseComponent {
    private channel: AudioChannelState | null = null;

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

            .track-list {
                display: flex;
                flex-direction: column;
                gap: ${spacing.xs};
            }

            .track-entry {
                font-size: 0.75rem;
                opacity: 0.7;
                display: flex;
                align-items: center;
                gap: ${spacing.sm};
            }

            .track-indicator {
                width: 6px;
                height: 6px;
                border-radius: 50%;
            }

            .track-indicator.playing {
                background: ${colors.green[400]};
                animation: pulse 2s infinite;
            }

            .track-indicator.paused {
                background: ${colors.amber[400]};
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
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
        `;
    }

    protected override render(): void {
        if (!this.channel) {
            this.shadowRoot!.innerHTML = "";
            return;
        }

        const channel = this.channel;
        const tracks = Array.from(channel.tracks.values());
        const anyPlaying = tracks.some((t) => t.playing);

        const trackEntries = tracks.map((track) => `
            <div class="track-entry">
                <span class="track-indicator ${track.playing ? "playing" : "paused"}"></span>
                <span>${track.source.type === "live" ? "LIVE" : track.source.ref}</span>
            </div>
        `).join("");

        this.shadowRoot!.innerHTML = `
            ${this.styleTag(this.getStyles())}

            <div class="channel ${anyPlaying ? "playing" : "paused"}">
                <div class="channel-name">${channel.id}</div>
                <div class="track-list">${trackEntries}</div>
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
