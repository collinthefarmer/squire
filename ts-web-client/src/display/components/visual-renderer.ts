import { animationFrameScheduler } from "rxjs";
import { cssSheet } from "@styles/adopt-styles";
import { observeOn } from "rxjs/operators";
import { BaseComponent } from "@components/base/base-component";
import { ServiceRegistry } from "@services/service-registry";
import { observeResize } from "@utils/observe-resize";
import type { ConfigService } from "@services/config-service";
import type { VisualService } from "@display/services/visual-service";
import type { ImageLayerState } from "@types";
import { ImageCache, drawLayers } from "@utils/canvas-renderer";
import { Logger } from "@utils/logger";
// @ts-expect-error — Bun imports CSS as text
import visualRendererCss from "./visual-renderer.css" with { type: "text" };
// @ts-expect-error — Bun imports CSS as text
import commonCss from "@styles/common.css" with { type: "text" };

/**
 * Visual renderer component
 *
 * Renders image layers on full-screen canvas with transforms and effects.
 * Uses animationFrameScheduler to coalesce rapid state updates into a
 * single render per frame.
 */
export class VisualRenderer extends BaseComponent {
    private logger = new Logger("VisualRenderer");
    private canvas: HTMLCanvasElement | null = null;
    private ctx: CanvasRenderingContext2D | null = null;
    private imageCache!: ImageCache;
    private latestLayers: Map<string, ImageLayerState> = new Map();

    override connectedCallback(): void {
        super.connectedCallback();

        const config = ServiceRegistry.get<ConfigService>("ConfigService");
        this.imageCache = new ImageCache(config.getApiUrl());

        this.adoptStyles(cssSheet(commonCss), cssSheet(visualRendererCss));

        this.render();
        this.setupCanvas();

        if (this.shadowRoot?.host) {
            this.subscribe(observeResize(this.shadowRoot.host), () =>
                this.resizeCanvas(),
            );
        }

        const visualService =
            ServiceRegistry.get<VisualService>("VisualService");

        this.subscribe(
            visualService.getLayers$().pipe(observeOn(animationFrameScheduler)),
            (layers) => {
                this.latestLayers = layers;
                this.drawFrame();
            },
        );
    }
    protected override render(): void {
        this.shadowRoot!.innerHTML = `
            <canvas></canvas>
        `;
    }

    private setupCanvas(): void {
        this.canvas = this.shadowRoot!.querySelector("canvas");
        if (!this.canvas) {
            return;
        }

        this.ctx = this.canvas.getContext("2d");
        if (!this.ctx) {
            return;
        }

        this.resizeCanvas();
    }

    private resizeCanvas(): void {
        if (!this.canvas || !this.shadowRoot?.host) {
            return;
        }

        const rect = this.shadowRoot.host.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;

        this.drawFrame();
    }

    private drawFrame(): void {
        if (!this.ctx || !this.canvas) {
            return;
        }

        drawLayers(
            this.ctx,
            this.canvas,
            this.latestLayers,
            this.imageCache,
        ).catch((error) => {
            this.logger.error("Render failed", { error });
        });
    }
}
