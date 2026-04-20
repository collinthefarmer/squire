import { BaseComponent } from "@components/base/base-component";
import { stripButtonStyles, levelBarStyles } from "@styles/common-styles";
import { ServiceRegistry } from "@services/service-registry";
import type {
    MasterAudioService,
    MixState,
} from "@master/services/master-audio-service";
import type { AudioChannelState } from "@types";
import {
    colors,
    spacing,
    fontSize,
    borderRadius,
    sizing,
    transitions,
} from "@styles/theme";

/**
 * Single channel lane in the audio timeline.
 *
 * Left strip: play/pause, mute, solo buttons (vertical, touch-friendly).
 * Right body: channel label + collapsible track blocks.
 *
 * @attr channel - The channel ID
 */
export class TimelineChannelLane extends BaseComponent {
    private audioService!: MasterAudioService;
    private channelId = "";
    private currentTrackIds: string[] = [];
    private collapsed = false;

    static observedAttributes = ["channel"];

    override connectedCallback(): void {
        super.connectedCallback();

        this.audioService =
            ServiceRegistry.get<MasterAudioService>("MasterAudioService");
        this.channelId = this.getAttribute("channel") ?? "";

        this.render();
        this.setupInteractions();
        this.setupSubscriptions();
    }

    setMuted(muted: boolean): void {
        const btn = this.shadowRoot?.querySelector("#mute-btn") as HTMLElement;
        const lane = this.shadowRoot?.querySelector(".lane") as HTMLElement;

        btn?.classList.toggle("active", muted);
        lane?.classList.toggle("muted", muted);
    }

    setSoloed(soloed: boolean): void {
        const btn = this.shadowRoot?.querySelector("#solo-btn") as HTMLElement;
        btn?.classList.toggle("active", soloed);
    }

    protected override getStyles(): string {
        return `
            :host {
                display: block;
            }

            ${stripButtonStyles()}
            ${levelBarStyles()}

            .lane {
                display: flex;
                min-height: calc(${sizing.stripBtn} + ${spacing.sm});
                border-bottom: 1px solid ${colors.gray[800]};
                transition: ${transitions.fast};
            }

            .lane:hover {
                background: ${colors.gray[800]};
            }

            .lane.muted {
                opacity: 0.5;
            }

            /* -- Left button strip -- */

            .lane-strip {
                display: flex;
                flex-direction: row;
                gap: ${spacing.sm};
                padding: ${spacing.xs};
                flex-shrink: 0;
                border-right: 1px solid ${colors.gray[800]};
                align-items: center;
            }

            .play-btn {
                flex: 2;
            }

            .play-btn.playing {
                color: ${colors.blue[400]};
                border-color: ${colors.blue[500]};
            }

            .mute-btn.active {
                background: ${colors.red[500]};
                border-color: ${colors.red[500]};
                color: ${colors.white};
            }

            .solo-btn.active {
                background: ${colors.amber[400]};
                border-color: ${colors.amber[400]};
                color: ${colors.gray[900]};
            }

            /* -- Right body -- */

            .lane-body {
                flex: 1;
                min-width: 0;
                display: flex;
                flex-direction: column;
                padding: ${spacing.xs} ${spacing.sm};
            }

            .lane-label {
                font-size: ${fontSize.xs};
                color: ${colors.gray[500]};
                text-transform: uppercase;
                letter-spacing: 0.05em;
                margin-bottom: ${spacing.xs};
                flex-shrink: 0;
            }

            .lane-content {
                flex: 1;
                min-height: 0;
            }

            .lane-summary {
                display: none;
                align-items: center;
                gap: ${spacing.sm};
                height: ${sizing.stripBtn};
                cursor: pointer;
                user-select: none;
            }

            .lane-summary.visible {
                display: flex;
            }

            .collapse-toggle {
                background: transparent;
                border: none;
                color: ${colors.gray[500]};
                cursor: pointer;
                font-size: ${fontSize.xs};
                padding: 0;
                line-height: 1;
                width: ${spacing.lg};
                text-align: center;
            }

            .summary-text {
                font-size: ${fontSize.xs};
                color: ${colors.gray[400]};
                flex: 1;
            }

            .lane-track {
                display: flex;
                flex-direction: column;
                gap: ${spacing.xs};
            }

            .lane-track.hidden {
                display: none;
            }
        `;
    }

    protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.innerHTML = `
            ${this.styleTag(this.getStyles())}

            <div class="lane">
                <div class="lane-strip">
                    <button class="strip-btn play-btn" id="play-btn" title="Play/Pause">▶</button>
                    <button class="strip-btn mute-btn" id="mute-btn" title="Mute">M</button>
                    <button class="strip-btn solo-btn" id="solo-btn" title="Solo">S</button>
                </div>
                <div class="lane-body">
                    <span class="lane-label">${this.channelId}</span>
                    <div class="lane-content">
                        <div class="lane-summary" id="summary">
                            <button class="collapse-toggle" id="toggle">▸</button>
                            <span class="summary-text" id="summary-text"></span>
                            <div class="level-bar">
                                <div class="level-bar-fill" id="level-fill"></div>
                            </div>
                        </div>
                        <div class="lane-track" id="track-area"></div>
                    </div>
                </div>
            </div>
        `;
    }

    private setupInteractions(): void {
        this.shadowRoot
            ?.querySelector("#play-btn")
            ?.addEventListener("click", (e) => {
                e.stopPropagation();
                this.handlePlayPause();
            });

        this.shadowRoot
            ?.querySelector("#summary")
            ?.addEventListener("click", (e) => {
                e.stopPropagation();
                this.collapsed = !this.collapsed;
                this.updateCollapsedState();
            });

        this.shadowRoot
            ?.querySelector("#mute-btn")
            ?.addEventListener("click", (e) => {
                e.stopPropagation();
                this.audioService.toggleMute(this.channelId);
            });

        this.shadowRoot
            ?.querySelector("#solo-btn")
            ?.addEventListener("click", (e) => {
                e.stopPropagation();
                this.audioService.toggleSolo(this.channelId);
            });
    }

    private handlePlayPause(): void {
        const channel = this.audioService.getChannel(this.channelId);
        if (!channel) {
            return;
        }

        const anyPlaying = Array.from(channel.tracks.values()).some(
            (t) => t.playing,
        );

        if (anyPlaying) {
            this.audioService.pauseAudio(this.channelId);
        } else {
            this.audioService.resumeAudio(this.channelId);
        }
    }

    private setupSubscriptions(): void {
        if (!this.channelId) {
            return;
        }

        this.subscribe(
            this.audioService.getChannel$(this.channelId),
            (channel) => {
                const newTrackIds = channel
                    ? Array.from(channel.tracks.keys())
                    : [];

                this.syncTrackBlocks(newTrackIds);
                this.updateSummary(channel);
                this.updatePlayButton(channel);
            },
        );

        this.subscribe(this.audioService.getMixState$(), (mix) => {
            this.setMuted(mix.muted.has(this.channelId));
            this.setSoloed(mix.solo === this.channelId);
        });
    }

    private updatePlayButton(channel: AudioChannelState | null): void {
        const btn = this.shadowRoot?.querySelector("#play-btn") as HTMLElement;
        if (!btn) {
            return;
        }

        const anyPlaying = channel
            ? Array.from(channel.tracks.values()).some((t) => t.playing)
            : false;

        btn.textContent = anyPlaying ? "⏸" : "▶";
        btn.classList.toggle("playing", anyPlaying);
    }

    private syncTrackBlocks(newIds: string[]): void {
        const trackArea = this.shadowRoot?.querySelector("#track-area");
        if (!trackArea) {
            return;
        }

        const currentSet = new Set(this.currentTrackIds);
        const newSet = new Set(newIds);
        const prevCount = this.currentTrackIds.length;

        for (const id of this.currentTrackIds) {
            if (!newSet.has(id)) {
                const el = trackArea.querySelector(
                    `timeline-track-block[track-id="${id}"]`,
                );
                el?.remove();
            }
        }

        for (const id of newIds) {
            if (!currentSet.has(id)) {
                const block = document.createElement("timeline-track-block");
                block.setAttribute("track-id", id);
                block.setAttribute("channel", this.channelId);
                trackArea.appendChild(block);
            }
        }

        this.currentTrackIds = newIds;

        if (prevCount <= 1 && newIds.length > 1) {
            this.collapsed = true;
        }

        if (newIds.length <= 1) {
            this.collapsed = false;
        }

        this.updateCollapsedState();
    }

    private updateSummary(channel: AudioChannelState | null): void {
        const summaryText = this.shadowRoot?.querySelector(
            "#summary-text",
        ) as HTMLElement;
        const levelFill = this.shadowRoot?.querySelector(
            "#level-fill",
        ) as HTMLElement;

        if (!summaryText || !levelFill || !channel) {
            return;
        }

        const tracks = Array.from(channel.tracks.values());
        const total = tracks.length;
        const playing = tracks.filter((t) => t.playing).length;
        const paused = total - playing;

        const parts: string[] = [];
        if (playing > 0) {
            parts.push(`${playing} playing`);
        }
        if (paused > 0) {
            parts.push(`${paused} paused`);
        }

        summaryText.textContent = parts.join(", ") || "empty";
        levelFill.style.width =
            total > 0 ? `${(playing / total) * 100}%` : "0%";
    }

    private updateCollapsedState(): void {
        const summary = this.shadowRoot?.querySelector(
            "#summary",
        ) as HTMLElement;
        const trackArea = this.shadowRoot?.querySelector(
            "#track-area",
        ) as HTMLElement;
        const toggle = this.shadowRoot?.querySelector("#toggle") as HTMLElement;

        if (!summary || !trackArea || !toggle) {
            return;
        }

        const multiTrack = this.currentTrackIds.length > 1;

        if (!multiTrack) {
            summary.classList.remove("visible");
            trackArea.classList.remove("hidden");
            return;
        }

        summary.classList.add("visible");
        toggle.textContent = this.collapsed ? "▸" : "▾";

        if (this.collapsed) {
            trackArea.classList.add("hidden");
        } else {
            trackArea.classList.remove("hidden");
        }
    }
}
