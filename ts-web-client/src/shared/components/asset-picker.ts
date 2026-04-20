import { BaseComponent } from "@components/base/base-component";
import { cssSheet } from "@styles/adopt-styles";
import { emitDomEvent, type AppEventMap, type AssetChangeDetail } from "@utils/dom-events";
import { ServiceRegistry } from "@services/service-registry";
import type { AssetService, ImageAsset } from "@master/services/asset-service";
import { selectStyles, labelStyles, flexColumn } from "@styles/common-styles";
// @ts-expect-error — Bun imports CSS as text
import assetPickerCss from "./asset-picker.css" with { type: "text" };
// @ts-expect-error — Bun imports CSS as text
import commonCss from "@styles/common.css" with { type: "text" };

export type AssetType = "audio" | "image";

/**
 * Keys of AppEventMap whose detail is AssetChangeDetail,
 * used to constrain which event names a picker can emit.
 */
type AssetPickerEventName = {
    [K in keyof AppEventMap]: AppEventMap[K] extends AssetChangeDetail ? K : never;
}[keyof AppEventMap];

export interface AssetPickerConfig {
    assetType: AssetType;
    label: string;
    eventName: AssetPickerEventName;
    placeholder: string;
}

/**
 * Generic asset picker component
 *
 * Configurable dropdown for selecting audio or image assets from AssetService.
 * Emits custom events when selection changes.
 */
export class AssetPicker extends BaseComponent {
    private assetService!: AssetService;
    private selectedAsset = "";
    private config: AssetPickerConfig;

    constructor(config: AssetPickerConfig) {
        super();
        this.config = config;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.assetService = ServiceRegistry.get<AssetService>("AssetService");
        this.adoptStyles(cssSheet(commonCss), cssSheet(assetPickerCss));

        this.render();
        this.setupSubscriptions();
    }
protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        const selectId = `${this.config.assetType}-asset`;

        this.shadowRoot.innerHTML = `
            <div class="asset-picker">
                <label for="${selectId}">${this.config.label}</label>
                <select id="${selectId}">
                    <option value="" disabled selected>${this.config.placeholder}</option>
                </select>
            </div>
        `;

        this.setupEventListeners();
    }

    private setupSubscriptions(): void {
        if (this.config.assetType === "audio") {
            this.subscribe(this.assetService.getAudioAssets$(), (assets) => {
                this.updateAssetList(assets.map((a) => a.name));
            });
        } else {
            this.subscribe(this.assetService.getImageAssets$(), (assets) => {
                const names = assets.map((a: ImageAsset) => a.name);
                this.updateAssetList(names);
            });
        }
    }

    private setupEventListeners(): void {
        const select = this.shadowRoot?.querySelector("select") as HTMLSelectElement;
        if (!select) {
            return;
        }

        select.addEventListener("change", () => {
            this.selectedAsset = select.value;
            emitDomEvent(this, this.config.eventName, { asset: this.selectedAsset });
        });
    }

    private updateAssetList(assets: string[]): void {
        const select = this.shadowRoot?.querySelector("select") as HTMLSelectElement;
        if (!select) {
            return;
        }

        const currentValue = select.value;
        select.innerHTML = `<option value="" disabled selected>${this.config.placeholder}</option>`;

        for (const asset of assets) {
            const option = document.createElement("option");
            option.value = asset;
            option.textContent = asset;
            select.appendChild(option);
        }

        if (currentValue && assets.includes(currentValue)) {
            select.value = currentValue;
        }
    }

    /**
     * Get currently selected asset
     */
    getSelectedAsset(): string {
        return this.selectedAsset;
    }
}

/**
 * Factory function to create a configured AssetPicker class
 *
 * Use this when you need to register a custom element with specific configuration.
 */
export function createAssetPickerClass(config: AssetPickerConfig): typeof AssetPicker {
    return class extends AssetPicker {
        constructor() {
            super(config);
        }
    };
}

/**
 * Pre-configured audio asset picker class
 */
export const AudioAssetPickerClass = createAssetPickerClass({
    assetType: "audio",
    label: "Audio File",
    eventName: "asset-change",
    placeholder: "Select audio file...",
});

/**
 * Pre-configured image asset picker class
 */
export const ImageAssetPickerClass = createAssetPickerClass({
    assetType: "image",
    label: "Image File",
    eventName: "image-asset-change",
    placeholder: "Select image file...",
});
