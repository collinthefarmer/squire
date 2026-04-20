import { BaseComponent } from "@components/base/base-component";
import { cssSheet } from "@styles/adopt-styles";
import type { AudioChannelState } from "@types";
// @ts-expect-error — Bun imports CSS as text
import audioChannelCardCss from "./audio-channel-card.css" with { type: "text" };
// @ts-expect-error — Bun imports CSS as text
import commonCss from "@styles/common.css" with { type: "text" };

/**
 * Audio channel card component
 *
 * Renders a single audio channel's state, showing all active tracks.
 */
export class AudioChannelCard extends BaseComponent {
    private channel: AudioChannelState | null = null;

    setChannel(channel: AudioChannelState): void {
        this.channel = channel;
        this.adoptStyles(cssSheet(commonCss), cssSheet(audioChannelCardCss));

        this.render();
    }
    protected override render(): void {
        if (!this.channel) {
            this.shadowRoot!.innerHTML = "";
            return;
        }

        const channel = this.channel;
        const tracks = Array.from(channel.tracks.values());
        const anyPlaying = tracks.some((t) => t.playing);

        const trackEntries = tracks
            .map(
                (track) => `
            <div class="track-entry">
                <span class="track-indicator ${track.playing ? "playing" : "paused"}"></span>
                <span>${track.source.type === "live" ? "LIVE" : track.source.ref}</span>
            </div>
        `,
            )
            .join("");

        this.shadowRoot!.innerHTML = `
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
