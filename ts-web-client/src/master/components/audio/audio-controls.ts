import { BaseComponent } from "@components/base/base-component";
import { onDomEvent } from "@utils/dom-events";
import { ServiceRegistry } from "@services/service-registry";
import { EventBuilder } from "@master/services/event-builder";
import type { ConnectionService } from "@services/connection-service";
import {
    containerStyles,
    sectionHeaderStyles,
    flexColumn,
} from "@styles/common-styles";
import { spacing, fontSize } from "@styles/theme";

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
                font-size: ${fontSize.lg};
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

        this.cleanup.push(
            onDomEvent(this.shadowRoot, "channel-change", (e) => {
                this.currentChannel = e.detail.channel;
            }),

            onDomEvent(this.shadowRoot, "asset-change", (e) => {
                this.currentAsset = e.detail.asset;
            }),

            onDomEvent(this.shadowRoot, "volume-change", (e) => {
                this.currentVolume = e.detail.volume;
            }),

            onDomEvent(this.shadowRoot, "loop-change", (e) => {
                this.currentLoop = e.detail.loop;
            }),

            onDomEvent(this.shadowRoot, "play-request", () => {
                this.handlePlay();
            }),

            onDomEvent(this.shadowRoot, "pause-request", () => {
                this.handlePause();
            }),

            onDomEvent(this.shadowRoot, "resume-request", () => {
                this.handleResume();
            }),

            onDomEvent(this.shadowRoot, "stop-request", () => {
                this.handleStop();
            }),
        );
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
