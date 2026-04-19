import { BaseComponent } from "@components/base/base-component";
import { emitDomEvent } from "@utils/dom-events";
import {
    secondaryButtonStyles,
    successButtonStyles,
    dangerButtonStyles,
    grid,
} from "@styles/common-styles";
import { spacing, fontSize } from "@styles/theme";

/**
 * Audio playback buttons component
 *
 * Provides Play, Pause, Resume, and Stop buttons for audio control
 */
export class AudioPlaybackButtons extends BaseComponent {
    override connectedCallback(): void {
        super.connectedCallback();

        this.render();
        this.setupEventListeners();
    }

    protected override getStyles(): string {
        return `
            :host {
                display: block;
            }

            .playback-buttons {
                ${grid("repeat(2, 1fr)", spacing.sm)}
            }

            ${secondaryButtonStyles()}
            ${successButtonStyles()}
            ${dangerButtonStyles()}

            button {
                font-size: ${fontSize.base};
            }
        `;
    }

    protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.innerHTML = `
            ${this.styleTag(this.getStyles())}

            <div class="playback-buttons">
                <button id="play" class="success">Play</button>
                <button id="pause" class="secondary">Pause</button>
                <button id="resume" class="secondary">Resume</button>
                <button id="stop" class="danger">Stop</button>
            </div>
        `;
    }

    private setupEventListeners(): void {
        const playBtn = this.shadowRoot?.querySelector(
            "#play",
        ) as HTMLButtonElement;
        const pauseBtn = this.shadowRoot?.querySelector(
            "#pause",
        ) as HTMLButtonElement;
        const resumeBtn = this.shadowRoot?.querySelector(
            "#resume",
        ) as HTMLButtonElement;
        const stopBtn = this.shadowRoot?.querySelector(
            "#stop",
        ) as HTMLButtonElement;

        if (!playBtn || !pauseBtn || !resumeBtn || !stopBtn) {
            return;
        }

        playBtn.addEventListener("click", () => emitDomEvent(this, "play-request"));
        pauseBtn.addEventListener("click", () => emitDomEvent(this, "pause-request"));
        resumeBtn.addEventListener("click", () => emitDomEvent(this, "resume-request"));
        stopBtn.addEventListener("click", () => emitDomEvent(this, "stop-request"));
    }
}
