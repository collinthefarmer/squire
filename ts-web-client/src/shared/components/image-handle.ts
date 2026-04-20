import { BaseAssetComponent } from "@components/base/base-asset-component";
import { ServiceRegistry } from "@services/service-registry";
import type { ConfigService } from "@services/config-service";
import {
    colors,
    spacing,
    borderRadius,
    transitions,
    fontSize,
    sizing,
} from "@styles/theme";

/**
 * Image thumbnail component for asset galleries
 *
 * Displays a thumbnail preview of an image asset at its actual aspect ratio
 * (scaled to fit within max bounds). Intended to be wrapped in a
 * squire-draggable component for drag-and-drop functionality.
 *
 * @example
 * ```html
 * <squire-draggable data-drag-data="forest.jpg">
 *     <image-handle></image-handle>
 * </squire-draggable>
 * ```
 */
export class ImageHandle extends BaseAssetComponent {
    private _asset = "";
    private configService!: ConfigService;

    /** Thumbnail size for resized image requests (2x display size for retina) */
    private readonly THUMBNAIL_SIZE = 240;

    get asset(): string {
        return this._asset;
    }

    set asset(value: string) {
        this._asset = value;
        this.updateImage();
        this.updateDragData();
    }

    connectedCallback(): void {
        this.configService =
            ServiceRegistry.get<ConfigService>("ConfigService");

        this.attachShadow({ mode: "open" });
        this.render();
        this.updateImage();
        this.updateDragData();
    }

    private render(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    cursor: grab;
                }

                :host(:active) {
                    cursor: grabbing;
                }

                .thumbnail {
                    display: inline-block;
                    border-radius: ${borderRadius.sm};
                    overflow: hidden;
                    background: ${colors.gray[800]};
                    border: 2px solid transparent;
                    transition: ${transitions.fast};
                }

                .thumbnail:hover {
                    border-color: ${colors.blue[500]};
                    transform: scale(1.05);
                }

                img {
                    display: block;
                    max-width: ${sizing.thumbnail};
                    max-height: ${sizing.thumbnail};
                    width: auto;
                    height: auto;
                }

                .placeholder {
                    width: ${sizing.thumbnail};
                    height: ${sizing.thumbnail};
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: ${colors.gray[500]};
                    font-size: ${fontSize.xs};
                    text-align: center;
                    padding: ${spacing.xs};
                    box-sizing: border-box;
                    word-break: break-all;
                }
            </style>

            <div class="thumbnail">
                <div class="placeholder"></div>
            </div>
        `;
    }

    private updateImage(): void {
        if (!this.shadowRoot || !this._asset) {
            return;
        }

        const container = this.shadowRoot.querySelector(".thumbnail");
        if (!container) {
            return;
        }

        const apiUrl = this.configService?.getApiUrl() ?? "";

        // Request resized image for thumbnail display
        const imageUrl = `${apiUrl}/public/images/${this._asset}?w=${this.THUMBNAIL_SIZE}`;

        const img = document.createElement("img");
        img.src = imageUrl;
        img.alt = this._asset;
        img.loading = "lazy";

        img.onerror = () => {
            const placeholder = document.createElement("div");
            placeholder.className = "placeholder";
            placeholder.textContent = this._asset;
            container.innerHTML = "";
            container.appendChild(placeholder);
        };

        img.onload = () => {
            container.innerHTML = "";
            container.appendChild(img);
        };
    }

    /**
     * Sets the drag data on the parent draggable element
     */
    private updateDragData(): void {
        if (!this._asset) {
            return;
        }

        const draggable = this.closest("squire-draggable");
        if (draggable) {
            draggable.setAttribute("data-drag-data", this._asset);
        }
    }
}
