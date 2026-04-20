import { fromEvent } from "rxjs";
import { BaseComponent } from "@components/base/base-component";
import { stripButtonStyles } from "@styles/common-styles";
import { onDomEvent } from "@utils/dom-events";
import { ServiceRegistry } from "@services/service-registry";
import type { MasterAudioService } from "@master/services/master-audio-service";
import { Logger } from "@utils/logger";
import { generateTrackId } from "@utils/audio-helpers";
import {
    colors,
    spacing,
    borderRadius,
    fontSize,
    sizing,
    transitions,
} from "@styles/theme";

const DEFAULT_CHANNELS = ["ambient", "music", "sfx", "voice"];

/**
 * Audio timeline with channel lanes
 *
 * Thin shell component that manages the lane container and transport bar.
 * Channel lanes and track blocks are self-managing child components that
 * subscribe to their own observables from MasterAudioService.
 */
export class AudioTimeline extends BaseComponent {
    private logger = new Logger("AudioTimeline");
    private audioService!: MasterAudioService;

    private currentLaneIds: string[] = [];

    override connectedCallback(): void {
        super.connectedCallback();

        this.audioService =
            ServiceRegistry.get<MasterAudioService>("MasterAudioService");

        this.render();
        this.setupSubscriptions();
        this.setupEventListeners();
    }

    protected override getStyles(): string {
        return `
            :host {
                display: block;
            }

            ${stripButtonStyles()}

            .timeline {
                background: ${colors.gray[900]};
                border: 1px solid ${colors.gray[700]};
                border-radius: ${borderRadius.md};
                overflow: hidden;
            }

            .transport-row {
                display: flex;
                border-bottom: 1px solid ${colors.gray[700]};
                background: ${colors.gray[800]};
            }

            .global-strip {
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: ${spacing.xs};
                border-right: 1px solid ${colors.gray[800]};
            }

            .global-btn.playing {
                color: ${colors.blue[400]};
                border-color: ${colors.blue[500]};
            }

            .transport-controls {
                display: flex;
                align-items: center;
                gap: ${spacing.md};
                padding: ${spacing.sm} ${spacing.md};
                flex: 1;
            }

            .transport-btn {
                background: transparent;
                border: none;
                color: ${colors.gray[400]};
                cursor: pointer;
                font-size: ${fontSize.base};
                padding: ${spacing.xs};
                border-radius: ${borderRadius.sm};
                transition: ${transitions.fast};
                display: inline-flex;
                align-items: center;
                justify-content: center;
            }

            .transport-btn:hover {
                background: ${colors.gray[700]};
                color: ${colors.gray[200]};
            }

            .transport-volume {
                display: flex;
                align-items: center;
                gap: ${spacing.xs};
                flex: 1;
            }

            .transport-volume label {
                font-size: ${fontSize.xs};
                color: ${colors.gray[500]};
            }

            .transport-volume input[type="range"] {
                flex: 1;
                max-width: ${sizing.volumeMax};
                accent-color: ${colors.blue[500]};
            }

            .channel-lanes {
                display: flex;
                flex-direction: column;
            }

            .empty-hint {
                font-size: ${fontSize.xs};
                color: ${colors.gray[600]};
                padding: ${spacing.sm} ${spacing.md};
                text-align: center;
            }
        `;
    }

    protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.innerHTML = `
            ${this.styleTag(this.getStyles())}

            <div class="timeline">
                <div class="transport-row">
                    <div class="global-strip">
                        <button class="strip-btn global-btn" id="global-pause" title="Pause All">⏸</button>
                    </div>
                    <div class="transport-controls">
                        <button class="transport-btn" id="stop-btn" title="Stop All">⏹</button>
                        <div class="transport-volume">
                            <label>Vol</label>
                            <input type="range" id="transport-volume" min="0" max="1" step="0.01" value="1">
                        </div>
                    </div>
                </div>
                <div class="channel-lanes" id="lanes"></div>
            </div>
        `;
    }

    // -- Subscriptions --

    private setupSubscriptions(): void {
        this.subscribe(
            this.audioService.getChannelIds$(DEFAULT_CHANNELS),
            (ids) => this.syncLaneElements(ids),
        );

        this.subscribe(this.audioService.getChannels$(), () =>
            this.updateGlobalPauseButton(),
        );
    }

    private syncLaneElements(ids: string[]): void {
        const container = this.shadowRoot?.querySelector("#lanes");
        if (!container) {
            return;
        }

        const currentSet = new Set(this.currentLaneIds);
        const newSet = new Set(ids);

        for (const id of this.currentLaneIds) {
            if (newSet.has(id)) {
                continue;
            }

            const el = container.querySelector(
                `timeline-channel-lane[channel="${id}"]`,
            );

            el?.remove();
        }

        for (const id of ids) {
            if (currentSet.has(id)) {
                continue;
            }

            const lane = document.createElement("timeline-channel-lane");
            lane.setAttribute("channel", id);
            container.appendChild(lane);
        }

        this.currentLaneIds = ids;
    }

    // -- Event listeners --

    private setupEventListeners(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.cleanup.push(
            onDomEvent(this.shadowRoot, "track-volume-change", (e) => {
                this.audioService.setVolume(e.detail.channel, e.detail.volume, e.detail.trackId);
            }),

            onDomEvent(this.shadowRoot, "track-stop-request", (e) => {
                this.audioService.stopAudio(e.detail.channel, e.detail.trackId);
            }),
        );

        // Global pause
        this.shadowRoot
            .querySelector("#global-pause")
            ?.addEventListener("click", () => {
                this.handleGlobalPauseToggle();
            });

        // Stop all
        this.shadowRoot
            .querySelector("#stop-btn")
            ?.addEventListener("click", () => {
                for (const [id] of this.audioService.getChannels()) {
                    this.audioService.stopAudio(id);
                }
            });

        // Volume all
        const volumeSlider = this.shadowRoot.querySelector(
            "#transport-volume",
        ) as HTMLInputElement;
        volumeSlider?.addEventListener("input", () => {
            const volume = parseFloat(volumeSlider.value);
            for (const [id] of this.audioService.getChannels()) {
                this.audioService.setVolume(id, volume);
            }
        });

        // Drop handling
        this.subscribe(
            fromEvent<CustomEvent<import("@utils/dom-events").DragEndDetail>>(
                document,
                "drag-end",
            ),
            (e) => this.handleDrop(e),
        );
    }

    private handleDrop(
        e: CustomEvent<import("@utils/dom-events").DragEndDetail>,
    ): void {
        if (e.detail.source !== "audio-list") {
            return;
        }

        const channel = this.findLaneAtPosition(e.detail.x, e.detail.y);
        if (!channel) {
            return;
        }

        const trackId = generateTrackId();

        this.logger.info("Audio drop", {
            asset: e.detail.data,
            channel,
            trackId,
        });

        this.audioService.playAudio(channel, e.detail.data, { trackId });
    }

    private findLaneAtPosition(x: number, y: number): string | null {
        const lanes = this.shadowRoot?.querySelectorAll(
            "timeline-channel-lane",
        );
        if (!lanes) {
            return null;
        }

        for (const lane of Array.from(lanes)) {
            const rect = lane.getBoundingClientRect();
            if (
                y >= rect.top &&
                y <= rect.bottom &&
                x >= rect.left &&
                x <= rect.right
            ) {
                return lane.getAttribute("channel");
            }
        }

        return null;
    }

    // -- Global transport --

    private updateGlobalPauseButton(): void {
        const btn = this.shadowRoot?.querySelector(
            "#global-pause",
        ) as HTMLButtonElement;
        if (!btn) {
            return;
        }

        let anyPlaying = false;

        for (const [, channel] of this.audioService.getChannels()) {
            for (const track of channel.tracks.values()) {
                if (track.playing) {
                    anyPlaying = true;
                    break;
                }
            }

            if (anyPlaying) {
                break;
            }
        }

        btn.textContent = anyPlaying ? "⏸" : "▶";
        btn.classList.toggle("playing", anyPlaying);
    }

    private handleGlobalPauseToggle(): void {
        let anyPlaying = false;

        for (const [, channel] of this.audioService.getChannels()) {
            for (const track of channel.tracks.values()) {
                if (track.playing) {
                    anyPlaying = true;
                    break;
                }
            }

            if (anyPlaying) {
                break;
            }
        }

        for (const [id] of this.audioService.getChannels()) {
            if (anyPlaying) {
                this.audioService.pauseAudio(id);
            } else {
                this.audioService.resumeAudio(id);
            }
        }
    }
}
