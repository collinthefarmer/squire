import { BaseComponent } from "@components/base/base-component";
import type { BaseAssetComponent } from "@components/base/base-asset-component";
import type { Draggable } from "@components/draggable/draggable";
import type { ImageHandle } from "@components/image-handle";
import { ServiceRegistry } from "@services/service-registry";
import type { AssetService, ImageAsset } from "@master/services/asset-service";
import { labelStyles } from "@styles/common-styles";
import { colors, spacing, borderRadius } from "@styles/theme";

export type AssetType = "audio" | "image";

export interface AssetGalleryConfig {
    assetType: AssetType;
    label: string;
    assetElement: string;
}

/**
 * Generic asset grid component
 *
 * Configurable gallery view with draggable asset components.
 * Emits custom events when dragging starts/stops.
 */
/**
 * @attr aspect-ratio - Aspect ratio mode forwarded to draggable children ("cover" | "contain")
 */
export class AssetGrid extends BaseComponent {
    static observedAttributes = ["aspect-ratio"];

    private assetService!: AssetService;
    private config: AssetGalleryConfig;

    constructor(config: AssetGalleryConfig) {
        super();

        this.config = config;
    }

    override connectedCallback(): void {
        super.connectedCallback();

        this.assetService = ServiceRegistry.get<AssetService>("AssetService");

        this.render();
        this.setupSubscriptions();
    }

    attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
        if (name !== "aspect-ratio" || !value) {
            return;
        }

        this.syncAspectRatio(value);
    }

    protected override getStyles(): string {
        return `
            :host {
                display: block;
            }

            ${labelStyles()}

            label {
                font-size: 0.875rem;
                margin-bottom: ${spacing.sm};
                display: block;
            }

            .asset-grid {
                display: flex;
                flex-direction: column;
            }

            ul {
                list-style: none;
                margin: 0;
                padding: 0;
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
                gap: ${spacing.sm};
                max-height: 300px;
                overflow-y: auto;
                padding: ${spacing.xs};
                background: ${colors.gray[900]};
                border-radius: ${borderRadius.md};
            }

            ul:empty::after {
                content: "No assets available";
                color: ${colors.gray[500]};
                font-size: 0.75rem;
                text-align: center;
                padding: ${spacing.md};
                grid-column: 1 / -1;
            }
        `;
    }

    protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        const gridId = `${this.config.assetType}-grid`;

        this.shadowRoot.innerHTML = `
            ${this.styleTag(this.getStyles())}

            <div class="asset-grid">
                <label for="${gridId}">${this.config.label}</label>
                <ul id="${gridId}">
                </ul>
            </div>
        `;

        this.setupEventListeners();
    }

    private setupSubscriptions(): void {
        if (this.config.assetType === "audio") {
            this.subscribe(this.assetService.getAudioAssets$(), (assets) => {
                this.updateAudioAssetGrid(assets);
            });
        } else {
            this.subscribe(this.assetService.getImageAssets$(), (assets) => {
                this.updateImageAssetGrid(assets);
            });
        }
    }

    private setupEventListeners(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.addEventListener("drag-start", ((e: CustomEvent) => {
            this.dispatchEvent(
                new CustomEvent("asset-drag-start", {
                    detail: {
                        assetType: this.config.assetType,
                        asset: e.detail.data,
                        x: e.detail.x,
                        y: e.detail.y,
                    },
                    bubbles: true,
                    composed: true,
                }),
            );
        }) as EventListener);

        this.shadowRoot.addEventListener("drag-end", ((e: CustomEvent) => {
            this.dispatchEvent(
                new CustomEvent("asset-drag-end", {
                    detail: {
                        assetType: this.config.assetType,
                        asset: e.detail.data,
                        x: e.detail.x,
                        y: e.detail.y,
                    },
                    bubbles: true,
                    composed: true,
                }),
            );
        }) as EventListener);

        this.shadowRoot.addEventListener("drag-click", ((e: CustomEvent) => {
            this.dispatchEvent(
                new CustomEvent("asset-click", {
                    detail: {
                        assetType: this.config.assetType,
                        asset: e.detail.data,
                        imageWidth: e.detail.imageWidth,
                        imageHeight: e.detail.imageHeight,
                    },
                    bubbles: true,
                    composed: true,
                }),
            );
        }) as EventListener);
    }

    private updateAudioAssetGrid(assets: string[]): void {
        const grid = this.shadowRoot?.querySelector("ul") as HTMLUListElement;
        if (!grid) {
            return;
        }

        grid.innerHTML = "";

        for (const asset of assets) {
            const li = document.createElement("li");

            const draggable = document.createElement(
                "squire-draggable",
            ) as Draggable;

            const item = document.createElement(
                this.config.assetElement,
            ) as BaseAssetComponent;
            item.asset = asset;

            draggable.appendChild(item);
            li.appendChild(draggable);
            grid.appendChild(li);
        }
    }

    private updateImageAssetGrid(assets: ImageAsset[]): void {
        const grid = this.shadowRoot?.querySelector("ul") as HTMLUListElement;
        if (!grid) {
            return;
        }

        grid.innerHTML = "";

        const aspectRatio = this.getAttribute("aspect-ratio") ?? "contain";

        for (const asset of assets) {
            const li = document.createElement("li");

            const draggable = document.createElement(
                "squire-draggable",
            ) as Draggable;

            // Store metadata for shadow calculation during drag
            draggable.setAttribute("data-drag-data", asset.name);
            draggable.setAttribute("data-image-width", String(asset.width));
            draggable.setAttribute("data-image-height", String(asset.height));
            draggable.setAttribute("data-aspect-ratio", aspectRatio);

            const item = document.createElement(
                this.config.assetElement,
            ) as ImageHandle;
            item.asset = asset.name;

            draggable.appendChild(item);
            li.appendChild(draggable);
            grid.appendChild(li);
        }
    }

    private syncAspectRatio(aspectRatio: string): void {
        const grid = this.shadowRoot?.querySelector("ul");
        if (!grid) {
            return;
        }

        for (const draggable of Array.from(grid.querySelectorAll("squire-draggable"))) {
            draggable.setAttribute("data-aspect-ratio", aspectRatio);
        }
    }
}

/**
 * Factory function to create a configured AssetGrid class
 *
 * Use this when you need to register a custom element with specific configuration.
 */
export function createAssetGridClass(
    config: AssetGalleryConfig,
): typeof AssetGrid {
    return class extends AssetGrid {
        constructor() {
            super(config);
        }
    };
}

export const ImageAssetGridClass = createAssetGridClass({
    assetType: "image",
    label: "Image Gallery",
    assetElement: "image-handle",
});

export const AudioAssetGridClass = createAssetGridClass({
    assetType: "audio",
    label: "Audio Gallery",
    assetElement: "audio-handle",
});
