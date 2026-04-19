import { BaseComponent } from "@components/base/base-component";
import { emitDomEvent } from "@utils/dom-events";
import { Logger } from "@utils/logger";
import { primaryButtonStyles, cardStyles } from "@styles/common-styles";
import { colors, spacing, borderRadius, alpha } from "@styles/theme";

/**
 * Modal component for enabling audio playback
 *
 * Browsers require user interaction before allowing audio playback.
 * This modal prompts the user to click a button to enable audio,
 * satisfying the browser's autoplay policy requirements.
 *
 * Uses the native <dialog> element for proper modal semantics,
 * focus management, and accessibility.
 */
export class AudioEnableModal extends BaseComponent {
    private logger = new Logger("AudioEnableModal");
    private dialog: HTMLDialogElement | null = null;

    override connectedCallback(): void {
        super.connectedCallback();
        this.render();
        this.setupEventListeners();
        this.showModal();
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.dialog = null;
    }

    /**
     * Show the modal dialog
     */
    private showModal(): void {
        if (!this.dialog) {
            return;
        }

        this.logger.info("Showing audio enable modal");
        this.dialog.showModal();
    }

    /**
     * Close the modal and emit enable event
     */
    private handleEnable(): void {
        this.logger.info("Audio enabled by user interaction");

        // Play a silent audio to unlock audio context
        this.unlockAudioContext();

        // Close the dialog
        if (this.dialog) {
            this.dialog.close();
        }

        emitDomEvent(this, "audio-enabled");

        // Remove the modal from DOM after closing
        this.remove();
    }

    /**
     * Unlock the audio context by playing a silent audio
     *
     * This satisfies the browser's autoplay policy by establishing
     * user interaction context for subsequent audio playback.
     */
    private unlockAudioContext(): void {
        const silentAudio = new Audio();
        silentAudio.volume = 0;

        // Create a short silent audio using a data URL
        silentAudio.src =
            "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

        silentAudio.play().catch((error) => {
            this.logger.warn("Failed to play silent audio", { error });
        });
    }

    /**
     * Setup event listeners for the enable button
     */
    private setupEventListeners(): void {
        const enableButton = this.shadowRoot?.getElementById("enable-button");
        if (enableButton) {
            enableButton.addEventListener("click", () => this.handleEnable());
        }

        // Handle keyboard events for accessibility
        this.dialog?.addEventListener("keydown", (event: KeyboardEvent) => {
            if (event.key === "Enter") {
                event.preventDefault();
                this.handleEnable();
            }
        });
    }

    protected override getStyles(): string {
        return `
            :host {
                font-family: system-ui, -apple-system, sans-serif;
            }

            dialog {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                max-width: 100%;
                max-height: 100%;
                margin: 0;
                padding: 0;
                border: none;
                background: transparent;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            dialog::backdrop {
                background: ${alpha(colors.black, 0.85)};
                backdrop-filter: blur(4px);
            }

            dialog:not([open]) {
                display: none;
            }

            .modal-content {
                background: ${colors.gray[900]};
                border: 1px solid ${colors.gray[700]};
                border-radius: ${borderRadius.lg};
                padding: ${spacing["2xl"]};
                max-width: 400px;
                text-align: center;
                color: ${colors.gray[100]};
                box-shadow: 0 25px 50px -12px ${alpha(colors.black, 0.5)};
            }

            .icon {
                font-size: 3rem;
                margin-bottom: ${spacing.lg};
                line-height: 1;
            }

            h2 {
                margin: 0 0 ${spacing.md} 0;
                font-size: 1.5rem;
                font-weight: 600;
                color: ${colors.white};
            }

            p {
                margin: 0 0 ${spacing.xl} 0;
                font-size: 1rem;
                line-height: 1.5;
                color: ${colors.gray[500]};
            }

            ${primaryButtonStyles()}

            .enable-button {
                padding: ${spacing.md} ${spacing.xl};
                font-size: 1.125rem;
                display: inline-flex;
                align-items: center;
                gap: ${spacing.sm};
            }

            .enable-button:focus {
                outline: 2px solid ${colors.blue[400]};
                outline-offset: 2px;
            }

            .button-icon {
                font-size: 1.25rem;
            }

            @keyframes modal-appear {
                from {
                    opacity: 0;
                    transform: scale(0.95);
                }
                to {
                    opacity: 1;
                    transform: scale(1);
                }
            }

            dialog[open] .modal-content {
                animation: modal-appear 0.2s ease-out;
            }
        `;
    }

    protected override render(): void {
        this.shadowRoot!.innerHTML = `
            ${this.styleTag(this.getStyles())}

            <dialog
                id="audio-dialog"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="modal-title"
                aria-describedby="modal-description"
            >
                <div class="modal-content">
                    <div class="icon" aria-hidden="true">&#x1F50A;</div>
                    <h2 id="modal-title">Enable Audio</h2>
                    <p id="modal-description">
                        Click the button below to enable audio playback for this session.
                        This is required by your browser's autoplay policy.
                    </p>
                    <button
                        id="enable-button"
                        class="primary enable-button"
                        type="button"
                        autofocus
                        aria-label="Enable audio playback"
                    >
                        <span class="button-icon" aria-hidden="true">&#x25B6;</span>
                        Enable Audio
                    </button>
                </div>
            </dialog>
        `;

        this.dialog = this.shadowRoot!.getElementById(
            "audio-dialog"
        ) as HTMLDialogElement;
    }
}
