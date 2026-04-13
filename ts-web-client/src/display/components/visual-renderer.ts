import { BaseComponent } from "@components/base/base-component";
import { ServiceRegistry } from "@services/service-registry";
import type { ConfigService } from "@services/config-service";
import type { VisualService } from "@display/services/visual-service";
import type { ImageLayerState } from "@types";
import { ImageCache, drawLayers } from "@utils/canvas-renderer";
import { colors } from "@styles/theme";

/**
 * Visual renderer component
 *
 * Renders image layers on full-screen canvas with transforms and effects.
 * Uses shared canvas-renderer utilities for drawing logic.
 */
export class VisualRenderer extends BaseComponent {
    private canvas: HTMLCanvasElement | null = null;
    private ctx: CanvasRenderingContext2D | null = null;
    private imageCache!: ImageCache;
    private resizeObserver: ResizeObserver | null = null;

    override connectedCallback(): void {
        super.connectedCallback();

        const config = ServiceRegistry.get<ConfigService>("ConfigService");
        this.imageCache = new ImageCache(config.getApiUrl());

        this.render();
        this.setupCanvas();
        this.observeResize();

        const visualService = ServiceRegistry.get<VisualService>("VisualService");

        this.subscribe(visualService.getLayers$(), (layers) => {
            this.drawAllLayers(layers);
        });
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.resizeObserver?.disconnect();
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

    /**
     * Setup canvas and context
     */
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

    /**
     * Observe container resize
     */
    private observeResize(): void {
        this.resizeObserver = new ResizeObserver(() => {
            this.resizeCanvas();
        });

        if (this.shadowRoot?.host) {
            this.resizeObserver.observe(this.shadowRoot.host);
        }
    }

    /**
     * Resize canvas to match container
     */
    private resizeCanvas(): void {
        if (!this.canvas || !this.shadowRoot?.host) {
            return;
        }

        const rect = this.shadowRoot.host.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;

        // Redraw on resize
        const visualService = ServiceRegistry.get<VisualService>("VisualService");
        this.drawAllLayers(visualService.getLayers());
    }

    /**
     * Draw all image layers using shared utilities
     */
    private async drawAllLayers(layers: Map<string, ImageLayerState>): Promise<void> {
        if (!this.ctx || !this.canvas) {
            return;
        }

        await drawLayers(this.ctx, this.canvas, layers, this.imageCache);
    }
}
