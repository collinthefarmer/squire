import { BehaviorSubject, fromEvent, debounceTime } from "rxjs";
import { cssSheet } from "@styles/adopt-styles";
import { BaseComponent } from "@components/base/base-component";
import { onDomEvent, emitDomEvent } from "@utils/dom-events";
import type { AspectRatioMode } from "@types";
import { LAYER } from "@shared/constants/layer";

// @ts-expect-error — Bun imports CSS as text
import layerControlPanelCss from "./layer-control-panel.css" with { type: "text" };
// @ts-expect-error — Bun imports CSS as text
import commonCss from "@styles/common.css" with { type: "text" };

/**
 * A single layer's display state, computed by the parent toolbar
 * from the merged registry + server data.
 */
export interface LayerEntry {
    id: string;
    imageRef: string | null;
    aspectRatio: AspectRatioMode;
    zIndex: number;
    visible: boolean;
    selected: boolean;
}

/**
 * Drag-reorder state tracked as an observable so renders
 * are driven declaratively by state changes.
 */
interface DragState {
    sourceId: string | null;
    targetId: string | null;
    position: "before" | "after";
}

const IDLE_DRAG: DragState = {
    sourceId: null,
    targetId: null,
    position: "before",
};

/**
 * Layer control panel for managing image layers
 *
 * Displays a list of registered layers with selection, visibility toggle,
 * drag-to-reorder, and add/remove controls. All rendering is driven by
 * RxJS observables — drag handlers and user actions update subjects,
 * and a combined subscription produces the DOM.
 *
 * Rows are wrapped in `<squire-draggable-handle>` for consistent
 * drag mechanics and click-vs-drag threshold detection.
 */
export class LayerControlPanel extends BaseComponent {
    private layers$ = new BehaviorSubject<LayerEntry[]>([]);
    private dragState$ = new BehaviorSubject<DragState>(IDLE_DRAG);
    private adding$ = new BehaviorSubject<boolean>(false);

    setLayers(entries: LayerEntry[]): void {
        this.layers$.next(entries);
    }

    get layers(): LayerEntry[] {
        return this.layers$.value;
    }

    override connectedCallback(): void {
        super.connectedCallback();

        this.adoptStyles(cssSheet(commonCss), cssSheet(layerControlPanelCss));

        this.render();
        this.setupActionListeners();
        this.setupDragListeners();
        this.setupSubscriptions();
    }
    protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.innerHTML = `
            <div class="header-row">
                <div class="section-header">Layers</div>
                <button class="outline-button add-btn" id="add-btn" type="button">Add Layer +</button>
            </div>
            <div id="add-container"></div>
            <div class="layer-list" id="layer-list"></div>
        `;
    }

    // -- Subscriptions --

    private setupSubscriptions(): void {
        this.subscribe(this.layers$, (layers) => this.renderList(layers));

        this.subscribe(this.dragState$, (dragState) =>
            this.updateDragClasses(dragState),
        );

        this.subscribe(this.adding$, (adding) => this.renderAddInput(adding));
    }

    // -- Pure renders from state --

    private renderList(layers: LayerEntry[]): void {
        const list = this.shadowRoot?.querySelector("#layer-list");
        if (!list) {
            return;
        }

        if (layers.length === 0) {
            list.innerHTML = '<div class="empty-state">No layers</div>';
            return;
        }

        list.innerHTML = "";

        for (const layer of layers) {
            list.appendChild(this.createLayerRow(layer));
        }
    }

    private createLayerRow(layer: LayerEntry): HTMLElement {
        const draggable = document.createElement("squire-draggable-handle");
        draggable.setAttribute("data-drag-data", layer.id);
        draggable.setAttribute("data-drag-source", "layer-panel");

        const row = document.createElement("div");
        row.className = layer.selected ? "layer-row selected" : "layer-row";
        row.dataset.layer = layer.id;

        row.appendChild(this.createStrip(layer));
        row.appendChild(this.createBody(layer));

        draggable.appendChild(row);
        return draggable;
    }

    private createStrip(layer: LayerEntry): HTMLDivElement {
        const strip = document.createElement("div");
        strip.className = "layer-strip";

        const visBtn = this.createActionButton(
            layer.visible ? "●" : "○",
            layer.visible ? "Hide layer" : "Show layer",
            "visibility",
            layer.id,
            `vis-btn${layer.visible ? " active" : ""}`,
        );
        visBtn.dataset.visible = layer.visible ? "true" : "false";
        strip.appendChild(visBtn);

        const hasImage = layer.imageRef !== null;
        const isLastLayer = this.layers$.value.length <= 1;

        if (hasImage) {
            const containBtn = this.createActionButton(
                "◫",
                "Contain",
                "aspect-ratio",
                layer.id,
                `ar-btn${layer.aspectRatio === "contain" ? " selected" : ""}`,
            );
            containBtn.dataset.aspectRatio = "contain";

            const coverBtn = this.createActionButton(
                "▣",
                "Cover",
                "aspect-ratio",
                layer.id,
                `ar-btn${layer.aspectRatio === "cover" ? " selected" : ""}`,
            );
            coverBtn.dataset.aspectRatio = "cover";

            strip.appendChild(containBtn);
            strip.appendChild(coverBtn);

            strip.appendChild(
                this.createActionButton(
                    "✕",
                    "Clear image",
                    "clear",
                    layer.id,
                    "clear-btn",
                ),
            );
        } else if (!isLastLayer) {
            strip.appendChild(
                this.createActionButton(
                    "✕",
                    "Remove layer",
                    "remove",
                    layer.id,
                    "remove-btn",
                ),
            );
        }

        return strip;
    }

    private createBody(layer: LayerEntry): HTMLDivElement {
        const body = document.createElement("div");
        body.className = "layer-body";

        const name = document.createElement("span");
        name.className = "layer-name";
        name.textContent = layer.id;

        const image = document.createElement("span");
        image.className = "layer-image";
        image.textContent = layer.imageRef ?? "(empty)";

        body.appendChild(name);
        body.appendChild(image);
        return body;
    }

    private renderAddInput(adding: boolean): void {
        const container = this.shadowRoot?.querySelector("#add-container");
        if (!container) {
            return;
        }

        if (!adding) {
            container.innerHTML = "";
            return;
        }

        container.innerHTML = `
            <div class="add-row">
                <input type="text" id="add-input" placeholder="Layer name" />
            </div>
        `;

        const input = container.querySelector("#add-input") as HTMLInputElement;
        input.focus();

        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                this.confirmAdd(input.value.trim());
            } else if (e.key === "Escape") {
                this.adding$.next(false);
            }
        });

        this.subscribe(
            fromEvent(input, "blur").pipe(debounceTime(LAYER.ADD_BLUR_DELAY)),
            () => {
                if (this.adding$.value) {
                    this.adding$.next(false);
                }
            },
        );
    }

    /**
     * Toggle drag indicator classes on existing rows without
     * rebuilding the DOM, so the active Draggable stays alive.
     */
    private updateDragClasses(dragState: DragState): void {
        const list = this.shadowRoot?.querySelector("#layer-list");
        if (!list) {
            return;
        }

        const rows = Array.from(
            list.querySelectorAll(".layer-row"),
        ) as HTMLElement[];
        for (const el of rows) {
            const layerId = el.dataset.layer;

            el.classList.toggle("dragging", layerId === dragState.sourceId);
            el.classList.toggle(
                "drop-before",
                layerId === dragState.targetId &&
                    dragState.position === "before",
            );
            el.classList.toggle(
                "drop-after",
                layerId === dragState.targetId &&
                    dragState.position === "after",
            );
        }
    }

    /**
     * Create an action button that stops mousedown propagation so
     * the parent Draggable doesn't intercept clicks on it.
     */
    private createActionButton(
        text: string,
        title: string,
        action: string,
        layer: string,
        extraClass: string,
    ): HTMLButtonElement {
        const btn = document.createElement("button");
        btn.className = `strip-btn${extraClass ? ` ${extraClass}` : ""}`;
        btn.type = "button";
        btn.dataset.action = action;
        btn.dataset.layer = layer;
        btn.textContent = text;
        btn.title = title;

        btn.addEventListener("mousedown", (e) => e.stopPropagation());
        btn.addEventListener("touchstart", (e) => e.stopPropagation());

        return btn;
    }

    // -- Action listeners (click delegation + add button) --

    private setupActionListeners(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot
            .querySelector("#add-btn")
            ?.addEventListener("click", () => {
                this.adding$.next(true);
            });

        this.shadowRoot
            .querySelector("#layer-list")
            ?.addEventListener("click", (e) => {
                const target = e.target as HTMLElement;
                const action = target.dataset.action;
                if (!action) {
                    return;
                }

                e.stopPropagation();
                this.handleAction(action, target);
            });
    }

    // -- Drag listeners (reorder via Draggable events) --

    private setupDragListeners(): void {
        const list = this.shadowRoot?.querySelector("#layer-list");
        if (!list) {
            return;
        }

        this.cleanup.push(
            onDomEvent(list, "drag-click", (e) => {
                if (e.detail.data) {
                    emitDomEvent(this, "layer-select", {
                        layer: e.detail.data,
                    });
                }
            }),

            onDomEvent(list, "drag-start", (e) => {
                this.dragState$.next({ ...IDLE_DRAG, sourceId: e.detail.data });
            }),

            onDomEvent(list, "drag-move", (e) => {
                const current = this.dragState$.value;
                if (!current.sourceId) {
                    return;
                }

                const drop = this.findDropTarget(current.sourceId, e.detail.y);
                this.dragState$.next({ ...current, ...drop });
            }),

            onDomEvent(list, "drag-end", () => {
                const { sourceId, targetId, position } = this.dragState$.value;
                this.dragState$.next(IDLE_DRAG);

                if (!sourceId || !targetId || sourceId === targetId) {
                    return;
                }

                const order = this.computeReorderedList(
                    sourceId,
                    targetId,
                    position,
                );
                if (!order) {
                    return;
                }

                emitDomEvent(this, "layer-reorder", { order });
                this.applyOptimisticReorder(order);
            }),
        );
    }

    // -- Drag helpers --

    /**
     * Find which row the cursor is nearest (excluding the source)
     * and whether it is above or below that row's vertical center.
     */
    private findDropTarget(
        sourceId: string,
        cursorY: number,
    ): { targetId: string | null; position: "before" | "after" } {
        const list = this.shadowRoot?.querySelector("#layer-list");
        if (!list) {
            return { targetId: null, position: "before" };
        }

        const rows = Array.from(
            list.querySelectorAll(".layer-row"),
        ) as HTMLElement[];

        for (const row of rows) {
            if (row.dataset.layer === sourceId) {
                continue;
            }

            const rect = row.getBoundingClientRect();
            if (cursorY < rect.bottom) {
                const midY = rect.top + rect.height / 2;
                return {
                    targetId: row.dataset.layer ?? null,
                    position: cursorY < midY ? "before" : "after",
                };
            }
        }

        // Cursor is below all non-source rows — drop after the last one
        for (let i = rows.length - 1; i >= 0; i--) {
            const row = rows[i] as HTMLElement;
            if (row.dataset.layer !== sourceId) {
                return {
                    targetId: row.dataset.layer ?? null,
                    position: "after",
                };
            }
        }

        return { targetId: null, position: "before" };
    }

    /**
     * Compute the new layer order by inserting the source
     * before or after the target.
     */
    private computeReorderedList(
        sourceId: string,
        targetId: string,
        position: "before" | "after",
    ): string[] | null {
        const order = this.layers$.value.map((l) => l.id);
        const sourceIdx = order.indexOf(sourceId);
        if (sourceIdx === -1) {
            return null;
        }

        order.splice(sourceIdx, 1);

        const targetIdx = order.indexOf(targetId);
        if (targetIdx === -1) {
            return null;
        }

        const insertIdx = position === "before" ? targetIdx : targetIdx + 1;
        order.splice(insertIdx, 0, sourceId);
        return order;
    }

    /**
     * Optimistically reorder local layers to match the requested order,
     * preventing a visual snap-back while waiting for the server round-trip.
     */
    private applyOptimisticReorder(order: string[]): void {
        const current = this.layers$.value;
        const byId = new Map(current.map((l) => [l.id, l]));

        const reordered: LayerEntry[] = [];

        for (let i = 0; i < order.length; i++) {
            const id = order[i] as string;
            const entry = byId.get(id);
            if (!entry) {
                continue;
            }
            reordered.push({ ...entry, zIndex: order.length - 1 - i });
        }

        for (const entry of current) {
            if (!order.includes(entry.id)) {
                reordered.push(entry);
            }
        }

        this.layers$.next(reordered);
    }

    // -- Action handling --

    private handleAction(action: string, target: HTMLElement): void {
        const layer = target.dataset.layer;
        if (!layer) {
            return;
        }

        switch (action) {
            case "visibility": {
                const currentlyVisible = target.dataset.visible === "true";
                emitDomEvent(this, "layer-visibility", {
                    layer,
                    visible: !currentlyVisible,
                });
                break;
            }
            case "aspect-ratio": {
                const aspectRatio = target.dataset
                    .aspectRatio as AspectRatioMode;
                if (aspectRatio) {
                    emitDomEvent(this, "layer-aspect-ratio", {
                        layer,
                        aspectRatio,
                    });
                }
                break;
            }
            case "clear":
                emitDomEvent(this, "layer-clear", { layer });
                break;
            case "remove":
                emitDomEvent(this, "layer-remove", { layer });
                break;
        }
    }

    private confirmAdd(name: string): void {
        this.adding$.next(false);

        if (!name) {
            return;
        }

        emitDomEvent(this, "layer-add", { name });
    }
}
