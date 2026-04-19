import { BaseComponent } from "@components/base/base-component";
import type { SidebarTabs } from "./sidebar-tabs";
import { colors, spacing, borderRadius, fontSize, sizing } from "@styles/theme";

/**
 * Squire master client root component
 *
 * Lays out the canvas preview alongside a tabbed sidebar
 * with Image, Time, and Audio controls.
 */
export class SquireMasterClient extends BaseComponent {
    override connectedCallback(): void {
        super.connectedCallback();
        this.render();
        this.initTabs();
    }

    protected override getStyles(): string {
        return `
            :host {
                display: block;
                min-height: 100vh;
                background: ${colors.slate[900]};
            }

            .master-client {
                max-width: ${sizing.maxWidth};
                margin: 0 auto;
                padding: ${spacing["2xl"]};
            }

            .header {
                margin-bottom: ${spacing["2xl"]};
            }

            .title {
                font-size: ${fontSize["3xl"]};
                font-weight: 700;
                color: ${colors.gray[50]};
                margin-bottom: ${spacing.sm};
            }

            .subtitle {
                font-size: ${fontSize.md};
                color: ${colors.gray[500]};
            }

            .preview-section {
                display: grid;
                grid-template-columns: minmax(0, 1fr) ${sizing.sidebarWidth};
                gap: ${spacing.xl};
                margin-bottom: ${spacing.xl};
            }

            .preview-main {
                min-width: 0;
            }

            .bottom-section {
                display: block;
            }

            .tab-panel {
                display: flex;
                flex-direction: column;
                gap: ${spacing.md};
                flex: 1;
                min-height: 0;
            }

            @media (max-width: 1200px) {
                .preview-section {
                    grid-template-columns: 1fr;
                }
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
                font-size: ${fontSize.base};
                color: ${colors.gray[200]};
            }

            .status-indicator {
                width: ${sizing.statusDot};
                height: ${sizing.statusDot};
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
                    <sidebar-tabs>
                        <div slot="image" class="tab-panel">
                            <image-toolbar></image-toolbar>
                            <image-gallery></image-gallery>
                        </div>
                        <div slot="time" class="tab-panel">
                            <clock-controls></clock-controls>
                            <time-scale-controls></time-scale-controls>
                        </div>
                        <div slot="audio" class="tab-panel">
                            <audio-controls></audio-controls>
                        </div>
                    </sidebar-tabs>
                </div>

                <div class="bottom-section">
                    <slot name="bottom"></slot>
                </div>
            </div>

            <div class="status-bar">
                <div class="status-indicator"></div>
                <span>Connected to server</span>
            </div>
        `;
    }

    private initTabs(): void {
        const tabs = this.shadowRoot?.querySelector("sidebar-tabs") as SidebarTabs | null;

        tabs?.setTabs([
            { id: "image", label: "Image" },
            { id: "time", label: "Time" },
            { id: "audio", label: "Audio" },
        ]);
    }
}
