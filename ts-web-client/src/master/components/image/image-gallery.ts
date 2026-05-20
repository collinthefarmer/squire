import { map, distinctUntilChanged } from "rxjs";
import { cssSheet } from "@styles/adopt-styles";
import { BaseComponent } from "@components/base/base-component";
import { ServiceRegistry } from "@services/service-registry";
import { TOKENS } from "@services/service-tokens";
import type { AssetService } from "@master/services/asset-service";
import type { ImageToolbarService } from "@master/services/image-toolbar-service";
// @ts-expect-error — Bun imports CSS as text
import imageGalleryCss from "./image-gallery.css" with { type: "text" };
// @ts-expect-error — Bun imports CSS as text
import commonCss from "@styles/common.css" with { type: "text" };

/**
 * Image gallery container component
 *
 * Displays a grid of draggable image thumbnails. Works with the CanvasPreview
 * component to enable drag-and-drop image placement on layers.
 *
 * @fires asset-drag-start - When image drag begins
 * @fires asset-drag-end - When image drag ends
 */
export class ImageGallery extends BaseComponent {
    private assetService!: AssetService;
    private imageToolbarService!: ImageToolbarService;

    override connectedCallback(): void {
        super.connectedCallback();

        this.assetService = ServiceRegistry.get(TOKENS.AssetService);
        this.imageToolbarService = ServiceRegistry.get(
            TOKENS.ImageToolbarService,
        );

        this.adoptStyles(cssSheet(commonCss), cssSheet(imageGalleryCss));

        this.render();
        this.loadAssets();
        this.setupSubscriptions();
    }
    protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.innerHTML = `
            <div class="container">
                <div class="header-row">
                    <div class="section-header">Images</div>
                    <button class="icon-btn" id="refresh-btn" type="button" title="Refresh">⟳</button>
                </div>
                <image-asset-grid></image-asset-grid>
            </div>
        `;

        this.setupEventListeners();
    }

    private setupSubscriptions(): void {
        const settings$ = this.imageToolbarService.getSettings$();
        const grid = (): Element | null | undefined =>
            this.shadowRoot?.querySelector("image-asset-grid");

        this.subscribe(
            settings$.pipe(
                map((s) => s.previewScale),
                distinctUntilChanged(),
            ),
            (previewScale) =>
                grid()?.setAttribute("preview-scale", String(previewScale)),
        );
    }

    private setupEventListeners(): void {
        this.shadowRoot
            ?.querySelector("#refresh-btn")
            ?.addEventListener("click", () => {
                this.loadAssets();
            });
    }

    private async loadAssets(): Promise<void> {
        await this.assetService.fetchImageAssets();
    }
}
