import { map, distinctUntilChanged } from "rxjs";
import { BaseComponent } from "@components/base/base-component";
import { ServiceRegistry } from "@services/service-registry";
import type { AssetService } from "@master/services/asset-service";
import type { ImageToolbarService } from "@master/services/image-toolbar-service";
import {
    containerStyles,
    sectionHeaderStyles,
    outlineButtonStyles,
    headerRowStyles,
} from "@styles/common-styles";
import { spacing } from "@styles/theme";

/**
 * Image gallery container component
 *
 * Displays a grid of draggable image thumbnails. Works with the CanvasPreview
 * component to enable drag-and-drop image placement on layers.
 *
 * @fires asset-drag-start - When image drag begins
 *   - detail.assetType: "image"
 *   - detail.asset: string (filename)
 *   - detail.x, detail.y: number (coordinates)
 *
 * @fires asset-drag-end - When image drag ends
 *   - detail.assetType: "image"
 *   - detail.asset: string (filename)
 *   - detail.x, detail.y: number (coordinates)
 *
 * @example
 * ```html
 * <image-gallery></image-gallery>
 * ```
 */
export class ImageGallery extends BaseComponent {
    private assetService!: AssetService;
    private imageToolbarService!: ImageToolbarService;

    override connectedCallback(): void {
        super.connectedCallback();

        this.assetService = ServiceRegistry.get<AssetService>("AssetService");
        this.imageToolbarService = ServiceRegistry.get<ImageToolbarService>("ImageToolbarService");

        this.render();
        this.loadAssets();
        this.setupSubscriptions();
    }

    protected override getStyles(): string {
        return `
            :host {
                display: block;
            }

            ${containerStyles()}
            ${sectionHeaderStyles()}
            ${outlineButtonStyles()}
            ${headerRowStyles()}

            .section-header {
                margin-bottom: ${spacing.sm};
            }
        `;
    }

    protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.innerHTML = `
            ${this.styleTag(this.getStyles())}

            <div class="container">
                <div class="header-row">
                    <div class="section-header">Images</div>
                    <button class="outline-button" type="button">Refresh</button>
                </div>
                <image-asset-grid></image-asset-grid>
            </div>
        `;

        this.setupEventListeners();
    }

    /**
     * Sync toolbar aspect ratio to the asset grid so draggable
     * children render the correct shadow preview.
     */
    private setupSubscriptions(): void {
        const settings$ = this.imageToolbarService.getSettings$();
        const grid = (): Element | null | undefined =>
            this.shadowRoot?.querySelector("image-asset-grid");

        this.subscribe(
            settings$.pipe(map((s) => s.aspectRatio), distinctUntilChanged()),
            (aspectRatio) => grid()?.setAttribute("aspect-ratio", aspectRatio),
        );

        this.subscribe(
            settings$.pipe(map((s) => s.previewScale), distinctUntilChanged()),
            (previewScale) => grid()?.setAttribute("preview-scale", String(previewScale)),
        );
    }

    private setupEventListeners(): void {
        if (!this.shadowRoot) {
            return;
        }

        const refreshButton = this.shadowRoot.querySelector(".outline-button");
        if (refreshButton) {
            refreshButton.addEventListener("click", () => {
                this.loadAssets();
            });
        }
    }

    private async loadAssets(): Promise<void> {
        await this.assetService.fetchImageAssets();
    }
}
