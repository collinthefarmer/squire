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
 * Manages scale state internally and notifies on changes via callback.
 * Uses an attach/detach pattern for the document-level wheel listener.
 */
export class ScaleGesture {
    private scale = 1.0;
    private initialPinchDistance: number | null = null;
    private pinchStartScale = 1.0;

    constructor(
        private config: ScaleConfig,
        private onScaleChange: (scale: number) => void,
    ) {}

    /**
     * Attach document-level wheel listener.
     * Call when drag starts.
     */
    attach(): void {
        document.addEventListener("wheel", this.handleWheel, {
            passive: false,
        });
    }

    /**
     * Detach document-level wheel listener.
     * Call when drag ends.
     */
    detach(): void {
        document.removeEventListener("wheel", this.handleWheel);
    }

    /**
     * Reset scale to 1.0 and clear pinch state.
     */
    reset(): void {
        this.scale = 1.0;
        this.initialPinchDistance = null;
        this.pinchStartScale = 1.0;
    }

    /**
     * Begin tracking a pinch gesture.
     * Call when a second touch is detected during drag.
     */
    handlePinchStart(touches: TouchList): void {
        this.initialPinchDistance = this.getPinchDistance(touches);
        this.pinchStartScale = this.scale;
    }

    /**
     * Process pinch movement.
     * Returns true if the gesture was handled (scale changed).
     */
    handlePinchMove(touches: TouchList): boolean {
        if (this.initialPinchDistance === null) {
            return false;
        }

        const currentDistance = this.getPinchDistance(touches);
        const scaleDelta = currentDistance / this.initialPinchDistance;
        const newScale = this.clamp(this.pinchStartScale * scaleDelta);

        if (newScale === this.scale) {
            return false;
        }

        this.scale = newScale;
        this.onScaleChange(this.scale);
        return true;
    }

    /**
     * Clear pinch tracking state.
     * Call when touch count drops back to one.
     */
    resetPinch(): void {
        this.initialPinchDistance = null;
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
        this.onScaleChange(this.scale);
    };

    private clamp(value: number): number {
        return Math.max(this.config.min, Math.min(this.config.max, value));
    }

    private getPinchDistance(touches: TouchList): number {
        const touch1 = touches[0];
        const touch2 = touches[1];
        if (!touch1 || !touch2) {
            return 0;
        }

        const dx = touch2.clientX - touch1.clientX;
        const dy = touch2.clientY - touch1.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }
}
