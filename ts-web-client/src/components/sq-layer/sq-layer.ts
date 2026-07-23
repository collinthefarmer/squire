import { html, nothing, type TemplateResult } from "lit-html";
import { styleMap } from "lit-html/directives/style-map.js";

import { BaseComponent } from "@core/base-component";
import { buildLayerStyles } from "./layer-styles";
import layerCss from "./sq-layer.css" with { type: "text" };

import type { Observable } from "rxjs";
import type { LayerView } from "@core/layer-service";

/**
 * Renders a single image layer from a stream of its render-ready
 * state. Purely presentational — it imports no store or service and
 * subscribes only to the `LayerView` observable handed to it.
 */
export class SqLayer extends BaseComponent {
    private _state: LayerView | undefined;
    private _state$: Observable<LayerView | undefined> | null = null;

    set state$(value: Observable<LayerView | undefined>) {
        if (value === this._state$) return;

        this._state$ = value;
        this.subscribe(value, (state) => {
            this._state = state;
            this.update();
        });
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.adoptStyles(layerCss);
        this.update();
    }

    protected template(): TemplateResult {
        const layer = this._state;

        if (!layer || !layer.visible || !layer.imageUrl) return html`${nothing}`;

        const { host, img, isFull } = buildLayerStyles(layer);

        return html`
            <div class="layer ${isFull ? "layer-full" : ""}" style=${styleMap(host)}>
                <img src=${layer.imageUrl} alt="" style=${styleMap(img)} />
            </div>
        `;
    }
}
