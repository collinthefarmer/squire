import { BaseComponent } from "@components/base/base-component";
import { cssSheet } from "@styles/adopt-styles";
import { onDomEvent } from "@utils/dom-events";
import { ServiceRegistry } from "@services/service-registry";
import type { MicCaptureService } from "@master/services/mic-capture-service";
import type { LocalStore } from "@services/local-store";

// @ts-expect-error — Bun imports CSS as text
import settingsPanelCss from "./settings-panel.css" with { type: "text" };
// @ts-expect-error — Bun imports CSS as text
import commonCss from "@styles/common.css" with { type: "text" };

/**
 * Settings panel for master client configuration.
 *
 * Houses device and input settings that don't belong in
 * domain-specific tabs. Currently: microphone input selection,
 * gain, and monitoring.
 */
export class SettingsPanel extends BaseComponent {
    private micCaptureService!: MicCaptureService;
    private localStore!: LocalStore;

    override connectedCallback(): void {
        super.connectedCallback();

        this.micCaptureService =
            ServiceRegistry.get<MicCaptureService>("MicCaptureService");
        this.localStore = ServiceRegistry.get<LocalStore>("LocalStore");

        this.adoptStyles(cssSheet(commonCss), cssSheet(settingsPanelCss));
        this.render();
        this.setupEventListeners();
    }

    protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.innerHTML = `
            <div class="settings-panel">
                <div class="section-header">Settings</div>

                <div class="settings-section">
                    <div class="section-title">Microphone</div>
                    <mic-controls></mic-controls>
                </div>

                <div class="divider"></div>

                <div class="settings-section">
                    <div class="section-title">Data</div>
                    <button class="danger clear-data-btn" id="clear-data" type="button">Clear All Local Data</button>
                </div>
            </div>
        `;
    }

    private setupEventListeners(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.cleanup.push(
            onDomEvent(this.shadowRoot, "gain-change", (e) => {
                this.micCaptureService.setInputGain(e.detail.gain);
            }),

            onDomEvent(this.shadowRoot, "monitor-change", (e) => {
                this.micCaptureService.setMonitoring(e.detail.enabled);
            }),
        );

        this.shadowRoot.querySelector("#clear-data")?.addEventListener("click", () => {
            this.handleClearData();
        });
    }

    private handleClearData(): void {
        const btn = this.shadowRoot?.querySelector("#clear-data") as HTMLButtonElement;
        if (!btn) {
            return;
        }

        if (btn.dataset.confirm !== "true") {
            btn.textContent = "Are you sure?";
            btn.dataset.confirm = "true";

            setTimeout(() => {
                btn.textContent = "Clear All Local Data";
                btn.dataset.confirm = "";
            }, 3000);
            return;
        }

        this.localStore.clear();
        btn.textContent = "Cleared";
        btn.disabled = true;

        setTimeout(() => {
            btn.textContent = "Clear All Local Data";
            btn.dataset.confirm = "";
            btn.disabled = false;
        }, 2000);
    }
}
