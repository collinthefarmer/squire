import { DRAG } from "@shared/constants/drag";
import { emitDomEvent, type DragStartDetail } from "@utils/dom-events";
import { ScaleGesture } from "./scale-gesture";

/**
 * Base draggable wrapper component
 *
 * Wraps any element to make it draggable. Provides core drag mechanics:
 * pending/threshold click detection, mouse + touch handling, wheel/pinch
 * scale gesture, and consistent event emission. Does not create visual
 * overlays (ghost, shadow) — subclasses add those via lifecycle hooks.
 *
 * @fires drag-start - When drag begins { detail: { data, element, x, y, ...extraDetail } }
 * @fires drag-move - During drag { detail: { data, x, y } }
 * @fires drag-end - When drag ends { detail: { data, x, y } }
 * @fires drag-click - When a click is detected (no drag movement) { detail: { data, x, y, ...extraDetail } }
 * @fires drag-scale - When scale changes during drag { detail: { data, scale } }
 *
 * @attr data-drag-data - Data to include in drag events
 * @attr data-drag-source - Optional source tag included in all events for filtering
 *
 * @example
 * ```html
 * <squire-draggable data-drag-data="item-id">
 *     <div>Drag me</div>
 * </squire-draggable>
 * ```
 */
export class Draggable extends HTMLElement {
    private isDragging = false;
    private dragPhase: "idle" | "pending" | "dragging" = "idle";
    private startX = 0;
    private startY = 0;

    protected currentX = 0;
    protected currentY = 0;

    protected scaleGesture = new ScaleGesture(
        { min: DRAG.SCALE_MIN, max: DRAG.SCALE_MAX, wheelFactor: DRAG.WHEEL_FACTOR },
        (scale) => this.handleScaleChange(scale),
    );

    connectedCallback(): void {
        this.style.display = "contents";
        this.addEventListener("mousedown", this.handleMouseDown);
        this.addEventListener("touchstart", this.handleTouchStart, {
            passive: false,
        });
    }

    disconnectedCallback(): void {
        this.cleanup();
    }

    // -- Lifecycle hooks for subclasses --

    /** Called when drag begins. Override to create visual elements. */
    protected onDragStart(_x: number, _y: number): void {}

    /** Called on each drag movement. Override to update visual elements. */
    protected onDragMove(_x: number, _y: number): void {}

    /** Called when drag ends. Override to destroy visual elements. */
    protected onDragEnd(_x: number, _y: number): void {}

    /** Called when scale changes during drag. Override to update visual elements. */
    protected onScaleChange(_scale: number): void {}

    /** Returns extra fields merged into drag-start and drag-click event details. */
    protected getExtraDetail(): Partial<DragStartDetail> {
        return {};
    }

    // -- Mouse handlers --

    private handleMouseDown = (e: MouseEvent): void => {
        if (e.button !== 0) {
            return;
        }

        e.preventDefault();
        this.enterPending(e.clientX, e.clientY);

        document.addEventListener("mousemove", this.handleMouseMove);
        document.addEventListener("mouseup", this.handleMouseUp);
    };

    private handleMouseMove = (e: MouseEvent): void => {
        e.preventDefault();

        if (this.dragPhase === "pending") {
            this.checkThreshold(e.clientX, e.clientY);
            return;
        }

        if (!this.isDragging) {
            return;
        }

        this.moveDrag(e.clientX, e.clientY);
    };

    private handleMouseUp = (e: MouseEvent): void => {
        if (this.dragPhase === "pending") {
            this.emitClick();
            this.dragPhase = "idle";
            document.removeEventListener("mousemove", this.handleMouseMove);
            document.removeEventListener("mouseup", this.handleMouseUp);
            return;
        }

        this.endDrag(e.clientX, e.clientY);

        document.removeEventListener("mousemove", this.handleMouseMove);
        document.removeEventListener("mouseup", this.handleMouseUp);
    };

    // -- Touch handlers --

    private handleTouchStart = (e: TouchEvent): void => {
        if (e.touches.length === 2 && this.isDragging) {
            e.preventDefault();
            this.scaleGesture.handlePinchStart(e.touches);
            return;
        }

        if (e.touches.length !== 1) {
            return;
        }

        const touch = e.touches[0];
        if (!touch) {
            return;
        }

        e.preventDefault();
        this.enterPending(touch.clientX, touch.clientY);

        document.addEventListener("touchmove", this.handleTouchMove, {
            passive: false,
        });
        document.addEventListener("touchend", this.handleTouchEnd);
        document.addEventListener("touchcancel", this.handleTouchEnd);
    };

    private handleTouchMove = (e: TouchEvent): void => {
        if (e.touches.length === 2 && this.isDragging) {
            e.preventDefault();
            this.scaleGesture.handlePinchMove(e.touches);
            return;
        }

        if (e.touches.length === 1 && this.isDragging) {
            this.scaleGesture.resetPinch();
        }

        if (e.touches.length !== 1) {
            return;
        }

        const touch = e.touches[0];
        if (!touch) {
            return;
        }

        e.preventDefault();

        if (this.dragPhase === "pending") {
            this.checkThreshold(touch.clientX, touch.clientY);
            return;
        }

        if (!this.isDragging) {
            return;
        }

        this.moveDrag(touch.clientX, touch.clientY);
    };

    private handleTouchEnd = (): void => {
        if (this.dragPhase === "pending") {
            this.emitClick();
            this.dragPhase = "idle";
            document.removeEventListener("touchmove", this.handleTouchMove);
            document.removeEventListener("touchend", this.handleTouchEnd);
            document.removeEventListener("touchcancel", this.handleTouchEnd);
            return;
        }

        this.endDrag(this.currentX, this.currentY);

        document.removeEventListener("touchmove", this.handleTouchMove);
        document.removeEventListener("touchend", this.handleTouchEnd);
        document.removeEventListener("touchcancel", this.handleTouchEnd);
    };

    // -- Drag lifecycle --

    private enterPending(x: number, y: number): void {
        this.dragPhase = "pending";
        this.startX = x;
        this.startY = y;
    }

    private checkThreshold(x: number, y: number): void {
        const dx = x - this.startX;
        const dy = y - this.startY;

        if (Math.sqrt(dx * dx + dy * dy) < DRAG.CLICK_THRESHOLD) {
            return;
        }

        this.dragPhase = "dragging";
        this.startDrag(this.startX, this.startY);
        this.moveDrag(x, y);
    }

    private dragData(): string {
        return this.dataset.dragData ?? "";
    }

    private emitClick(): void {
        emitDomEvent(this, "drag-click", {
            data: this.dragData(),
            source: this.dataset.dragSource,
            x: this.startX,
            y: this.startY,
            ...this.getExtraDetail(),
        });
    }

    private startDrag(x: number, y: number): void {
        this.isDragging = true;
        this.currentX = x;
        this.currentY = y;

        this.scaleGesture.reset();
        this.onDragStart(x, y);

        document.body.style.userSelect = "none";
        document.body.style.cursor = "grabbing";

        this.scaleGesture.attach();

        emitDomEvent(this, "drag-start", {
            data: this.dragData(),
            source: this.dataset.dragSource,
            element: this,
            x,
            y,
            ...this.getExtraDetail(),
        });
    }

    private moveDrag(x: number, y: number): void {
        this.currentX = x;
        this.currentY = y;

        this.onDragMove(x, y);

        emitDomEvent(this, "drag-move", {
            data: this.dragData(),
            source: this.dataset.dragSource,
            x,
            y,
        });
    }

    private endDrag(x: number, y: number): void {
        if (!this.isDragging) {
            return;
        }

        this.isDragging = false;
        this.dragPhase = "idle";
        this.scaleGesture.detach();

        emitDomEvent(this, "drag-end", {
            data: this.dragData(),
            source: this.dataset.dragSource,
            x,
            y,
        });

        document.body.style.userSelect = "";
        document.body.style.cursor = "";

        this.onDragEnd(x, y);
    }

    // -- Scale change callback --

    private handleScaleChange(scale: number): void {
        this.onScaleChange(scale);

        emitDomEvent(this, "drag-scale", {
            data: this.dragData(),
            source: this.dataset.dragSource,
            scale,
        });
    }

    private cleanup(): void {
        if (this.isDragging) {
            this.endDrag(this.currentX, this.currentY);
        }
        this.dragPhase = "idle";

        document.removeEventListener("mousemove", this.handleMouseMove);
        document.removeEventListener("mouseup", this.handleMouseUp);
        document.removeEventListener("touchmove", this.handleTouchMove);
        document.removeEventListener("touchend", this.handleTouchEnd);
        document.removeEventListener("touchcancel", this.handleTouchEnd);
    }
}
