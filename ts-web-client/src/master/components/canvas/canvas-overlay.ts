import { combineLatest, map } from "rxjs";
import { BaseComponent } from "@components/base/base-component";
import { ServiceRegistry } from "@services/service-registry";
import { Logger } from "@utils/logger";
import type { MasterVisualService, CanvasObject } from "@master/services/visual-service";
import type { MasterClockService } from "@master/services/clock-service";
import { colors, alpha } from "@styles/theme";
import type { IframePreview } from "./iframe-preview";

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
    private visualService!: MasterVisualService;
    private clockService!: MasterClockService;
    private objects: CanvasObject[] = [];

    private activeDragId: string | null = null;
    private dragStartScreenX = 0;
    private dragStartScreenY = 0;
    private dragDx = 0;
    private dragDy = 0;
    private pendingScale: number | null = null;

    private readonly DISPLAY_WIDTH = 1920;
    private readonly DISPLAY_HEIGHT = 1080;

    override connectedCallback(): void {
        super.connectedCallback();

        this.visualService = ServiceRegistry.get<MasterVisualService>("MasterVisualService");
        this.clockService = ServiceRegistry.get<MasterClockService>("MasterClockService");

        this.render();
        this.setupSubscriptions();
        this.setupDragListeners();
    }

    protected override getStyles(): string {
        return `
            :host {
                position: absolute;
                inset: 0;
                pointer-events: none;
                z-index: 5;
            }

            .overlay-container {
                position: relative;
                width: 100%;
                height: 100%;
            }

            .overlay-handle {
                position: absolute;
                pointer-events: auto;
                border: 1px dashed ${colors.blue[400]};
                cursor: grab;
                box-sizing: border-box;
                transform-origin: center;
            }

            .overlay-handle:hover {
                background: ${alpha(colors.blue[500], 0.1)};
                border-color: ${colors.blue[500]};
            }
        `;
    }

    protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.innerHTML = `
            ${this.styleTag(this.getStyles())}
            <div class="overlay-container"></div>
        `;
    }

    private setupSubscriptions(): void {
        const combined$ = combineLatest([
            this.visualService.getCanvasObjects$(),
            this.clockService.getCanvasObjects$(),
        ]).pipe(
            map(([imageObjects, clockObjects]) =>
                [...imageObjects, ...clockObjects].sort((a, b) => a.zIndex - b.zIndex),
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
        const stop = (handler: (e: CustomEvent) => void) => {
            return ((e: CustomEvent) => {
                e.stopPropagation();
                handler(e);
            }) as EventListener;
        };

        this.shadowRoot.addEventListener("drag-start", stop((e) => this.handleOverlayDragStart(e)));
        this.shadowRoot.addEventListener("drag-move", stop((e) => this.handleOverlayDragMove(e)));
        this.shadowRoot.addEventListener("drag-end", stop((e) => this.handleOverlayDragEnd(e)));
        this.shadowRoot.addEventListener("drag-scale", stop((e) => this.handleOverlayDragScale(e)));
        this.shadowRoot.addEventListener("drag-click", stop(() => {}));
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

            const pctLeft = (obj.bounds.x / this.DISPLAY_WIDTH) * 100;
            const pctTop = (obj.bounds.y / this.DISPLAY_HEIGHT) * 100;
            const pctWidth = (obj.bounds.width / this.DISPLAY_WIDTH) * 100;
            const pctHeight = (obj.bounds.height / this.DISPLAY_HEIGHT) * 100;

            handle.style.left = `${pctLeft}%`;
            handle.style.top = `${pctTop}%`;
            handle.style.width = `${pctWidth}%`;
            handle.style.height = `${pctHeight}%`;

            this.logger.debug("  handle", {
                id: obj.id,
                type: obj.type,
                bounds: obj.bounds,
                pct: { left: pctLeft, top: pctTop, width: pctWidth, height: pctHeight },
            });

            draggable.appendChild(handle);
            container.appendChild(draggable);
        }
    }

    // -- Drag event handlers --

    private handleOverlayDragStart(e: CustomEvent): void {
        const objectId = e.detail.data;
        if (!objectId) {
            return;
        }

        const obj = this.objects.find((o) => o.id === objectId);
        const handle = this.findHandle(objectId);

        // Use the handle's visual center as the drag origin so the
        // cursor stays centered. This prevents the handle from
        // drifting away when CSS transforms shift its visual position.
        let startX = e.detail.x;
        let startY = e.detail.y;

        if (handle) {
            const rect = handle.getBoundingClientRect();
            startX = rect.left + rect.width / 2;
            startY = rect.top + rect.height / 2;
        }

        this.activeDragId = objectId;
        this.dragStartScreenX = startX;
        this.dragStartScreenY = startY;
        this.dragDx = 0;
        this.dragDy = 0;
        this.pendingScale = null;

        this.logger.info("dragStart", {
            objectId,
            mouseScreen: { x: e.detail.x, y: e.detail.y },
            handleCenter: { x: startX, y: startY },
            bounds: obj?.bounds,
            scale: obj?.scale,
        });
    }

    private handleOverlayDragMove(e: CustomEvent): void {
        if (!this.activeDragId) {
            return;
        }

        this.dragDx = e.detail.x - this.dragStartScreenX;
        this.dragDy = e.detail.y - this.dragStartScreenY;

        this.logger.debug("dragMove", { dx: this.dragDx, dy: this.dragDy });
        this.updateHandleTransform();
    }

    private handleOverlayDragEnd(e: CustomEvent): void {
        if (!this.activeDragId) {
            return;
        }

        const previewScale = this.getPreviewScale();
        const obj = this.objects.find((o) => o.id === this.activeDragId);

        if (!obj || previewScale === 0) {
            this.activeDragId = null;
            return;
        }

        // Convert screen-space drag delta to display-space pixels
        const dx = (e.detail.x - this.dragStartScreenX) / previewScale;
        const dy = (e.detail.y - this.dragStartScreenY) / previewScale;

        // Recover pre-scale dimensions for correct offset computation
        const preScaleW = obj.bounds.width / obj.scale;
        const preScaleH = obj.bounds.height / obj.scale;

        const oldCenterX = obj.bounds.x + obj.bounds.width / 2;
        const oldCenterY = obj.bounds.y + obj.bounds.height / 2;
        const newCenterX = oldCenterX + dx;
        const newCenterY = oldCenterY + dy;

        const newOffsetX = newCenterX - preScaleW / 2;
        const newOffsetY = newCenterY - preScaleH / 2;
        const newPosition = { x: `${newOffsetX}px`, y: `${newOffsetY}px` };

        this.logger.info("dragEnd", {
            objectId: this.activeDragId,
            type: obj.type,
            previewScale,
            displayDelta: { dx, dy },
            preScaleDims: { preScaleW, preScaleH },
            oldCenter: { oldCenterX, oldCenterY },
            newCenter: { newCenterX, newCenterY },
            newOffset: { newOffsetX, newOffsetY },
            newPosition,
            pendingScale: this.pendingScale,
        });

        if (obj.type === "image") {
            this.visualService.transformImage(this.activeDragId, {
                position: newPosition,
                ...(this.pendingScale !== null ? { scale: this.pendingScale } : {}),
            });
        } else if (obj.type === "clock") {
            this.clockService.transformClock(this.activeDragId, newPosition);
        }

        this.activeDragId = null;
        this.pendingScale = null;
    }

    private handleOverlayDragScale(e: CustomEvent): void {
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
            return 0.5;
        }

        return iframePreview.getPreviewScale();
    }
}
