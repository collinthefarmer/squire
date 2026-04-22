import { BaseComponent } from "@components/base/base-component";
import { cssSheet } from "@styles/adopt-styles";
import { onDomEvent } from "@utils/dom-events";
import type { SidebarTabs } from "./sidebar-tabs";
// @ts-expect-error — Bun imports CSS as text
import squireClientCss from "./squire-client.css" with { type: "text" };
// @ts-expect-error — Bun imports CSS as text
import commonCss from "@styles/common.css" with { type: "text" };

/**
 * Squire master client root component
 *
 * Lays out the canvas preview alongside a tabbed sidebar
 * with Image, Time, and Audio controls.
 */
export class SquireMasterClient extends BaseComponent {
    override connectedCallback(): void {
        super.connectedCallback();
        this.adoptStyles(cssSheet(commonCss), cssSheet(squireClientCss));

        this.render();
        this.initTabs();
    }
    protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.innerHTML = `
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
                        <div slot="settings" class="tab-panel">
                            <settings-panel></settings-panel>
                        </div>
                    </sidebar-tabs>
                </div>

                <div class="bottom-section">
                    <audio-timeline></audio-timeline>
                </div>
            </div>

            <div class="status-bar">
                <div class="status-indicator"></div>
                <span>Connected to server</span>
            </div>
        `;
    }

    private initTabs(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.cleanup.push(
            onDomEvent(this.shadowRoot, "tab-change", (e) => {
                const section = this.shadowRoot?.querySelector(
                    ".preview-section",
                ) as HTMLElement;
                if (section) {
                    section.style.gridTemplateColumns = e.detail.layout;
                }
            }),
        );

        const tabs = this.shadowRoot.querySelector(
            "sidebar-tabs",
        ) as SidebarTabs | null;

        tabs?.setTabs([
            { id: "image", label: "Image", layout: "minmax(0, 3fr) 1fr" },
            { id: "time", label: "Time", layout: "minmax(0, 3fr) 1fr" },
            { id: "audio", label: "Audio", layout: "minmax(0, 1fr) 2fr" },
            { id: "settings", label: "Settings", layout: "minmax(0, 3fr) 1fr" },
        ]);
    }
}
