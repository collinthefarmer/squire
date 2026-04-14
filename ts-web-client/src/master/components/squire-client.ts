import { BaseComponent } from "@components/base/base-component";
import { colors, spacing, borderRadius } from "@styles/theme";

/**
 * Squire master client root component
 *
 * Container for audio and image control panels
 */
export class SquireMasterClient extends BaseComponent {
    override connectedCallback(): void {
        super.connectedCallback();
        this.render();
    }

    protected override getStyles(): string {
        return `
            :host {
                display: block;
                min-height: 100vh;
                background: ${colors.slate[900]};
            }

            .master-client {
                max-width: 1400px;
                margin: 0 auto;
                padding: ${spacing["2xl"]};
            }

            .header {
                margin-bottom: ${spacing["2xl"]};
            }

            .title {
                font-size: 2rem;
                font-weight: 700;
                color: ${colors.gray[50]};
                margin-bottom: ${spacing.sm};
            }

            .subtitle {
                font-size: 1rem;
                color: ${colors.gray[500]};
            }

            .preview-section {
                margin-bottom: ${spacing["2xl"]};
                display: grid;
                grid-template-columns: 1fr 280px;
                gap: ${spacing.xl};
            }

            .preview-main {
                flex: 1;
            }

            .preview-sidebar {
                display: flex;
                flex-direction: column;
                gap: ${spacing.md};
            }

            @media (max-width: 1200px) {
                .preview-section {
                    grid-template-columns: 1fr;
                }
            }

            .controls-container {
                display: block;
            }

            .status-bar {
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                padding: ${spacing.md} ${spacing.lg};
                background: ${colors.slate[800]};
                border-top: 1px solid ${colors.slate[700]};
                display: flex;
                align-items: center;
                gap: ${spacing.md};
                font-size: 0.875rem;
                color: ${colors.gray[200]};
            }

            .status-indicator {
                width: 0.5rem;
                height: 0.5rem;
                border-radius: ${borderRadius.full};
                background: ${colors.green[500]};
                animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
            }

            @keyframes pulse {
                0%, 100% {
                    opacity: 1;
                }
                50% {
                    opacity: 0.5;
                }
            }
        `;
    }

    protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.innerHTML = `
            ${this.styleTag(this.getStyles())}

            <div class="master-client">
                <div class="header">
                    <div class="title">Squire Master Client</div>
                    <div class="subtitle">DM Control Interface</div>
                </div>

                <div class="preview-section">
                    <div class="preview-main">
                        <canvas-preview></canvas-preview>
                    </div>
                    <div class="preview-sidebar">
                        <image-toolbar></image-toolbar>
                        <image-gallery></image-gallery>
                        <clock-controls></clock-controls>
                        <time-scale-controls></time-scale-controls>
                    </div>
                </div>

                <div class="controls-container">
                    <audio-controls></audio-controls>
                </div>
            </div>

            <div class="status-bar">
                <div class="status-indicator"></div>
                <span>Connected to server</span>
            </div>
        `;
    }
}
