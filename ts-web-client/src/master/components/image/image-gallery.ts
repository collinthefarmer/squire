import { BaseComponent } from "@components/base/base-component";
import { ServiceRegistry } from "@services/service-registry";
import type { AssetService } from "@master/services/asset-service";
import { sectionHeaderStyles, containerStyles } from "@styles/common-styles";
import { colors, spacing, borderRadius } from "@styles/theme";

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

    override connectedCallback(): void {
        super.connectedCallback();

        this.assetService = ServiceRegistry.get<AssetService>("AssetService");

        this.render();
        this.loadAssets();
    }

    protected override getStyles(): string {
        return `
            :host {
                display: block;
            }

            ${containerStyles()}
            ${sectionHeaderStyles()}

            .container {
                background: ${colors.gray[800]};
                border-radius: ${borderRadius.lg};
                padding: ${spacing.md};
            }

            .section-header {
                margin-bottom: ${spacing.sm};
            }

            .refresh-button {
                background: transparent;
                border: 1px solid ${colors.gray[600]};
                color: ${colors.gray[200]};
                padding: ${spacing.xs} ${spacing.sm};
                border-radius: ${borderRadius.sm};
                font-size: 0.75rem;
                cursor: pointer;
                transition: all 0.15s ease;
            }

            .refresh-button:hover {
                background: ${colors.gray[700]};
                border-color: ${colors.gray[500]};
            }

            .header-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
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
                    <button class="refresh-button" type="button">Refresh</button>
                </div>
                <image-asset-grid></image-asset-grid>
            </div>
        `;

        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        if (!this.shadowRoot) {
            return;
        }

        const refreshButton = this.shadowRoot.querySelector(".refresh-button");
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
