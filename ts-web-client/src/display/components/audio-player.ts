import { of, concat, timer } from "rxjs";
import { cssSheet } from "@styles/adopt-styles";
import { switchMap, tap, map } from "rxjs/operators";
import { BaseComponent } from "@components/base/base-component";
import { ServiceRegistry } from "@services/service-registry";
import type { AudioService } from "@display/services/audio-service";
import type { AudioChannelState } from "@types";
import { AudioChannelCard } from "./audio-channel-card";
import { flexColumn } from "@styles/common-styles";

// @ts-expect-error — Bun imports CSS as text
import audioPlayerCss from "./audio-player.css" with { type: "text" };
// @ts-expect-error — Bun imports CSS as text
import commonCss from "@styles/common.css" with { type: "text" };
import {
    colors,
    spacing,
    borderRadius,
    alpha,
    transitions,
} from "@styles/theme";

const COLLAPSE_DELAY = 3000;

type ViewMode = "expanded" | "condensed" | "empty";

/**
 * Audio player component
 *
 * Displays audio channel state as an overlay. Shows full channel
 * cards on audio events, then collapses to minimal indicator dots
 * after a brief delay. Dots are color-coded by channel status
 * (green = playing, amber = paused).
 */
export class AudioPlayer extends BaseComponent {
    private viewMode: ViewMode = "empty";
    private latestChannels: Map<string, AudioChannelState> = new Map();

    override connectedCallback(): void {
        super.connectedCallback();

        const audioService = ServiceRegistry.get<AudioService>("AudioService");

        this.subscribe(
            audioService.getChannels$().pipe(
                tap((channels) => { this.latestChannels = channels; }),
                switchMap((channels) => {
                    if (channels.size === 0) {
                        return of("empty" as const);
                    }

                    return concat(
                        of("expanded" as const),
                        timer(COLLAPSE_DELAY).pipe(map(() => "condensed" as const)),
                    );
                }),
            ),
            (mode) => {
                this.viewMode = mode;
                this.adoptStyles(cssSheet(commonCss), cssSheet(audioPlayerCss));

                this.render();
            },
        );

        this.latestChannels = audioService.getChannels();
        this.render();
    }
protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        if (this.viewMode === "empty") {
            this.shadowRoot.innerHTML = "";
            return;
        }

        const channels = Array.from(this.latestChannels.values());

        if (this.viewMode === "condensed") {
            this.renderCondensed(channels);
        } else {
            this.renderExpanded(channels);
        }
    }

    private renderCondensed(channels: AudioChannelState[]): void {
        const dots = channels
            .map((ch) => {
                const anyPlaying = Array.from(ch.tracks.values()).some((t) => t.playing);
                return `<div class="dot ${anyPlaying ? "playing" : "paused"}"
                  title="${ch.id}: ${anyPlaying ? "Playing" : "Paused"}"></div>`;
            })
            .join("");

        this.shadowRoot!.innerHTML = `
            <div class="audio-overlay condensed">
                <div class="dot-row">${dots}</div>
            </div>
        `;
    }

    private renderExpanded(channels: AudioChannelState[]): void {
        this.shadowRoot!.innerHTML = `
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
