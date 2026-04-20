import { fromEvent } from "rxjs";
import { cssSheet } from "@styles/adopt-styles";
import { filter, take } from "rxjs/operators";
import { BaseComponent } from "@components/base/base-component";
import { observeResize } from "@utils/observe-resize";
import "@utils/dom-events";
import { ServiceRegistry } from "@services/service-registry";
import type { MasterVisualService } from "@master/services/visual-service";
import type { ImageToolbarService } from "@master/services/image-toolbar-service";
import type { IframePreview } from "./iframe-preview";
import type { DropZoneOverlay } from "./drop-zone-overlay";
import {
    screenToCanvasFraction,
    screenToDisplayPixels,
    wouldOverlapDisplay,
} from "./display-coordinates";
import { containerStyles, sectionHeaderStyles } from "@styles/common-styles";
import { DISPLAY } from "@shared/constants/display";

// @ts-expect-error — Bun imports CSS as text
import canvasPreviewCss from "./canvas-preview.css" with { type: "text" };
// @ts-expect-error — Bun imports CSS as text
import commonCss from "@styles/common.css" with { type: "text" };

/**
 * Canvas preview container for master client
 *
 * Hosts an iframe preview of the display client and a drop zone overlay.
 * Coordinates drag-and-drop image placement by listening for drag events,
 * converting coordinates, and delegating to the visual service.
 *
 * @example
 * ```html
 * <canvas-preview></canvas-preview>
 * ```
 */
export class CanvasPreview extends BaseComponent {
    private visualService!: MasterVisualService;
    private imageToolbarService!: ImageToolbarService;
    private isDragActive = false;
    private currentDragAsset: string | null = null;

    override connectedCallback(): void {
        super.connectedCallback();

        this.visualService = ServiceRegistry.get<MasterVisualService>("MasterVisualService");
        this.imageToolbarService = ServiceRegistry.get<ImageToolbarService>("ImageToolbarService");

        this.adoptStyles(cssSheet(commonCss), cssSheet(canvasPreviewCss));

        this.render();
        this.setupDragSubscriptions();
        this.setupPreviewScaleSync();
        this.listenForDisplayReady();
    }
protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.innerHTML = `
            <div class="container preview-container">
                <div class="section-header header">Display Preview</div>
                <iframe-preview></iframe-preview>
            </div>
        `;
    }

    // -- Drag event handling --

    private setupDragSubscriptions(): void {
        this.subscribe(fromEvent<CustomEvent<import("@utils/dom-events").DragStartDetail>>(document, "drag-start"), (e) => this.handleDragStart(e));
        this.subscribe(fromEvent<CustomEvent<import("@utils/dom-events").DragMoveDetail>>(document, "drag-move"), (e) => this.handleDragMove(e));
        this.subscribe(fromEvent<CustomEvent<import("@utils/dom-events").DragEndDetail>>(document, "drag-end"), (e) => this.handleDragEnd(e));
        this.subscribe(fromEvent<CustomEvent<import("@utils/dom-events").DragScaleDetail>>(document, "drag-scale"), (e) => this.handleDragScale(e));
        this.subscribe(fromEvent<CustomEvent<import("@utils/dom-events").AssetClickDetail>>(document, "asset-click"), (e) => this.handleAssetClick(e));
    }

    private handleDragStart(e: CustomEvent<import("@utils/dom-events").DragStartDetail>): void {
        if (e.detail.source) {
            return;
        }

        this.isDragActive = true;
        this.currentDragAsset = e.detail.data;

        this.imageToolbarService.resetScale();
        if (e.detail.imageWidth && e.detail.imageHeight) {
            this.imageToolbarService.setImageDimensions({
                width: e.detail.imageWidth,
                height: e.detail.imageHeight,
            });
        }

        this.getDropZone()?.activate();
    };

    private handleDragMove(e: CustomEvent<import("@utils/dom-events").DragMoveDetail>): void {
        if (!this.isDragActive || e.detail.source) {
            return;
        }

        const wrapperRect = this.getIframePreview()?.getWrapperRect();
        if (!wrapperRect) {
            return;
        }

        const normalizedPos = screenToCanvasFraction(e.detail.x, e.detail.y, wrapperRect);
        this.imageToolbarService.setPosition(normalizedPos);
    };

    private handleDragEnd(e: CustomEvent<import("@utils/dom-events").DragEndDetail>): void {
        if (e.detail.source) {
            return;
        }

        if (this.currentDragAsset) {
            this.handleDrop(this.currentDragAsset, e.detail.x, e.detail.y);
        }

        this.imageToolbarService.setImageDimensions(null);

        this.isDragActive = false;
        this.currentDragAsset = null;

        this.getDropZone()?.deactivate();
    };

    private handleDragScale(e: CustomEvent<import("@utils/dom-events").DragScaleDetail>): void {
        if (e.detail.source) {
            return;
        }

        this.imageToolbarService.setScale(e.detail.scale);
    };

    private handleAssetClick(e: CustomEvent<import("@utils/dom-events").AssetClickDetail>): void {
        const { asset, assetType, imageWidth, imageHeight } = e.detail;

        if (assetType !== "image" || !asset) {
            return;
        }

        // Dimensions must be set before handleImageDrop reads them
        // and cleared after, all within the same synchronous block,
        // since no drag lifecycle manages them for click events.
        if (imageWidth && imageHeight) {
            this.imageToolbarService.setImageDimensions({
                width: imageWidth,
                height: imageHeight,
            });
        }

        const settings = this.imageToolbarService.getSettings();
        const displayX = settings.position.x * DISPLAY.WIDTH;
        const displayY = settings.position.y * DISPLAY.HEIGHT;

        this.visualService.handleImageDrop(asset, displayX, displayY);

        this.imageToolbarService.setImageDimensions(null);
    };

    private handleDrop(imageRef: string, screenX: number, screenY: number): void {
        const iframePreview = this.getIframePreview();
        if (!iframePreview) {
            return;
        }

        const wrapperRect = iframePreview.getWrapperRect();
        if (!wrapperRect) {
            return;
        }

        const previewScale = iframePreview.getPreviewScale();
        const displayPos = screenToDisplayPixels(screenX, screenY, wrapperRect, previewScale);

        const settings = this.imageToolbarService.getSettings();
        const overlaps = wouldOverlapDisplay(
            displayPos.x,
            displayPos.y,
            settings.imageDimensions,
            "contain",
            settings.scale,
            DISPLAY.WIDTH,
            DISPLAY.HEIGHT,
        );

        if (!overlaps) {
            return;
        }

        this.visualService.handleImageDrop(imageRef, displayPos.x, displayPos.y);
    }

    // -- Sub-component accessors --

    private getIframePreview(): IframePreview | null {
        return this.shadowRoot?.querySelector("iframe-preview") as IframePreview | null;
    }

    private getDropZone(): DropZoneOverlay | null {
        return this.shadowRoot?.querySelector("drop-zone-overlay") as DropZoneOverlay | null;
    }

    /**
     * Keep the toolbar's preview scale in sync with the iframe wrapper.
     * This value propagates to DraggableImage via the asset gallery
     * attribute chain for shadow sizing.
     */
    private setupPreviewScaleSync(): void {
        const iframePreview = this.getIframePreview();
        if (!iframePreview) {
            return;
        }

        this.imageToolbarService.setPreviewScale(iframePreview.getPreviewScale());

        this.subscribe(observeResize(iframePreview), () => {
            this.imageToolbarService.setPreviewScale(iframePreview.getPreviewScale());
        });
    }

    private listenForDisplayReady(): void {
        this.subscribe(
            fromEvent<MessageEvent>(window, "message").pipe(
                filter((e) => e.data?.type === "squire:audio-enabled"),
                take(1),
            ),
            () => {
                const preview = this.getIframePreview();
                if (preview) {
                    preview.appendChild(document.createElement("drop-zone-overlay"));
                    preview.appendChild(document.createElement("canvas-overlay"));
                }
            },
        );
    }
}
