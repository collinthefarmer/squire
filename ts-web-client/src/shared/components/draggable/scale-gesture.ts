import { Subject } from "rxjs";
import { Logger } from "@utils/logger";

const logger = new Logger("ScaleGesture");

export interface ScaleConfig {
    min: number;
    max: number;
    wheelFactor: number;
}

/**
 * Handles wheel and pinch-to-zoom gestures during drag.
 *
 * Self-contained: manages its own document-level listeners for
 * both wheel and two-finger pinch. Emits scale changes via the
 * scale$ Subject. Uses attach/detach to scope listener lifetime
 * to the active drag.
 */
export class ScaleGesture {
    readonly scale$ = new Subject<number>();

    private scale = 1.0;
    private initialPinchDistance: number | null = null;
    private pinchStartScale = 1.0;

    constructor(private config: ScaleConfig) {}

    attach(): void {
        document.addEventListener("wheel", this.handleWheel, {
            passive: false,
        });
        document.addEventListener("touchmove", this.handleTouchMove, {
            passive: false,
        });
    }

    detach(): void {
        document.removeEventListener("wheel", this.handleWheel);
        document.removeEventListener("touchmove", this.handleTouchMove);
        this.initialPinchDistance = null;
    }

    reset(): void {
        this.scale = 1.0;
        this.initialPinchDistance = null;
        this.pinchStartScale = 1.0;
    }

    getScale(): number {
        return this.scale;
    }

    private handleWheel = (e: WheelEvent): void => {
        e.preventDefault();

        const delta =
            e.deltaY > 0 ? -this.config.wheelFactor : this.config.wheelFactor;
        const newScale = this.clamp(this.scale + delta);

        if (newScale === this.scale) {
            return;
        }

        logger.debug("wheel", {
            direction: e.deltaY > 0 ? "down" : "up",
            oldScale: this.scale,
            newScale,
        });

        this.scale = newScale;
        this.scale$.next(this.scale);
    };

    private handleTouchMove = (e: TouchEvent): void => {
        if (e.touches.length !== 2) {
            this.initialPinchDistance = null;
            return;
        }

        e.preventDefault();

        const dist = this.getPinchDistance(e.touches);

        if (this.initialPinchDistance === null) {
            this.initialPinchDistance = dist;
            this.pinchStartScale = this.scale;
            return;
        }

        const newScale = this.clamp(
            this.pinchStartScale * (dist / this.initialPinchDistance),
        );

        if (newScale === this.scale) {
            return;
        }

        this.scale = newScale;
        this.scale$.next(this.scale);
    };

    private clamp(value: number): number {
        return Math.max(this.config.min, Math.min(this.config.max, value));
    }

    private getPinchDistance(touches: TouchList): number {
        const a = touches[0];
        const b = touches[1];
        if (!a || !b) {
            return 0;
        }

        const dx = b.clientX - a.clientX;
        const dy = b.clientY - a.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }
}
