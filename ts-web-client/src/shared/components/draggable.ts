import { calculateScaledDimensions } from "@utils/canvas-renderer";
import { ServiceRegistry } from "@services/service-registry";
import type { ImageToolbarService } from "@master/services/image-toolbar-service";

/**
 * Draggable wrapper component
 *
 * Wraps any element to make it draggable. Creates a ghost element that follows
 * the cursor/touch while dragging, leaving the original in place.
 *
 * @fires drag-start - When drag begins { detail: { data: string, element: HTMLElement } }
 * @fires drag-move - During drag { detail: { x: number, y: number, data: string } }
 * @fires drag-end - When drag ends { detail: { data: string, x: number, y: number } }
 *
 * @attr data-drag-data - Data to include in drag events (e.g., asset filename)
 * @attr data-image-width - Image width for shadow calculation
 * @attr data-image-height - Image height for shadow calculation
 *
 * @example
 * ```html
 * <squire-draggable data-drag-data="image.png" data-image-width="1920" data-image-height="1080">
 *     <image-handle></image-handle>
 * </squire-draggable>
 * ```
 */
export class Draggable extends HTMLElement {
    private isDragging = false;
    private ghost: HTMLElement | null = null;
    private shadowElement: HTMLElement | null = null;
    private imageMetadata: { width: number; height: number } | null = null;
    private currentX = 0;
    private currentY = 0;

    private readonly DISPLAY_WIDTH = 1920;
    private readonly DISPLAY_HEIGHT = 1080;

    connectedCallback(): void {
        this.style.display = "contents";
        this.setupEventListeners();
    }

    disconnectedCallback(): void {
        this.cleanup();
    }

    private setupEventListeners(): void {
        this.addEventListener("mousedown", this.handleMouseDown);
        this.addEventListener("touchstart", this.handleTouchStart, { passive: false });
    }

    private handleMouseDown = (e: MouseEvent): void => {
        if (e.button !== 0) {
            return;
        }

        e.preventDefault();
        this.startDrag(e.clientX, e.clientY);

        document.addEventListener("mousemove", this.handleMouseMove);
        document.addEventListener("mouseup", this.handleMouseUp);
    };

    private handleTouchStart = (e: TouchEvent): void => {
        if (e.touches.length !== 1) {
            return;
        }

        const touch = e.touches[0];
        if (!touch) {
            return;
        }

        e.preventDefault();
        this.startDrag(touch.clientX, touch.clientY);

        document.addEventListener("touchmove", this.handleTouchMove, { passive: false });
        document.addEventListener("touchend", this.handleTouchEnd);
        document.addEventListener("touchcancel", this.handleTouchEnd);
    };

    private startDrag(x: number, y: number): void {
        this.isDragging = true;
        this.currentX = x;
        this.currentY = y;

        // Read image metadata from data attributes
        const width = this.getAttribute("data-image-width");
        const height = this.getAttribute("data-image-height");
        if (width && height) {
            this.imageMetadata = {
                width: parseInt(width, 10),
                height: parseInt(height, 10),
            };
        }

        this.createGhost();
        this.createDisplayShadow();
        this.positionGhost(x, y);

        document.body.style.userSelect = "none";
        document.body.style.cursor = "grabbing";

        this.dispatchEvent(
            new CustomEvent("drag-start", {
                detail: {
                    data: this.dataset.dragData,
                    element: this,
                    x,
                    y,
                },
                bubbles: true,
                composed: true,
            }),
        );
    }

    private createGhost(): void {
        const slotted = this.querySelector("*");
        if (!slotted) {
            return;
        }

        // For elements with Shadow DOM (like image-handle), extract the visible content
        const shadowImg = slotted.shadowRoot?.querySelector("img");
        const rect = shadowImg
            ? shadowImg.getBoundingClientRect()
            : slotted.getBoundingClientRect();

        if (shadowImg) {
            this.ghost = document.createElement("img");
            (this.ghost as HTMLImageElement).src = shadowImg.src;
            (this.ghost as HTMLImageElement).alt = shadowImg.alt;
        } else {
            this.ghost = slotted.cloneNode(true) as HTMLElement;
        }

        this.ghost.style.cssText = `
            position: fixed;
            width: ${rect.width}px;
            height: ${rect.height}px;
            pointer-events: none;
            z-index: 9999;
            opacity: 0.85;
            transform: scale(1.05);
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
            border-radius: 4px;
            transition: transform 0.1s ease-out;
        `;

        document.body.appendChild(this.ghost);
    }

    private createDisplayShadow(): void {
        if (!this.imageMetadata) {
            return;
        }

        const toolbarService = this.getToolbarService();
        if (!toolbarService) {
            return;
        }

        const settings = toolbarService.getSettings();
        const { width, height } = calculateScaledDimensions(
            settings.aspectRatio,
            this.imageMetadata.width,
            this.imageMetadata.height,
            this.DISPLAY_WIDTH,
            this.DISPLAY_HEIGHT
        );

        const previewScale = this.getPreviewScale();

        this.shadowElement = document.createElement("div");
        this.shadowElement.style.cssText = `
            position: fixed;
            width: ${width * previewScale}px;
            height: ${height * previewScale}px;
            border: 2px dashed rgba(59, 130, 246, 0.6);
            background: rgba(59, 130, 246, 0.1);
            pointer-events: none;
            z-index: 9998;
            display: none;
            transform: translate(-50%, -50%);
        `;

        document.body.appendChild(this.shadowElement);
    }

    private getToolbarService(): ImageToolbarService | null {
        try {
            return ServiceRegistry.get<ImageToolbarService>("ImageToolbarService");
        } catch {
            return null;
        }
    }

    private getCanvasWrapper(): HTMLElement | null {
        // canvas-preview is inside squire-master-client's shadow DOM
        const masterClient = document.querySelector("squire-master-client");
        if (!masterClient?.shadowRoot) {
            return null;
        }

        const canvasPreview = masterClient.shadowRoot.querySelector("canvas-preview");
        if (!canvasPreview?.shadowRoot) {
            return null;
        }

        return canvasPreview.shadowRoot.querySelector(".iframe-wrapper") as HTMLElement;
    }

    private getPreviewScale(): number {
        const wrapper = this.getCanvasWrapper();
        if (!wrapper) {
            return 0.5;
        }
        return wrapper.clientWidth / this.DISPLAY_WIDTH;
    }

    private isOverCanvas(x: number, y: number): boolean {
        const wrapper = this.getCanvasWrapper();
        if (!wrapper) {
            return false;
        }

        const rect = wrapper.getBoundingClientRect();
        return x >= rect.left && x <= rect.right &&
               y >= rect.top && y <= rect.bottom;
    }

    private positionGhost(x: number, y: number): void {
        if (!this.ghost) {
            return;
        }

        const width = this.ghost.offsetWidth;
        const height = this.ghost.offsetHeight;

        this.ghost.style.left = `${x - width / 2}px`;
        this.ghost.style.top = `${y - height / 2}px`;

        // Position shadow at same location when over canvas
        if (this.shadowElement) {
            if (this.isOverCanvas(x, y)) {
                this.shadowElement.style.display = "block";
                this.shadowElement.style.left = `${x}px`;
                this.shadowElement.style.top = `${y}px`;
            } else {
                this.shadowElement.style.display = "none";
            }
        }
    }

    private handleMouseMove = (e: MouseEvent): void => {
        if (!this.isDragging) {
            return;
        }

        e.preventDefault();
        this.moveDrag(e.clientX, e.clientY);
    };

    private handleTouchMove = (e: TouchEvent): void => {
        if (!this.isDragging || e.touches.length !== 1) {
            return;
        }

        const touch = e.touches[0];
        if (!touch) {
            return;
        }

        e.preventDefault();
        this.moveDrag(touch.clientX, touch.clientY);
    };

    private moveDrag(x: number, y: number): void {
        this.currentX = x;
        this.currentY = y;
        this.positionGhost(x, y);

        this.dispatchEvent(
            new CustomEvent("drag-move", {
                detail: {
                    data: this.dataset.dragData,
                    x,
                    y,
                },
                bubbles: true,
                composed: true,
            }),
        );
    }

    private handleMouseUp = (e: MouseEvent): void => {
        this.endDrag(e.clientX, e.clientY);

        document.removeEventListener("mousemove", this.handleMouseMove);
        document.removeEventListener("mouseup", this.handleMouseUp);
    };

    private handleTouchEnd = (e: TouchEvent): void => {
        const x = this.currentX;
        const y = this.currentY;

        this.endDrag(x, y);

        document.removeEventListener("touchmove", this.handleTouchMove);
        document.removeEventListener("touchend", this.handleTouchEnd);
        document.removeEventListener("touchcancel", this.handleTouchEnd);
    };

    private endDrag(x: number, y: number): void {
        if (!this.isDragging) {
            return;
        }

        this.isDragging = false;

        document.body.style.userSelect = "";
        document.body.style.cursor = "";

        if (this.ghost) {
            this.ghost.remove();
            this.ghost = null;
        }

        if (this.shadowElement) {
            this.shadowElement.remove();
            this.shadowElement = null;
        }

        this.imageMetadata = null;

        this.dispatchEvent(
            new CustomEvent("drag-end", {
                detail: {
                    data: this.dataset.dragData,
                    x,
                    y,
                },
                bubbles: true,
                composed: true,
            }),
        );
    }

    private cleanup(): void {
        if (this.isDragging) {
            this.endDrag(this.currentX, this.currentY);
        }

        document.removeEventListener("mousemove", this.handleMouseMove);
        document.removeEventListener("mouseup", this.handleMouseUp);
        document.removeEventListener("touchmove", this.handleTouchMove);
        document.removeEventListener("touchend", this.handleTouchEnd);
        document.removeEventListener("touchcancel", this.handleTouchEnd);
    }
}
