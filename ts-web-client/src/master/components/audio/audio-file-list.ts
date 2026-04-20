import { BaseComponent } from "@components/base/base-component";
import { ServiceRegistry } from "@services/service-registry";
import type { AssetService, AudioAsset } from "@master/services/asset-service";
import { inputStyles } from "@styles/common-styles";
import { colors, spacing, borderRadius, fontSize, transitions } from "@styles/theme";

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

        this.render();
        this.setupFilterListener();
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

            ${inputStyles()}

            .filter-input {
                padding: ${spacing.sm} ${spacing.md};
                font-size: ${fontSize.sm};
                background: ${colors.gray[800]};
                border: 1px solid ${colors.gray[600]};
                border-radius: ${borderRadius.md};
                color: ${colors.gray[200]};
                margin-bottom: ${spacing.sm};
                flex-shrink: 0;
            }

            .filter-input:focus {
                outline: none;
                border-color: ${colors.blue[400]};
            }

            .file-list {
                list-style: none;
                margin: 0;
                padding: 0;
                flex: 1;
                min-height: 0;
                overflow-y: auto;
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 2px;
                align-content: start;
            }

            .audio-row {
                display: flex;
                align-items: center;
                gap: ${spacing.sm};
                padding: ${spacing.sm} ${spacing.md};
                background: ${colors.gray[800]};
                border-radius: ${borderRadius.sm};
                cursor: grab;
                transition: ${transitions.fast};
                user-select: none;
            }

            .audio-row:active {
                cursor: grabbing;
            }

            .audio-row:hover {
                background: ${colors.gray[700]};
            }

            .audio-name {
                flex: 1;
                font-size: ${fontSize.sm};
                color: ${colors.gray[200]};
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                min-width: 0;
            }

            .audio-duration {
                font-size: ${fontSize.xs};
                color: ${colors.gray[500]};
                flex-shrink: 0;
                font-variant-numeric: tabular-nums;
            }

            .empty-state {
                font-size: ${fontSize.sm};
                color: ${colors.gray[500]};
                text-align: center;
                padding: ${spacing.md};
            }
        `;
    }

    protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.innerHTML = `
            ${this.styleTag(this.getStyles())}

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
