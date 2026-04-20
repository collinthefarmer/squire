import { interval, animationFrameScheduler, type Subscription } from "rxjs";
import { cssSheet } from "@styles/adopt-styles";
import { takeUntil } from "rxjs/operators";
import { BaseComponent } from "@components/base/base-component";
import { ServiceRegistry } from "@services/service-registry";
import type { DisplayClockService } from "@display/services/clock-service";
import type { ClockState } from "@services/clock-state";
import {
    CLOCK_DISPLAY,
    getRemainingTime,
    formatTime,
    getUrgency,
} from "@services/clock-state";
import { calculatePosition } from "@utils/canvas-renderer";
import { DISPLAY } from "@shared/constants/display";
import { colors } from "@styles/theme";

// @ts-expect-error — Bun imports CSS as text
import clockRendererCss from "./clock-renderer.css" with { type: "text" };
// @ts-expect-error — Bun imports CSS as text
import commonCss from "@styles/common.css" with { type: "text" };

/**
 * Clock renderer component for display client
 *
 * Renders positioned countdown clock overlays on top of the visual canvas.
 * Each clock shows a digital time display with urgency-based color shifting.
 * Uses requestAnimationFrame for smooth countdown animation.
 */
export class ClockRenderer extends BaseComponent {
    private clockService!: DisplayClockService;
    private animationSub: Subscription | null = null;
    private clocks: Map<string, ClockState> = new Map();

    override connectedCallback(): void {
        super.connectedCallback();

        this.clockService =
            ServiceRegistry.get<DisplayClockService>("ClockService");

        this.adoptStyles(cssSheet(commonCss), cssSheet(clockRendererCss));

        this.render();
        this.setupSubscriptions();
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.animationSub?.unsubscribe();
    }
protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.innerHTML = `
            <div class="clock-container"></div>
        `;
    }

    private setupSubscriptions(): void {
        this.subscribe(this.clockService.getClocks$(), (clocks) => {
            this.clocks = clocks;
            this.renderClocks();

            if (clocks.size > 0) {
                this.startAnimationLoop();
            } else {
                this.stopAnimationLoop();
            }
        });
    }

    private renderClocks(): void {
        const container = this.shadowRoot?.querySelector(".clock-container");
        if (!container) {
            return;
        }

        container.innerHTML = "";

        for (const [id, clock] of this.clocks) {
            if (
                !clock.visible ||
                clock.visibility === "hidden" ||
                clock.visibility === "dm-only"
            ) {
                continue;
            }

            if (clock.completed) {
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
     * Smooth urgency color via HSL interpolation.
     *
     * 0.0–0.5: white (no urgency)
     * 0.5–1.0: hue shifts from 60° (yellow) to 0° (red),
     * saturation and lightness ramp up for intensity.
     */
    private urgencyColor(urgency: number): string {
        if (urgency < 0.5) {
            return colors.white;
        }

        // Map 0.5–1.0 to 0–1 for interpolation
        const t = (urgency - 0.5) / 0.5;
        const hue = 60 * (1 - t); // 60° (yellow) → 0° (red)
        const saturation = 80 + t * 20; // 80% → 100%
        const lightness = 70 - t * 20; // 70% → 50%

        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    }

    // -- Animation loop --

    private startAnimationLoop(): void {
        if (this.animationSub) {
            return;
        }

        this.animationSub = interval(0, animationFrameScheduler)
            .pipe(takeUntil(this.destroy$))
            .subscribe(() => this.updateAllClocks());
    }

    private stopAnimationLoop(): void {
        this.animationSub?.unsubscribe();
        this.animationSub = null;
    }

    private updateAllClocks(): void {
        const container = this.shadowRoot?.querySelector(".clock-container");
        if (!container) {
            return;
        }

        for (const [id, clock] of this.clocks) {
            const el = container.querySelector(
                `[data-clock-id="${id}"]`,
            ) as HTMLElement | null;
            if (!el) {
                continue;
            }

            // Check for completion
            const remaining = getRemainingTime(clock);
            if (remaining <= 0 && clock.running && !clock.completed) {
                this.handleCompletion(id, clock, el);
                continue;
            }

            this.positionClockElement(el, clock);
            this.updateClockDisplay(el, clock);
        }
    }

    private handleCompletion(
        id: string,
        clock: ClockState,
        el: HTMLElement,
    ): void {
        switch (clock.onComplete) {
            case "persist":
                el.textContent = formatTime(0);
                el.style.color = this.urgencyColor(1);
                break;

            case "auto-hide":
                el.style.opacity = "0";
                el.style.transition = "opacity 1s ease";
                setTimeout(() => {
                    const updated = new Map(this.clocks);
                    const current = updated.get(id);
                    if (current) {
                        updated.set(id, { ...current, completed: true });
                        this.clocks = updated;
                    }
                }, 1000);
                break;

            case "auto-destroy": {
                const updated = new Map(this.clocks);
                updated.delete(id);
                this.clocks = updated;
                this.renderClocks();
                break;
            }
        }

        // Mark as completed to prevent re-triggering
        const updated = new Map(this.clocks);
        const current = updated.get(id);
        if (current && clock.onComplete === "persist") {
            updated.set(id, { ...current, completed: true });
            this.clocks = updated;
        }
    }
}
