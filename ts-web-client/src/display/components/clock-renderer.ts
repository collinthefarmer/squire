import { BaseComponent } from "@components/base/base-component";
import { ServiceRegistry } from "@services/service-registry";
import type { DisplayClockService } from "@display/services/clock-service";
import type { ClockState } from "@services/clock-state";
import { CLOCK_DISPLAY, getRemainingTime, formatTime, getUrgency } from "@services/clock-state";
import { calculatePosition } from "@utils/canvas-renderer";
import { DISPLAY } from "@shared/constants/display";
import { colors, alpha, transitions } from "@styles/theme";

/**
 * Clock renderer component for display client
 *
 * Renders positioned countdown clock overlays on top of the visual canvas.
 * Each clock shows a digital time display with urgency-based color shifting.
 * Uses requestAnimationFrame for smooth countdown animation.
 */
export class ClockRenderer extends BaseComponent {
    private clockService!: DisplayClockService;
    private animationFrameId: number | null = null;
    private clocks: Map<string, ClockState> = new Map();

    override connectedCallback(): void {
        super.connectedCallback();

        this.clockService = ServiceRegistry.get<DisplayClockService>("ClockService");

        this.render();
        this.setupSubscriptions();
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.stopAnimationLoop();
    }

    protected override getStyles(): string {
        return `
            :host {
                display: block;
                position: fixed;
                inset: 0;
                pointer-events: none;
                z-index: 10;
            }

            .clock {
                position: absolute;
                font-family: 'Courier New', monospace;
                font-size: 2rem;
                font-weight: 700;
                text-align: center;
                padding: 0.5rem 1.5rem;
                border-radius: 0.5rem;
                background: ${alpha(colors.black, 0.6)};
                min-width: 120px;
                transition: ${transitions.normal};
            }
        `;
    }

    protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.innerHTML = `
            ${this.styleTag(this.getStyles())}
            <div class="clock-container"></div>
        `;
    }

    private setupSubscriptions(): void {
        this.subscribe(
            this.clockService.getClocks$(),
            (clocks) => {
                this.clocks = clocks;
                this.renderClocks();

                if (clocks.size > 0) {
                    this.startAnimationLoop();
                } else {
                    this.stopAnimationLoop();
                }
            },
        );
    }

    private renderClocks(): void {
        const container = this.shadowRoot?.querySelector(".clock-container");
        if (!container) {
            return;
        }

        container.innerHTML = "";

        for (const [id, clock] of this.clocks) {
            if (!clock.visible) {
                continue;
            }

            const el = document.createElement("div");
            el.className = "clock";
            el.dataset.clockId = id;

            this.positionClockElement(el, clock);
            this.updateClockDisplay(el, clock);

            container.appendChild(el);
        }
    }

    private positionClockElement(el: HTMLElement, clock: ClockState): void {
        const x = calculatePosition(
            clock.position.x,
            DISPLAY.WIDTH,
            CLOCK_DISPLAY.width,
        );
        const y = calculatePosition(
            clock.position.y,
            DISPLAY.HEIGHT,
            CLOCK_DISPLAY.height,
        );

        // Convert display-space to viewport percentage for responsive positioning
        const leftPercent = (x / DISPLAY.WIDTH) * 100;
        const topPercent = (y / DISPLAY.HEIGHT) * 100;

        el.style.left = `${leftPercent}%`;
        el.style.top = `${topPercent}%`;
    }

    private updateClockDisplay(el: HTMLElement, clock: ClockState): void {
        const remaining = getRemainingTime(clock);
        const urgency = getUrgency(clock);

        el.textContent = formatTime(remaining);
        el.style.color = this.urgencyColor(urgency);
    }

    /**
     * Interpolate color based on urgency (0 = calm, 1 = critical)
     *
     * 0.0–0.5: white
     * 0.5–0.75: white → yellow/orange
     * 0.75–0.9: orange → red
     * 0.9–1.0: intense red
     */
    private urgencyColor(urgency: number): string {
        if (urgency < 0.5) {
            return colors.white;
        }
        if (urgency < 0.75) {
            return colors.amber[400];
        }
        if (urgency < 0.9) {
            return "#ef4444"; // red-500
        }
        return "#dc2626"; // red-600
    }

    // -- Animation loop --

    private startAnimationLoop(): void {
        if (this.animationFrameId !== null) {
            return;
        }

        const tick = (): void => {
            this.updateAllClocks();
            this.animationFrameId = requestAnimationFrame(tick);
        };

        this.animationFrameId = requestAnimationFrame(tick);
    }

    private stopAnimationLoop(): void {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    private updateAllClocks(): void {
        const container = this.shadowRoot?.querySelector(".clock-container");
        if (!container) {
            return;
        }

        for (const [id, clock] of this.clocks) {
            const el = container.querySelector(`[data-clock-id="${id}"]`) as HTMLElement | null;
            if (!el) {
                continue;
            }

            this.positionClockElement(el, clock);
            this.updateClockDisplay(el, clock);
        }
    }
}
