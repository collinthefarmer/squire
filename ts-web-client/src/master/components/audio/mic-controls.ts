import { EMPTY, Observable, animationFrameScheduler, interval } from "rxjs";
import { switchMap } from "rxjs/operators";
import { BaseComponent } from "@components/base/base-component";
import { emitDomEvent } from "@utils/dom-events";
import { ServiceRegistry } from "@services/service-registry";
import type { MicCaptureService } from "@master/services/mic-capture-service";
import {
    labelStyles,
    selectStyles,
    rangeInputStyles,
    checkboxStyles,
    flexColumn,
    sliderRowStyles,
    valueDisplayStyles,
} from "@styles/common-styles";
import { spacing, colors, fontSize, sizing } from "@styles/theme";

/**
 * Microphone controls for live audio
 *
 * Provides device selection, input gain slider, level meter,
 * and monitoring toggle.
 *
 * @fires mic-device-change - When mic device selection changes
 * @fires gain-change - When input gain changes
 * @fires monitor-change - When monitoring is toggled
 */
export class MicControls extends BaseComponent {
    private micService!: MicCaptureService;

    override connectedCallback(): void {
        super.connectedCallback();

        this.micService = ServiceRegistry.get<MicCaptureService>("MicCaptureService");

        this.render();
        this.populateDevices();
        this.setupEventListeners();
        this.setupSubscriptions();
    }


    protected override getStyles(): string {
        return `
            :host {
                display: block;
            }

            .mic-controls {
                ${flexColumn(spacing.lg)}
            }

            ${labelStyles()}
            ${selectStyles()}
            ${rangeInputStyles()}
            ${checkboxStyles()}
            ${sliderRowStyles()}
            ${valueDisplayStyles()}

            .form-group {
                ${flexColumn(spacing.sm)}
            }

            label {
                font-size: ${fontSize.base};
            }

            select {
                font-size: ${fontSize.base};
                cursor: pointer;
            }

            input[type="range"] {
                outline: none;
            }

            .monitor-row {
                display: flex;
                align-items: center;
                gap: ${spacing.sm};
            }

            input[type="checkbox"] {
                width: ${sizing.checkboxSm};
                height: ${sizing.checkboxSm};
            }

            .meter-container {
                height: 6px;
                background: ${colors.gray[700]};
                border-radius: 3px;
                overflow: hidden;
            }

            .meter-fill {
                height: 100%;
                width: 0%;
                background: ${colors.green[500]};
                border-radius: 3px;
                transition: width 50ms linear;
            }

            .meter-fill.hot {
                background: ${colors.red[500]};
            }
        `;
    }

    protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.innerHTML = `
            ${this.styleTag(this.getStyles())}

            <div class="mic-controls">
                <div class="form-group">
                    <label for="mic-device">Microphone</label>
                    <select id="mic-device">
                        <option value="">Select device...</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>Input Level</label>
                    <div class="meter-container">
                        <div class="meter-fill" id="meter-fill"></div>
                    </div>
                </div>

                <div class="form-group">
                    <label>Gain</label>
                    <div class="slider-row">
                        <input type="range" id="gain" min="0" max="2" step="0.01" value="1">
                        <span class="value-display" id="gain-value">100%</span>
                    </div>
                </div>

                <div class="monitor-row">
                    <input type="checkbox" id="monitor">
                    <label for="monitor">Monitor (hear yourself)</label>
                </div>
            </div>
        `;
    }

    private async populateDevices(): Promise<void> {
        const select = this.shadowRoot?.querySelector("#mic-device") as HTMLSelectElement;
        if (!select) {
            return;
        }

        const devices = await this.micService.getInputDevices();

        for (const device of devices) {
            const option = document.createElement("option");
            option.value = device.deviceId;
            option.textContent = device.label || `Microphone ${select.options.length}`;
            select.appendChild(option);
        }
    }

    private setupEventListeners(): void {
        if (!this.shadowRoot) {
            return;
        }

        const select = this.shadowRoot.querySelector("#mic-device") as HTMLSelectElement;
        const gainSlider = this.shadowRoot.querySelector("#gain") as HTMLInputElement;
        const gainValue = this.shadowRoot.querySelector("#gain-value") as HTMLSpanElement;
        const monitorCheckbox = this.shadowRoot.querySelector("#monitor") as HTMLInputElement;

        if (!select || !gainSlider || !gainValue || !monitorCheckbox) {
            return;
        }

        select.addEventListener("change", () => {
            emitDomEvent(this, "mic-device-change", { deviceId: select.value });
        });

        gainSlider.addEventListener("input", () => {
            const gain = parseFloat(gainSlider.value);
            gainValue.textContent = `${Math.round(gain * 100)}%`;
            emitDomEvent(this, "gain-change", { gain });
        });

        monitorCheckbox.addEventListener("change", () => {
            emitDomEvent(this, "monitor-change", { enabled: monitorCheckbox.checked });
        });
    }

    private setupSubscriptions(): void {
        if (!this.micService) {
            return;
        }

        this.subscribe(
            this.micService.getState$().pipe(
                switchMap((state) => {
                    if (state !== "capturing") {
                        return EMPTY;
                    }

                    return interval(0, animationFrameScheduler);
                }),
            ),
            () => this.updateMeter(),
        );
    }

    private updateMeter(): void {
        const analyser = this.micService.getAnalyserNode();
        const fill = this.shadowRoot?.querySelector("#meter-fill") as HTMLElement;

        if (!analyser || !fill) {
            return;
        }

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i] ?? 0;
        }
        const average = sum / dataArray.length;
        const percent = Math.min(100, (average / 128) * 100);

        fill.style.width = `${percent}%`;
        fill.classList.toggle("hot", percent > 85);
    }
}
