import { html, nothing, type TemplateResult } from "lit-html";
import { map } from "lit-html/directives/map.js";
import { repeat } from "lit-html/directives/repeat.js";
import { styleMap } from "lit-html/directives/style-map.js";

import { BaseComponent } from "@core/base-component";
import { getRemainingTime, formatTime } from "@state/clock-state";
import { resolveX, resolveY, buildTransform } from "@utils/layer-geometry";
import displayCss from "./sq-display.css" with { type: "text" };

import type { ClockState } from "@state/clock-state";
import type { LayerService } from "@core/layer-service";
import type { LayerId, ClockId } from "@types";

export class SqDisplay extends BaseComponent {
    private _layerService: LayerService | null = null;
    private _layerIds: LayerId[] = [];
    private _clocks: ReadonlyMap<ClockId, ClockState> = new Map();

    set layerService(value: LayerService) {
        if (value === this._layerService) return;

        this._layerService = value;
        this.subscribe(value.layerIds$, (ids) => {
            this._layerIds = ids;
            this.update();
        });
    }

    set clocks(value: ReadonlyMap<ClockId, ClockState>) {
        this._clocks = value;
        this.update();
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.adoptStyles(displayCss);
        this.update();
    }

    protected template(): TemplateResult {
        const service = this._layerService;

        const visibleClocks = [...this._clocks.values()]
            .filter((c) => c.visible);

        return html`
            ${service
                ? repeat(
                      this._layerIds,
                      (id) => id,
                      (id) => html`<sq-layer .state$=${service.layer$(id)}></sq-layer>`,
                  )
                : nothing}
            ${map(visibleClocks, (clock) => this.clockTemplate(clock))}
        `;
    }

    private clockTemplate(clock: ClockState): TemplateResult {
        const remaining = getRemainingTime(clock);
        const formatted = formatTime(remaining);

        const styles: Record<string, string> = {
            zIndex: String(clock.zIndex),
            fontSize: `${24 * clock.scale}px`,
            fontFamily: clock.font,
            ...resolveX(clock.position.x),
            ...resolveY(clock.position.y),
        };

        const transform = buildTransform(clock.position, 1, 0);
        if (transform) styles.transform = transform;

        return html`
            <div class="clock" style=${styleMap(styles)}>
                ${formatted}
            </div>
        `;
    }
}
