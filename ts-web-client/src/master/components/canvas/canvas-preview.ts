import { BaseComponent } from "@components/base/base-component";
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
import { spacing } from "@styles/theme";
import { DISPLAY } from "@shared/constants/display";

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

        this.render();
        this.setupDragListeners();
        this.setupPreviewScaleSync();
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.cleanupDragListeners();
    }

    protected override getStyles(): string {
        return `
            :host {
                display: block;
            }

            ${containerStyles()}
            ${sectionHeaderStyles()}

            .preview-container {
                display: flex;
                flex-direction: column;
                gap: ${spacing.md};
            }

            .header {
                font-size: 1.125rem;
            }
        `;
    }

    protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.innerHTML = `
            ${this.styleTag(this.getStyles())}

            <div class="container preview-container">
                <div class="section-header header">Display Preview</div>
                <iframe-preview>
                    <drop-zone-overlay></drop-zone-overlay>
                    <canvas-overlay></canvas-overlay>
                </iframe-preview>
            </div>
        `;
    }

    // -- Drag event handling --

    private setupDragListeners(): void {
        document.addEventListener("drag-start", this.handleDragStart);
        document.addEventListener("drag-move", this.handleDragMove);
        document.addEventListener("drag-end", this.handleDragEnd);
        document.addEventListener("drag-scale", this.handleDragScale);
        document.addEventListener("asset-click", this.handleAssetClick);
    }

    private cleanupDragListeners(): void {
        document.removeEventListener("drag-start", this.handleDragStart);
        document.removeEventListener("drag-move", this.handleDragMove);
        document.removeEventListener("drag-end", this.handleDragEnd);
        document.removeEventListener("drag-scale", this.handleDragScale);
        document.removeEventListener("asset-click", this.handleAssetClick);
    }

    private handleDragStart = (e: Event): void => {
        const detail = (e as CustomEvent).detail;

        this.isDragActive = true;
        this.currentDragAsset = detail?.data ?? null;

        this.imageToolbarService.resetScale();
        if (detail?.imageWidth && detail?.imageHeight) {
            this.imageToolbarService.setImageDimensions({
                width: detail.imageWidth,
                height: detail.imageHeight,
            });
        }

        this.getDropZone()?.activate();
    };

    private handleDragMove = (e: Event): void => {
        if (!this.isDragActive) {
            return;
        }

        const customEvent = e as CustomEvent;
        const { x, y } = customEvent.detail;

        const wrapperRect = this.getIframePreview()?.getWrapperRect();
        if (!wrapperRect) {
            return;
        }

        // Cursor position as fraction of canvas (unclamped).
        // Represents the image center point.
        const normalizedPos = screenToCanvasFraction(x, y, wrapperRect);
        this.imageToolbarService.setPosition(normalizedPos);
    };

    private handleDragEnd = (e: Event): void => {
        const customEvent = e as CustomEvent;
        const { x, y } = customEvent.detail;

        // Handle the drop if we have an active drag asset.
        // Cursor position represents the image center.
        if (this.currentDragAsset) {
            this.handleDrop(this.currentDragAsset, x, y);
        }

        this.imageToolbarService.setImageDimensions(null);

        this.isDragActive = false;
        this.currentDragAsset = null;

        this.getDropZone()?.deactivate();
    };

    private handleDragScale = (e: Event): void => {
        const { scale } = (e as CustomEvent).detail;
        this.imageToolbarService.setScale(scale);
    };

    /**
     * Handle single-click on an image asset.
     *
     * Applies the image at the current toolbar position (center by default)
     * using whatever settings are configured in the toolbar. Sets image
     * dimensions temporarily so the visual service can compute placement.
     */
    private handleAssetClick = (e: Event): void => {
        const { asset, assetType, imageWidth, imageHeight } = (e as CustomEvent).detail;

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
            settings.aspectRatio,
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

        const updateScale = (): void => {
            this.imageToolbarService.setPreviewScale(
                iframePreview.getPreviewScale(),
            );
        };

        // Initial sync + observe resizes
        updateScale();
        const observer = new ResizeObserver(updateScale);
        observer.observe(iframePreview);
        this.cleanup.push(() => observer.disconnect());
    }
}
