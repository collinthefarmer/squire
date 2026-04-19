import { BaseComponent } from "@components/base/base-component";
import { ServiceRegistry } from "@services/service-registry";
import type { ConnectionService } from "@services/connection-service";
import type { TimeScaleService } from "@services/time-scale-service";
import { EventBuilder } from "@master/services/event-builder";
import {
    containerStyles,
    sectionHeaderStyles,
    segmentedButtonStyles,
} from "@styles/common-styles";
import { colors, spacing, fontSize } from "@styles/theme";

/**
 * Time-scale controls for master client
 *
 * Provides preset buttons for adjusting the global time scale
 * and displays the current scale value.
 *
 * @example
 * ```html
 * <time-scale-controls></time-scale-controls>
 * ```
 */
export class TimeScaleControls extends BaseComponent {
    private connectionService!: ConnectionService;
    private timeScaleService!: TimeScaleService;

    override connectedCallback(): void {
        super.connectedCallback();

        this.connectionService = ServiceRegistry.get<ConnectionService>("ConnectionService");
        this.timeScaleService = ServiceRegistry.get<TimeScaleService>("TimeScaleService");

        this.render();
        this.setupEventListeners();
        this.setupSubscriptions();
    }

    protected override getStyles(): string {
        return `
            :host {
                display: block;
            }

            ${containerStyles()}
            ${sectionHeaderStyles()}
            ${segmentedButtonStyles()}

            .section-header {
                margin-bottom: ${spacing.sm};
            }

            .scale-display {
                font-size: ${fontSize.sm};
                color: ${colors.gray[500]};
                text-align: center;
                margin-top: ${spacing.xs};
            }
        `;
    }

    protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.innerHTML = `
            ${this.styleTag(this.getStyles())}

            <div class="container">
                <div class="section-header">Time Scale</div>
                <div class="button-group" role="radiogroup" aria-label="Time scale">
                    <button type="button" class="option" data-scale="0">0x</button>
                    <button type="button" class="option" data-scale="0.5">0.5x</button>
                    <button type="button" class="option selected" data-scale="1">1x</button>
                    <button type="button" class="option" data-scale="2">2x</button>
                </div>
                <div class="scale-display">Current: 1.0x</div>
            </div>
        `;
    }

    private setupEventListeners(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.addEventListener("click", (e) => {
            const button = (e.target as HTMLElement).closest(".option") as HTMLElement | null;
            if (!button) {
                return;
            }

            const scale = parseFloat(button.dataset.scale ?? "1");
            this.connectionService.send(EventBuilder.timeScaleChanged({ scale }));
        });
    }

    private setupSubscriptions(): void {
        this.subscribe(
            this.timeScaleService.getScale$(),
            (scale) => {
                this.updateSelection(scale);
            },
        );
    }

    private updateSelection(scale: number): void {
        if (!this.shadowRoot) {
            return;
        }

        const buttons = this.shadowRoot.querySelectorAll(".option");
        for (const btn of Array.from(buttons)) {
            const btnScale = parseFloat((btn as HTMLElement).dataset.scale ?? "1");
            btn.classList.toggle("selected", btnScale === scale);
        }

        const display = this.shadowRoot.querySelector(".scale-display");
        if (display) {
            display.textContent = `Current: ${scale}x`;
        }
    }
}
