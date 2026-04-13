import { BaseComponent } from "@components/base/base-component";
import { ServiceRegistry } from "@services/service-registry";
import { EventBuilder } from "@master/services/event-builder";
import type { ConnectionService } from "@services/connection-service";
import {
    containerStyles,
    sectionHeaderStyles,
    flexColumn,
} from "@styles/common-styles";
import { spacing } from "@styles/theme";

/**
 * Audio controls container component
 *
 * Hosts all audio control components and coordinates event creation
 */
export class AudioControls extends BaseComponent {
    private connectionService!: ConnectionService;
    private currentChannel = "ambient";
    private currentAsset = "";
    private currentVolume = 1.0;
    private currentLoop = false;

    override connectedCallback(): void {
        super.connectedCallback();

        this.connectionService =
            ServiceRegistry.get<ConnectionService>("ConnectionService");

        this.render();
        this.setupEventListeners();
    }

    protected override getStyles(): string {
        return `
            :host {
                display: block;
            }

            ${containerStyles()}
            ${sectionHeaderStyles()}

            .audio-controls {
                ${flexColumn(spacing.xl)}
            }

            .controls-grid {
                ${flexColumn(spacing.xl)}
            }

            .header {
                font-size: 1.125rem;
            }
        `;
    }

    protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.innerHTML = `
            ${this.styleTag(this.getStyles())}

            <div class="container audio-controls">
                <div class="section-header header">Audio Controls</div>
                <div class="controls-grid">
                    <channel-selector></channel-selector>
                    <audio-asset-picker></audio-asset-picker>
                    <volume-control></volume-control>
                    <audio-playback-buttons></audio-playback-buttons>
                </div>
            </div>
        `;
    }

    private setupEventListeners(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.addEventListener("channel-change", ((
            e: CustomEvent,
        ) => {
            this.currentChannel = e.detail.channel;
        }) as EventListener);

        this.shadowRoot.addEventListener("asset-change", ((e: CustomEvent) => {
            this.currentAsset = e.detail.asset;
        }) as EventListener);

        this.shadowRoot.addEventListener("volume-change", ((e: CustomEvent) => {
            this.currentVolume = e.detail.volume;
        }) as EventListener);

        this.shadowRoot.addEventListener("loop-change", ((e: CustomEvent) => {
            this.currentLoop = e.detail.loop;
        }) as EventListener);

        this.shadowRoot.addEventListener("play-request", () => {
            this.handlePlay();
        });

        this.shadowRoot.addEventListener("pause-request", () => {
            this.handlePause();
        });

        this.shadowRoot.addEventListener("resume-request", () => {
            this.handleResume();
        });

        this.shadowRoot.addEventListener("stop-request", () => {
            this.handleStop();
        });
    }

    private handlePlay(): void {
        if (!this.currentAsset) {
            console.warn("No audio asset selected");
            return;
        }

        const event = EventBuilder.audioPlay({
            channel: this.currentChannel,
            source: this.currentAsset,
            volume: this.currentVolume,
            loop: this.currentLoop,
        });

        this.connectionService.send(event);
    }

    private handlePause(): void {
        const event = EventBuilder.audioPause({
            channel: this.currentChannel,
        });

        this.connectionService.send(event);
    }

    private handleResume(): void {
        const event = EventBuilder.audioResume({
            channel: this.currentChannel,
        });

        this.connectionService.send(event);
    }

    private handleStop(): void {
        const event = EventBuilder.audioStop({
            channel: this.currentChannel,
        });

        this.connectionService.send(event);
    }
}
