import { BaseComponent } from "@components/base/base-component";
import { cssSheet } from "@styles/adopt-styles";
import { ServiceRegistry } from "@services/service-registry";
import type { AssetService, AudioAsset } from "@master/services/asset-service";
import { inputStyles } from "@styles/common-styles";
// @ts-expect-error — Bun imports CSS as text
import audioFileListCss from "./audio-file-list.css" with { type: "text" };
// @ts-expect-error — Bun imports CSS as text
import commonCss from "@styles/common.css" with { type: "text" };

/**
 * Filterable, draggable audio file list
 *
 * Displays audio assets as compact rows with filename and duration.
 * Each row is wrapped in a draggable handle for drag-to-timeline.
 * A text input filters the list by filename in real time.
 */
export class AudioFileList extends BaseComponent {
    private assetService!: AssetService;
    private allAssets: AudioAsset[] = [];
    private filterText = "";

    override connectedCallback(): void {
        super.connectedCallback();

        this.assetService = ServiceRegistry.get<AssetService>("AssetService");

        this.adoptStyles(cssSheet(commonCss), cssSheet(audioFileListCss));

        this.render();
        this.setupFilterListener();
        this.setupSubscriptions();
    }
protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.innerHTML = `
            <input
                type="text"
                class="filter-input"
                id="filter"
                placeholder="Filter audio files..."
            />
            <ul class="file-list" id="list"></ul>
        `;
    }

    private setupFilterListener(): void {
        const input = this.shadowRoot?.querySelector("#filter") as HTMLInputElement;
        if (!input) {
            return;
        }

        input.addEventListener("input", () => {
            this.filterText = input.value.toLowerCase();
            this.renderList();
        });
    }

    private setupSubscriptions(): void {
        this.subscribe(this.assetService.getAudioAssets$(), (assets) => {
            this.allAssets = assets;
            this.renderList();
        });
    }

    private renderList(): void {
        const list = this.shadowRoot?.querySelector("#list");
        if (!list) {
            return;
        }

        const filtered = this.filterText
            ? this.allAssets.filter((a) => a.name.toLowerCase().includes(this.filterText))
            : this.allAssets;

        if (filtered.length === 0) {
            list.innerHTML = `<li class="empty-state">${this.filterText ? "No matches" : "No audio files"}</li>`;
            return;
        }

        list.innerHTML = "";

        for (const asset of filtered) {
            const draggable = document.createElement("squire-draggable-audio");
            draggable.setAttribute("data-drag-data", asset.name);
            draggable.setAttribute("data-drag-source", "audio-list");

            const row = document.createElement("li");
            row.className = "audio-row";

            const name = document.createElement("span");
            name.className = "audio-name";
            name.textContent = asset.name;

            const duration = document.createElement("span");
            duration.className = "audio-duration";
            duration.textContent = this.formatDuration(asset.duration);

            row.appendChild(name);
            row.appendChild(duration);
            draggable.appendChild(row);
            list.appendChild(draggable);
        }
    }

    private formatDuration(seconds: number): string {
        if (seconds <= 0) {
            return "--:--";
        }

        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    }
}
