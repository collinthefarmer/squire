import { map, distinctUntilChanged } from "rxjs";
import { BaseComponent } from "@components/base/base-component";
import { ServiceRegistry } from "@services/service-registry";
import type { AssetService } from "@master/services/asset-service";
import type { ImageToolbarService } from "@master/services/image-toolbar-service";
import {
    containerStyles,
    sectionHeaderStyles,
    headerRowStyles,
} from "@styles/common-styles";
import { colors, spacing, borderRadius, fontSize, transitions } from "@styles/theme";

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

        this.assetService = ServiceRegistry.get<AssetService>("AssetService");
        this.imageToolbarService = ServiceRegistry.get<ImageToolbarService>("ImageToolbarService");

        this.render();
        this.loadAssets();
        this.setupSubscriptions();
    }

    protected override getStyles(): string {
        return `
            :host {
                display: flex;
                flex-direction: column;
                flex: 1;
                min-height: 0;
            }

            ${containerStyles()}
            ${sectionHeaderStyles()}
            ${headerRowStyles()}

            .container {
                display: flex;
                flex-direction: column;
                flex: 1;
                min-height: 0;
            }

            .section-header {
                margin-bottom: 0;
            }

            .icon-btn {
                background: transparent;
                border: none;
                color: ${colors.gray[500]};
                cursor: pointer;
                padding: ${spacing.xs};
                font-size: ${fontSize.lg};
                border-radius: ${borderRadius.sm};
                transition: ${transitions.fast};
                line-height: 1;
                display: inline-flex;
                align-items: center;
                justify-content: center;
            }

            .icon-btn:hover {
                background: ${colors.gray[700]};
                color: ${colors.gray[200]};
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
            settings$.pipe(map((s) => s.previewScale), distinctUntilChanged()),
            (previewScale) => grid()?.setAttribute("preview-scale", String(previewScale)),
        );
    }

    private setupEventListeners(): void {
        this.shadowRoot?.querySelector("#refresh-btn")?.addEventListener("click", () => {
            this.loadAssets();
        });
    }

    private async loadAssets(): Promise<void> {
        await this.assetService.fetchImageAssets();
    }
}
