import { Subject } from "rxjs";
import { throttleTime } from "rxjs/operators";
import { BaseComponent } from "@components/base/base-component";
import { emitDomEvent } from "@utils/dom-events";
import { cssSheet } from "@styles/adopt-styles";
import { ServiceRegistry } from "@services/service-registry";
import type { MasterAudioService } from "@master/services/master-audio-service";
import type { AssetService } from "@master/services/asset-service";
import type { AudioTrackState } from "@types";

// @ts-expect-error — Bun imports CSS as text
import trackBlockCss from "./timeline-track-block.css" with { type: "text" };
// @ts-expect-error — Bun imports CSS as text
import commonCss from "@styles/common.css" with { type: "text" };

/**
 * Self-contained track block within a timeline channel lane.
 *
 * Subscribes to per-track observables from MasterAudioService
 * to update its own progress, name, and play state without
 * requiring parent re-renders.
 *
 * @attr track-id - The track ID to observe
 * @attr channel - The parent channel ID (for events)
 *
 * @fires track-volume-change - When the volume slider changes
 * @fires track-stop-request - When the stop button is clicked
 */
export class TimelineTrackBlock extends BaseComponent {
    private audioService!: MasterAudioService;
    private assetService!: AssetService;
    private volumeChange$ = new Subject<number>();

    private trackId = "";
    private channel = "";

    static observedAttributes = ["track-id", "channel"];

    override connectedCallback(): void {
        super.connectedCallback();

        this.audioService = ServiceRegistry.get<MasterAudioService>("MasterAudioService");
        this.assetService = ServiceRegistry.get<AssetService>("AssetService");

        this.trackId = this.getAttribute("track-id") ?? "";
        this.channel = this.getAttribute("channel") ?? "";

        this.adoptStyles(cssSheet(commonCss), cssSheet(trackBlockCss));
        this.render();
        this.setupSubscriptions();
    }

    protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.innerHTML = `
            <div class="track-block" id="block">
                <div class="track-progress" id="progress"></div>
                <span class="track-name" id="name"></span>
                <input type="range" class="track-volume" id="volume"
                    min="0" max="1" step="0.01" value="1" />
                <button class="track-stop" id="stop" title="Stop track">×</button>
            </div>
        `;

        this.setupInteractions();
    }

    private setupInteractions(): void {
        const stopBtn = this.shadowRoot?.querySelector("#stop");
        stopBtn?.addEventListener("click", (e) => {
            e.stopPropagation();
            emitDomEvent(this, "track-stop-request", {
                channel: this.channel,
                trackId: this.trackId,
            });
        });

        const volumeSlider = this.shadowRoot?.querySelector("#volume") as HTMLInputElement;
        if (volumeSlider) {
            volumeSlider.addEventListener("mousedown", (e) => e.stopPropagation());
            volumeSlider.addEventListener("input", (e) => {
                e.stopPropagation();
                this.volumeChange$.next(parseFloat(volumeSlider.value));
            });
        }
    }

    private setupSubscriptions(): void {
        if (!this.trackId) {
            return;
        }

        // Track state → update block classes, name, volume slider
        this.subscribe(this.audioService.getTrack$(this.trackId), (track) => {
            this.updateTrackState(track);
        });

        // Elapsed → update progress bar
        this.subscribe(this.audioService.getTrackElapsed$(this.trackId), (elapsed) => {
            this.updateProgressBar(elapsed);
        });

        // Throttled volume events
        this.subscribe(
            this.volumeChange$.pipe(throttleTime(50, undefined, { leading: true, trailing: true })),
            (volume) => {
                emitDomEvent(this, "track-volume-change", {
                    channel: this.channel,
                    trackId: this.trackId,
                    volume,
                });
            },
        );
    }

    private updateTrackState(track: AudioTrackState | null): void {
        const block = this.shadowRoot?.querySelector("#block") as HTMLElement;
        const nameEl = this.shadowRoot?.querySelector("#name") as HTMLElement;
        const volumeEl = this.shadowRoot?.querySelector("#volume") as HTMLInputElement;

        if (!block || !nameEl || !track) {
            return;
        }

        const isLive = track.source.type === "live";
        block.className = `track-block ${isLive ? "live" : "file"}${track.playing ? "" : " paused"}`;

        nameEl.textContent = isLive ? "LIVE" : track.source.ref;

        // Only update slider if user isn't actively dragging it
        if (volumeEl && this.shadowRoot?.activeElement !== volumeEl) {
            volumeEl.value = String(track.volume);
            volumeEl.title = `Volume: ${Math.round(track.volume * 100)}%`;
        }
    }

    private updateProgressBar(elapsed: number): void {
        const block = this.shadowRoot?.querySelector("#block") as HTMLElement;
        if (!block) {
            return;
        }

        const track = this.audioService.findTrack(this.trackId);
        if (!track || track.source.type === "live") {
            block.style.setProperty("--progress", track?.source.type === "live" ? "100%" : "0%");
            return;
        }

        const asset = this.assetService.getAudioAssets().find((a) => a.name === track.source.ref);
        if (!asset || asset.duration <= 0) {
            block.style.setProperty("--progress", "0%");
            return;
        }

        let adjustedElapsed = elapsed;
        if (track.loop && elapsed > asset.duration) {
            adjustedElapsed = elapsed % asset.duration;
        }

        const percent = Math.min(100, (adjustedElapsed / asset.duration) * 100);
        block.style.setProperty("--progress", `${percent}%`);
    }
}
