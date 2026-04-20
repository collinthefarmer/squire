import { BaseComponent } from "@components/base/base-component";
import { cssSheet } from "@styles/adopt-styles";
import type { BaseAssetComponent } from "@components/base/base-asset-component";
import type { Draggable } from "@components/draggable/draggable";
import type { ImageHandle } from "@components/image-handle";
import { onDomEvent, emitDomEvent } from "@utils/dom-events";
import { ServiceRegistry } from "@services/service-registry";
import type {
    AssetService,
    AudioAsset,
    ImageAsset,
} from "@master/services/asset-service";
import { labelStyles } from "@styles/common-styles";
// @ts-expect-error — Bun imports CSS as text
import assetGalleryCss from "./asset-gallery.css" with { type: "text" };
// @ts-expect-error — Bun imports CSS as text
import commonCss from "@styles/common.css" with { type: "text" };

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
 * @attr preview-scale - Preview scale factor forwarded to draggable children
 */
export class AssetGrid extends BaseComponent {
    static observedAttributes = ["preview-scale"];

    private assetService!: AssetService;
    private config: AssetGalleryConfig;

    constructor(config: AssetGalleryConfig) {
        super();

        this.config = config;
    }

    override connectedCallback(): void {
        super.connectedCallback();

        this.assetService = ServiceRegistry.get<AssetService>("AssetService");

        this.adoptStyles(cssSheet(commonCss), cssSheet(assetGalleryCss));

        this.render();
        this.setupSubscriptions();
    }

    attributeChangedCallback(
        name: string,
        _old: string | null,
        value: string | null,
    ): void {
        if (!value) {
            return;
        }

        if (name === "preview-scale") {
            this.syncDraggableAttribute("data-preview-scale", value);
        }
    }
    protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        const gridId = `${this.config.assetType}-grid`;

        this.shadowRoot.innerHTML = `
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

        this.cleanup.push(
            onDomEvent(this.shadowRoot, "drag-start", (e) => {
                emitDomEvent(this, "asset-drag-start", {
                    assetType: this.config.assetType,
                    asset: e.detail.data,
                    x: e.detail.x,
                    y: e.detail.y,
                });
            }),

            onDomEvent(this.shadowRoot, "drag-end", (e) => {
                emitDomEvent(this, "asset-drag-end", {
                    assetType: this.config.assetType,
                    asset: e.detail.data,
                    x: e.detail.x,
                    y: e.detail.y,
                });
            }),

            onDomEvent(this.shadowRoot, "drag-click", (e) => {
                emitDomEvent(this, "asset-click", {
                    assetType: this.config.assetType,
                    asset: e.detail.data,
                    imageWidth: e.detail.imageWidth,
                    imageHeight: e.detail.imageHeight,
                });
            }),
        );
    }

    private updateAudioAssetGrid(assets: AudioAsset[]): void {
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
            item.asset = asset.name;

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

        const aspectRatio = "contain";

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

            const previewScale = this.getAttribute("preview-scale");
            if (previewScale) {
                draggable.setAttribute("data-preview-scale", previewScale);
            }

            const item = document.createElement(
                this.config.assetElement,
            ) as ImageHandle;
            item.asset = asset.name;

            draggable.appendChild(item);
            li.appendChild(draggable);
            grid.appendChild(li);
        }
    }

    private syncDraggableAttribute(attrName: string, value: string): void {
        const grid = this.shadowRoot?.querySelector("ul");
        if (!grid) {
            return;
        }

        for (const draggable of Array.from(
            grid.querySelectorAll("squire-draggable"),
        )) {
            draggable.setAttribute(attrName, value);
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
