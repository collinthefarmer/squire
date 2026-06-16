import { combineLatest } from "rxjs";
import { cssSheet } from "@styles/adopt-styles";
import { BaseComponent } from "@components/base/base-component";
import { onDomEvent } from "@utils/dom-events";
import { ServiceRegistry } from "@services/service-registry";
import { TOKENS } from "@services/service-tokens";
import type { ImageToolbarService } from "@master/services/image-toolbar-service";
import type { MasterVisualService } from "@master/services/visual-service";
import type { LayerControlPanel, LayerEntry } from "./layer-control-panel";
import type { ImageLayerState } from "@types";
import { layerId as toLayerId } from "@types";
// @ts-expect-error — Bun imports CSS as text
import imageToolbarCss from "./image-toolbar.css" with { type: "text" };
// @ts-expect-error — Bun imports CSS as text
import commonCss from "@styles/common.css" with { type: "text" };

/**
 * Image toolbar container component
 *
 * Provides controls for configuring how dropped images are placed:
 * - Layer control panel (add, select, reorder, toggle, remove)
 *
 * Orchestrates communication between the layer panel, toolbar service,
 * and visual service. Event handlers are thin — they delegate to
 * service methods rather than containing business logic.
 */
export class ImageToolbar extends BaseComponent {
    private imageToolbarService!: ImageToolbarService;
    private visualService!: MasterVisualService;

    override connectedCallback(): void {
        super.connectedCallback();

        this.imageToolbarService = ServiceRegistry.get(
            TOKENS.ImageToolbarService,
        );
        this.visualService = ServiceRegistry.get(
            TOKENS.MasterVisualService,
        );

        this.adoptStyles(cssSheet(commonCss), cssSheet(imageToolbarCss));

        this.render();
        this.setupEventListeners();
        this.setupSubscriptions();
    }
    protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.innerHTML = `
            <div class="toolbar">
                <layer-control-panel></layer-control-panel>
            </div>
        `;
    }

    private setupEventListeners(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.cleanup.push(
            onDomEvent(this.shadowRoot, "layer-select", (e) => {
                this.imageToolbarService.setLayer(e.detail.layer);
            }),

            onDomEvent(this.shadowRoot, "layer-add", (e) => {
                this.imageToolbarService.registerLayer(e.detail.name);
            }),

            onDomEvent(this.shadowRoot, "layer-remove", (e) => {
                const serverLayer = this.visualService
                    .getLayers()
                    .get(toLayerId(e.detail.layer));
                if (serverLayer?.imageRef) {
                    this.visualService.clearImage(e.detail.layer);
                }
                this.imageToolbarService.unregisterLayer(e.detail.layer);
            }),

            onDomEvent(this.shadowRoot, "layer-clear", (e) => {
                this.visualService.clearImage(e.detail.layer);
            }),

            onDomEvent(this.shadowRoot, "layer-visibility", (e) => {
                this.visualService.setLayerConfig(e.detail.layer, {
                    visible: e.detail.visible,
                });
            }),

            onDomEvent(this.shadowRoot, "layer-reorder", (e) => {
                this.visualService.reorderLayers(e.detail.order);
            }),

            onDomEvent(this.shadowRoot, "layer-aspect-ratio", (e) => {
                const current = this.visualService
                    .getLayers()
                    .get(toLayerId(e.detail.layer));
                if (current?.imageRef) {
                    this.visualService.setImage(
                        e.detail.layer,
                        current.imageRef,
                        {
                            aspectRatio: e.detail.aspectRatio,
                        },
                    );
                }
            }),
        );
    }

    private setupSubscriptions(): void {
        this.subscribe(
            combineLatest([
                this.imageToolbarService.getRegisteredLayers$(),
                this.visualService.getLayers$(),
                this.imageToolbarService.getSelectedLayer$(),
            ]),
            ([registered, serverLayers, selectedLayer]) => {
                this.imageToolbarService.syncServerLayers(
                    Array.from(serverLayers.keys()),
                );

                const entries = this.computeLayerEntries(
                    registered,
                    serverLayers,
                    selectedLayer,
                );
                this.getPanel()?.setLayers(entries);
            },
        );
    }

    private computeLayerEntries(
        registered: string[],
        serverLayers: Map<string, ImageLayerState>,
        selectedLayer: string,
    ): LayerEntry[] {
        const entries: LayerEntry[] = registered.map((id) => {
            const server = serverLayers.get(id);
            return {
                id,
                imageRef: server?.imageRef ?? null,
                aspectRatio: server?.aspectRatio ?? "contain",
                zIndex: server?.zIndex ?? 0,
                visible: server?.visible ?? true,
                selected: id === selectedLayer,
            };
        });

        // Sort so top of list = frontmost on display.
        // Primary: descending zIndex. Tiebreaker: later-registered layers
        // appear on top (matching Map insertion order in the renderer).
        entries.sort((a, b) => {
            if (a.zIndex !== b.zIndex) {
                return b.zIndex - a.zIndex;
            }
            return registered.indexOf(b.id) - registered.indexOf(a.id);
        });
        return entries;
    }

    private getPanel(): LayerControlPanel | null {
        return this.shadowRoot?.querySelector(
            "layer-control-panel",
        ) as LayerControlPanel | null;
    }
}
