import { calculateScaledDimensions } from "@utils/canvas-renderer";
import type { AspectRatioMode } from "@types";
import { colors, alpha } from "@styles/theme";

export interface ShadowConfig {
    aspectRatio: AspectRatioMode;
    imageWidth: number;
    imageHeight: number;
    displayWidth: number;
    displayHeight: number;
    previewScale: number;
    userScale: number;
}

/**
 * Shadow preview rectangle shown on the canvas during drag.
 *
 * Displays a dashed-border rectangle representing the image's
 * actual display-space footprint at the current preview scale.
 * Positioned centered on the cursor to match the ghost element.
 */
export class DragShadow {
    private element: HTMLElement | null = null;

    /**
     * Create shadow element with dimensions based on the image's
     * display-space size at the current aspect ratio and scale.
     */
    create(config: ShadowConfig): void {
        const { width, height } = this.computeDimensions(config);

        this.element = document.createElement("div");
        this.element.style.cssText = `
            position: fixed;
            width: ${width}px;
            height: ${height}px;
            border: 2px dashed ${alpha(colors.blue[500], 0.6)};
            background: ${alpha(colors.blue[500], 0.1)};
            pointer-events: none;
            z-index: 9998;
            display: none;
        `;

        document.body.appendChild(this.element);
    }

    /**
     * Position shadow centered on cursor coordinates.
     */
    position(x: number, y: number): void {
        if (!this.element) {
            return;
        }

        const shadowWidth = this.element.offsetWidth;
        const shadowHeight = this.element.offsetHeight;

        this.element.style.display = "block";
        this.element.style.left = `${x - shadowWidth / 2}px`;
        this.element.style.top = `${y - shadowHeight / 2}px`;
    }

    /**
     * Recalculate shadow dimensions when scale or settings change.
     */
    updateSize(config: ShadowConfig): void {
        if (!this.element) {
            return;
        }

        const { width, height } = this.computeDimensions(config);

        this.element.style.width = `${width}px`;
        this.element.style.height = `${height}px`;
    }

    show(): void {
        if (this.element) {
            this.element.style.display = "block";
        }
    }

    hide(): void {
        if (this.element) {
            this.element.style.display = "none";
        }
    }

    /**
     * Remove shadow element from the DOM.
     */
    destroy(): void {
        if (this.element) {
            this.element.remove();
            this.element = null;
        }
    }

    get exists(): boolean {
        return this.element !== null;
    }

    private computeDimensions(config: ShadowConfig): { width: number; height: number } {
        const scaled = calculateScaledDimensions(
            config.aspectRatio,
            config.imageWidth,
            config.imageHeight,
            config.displayWidth,
            config.displayHeight,
        );

        return {
            width: scaled.width * config.userScale * config.previewScale,
            height: scaled.height * config.userScale * config.previewScale,
        };
    }
}
