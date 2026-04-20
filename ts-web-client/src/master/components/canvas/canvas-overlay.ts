import { combineLatest, map } from "rxjs";
import { cssSheet } from "@styles/adopt-styles";
import { BaseComponent } from "@components/base/base-component";
import { onDomEvent } from "@utils/dom-events";
import type { DragStartDetail, DragMoveDetail, DragEndDetail, DragScaleDetail } from "@utils/dom-events";
import { ServiceRegistry } from "@services/service-registry";
import { Logger } from "@utils/logger";
import type { CanvasObject } from "@master/services/visual-service";
import type { CanvasObjectProvider } from "@master/services/canvas-object-provider";
import { DRAG } from "@shared/constants/drag";
import { boundsToPercentages, applyDragDelta } from "./display-coordinates";
import type { IframePreview } from "./iframe-preview";

// @ts-expect-error — Bun imports CSS as text
import canvasOverlayCss from "./canvas-overlay.css" with { type: "text" };
// @ts-expect-error — Bun imports CSS as text
import commonCss from "@styles/common.css" with { type: "text" };

/**
 * Persistent overlay for interacting with placed canvas objects
 *
 * Renders draggable outline rectangles over the iframe preview,
 * one per visible object (image layer, timer, etc.). Each handle
 * is wrapped in a `<squire-draggable-handle>` for consistent drag
 * behavior and wheel/pinch scale support.
 *
 * Handles are positioned using percentages of the 1920x1080 display
 * space, so they automatically adapt to container resizes. Drag and
 * scale feedback uses CSS transforms for correct center-based scaling.
 */
export class CanvasOverlay extends BaseComponent {
    private logger = new Logger("CanvasOverlay");
    private providers = new Map<string, CanvasObjectProvider>();
    private objects: CanvasObject[] = [];

    private activeDragId: string | null = null;
    private dragStartScreenX = 0;
    private dragStartScreenY = 0;
    private dragDx = 0;
    private dragDy = 0;
    private pendingScale: number | null = null;

    override connectedCallback(): void {
        super.connectedCallback();

        this.registerProvider("image",
            ServiceRegistry.get<CanvasObjectProvider>("MasterVisualService"));
        this.registerProvider("clock",
            ServiceRegistry.get<CanvasObjectProvider>("MasterClockService"));

        this.adoptStyles(cssSheet(commonCss), cssSheet(canvasOverlayCss));

        this.render();
        this.setupSubscriptions();
        this.setupDragListeners();
    }
protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.innerHTML = `
            <div class="overlay-container"></div>
        `;
    }

    private registerProvider(type: string, provider: CanvasObjectProvider): void {
        this.providers.set(type, provider);
    }

    private setupSubscriptions(): void {
        const streams = Array.from(this.providers.values()).map(
            (p) => p.getCanvasObjects$(),
        );

        const combined$ = combineLatest(streams).pipe(
            map((arrays) =>
                arrays.flat().sort((a, b) => a.zIndex - b.zIndex),
            ),
        );

        this.subscribe(combined$, (objects) => {
            this.objects = objects;
            this.renderOverlays();
        });
    }

    private setupDragListeners(): void {
        if (!this.shadowRoot) {
            return;
        }

        // Stop overlay drag events from propagating to document,
        // where canvas-preview's gallery drag handlers would
        // misinterpret them as asset placement drags.
        this.cleanup.push(
            onDomEvent(this.shadowRoot, "drag-start", (e) => {
                e.stopPropagation();
                this.handleOverlayDragStart(e);
            }),
            onDomEvent(this.shadowRoot, "drag-move", (e) => {
                e.stopPropagation();
                this.handleOverlayDragMove(e);
            }),
            onDomEvent(this.shadowRoot, "drag-end", (e) => {
                e.stopPropagation();
                this.handleOverlayDragEnd(e);
            }),
            onDomEvent(this.shadowRoot, "drag-scale", (e) => {
                e.stopPropagation();
                this.handleOverlayDragScale(e);
            }),
            onDomEvent(this.shadowRoot, "drag-click", (e) => {
                e.stopPropagation();
            }),
        );
    }

    private renderOverlays(): void {
        const container = this.shadowRoot?.querySelector(".overlay-container");
        if (!container) {
            return;
        }

        // Skip re-render while dragging — transforms manage visual feedback
        if (this.activeDragId) {
            return;
        }

        container.innerHTML = "";

        this.logger.info("renderOverlays", { count: this.objects.length });

        for (const obj of this.objects) {
            const draggable = document.createElement("squire-draggable-handle");
            draggable.setAttribute("data-drag-data", obj.id);

            const handle = document.createElement("div");
            handle.className = "overlay-handle";

            const pct = boundsToPercentages(obj.bounds);

            handle.style.left = `${pct.left}%`;
            handle.style.top = `${pct.top}%`;
            handle.style.width = `${pct.width}%`;
            handle.style.height = `${pct.height}%`;

            this.logger.debug("  handle", {
                id: obj.id,
                type: obj.type,
                bounds: obj.bounds,
                pct,
            });

            draggable.appendChild(handle);
            container.appendChild(draggable);
        }
    }

    // -- Drag event handlers --

    private handleOverlayDragStart(e: CustomEvent<DragStartDetail>): void {
        const objectId = e.detail.data;
        if (!objectId) {
            return;
        }

        const obj = this.objects.find((o) => o.id === objectId);

        this.activeDragId = objectId;
        this.dragStartScreenX = e.detail.x;
        this.dragStartScreenY = e.detail.y;
        this.dragDx = 0;
        this.dragDy = 0;
        this.pendingScale = null;

        this.logger.info("dragStart", {
            objectId,
            screen: { x: e.detail.x, y: e.detail.y },
            bounds: obj?.bounds,
            scale: obj?.scale,
        });
    }

    private handleOverlayDragMove(e: CustomEvent<DragMoveDetail>): void {
        if (!this.activeDragId) {
            return;
        }

        this.dragDx = e.detail.x - this.dragStartScreenX;
        this.dragDy = e.detail.y - this.dragStartScreenY;

        this.logger.debug("dragMove", { dx: this.dragDx, dy: this.dragDy });
        this.updateHandleTransform();
    }

    private handleOverlayDragEnd(e: CustomEvent<DragEndDetail>): void {
        if (!this.activeDragId) {
            return;
        }

        const previewScale = this.getPreviewScale();
        const obj = this.objects.find((o) => o.id === this.activeDragId);

        if (!obj || previewScale === 0) {
            this.activeDragId = null;
            return;
        }

        const dx = (e.detail.x - this.dragStartScreenX) / previewScale;
        const dy = (e.detail.y - this.dragStartScreenY) / previewScale;
        const newPosition = applyDragDelta(obj.bounds, obj.scale, dx, dy);

        const objectId = this.activeDragId;
        const scale = this.pendingScale;

        this.logger.info("dragEnd", {
            objectId,
            type: obj.type,
            previewScale,
            displayDelta: { dx, dy },
            newPosition,
            pendingScale: scale,
        });

        // Clear drag state BEFORE the service call so the resulting
        // re-render (triggered by updateOverlay → subscription) isn't
        // blocked by the activeDragId guard in renderOverlays().
        const handle = this.findHandle(objectId);
        if (handle) {
            handle.style.transform = "";
        }
        this.activeDragId = null;
        this.pendingScale = null;

        const provider = this.providers.get(obj.type);
        if (provider) {
            provider.transformObject(
                objectId,
                newPosition,
                scale !== null ? scale : undefined,
            );
        }
    }

    private handleOverlayDragScale(e: CustomEvent<DragScaleDetail>): void {
        if (!this.activeDragId) {
            return;
        }

        const obj = this.objects.find((o) => o.id === this.activeDragId);
        if (!obj || obj.type !== "image") {
            return;
        }

        this.pendingScale = obj.scale * e.detail.scale;

        this.logger.info("dragScale", {
            objectId: this.activeDragId,
            gestureScale: e.detail.scale,
            objScale: obj.scale,
            pendingScale: this.pendingScale,
            scaleFactor: this.pendingScale / obj.scale,
        });

        this.updateHandleTransform();
    }

    /**
     * Apply CSS transform combining drag translation and scale.
     * transform-origin: center (from CSS) ensures scale grows from center.
     */
    private updateHandleTransform(): void {
        const handle = this.findHandle(this.activeDragId);
        if (!handle) {
            return;
        }

        const obj = this.objects.find((o) => o.id === this.activeDragId);
        const scaleFactor = obj && this.pendingScale !== null
            ? this.pendingScale / obj.scale
            : 1;

        const transform = `translate(${this.dragDx}px, ${this.dragDy}px) scale(${scaleFactor})`;
        handle.style.transform = transform;

        this.logger.debug("updateTransform", { transform, scaleFactor });
    }

    // -- Helpers --

    private findHandle(objectId: string | null): HTMLElement | null {
        if (!objectId) {
            return null;
        }

        const draggable = this.shadowRoot?.querySelector(
            `squire-draggable-handle[data-drag-data="${objectId}"]`,
        );
        return draggable?.querySelector(".overlay-handle") as HTMLElement | null;
    }

    private getPreviewScale(): number {
        const iframePreview = this.closest("iframe-preview") as IframePreview | null;

        if (!iframePreview) {
            return DRAG.PREVIEW_SCALE_FALLBACK;
        }

        return iframePreview.getPreviewScale();
    }
}
