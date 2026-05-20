import { BaseComponent } from "@components/base/base-component";
import { cssSheet } from "@styles/adopt-styles";
import { onDomEvent } from "@utils/dom-events";
import { ServiceRegistry } from "@services/service-registry";
import { TOKENS } from "@services/service-tokens";
import type { LiveAudioService } from "@master/services/live-audio-service";

// @ts-expect-error — Bun imports CSS as text
import audioControlsCss from "./audio-controls.css" with { type: "text" };
// @ts-expect-error — Bun imports CSS as text
import commonCss from "@styles/common.css" with { type: "text" };

/**
 * Audio controls container component
 *
 * Sidebar panel with a filterable audio file list and a draggable
 * mic input item. Files and the mic item are dragged to the timeline
 * for playback. Per-channel and per-track controls live on the
 * timeline itself.
 */
export class AudioControls extends BaseComponent {
    private liveAudioService!: LiveAudioService;

    override connectedCallback(): void {
        super.connectedCallback();

        this.liveAudioService =
            ServiceRegistry.get(TOKENS.LiveAudioService);

        this.adoptStyles(cssSheet(commonCss), cssSheet(audioControlsCss));
        this.render();
        this.setupListeners();
    }

    private setupListeners(): void {
        const mic = this.shadowRoot?.querySelector(".mic-draggable-wrapper");
        if (!mic) return;

        onDomEvent(mic, "drag-click", () => {
            this.liveAudioService.goLive("voice");
        });
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

                <squire-draggable-audio
                    data-drag-data="master-mic"
                    data-drag-source="audio-list"
                    class="mic-draggable-wrapper"
                >
                    <div class="mic-input-row">
                        <span class="mic-icon">🎙</span>
                        <span class="mic-label">Microphone Input</span>
                    </div>
                </squire-draggable-audio>

            </div>
        `;
    }
}
