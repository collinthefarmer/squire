import { BaseComponent } from "@components/base/base-component";
import { cssSheet } from "@styles/adopt-styles";
import { ServiceRegistry } from "@services/service-registry";
import type { AssetService, AudioAsset } from "@master/services/asset-service";
import type { MasterAudioService } from "@master/services/master-audio-service";
import type { LocalStore } from "@services/local-store";
import type { ContextMenuService, MenuProvider } from "@services/context-menu-service";

// @ts-expect-error — Bun imports CSS as text
import audioFileListCss from "./audio-file-list.css" with { type: "text" };
// @ts-expect-error — Bun imports CSS as text
import commonCss from "@styles/common.css" with { type: "text" };

type ChannelHistory = Record<string, Record<string, number>>;

const DEFAULT_CHANNELS = ["ambient", "music", "sfx", "voice"];

/**
 * Filterable, draggable audio file list with channel tag filtering.
 *
 * Tag buttons filter to files previously played on that channel,
 * sorted by play frequency. History is persisted in LocalStore.
 */
export class AudioFileList extends BaseComponent {
    private assetService!: AssetService;
    private audioService!: MasterAudioService;
    private localStore!: LocalStore;
    private contextMenuService!: ContextMenuService;
    private allAssets: AudioAsset[] = [];
    private channelHistory: ChannelHistory = {};
    private filterText = "";
    private activeTag: string | null = null;

    private menuProvider: MenuProvider = (_target, path) => {
        const row = path.find(
            (el) => (el as HTMLElement).classList?.contains("audio-row"),
        );
        if (!row) {
            return null;
        }

        const draggable = (row as HTMLElement).closest(
            "squire-draggable-audio",
        );
        const asset = draggable?.getAttribute("data-drag-data");
        if (!asset) {
            return null;
        }

        return DEFAULT_CHANNELS.map((ch) => ({
            label: `Play on ${ch}`,
            icon: "▶",
            action: () => this.audioService.playAudio(ch, asset),
        }));
    };

    override connectedCallback(): void {
        super.connectedCallback();

        this.assetService = ServiceRegistry.get<AssetService>("AssetService");
        this.audioService =
            ServiceRegistry.get<MasterAudioService>("MasterAudioService");
        this.localStore = ServiceRegistry.get<LocalStore>("LocalStore");
        this.contextMenuService =
            ServiceRegistry.get<ContextMenuService>("ContextMenuService");

        this.contextMenuService.registerProvider(this.menuProvider);

        this.adoptStyles(cssSheet(commonCss), cssSheet(audioFileListCss));

        this.render();
        this.setupInteractions();
        this.setupSubscriptions();
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.contextMenuService.unregisterProvider(this.menuProvider);
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
            <div class="list-area">
                <ul class="file-list" id="list"></ul>
                <div class="tag-filters" id="tags">
                    ${DEFAULT_CHANNELS.map(
                        (ch) =>
                            `<button class="tag-btn" data-channel="${ch}">${ch}</button>`,
                    ).join("")}
                </div>
            </div>
        `;
    }

    private setupInteractions(): void {
        const input = this.shadowRoot?.querySelector(
            "#filter",
        ) as HTMLInputElement;

        input?.addEventListener("input", () => {
            this.filterText = input.value.toLowerCase();
            this.renderList();
        });

        this.shadowRoot
            ?.querySelector("#tags")
            ?.addEventListener("click", (e) => {
                const btn = (e.target as HTMLElement).closest(
                    ".tag-btn",
                ) as HTMLElement | null;
                if (!btn) {
                    return;
                }

                const channel = btn.dataset.channel ?? null;

                if (this.activeTag === channel) {
                    this.activeTag = null;
                } else {
                    this.activeTag = channel;
                }

                this.updateTagButtons();
                this.renderList();
            });
    }

    private setupSubscriptions(): void {
        this.subscribe(this.assetService.getAudioAssets$(), (assets) => {
            this.allAssets = assets;
            this.renderList();
        });

        this.subscribe(
            this.localStore.get$<ChannelHistory>("audio.channelHistory"),
            (history) => {
                this.channelHistory = history ?? {};
                this.renderList();
            },
        );
    }

    private getFilteredAssets(): AudioAsset[] {
        let assets = [...this.allAssets];

        if (this.filterText) {
            assets = assets.filter((a) =>
                a.name.toLowerCase().includes(this.filterText),
            );
        }

        if (this.activeTag) {
            const tag = this.activeTag;
            assets = assets
                .filter(
                    (a) => (this.channelHistory[a.name]?.[tag] ?? 0) > 0,
                )
                .sort((a, b) => {
                    const countA =
                        this.channelHistory[a.name]?.[tag] ?? 0;
                    const countB =
                        this.channelHistory[b.name]?.[tag] ?? 0;
                    return countB - countA;
                });
        }

        return assets;
    }

    private renderList(): void {
        const list = this.shadowRoot?.querySelector("#list");
        if (!list) {
            return;
        }

        const filtered = this.getFilteredAssets();

        if (filtered.length === 0) {
            const msg = this.activeTag
                ? `No files played on "${this.activeTag}"`
                : this.filterText
                  ? "No matches"
                  : "No audio files";
            list.innerHTML = `<li class="empty-state">${msg}</li>`;
            return;
        }

        list.innerHTML = "";

        for (const asset of filtered) {
            const draggable = document.createElement("squire-draggable-audio");
            draggable.setAttribute("data-drag-data", asset.name);
            draggable.setAttribute("data-drag-source", "audio-list");

            const row = document.createElement("li");
            row.className = "audio-row";

            const grip = document.createElement("span");
            grip.className = "grip-handle";
            grip.textContent = "⠿";

            const name = document.createElement("span");
            name.className = "audio-name";
            name.textContent = asset.name;

            const duration = document.createElement("span");
            duration.className = "audio-duration";
            duration.textContent = this.formatDuration(asset.duration);

            draggable.addEventListener("drag-click", () => {
                const channel = this.audioService.bestChannelFor(asset.name);
                this.audioService.playAudio(channel, asset.name);
            });

            row.appendChild(grip);
            row.appendChild(name);
            row.appendChild(duration);
            draggable.appendChild(row);
            list.appendChild(draggable);
        }
    }

    private updateTagButtons(): void {
        const buttons = this.shadowRoot?.querySelectorAll(".tag-btn");
        if (!buttons) {
            return;
        }

        for (const btn of Array.from(buttons)) {
            const el = btn as HTMLElement;
            el.classList.toggle(
                "active",
                el.dataset.channel === this.activeTag,
            );
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
