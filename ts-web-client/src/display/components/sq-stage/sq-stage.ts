import { html, type TemplateResult } from "lit-html";
import { ref } from "lit-html/directives/ref.js";
import { styleMap } from "lit-html/directives/style-map.js";

import { BaseComponent } from "@core/base-component";
import { DISPLAY } from "@constants/display";
import { fitScale } from "@utils/fit-scale";
import { store, layerService } from "../../services";
import stageCss from "./sq-stage.css" with { type: "text" };

import type { SqDisplay } from "@components/sq-display";

/**
 * The display client's root: scales the fixed 1920×1080 stage to fill
 * the screen, uniformly and centred, and wires the sq-display to state.
 *
 * The visual twin of the master's display-frame — same fit math
 * (`fitScale`) — but view-only: no palette, gestures, or handles.
 */
export class SqStage extends BaseComponent {
    private scale = 1;
    private offsetX = 0;
    private offsetY = 0;
    private observer: ResizeObserver | null = null;
    private displayEl: SqDisplay | null = null;

    private viewportRef = (el: Element | undefined): void => {
        if (!el) return;

        this.observer = new ResizeObserver(([entry]) => {
            if (!entry) return;
            const { width, height } = entry.contentRect;
            const fit = fitScale(width, height, DISPLAY.WIDTH, DISPLAY.HEIGHT);

            this.scale = fit.scale;
            this.offsetX = fit.offsetX;
            this.offsetY = fit.offsetY;
            this.update();
        });

        this.observer.observe(el);
    };

    private displayRef = (el: Element | undefined): void => {
        if (!el) return;
        this.displayEl = el as SqDisplay;
        this.displayEl.layerService = layerService;
        this.displayEl.clocks = store.clocks;
    };

    override connectedCallback(): void {
        super.connectedCallback();
        this.adoptStyles(stageCss);

        this.subscribe(store.clocks$, (clocks) => {
            if (this.displayEl) this.displayEl.clocks = clocks;
        });

        this.update();
    }

    override disconnectedCallback(): void {
        this.observer?.disconnect();
        this.observer = null;
        super.disconnectedCallback();
    }

    protected template(): TemplateResult {
        return html`
            <div class="viewport" ${ref(this.viewportRef)}>
                <div class="frame" style=${styleMap({
                    transform: `translate(${this.offsetX}px, ${this.offsetY}px) scale(${this.scale})`,
                })}>
                    <sq-display ${ref(this.displayRef)}></sq-display>
                </div>
            </div>
        `;
    }
}
