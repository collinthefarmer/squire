import { BaseComponent } from "@components/base/base-component";
import { ServiceRegistry } from "@services/service-registry";
import type { AudioService } from "@display/services/audio-service";
import type { AudioChannelState } from "@types";
import { AudioChannelCard } from "./audio-channel-card";
import { flexColumn } from "@styles/common-styles";
import { colors, spacing, borderRadius, alpha, transitions } from "@styles/theme";

const COLLAPSE_DELAY = 3000;

/**
 * Audio player component
 *
 * Displays audio channel state as an overlay. Shows full channel
 * cards on audio events, then collapses to minimal indicator dots
 * after a brief delay. Dots are color-coded by channel status
 * (green = playing, amber = paused).
 */
export class AudioPlayer extends BaseComponent {
    private viewMode: "expanded" | "condensed" = "condensed";
    private collapseTimer: number | null = null;
    private latestChannels: Map<string, AudioChannelState> = new Map();

    override connectedCallback(): void {
        super.connectedCallback();

        const audioService = ServiceRegistry.get<AudioService>("AudioService");

        this.subscribe(audioService.getChannels$(), (channels) => {
            this.onChannelsUpdate(channels);
        });

        this.latestChannels = audioService.getChannels();
        this.renderView();
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.resetCollapseTimer();
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
                transition: ${transitions.normal};
            }

            .audio-overlay.condensed {
                padding: 0;
                background: transparent;
                backdrop-filter: none;
                min-width: unset;
                max-width: unset;
            }

            .title {
                font-size: 0.875rem;
                font-weight: 600;
                margin-bottom: ${spacing.md};
                opacity: 0.7;
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }

            .channels-container {
                ${flexColumn()}
            }

            .dot-row {
                display: flex;
                gap: 6px;
                align-items: center;
                padding: 8px 12px;
                background: ${alpha(colors.black, 0.6)};
                border-radius: 999px;
                backdrop-filter: blur(10px);
            }

            .dot {
                width: 10px;
                height: 10px;
                border-radius: 50%;
                transition: background-color 0.3s ease;
            }

            .dot.playing {
                background: ${colors.green[400]};
                animation: pulse 2s infinite;
            }

            .dot.paused {
                background: ${colors.amber[400]};
            }

            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
        `;
    }

    private onChannelsUpdate(channels: Map<string, AudioChannelState>): void {
        this.latestChannels = channels;
        this.resetCollapseTimer();

        if (channels.size > 0) {
            this.viewMode = "expanded";
        }

        this.renderView();
        this.startCollapseTimer();
    }

    private startCollapseTimer(): void {
        if (this.latestChannels.size === 0) {
            return;
        }

        this.collapseTimer = window.setTimeout(() => {
            this.collapseTimer = null;
            this.viewMode = "condensed";
            this.renderView();
        }, COLLAPSE_DELAY);
    }

    private resetCollapseTimer(): void {
        if (this.collapseTimer !== null) {
            clearTimeout(this.collapseTimer);
            this.collapseTimer = null;
        }
    }

    private renderView(): void {
        if (!this.shadowRoot) {
            return;
        }

        const channels = Array.from(this.latestChannels.values());

        if (channels.length === 0) {
            this.shadowRoot.innerHTML = "";
            return;
        }

        if (this.viewMode === "condensed") {
            this.renderCondensed(channels);
        } else {
            this.renderExpanded(channels);
        }
    }

    private renderCondensed(channels: AudioChannelState[]): void {
        const dots = channels.map((ch) =>
            `<div class="dot ${ch.playing ? "playing" : "paused"}"
                  title="${ch.id}: ${ch.playing ? "Playing" : "Paused"}"></div>`,
        ).join("");

        this.shadowRoot!.innerHTML = `
            ${this.styleTag(this.getStyles())}
            <div class="audio-overlay condensed">
                <div class="dot-row">${dots}</div>
            </div>
        `;
    }

    private renderExpanded(channels: AudioChannelState[]): void {
        this.shadowRoot!.innerHTML = `
            ${this.styleTag(this.getStyles())}
            <div class="audio-overlay">
                <div class="title">Audio Channels</div>
                <div class="channels-container" id="channels-container"></div>
            </div>
        `;

        const container = this.shadowRoot!.getElementById("channels-container");
        if (!container) {
            return;
        }

        for (const channel of channels) {
            const card = new AudioChannelCard();
            card.setChannel(channel);
            container.appendChild(card);
        }
    }
}
