import type { AspectRatioMode } from "@types";
import type { DragStartDetail } from "@utils/dom-events";
import { DISPLAY } from "@shared/constants/display";
import { DRAG } from "@shared/constants/drag";
import { Draggable } from "./draggable";
import { DragGhost } from "./drag-ghost";
import { DragShadow } from "./drag-shadow";

/**
 * Image-specialized draggable with ghost and shadow overlays
 *
 * Extends the base Draggable with visual feedback for image placement:
 * a semi-transparent ghost clone follows the cursor, and a dashed
 * shadow rectangle previews the image's display-space footprint.
 *
 * @attr data-image-width - Image natural width for shadow calculation
 * @attr data-image-height - Image natural height for shadow calculation
 * @attr data-aspect-ratio - Aspect ratio mode ("cover" | "contain")
 *
 * @example
 * ```html
 * <squire-draggable data-drag-data="image.png"
 *     data-image-width="1920" data-image-height="1080" data-aspect-ratio="contain">
 *     <image-handle></image-handle>
 * </squire-draggable>
 * ```
 */
export class DraggableImage extends Draggable {
    private ghost = new DragGhost();
    private shadow = new DragShadow();
    private imageMetadata: { width: number; height: number } | null = null;

    protected override onDragStart(x: number, y: number): void {
        this.readImageMetadata();

        const slotted = this.querySelector("*");
        if (slotted) {
            this.ghost.create(slotted as HTMLElement);
        }
        this.createShadow();

        this.ghost.position(x, y);
        this.shadow.position(x, y);
    }

    protected override onDragMove(x: number, y: number): void {
        this.ghost.position(x, y);
        this.shadow.position(x, y);
    }

    protected override onDragEnd(_x: number, _y: number): void {
        this.ghost.destroy();
        this.shadow.destroy();
        this.imageMetadata = null;
    }

    protected override onScaleChange(scale: number): void {
        this.ghost.setScale(scale);
        this.updateShadowSize();
        this.shadow.position(this.currentX, this.currentY);
    }

    protected override getExtraDetail(): Partial<DragStartDetail> {
        this.readImageMetadata();

        return {
            imageWidth: this.imageMetadata?.width,
            imageHeight: this.imageMetadata?.height,
        };
    }

    // -- Image-specific helpers --

    private readImageMetadata(): void {
        const width = this.getAttribute("data-image-width");
        const height = this.getAttribute("data-image-height");

        if (width && height) {
            this.imageMetadata = {
                width: parseInt(width, 10),
                height: parseInt(height, 10),
            };
        } else {
            this.imageMetadata = null;
        }
    }

    private getAspectRatio(): AspectRatioMode {
        const value = this.getAttribute("data-aspect-ratio");
        if (value === "cover" || value === "contain") {
            return value;
        }
        return "contain";
    }

    private createShadow(): void {
        if (!this.imageMetadata) {
            return;
        }

        this.shadow.create({
            aspectRatio: this.getAspectRatio(),
            imageWidth: this.imageMetadata.width,
            imageHeight: this.imageMetadata.height,
            displayWidth: DISPLAY.WIDTH,
            displayHeight: DISPLAY.HEIGHT,
            previewScale: this.getPreviewScale(),
            userScale: this.scaleGesture.getScale(),
        });
    }

    private updateShadowSize(): void {
        if (!this.imageMetadata) {
            return;
        }

        this.shadow.updateSize({
            aspectRatio: this.getAspectRatio(),
            imageWidth: this.imageMetadata.width,
            imageHeight: this.imageMetadata.height,
            displayWidth: DISPLAY.WIDTH,
            displayHeight: DISPLAY.HEIGHT,
            previewScale: this.getPreviewScale(),
            userScale: this.scaleGesture.getScale(),
        });
    }

    private getPreviewScale(): number {
        const value = this.getAttribute("data-preview-scale");
        if (value) {
            const parsed = parseFloat(value);
            if (!isNaN(parsed) && parsed > 0) {
                return parsed;
            }
        }
        return DRAG.PREVIEW_SCALE_FALLBACK;
    }
}
