import { BaseComponent } from "@components/base/base-component";
import { cssSheet } from "@styles/adopt-styles";
import { onDomEvent } from "@utils/dom-events";
import { ServiceRegistry } from "@services/service-registry";
import type { MicCaptureService } from "@master/services/mic-capture-service";
import type { LiveAudioService } from "@master/services/live-audio-service";
import {
    sectionHeaderStyles,
    selectStyles,
    labelStyles,
    rangeInputStyles,
    checkboxStyles,
    flexColumn,
    sliderRowStyles,
    valueDisplayStyles,
    primaryButtonStyles,
    dividerStyles,
} from "@styles/common-styles";
// @ts-expect-error — Bun imports CSS as text
import audioControlsCss from "./audio-controls.css" with { type: "text" };
// @ts-expect-error — Bun imports CSS as text
import commonCss from "@styles/common.css" with { type: "text" };

/**
 * Audio controls container component
 *
 * Sidebar panel with three stacked sections:
 * 1. Filterable, draggable audio file list (flex: 1, scrollable)
 * 2. Playback controls: channel selector, volume, loop
 * 3. Live mic: device, gain, meter, monitor, go-live button
 */
export class AudioControls extends BaseComponent {
    private micCaptureService!: MicCaptureService;
    private liveAudioService!: LiveAudioService;

    private currentChannel = "ambient";
    private currentVolume = 1.0;
    private selectedDeviceId = "";

    override connectedCallback(): void {
        super.connectedCallback();

        this.micCaptureService = ServiceRegistry.get<MicCaptureService>("MicCaptureService");
        this.liveAudioService = ServiceRegistry.get<LiveAudioService>("LiveAudioService");

        this.adoptStyles(cssSheet(commonCss), cssSheet(audioControlsCss));

        this.render();
        this.setupEventListeners();
    }
protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.innerHTML = `
            <div class="audio-panel">
                <div class="section-header">Audio</div>

                <audio-file-list></audio-file-list>

                <div class="divider"></div>

                <div class="controls-section">
                    <div class="form-group">
                        <label for="channel">Channel</label>
                        <select id="channel">
                            <option value="ambient">Ambient</option>
                            <option value="music">Music</option>
                            <option value="sfx">SFX</option>
                            <option value="voice">Voice</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label>Volume</label>
                        <div class="slider-row">
                            <input type="range" id="volume" min="0" max="1" step="0.01" value="1">
                            <span class="value-display" id="volume-value">100%</span>
                        </div>
                    </div>

                    <div class="loop-row">
                        <input type="checkbox" id="loop">
                        <label for="loop">Loop</label>
                    </div>
                </div>

                <div class="divider"></div>

                <div class="controls-section">
                    <div class="live-header">Live Mic</div>
                    <mic-controls></mic-controls>
                    <button class="primary go-live-btn" id="go-live" type="button">Go Live</button>
                </div>
            </div>
        `;
    }

    private setupEventListeners(): void {
        if (!this.shadowRoot) {
            return;
        }

        const channelSelect = this.shadowRoot.querySelector("#channel") as HTMLSelectElement;
        const volumeSlider = this.shadowRoot.querySelector("#volume") as HTMLInputElement;
        const volumeValue = this.shadowRoot.querySelector("#volume-value") as HTMLSpanElement;
        const loopCheckbox = this.shadowRoot.querySelector("#loop") as HTMLInputElement;
        const goLiveBtn = this.shadowRoot.querySelector("#go-live") as HTMLButtonElement;

        if (!channelSelect || !volumeSlider || !volumeValue || !loopCheckbox || !goLiveBtn) {
            return;
        }

        channelSelect.addEventListener("change", () => {
            this.currentChannel = channelSelect.value;
        });

        volumeSlider.addEventListener("input", () => {
            this.currentVolume = parseFloat(volumeSlider.value);
            volumeValue.textContent = `${Math.round(this.currentVolume * 100)}%`;
        });

        goLiveBtn.addEventListener("click", () => {
            if (this.liveAudioService.isLive()) {
                this.liveAudioService.stopLive();
                goLiveBtn.textContent = "Go Live";
                goLiveBtn.classList.remove("active");
            } else {
                this.liveAudioService.goLive(
                    this.currentChannel,
                    this.selectedDeviceId || undefined,
                ).catch((err) => {
                    console.error("Failed to go live", err);
                });
                goLiveBtn.textContent = "Stop Live";
                goLiveBtn.classList.add("active");
            }
        });

        this.cleanup.push(
            onDomEvent(this.shadowRoot, "mic-device-change", (e) => {
                this.selectedDeviceId = e.detail.deviceId;
            }),

            onDomEvent(this.shadowRoot, "gain-change", (e) => {
                this.micCaptureService.setInputGain(e.detail.gain);
            }),

            onDomEvent(this.shadowRoot, "monitor-change", (e) => {
                this.micCaptureService.setMonitoring(e.detail.enabled);
            }),
        );
    }

    getChannel(): string {
        return this.currentChannel;
    }

    getVolume(): number {
        return this.currentVolume;
    }

    isLooping(): boolean {
        const checkbox = this.shadowRoot?.querySelector("#loop") as HTMLInputElement;
        return checkbox?.checked ?? false;
    }
}
