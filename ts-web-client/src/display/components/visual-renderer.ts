import { BaseComponent } from "@components/base/base-component";
import { ServiceRegistry } from "@services/service-registry";
import type { ConfigService } from "@services/config-service";
import type { VisualService } from "@display/services/visual-service";
import type { ImageLayerState } from "@types";
import { ImageCache, drawLayers } from "@utils/canvas-renderer";
import { Logger } from "@utils/logger";
import { colors } from "@styles/theme";

/**
 * Visual renderer component
 *
 * Renders image layers on full-screen canvas with transforms and effects.
 * Uses requestAnimationFrame to coalesce rapid state updates (e.g.,
 * batched replay events) into a single render per frame.
 */
export class VisualRenderer extends BaseComponent {
    private logger = new Logger("VisualRenderer");
    private canvas: HTMLCanvasElement | null = null;
    private ctx: CanvasRenderingContext2D | null = null;
    private imageCache!: ImageCache;
    private resizeObserver: ResizeObserver | null = null;
    private latestLayers: Map<string, ImageLayerState> = new Map();
    private renderFrameId: number | null = null;

    override connectedCallback(): void {
        super.connectedCallback();

        const config = ServiceRegistry.get<ConfigService>("ConfigService");
        this.imageCache = new ImageCache(config.getApiUrl());

        this.render();
        this.setupCanvas();
        this.observeResize();

        const visualService = ServiceRegistry.get<VisualService>("VisualService");

        this.subscribe(visualService.getLayers$(), (layers) => {
            this.latestLayers = layers;
            this.requestRender();
        });
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.resizeObserver?.disconnect();

        if (this.renderFrameId !== null) {
            cancelAnimationFrame(this.renderFrameId);
        }
    }

    protected override getStyles(): string {
        return `
            :host {
                display: block;
                position: fixed;
                inset: 0;
                background: ${colors.black};
                z-index: 0;
            }

            canvas {
                width: 100%;
                height: 100%;
                display: block;
            }
        `;
    }

    protected override render(): void {
        this.shadowRoot!.innerHTML = `
            ${this.styleTag(this.getStyles())}
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

    private observeResize(): void {
        this.resizeObserver = new ResizeObserver(() => {
            this.resizeCanvas();
        });

        if (this.shadowRoot?.host) {
            this.resizeObserver.observe(this.shadowRoot.host);
        }
    }

    private resizeCanvas(): void {
        if (!this.canvas || !this.shadowRoot?.host) {
            return;
        }

        const rect = this.shadowRoot.host.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;

        this.requestRender();
    }

    /**
     * Schedule a render on the next animation frame.
     *
     * Multiple calls in the same frame collapse into one render
     * with the latest layer state. This naturally handles batched
     * replay events and rapid live updates.
     */
    private requestRender(): void {
        if (this.renderFrameId !== null) {
            return;
        }

        this.renderFrameId = requestAnimationFrame(async () => {
            this.renderFrameId = null;

            if (!this.ctx || !this.canvas) {
                return;
            }

            try {
                await drawLayers(this.ctx, this.canvas, this.latestLayers, this.imageCache);
            } catch (error) {
                this.logger.error("Render failed", { error });
            }
        });
    }
}
