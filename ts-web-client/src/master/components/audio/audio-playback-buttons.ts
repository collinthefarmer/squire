import { BaseComponent } from "@components/base/base-component";
import { cssSheet } from "@styles/adopt-styles";
import { emitDomEvent } from "@utils/dom-events";
import {
    secondaryButtonStyles,
    successButtonStyles,
    dangerButtonStyles,
    grid,
} from "@styles/common-styles";
// @ts-expect-error — Bun imports CSS as text
import audioPlaybackButtonsCss from "./audio-playback-buttons.css" with { type: "text" };
// @ts-expect-error — Bun imports CSS as text
import commonCss from "@styles/common.css" with { type: "text" };

/**
 * Audio playback buttons component
 *
 * Provides Play, Pause, Resume, and Stop buttons for audio control
 */
export class AudioPlaybackButtons extends BaseComponent {
    override connectedCallback(): void {
        super.connectedCallback();

        this.adoptStyles(
            cssSheet(commonCss),
            cssSheet(audioPlaybackButtonsCss),
        );

        this.render();
        this.setupEventListeners();
    }
    protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.innerHTML = `
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

        playBtn.addEventListener("click", () =>
            emitDomEvent(this, "play-request"),
        );
        pauseBtn.addEventListener("click", () =>
            emitDomEvent(this, "pause-request"),
        );
        resumeBtn.addEventListener("click", () =>
            emitDomEvent(this, "resume-request"),
        );
        stopBtn.addEventListener("click", () =>
            emitDomEvent(this, "stop-request"),
        );
    }
}
