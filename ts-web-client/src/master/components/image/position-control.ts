import { BaseComponent } from "@components/base/base-component";
import { ServiceRegistry } from "@services/service-registry";
import type { ImageToolbarService, ToolbarPosition, ImageDimensions } from "@master/services/image-toolbar-service";
import type { AspectRatioMode } from "@types";
import { colors, spacing, borderRadius } from "@styles/theme";
import { map, distinctUntilChanged, filter } from "rxjs";

/**
 * Visual position control for image placement
 *
 * Displays a 16:9 outer rectangle (display) with a draggable inner rectangle (image).
 * The inner rectangle visualization changes based on aspect ratio mode:
 * - Cover: extends beyond bounds (dashed overflow)
 * - Contain: fits within bounds (solid fill)
 *
 * @fires position-change - When position changes via drag
 *   - detail.position: ToolbarPosition (x, y as 0-1 values)
 */
export class PositionControl extends BaseComponent {
    private canvas: HTMLCanvasElement | null = null;
    private ctx: CanvasRenderingContext2D | null = null;
    private imageToolbarService!: ImageToolbarService;

    private isDragging = false;
    private position: ToolbarPosition = { x: 0.5, y: 0.5 };
    private aspectRatio: AspectRatioMode = "contain";
    private imageDimensions: ImageDimensions | null = null;
    private scale: number = 1.0;

    private readonly PADDING = 8;
    private readonly HANDLE_RADIUS = 6;

    override connectedCallback(): void {
        super.connectedCallback();

        this.imageToolbarService = ServiceRegistry.get<ImageToolbarService>("ImageToolbarService");

        this.render();
        this.setupCanvas();
        this.setupEventListeners();
        this.setupSubscriptions();
        this.draw();
    }

    protected override getStyles(): string {
        return `
            :host {
                display: block;
            }

            .position-control {
                background: ${colors.gray[900]};
                border-radius: ${borderRadius.md};
                padding: ${spacing.sm};
            }

            canvas {
                display: block;
                width: 100%;
                cursor: grab;
                border-radius: ${borderRadius.sm};
            }

            canvas.dragging {
                cursor: grabbing;
            }

            .label {
                font-size: 0.625rem;
                color: ${colors.gray[500]};
                text-align: center;
                margin-top: ${spacing.xs};
            }
        `;
    }

    protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.innerHTML = `
            ${this.styleTag(this.getStyles())}

            <div class="position-control">
                <canvas id="position-canvas"></canvas>
                <div class="label">Drag to position</div>
            </div>
        `;
    }

    private setupCanvas(): void {
        this.canvas = this.shadowRoot?.querySelector("#position-canvas") as HTMLCanvasElement;
        if (!this.canvas) {
            return;
        }

        this.ctx = this.canvas.getContext("2d");

        const container = this.canvas.parentElement;
        if (!container) {
            return;
        }

        const width = container.clientWidth - (this.PADDING * 2);
        const height = Math.round(width * (9 / 16));

        this.canvas.width = width * window.devicePixelRatio;
        this.canvas.height = height * window.devicePixelRatio;
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;

        this.ctx?.scale(window.devicePixelRatio, window.devicePixelRatio);
    }

    private setupEventListeners(): void {
        if (!this.canvas) {
            return;
        }

        this.canvas.addEventListener("mousedown", this.handleMouseDown);
        this.canvas.addEventListener("dblclick", this.handleDoubleClick);
        this.canvas.addEventListener("touchstart", this.handleTouchStart, { passive: false });
    }

    private setupSubscriptions(): void {
        const settings$ = this.imageToolbarService.getSettings$();

        // Aspect ratio changes
        this.subscribe(
            settings$.pipe(
                map((s) => s.aspectRatio),
                distinctUntilChanged()
            ),
            (aspectRatio) => {
                this.aspectRatio = aspectRatio;
                this.draw();
            }
        );

        // External position updates (from canvas drag)
        this.subscribe(
            settings$.pipe(
                map((s) => s.position),
                distinctUntilChanged((a, b) => a.x === b.x && a.y === b.y),
                filter(() => !this.isDragging)
            ),
            (position) => {
                this.position = { ...position };
                this.draw();
            }
        );

        // Image dimensions changes (from drag)
        this.subscribe(
            settings$.pipe(
                map((s) => s.imageDimensions),
                distinctUntilChanged((a, b) => a?.width === b?.width && a?.height === b?.height)
            ),
            (dimensions) => {
                this.imageDimensions = dimensions;

                if (!dimensions) {
                    this.position = { x: 0.5, y: 0.5 };
                    this.emitChange();
                }

                this.draw();
            }
        );

        // Scale changes (from wheel/pinch during drag)
        this.subscribe(
            settings$.pipe(
                map((s) => s.scale),
                distinctUntilChanged()
            ),
            (scale) => {
                this.scale = scale;
                this.draw();
            }
        );
    }

    private handleMouseDown = (e: MouseEvent): void => {
        e.preventDefault();
        this.startDrag(e.clientX, e.clientY);

        document.addEventListener("mousemove", this.handleMouseMove);
        document.addEventListener("mouseup", this.handleMouseUp);
    };

    private handleTouchStart = (e: TouchEvent): void => {
        const touch = e.touches[0];
        if (!touch) {
            return;
        }

        e.preventDefault();
        this.startDrag(touch.clientX, touch.clientY);

        document.addEventListener("touchmove", this.handleTouchMove, { passive: false });
        document.addEventListener("touchend", this.handleTouchEnd);
        document.addEventListener("touchcancel", this.handleTouchEnd);
    };

    private handleDoubleClick = (): void => {
        this.position = { x: 0.5, y: 0.5 };
        this.draw();
        this.emitChange();
    };

    private startDrag(clientX: number, clientY: number): void {
        this.isDragging = true;
        this.canvas?.classList.add("dragging");
        this.updatePositionFromClient(clientX, clientY);
    }

    private handleMouseMove = (e: MouseEvent): void => {
        if (!this.isDragging) {
            return;
        }

        e.preventDefault();
        this.updatePositionFromClient(e.clientX, e.clientY);
    };

    private handleTouchMove = (e: TouchEvent): void => {
        if (!this.isDragging) {
            return;
        }

        const touch = e.touches[0];
        if (!touch) {
            return;
        }

        e.preventDefault();
        this.updatePositionFromClient(touch.clientX, touch.clientY);
    };

    private handleMouseUp = (): void => {
        this.endDrag();

        document.removeEventListener("mousemove", this.handleMouseMove);
        document.removeEventListener("mouseup", this.handleMouseUp);
    };

    private handleTouchEnd = (): void => {
        this.endDrag();

        document.removeEventListener("touchmove", this.handleTouchMove);
        document.removeEventListener("touchend", this.handleTouchEnd);
        document.removeEventListener("touchcancel", this.handleTouchEnd);
    };

    private endDrag(): void {
        this.isDragging = false;
        this.canvas?.classList.remove("dragging");
        this.emitChange();
    }

    private updatePositionFromClient(clientX: number, clientY: number): void {
        if (!this.canvas) {
            return;
        }

        const rect = this.canvas.getBoundingClientRect();
        const x = (clientX - rect.left) / rect.width;
        const y = (clientY - rect.top) / rect.height;

        this.position = { x, y };

        this.draw();
    }

    private draw(): void {
        if (!this.ctx || !this.canvas) {
            return;
        }

        const width = this.canvas.width / window.devicePixelRatio;
        const height = this.canvas.height / window.devicePixelRatio;

        this.ctx.clearRect(0, 0, width, height);

        this.drawOuterRect(width, height);
        this.drawInnerRect(width, height);
        this.drawHandle(width, height);
    }

    private drawOuterRect(width: number, height: number): void {
        if (!this.ctx) {
            return;
        }

        this.ctx.strokeStyle = colors.gray[600];
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(1, 1, width - 2, height - 2);

        this.ctx.fillStyle = colors.gray[800];
        this.ctx.fillRect(2, 2, width - 4, height - 4);
    }

    private drawInnerRect(width: number, height: number): void {
        if (!this.ctx) {
            return;
        }

        let innerWidth: number;
        let innerHeight: number;

        if (this.imageDimensions) {
            // Use actual image aspect ratio
            const imageRatio = this.imageDimensions.width / this.imageDimensions.height;
            const canvasRatio = width / height;

            if (this.aspectRatio === "cover") {
                // Image covers entire canvas (some parts may extend beyond)
                if (imageRatio > canvasRatio) {
                    innerHeight = height;
                    innerWidth = height * imageRatio;
                } else {
                    innerWidth = width;
                    innerHeight = width / imageRatio;
                }
            } else {
                // Contain: image fits within canvas (some canvas may be empty)
                if (imageRatio > canvasRatio) {
                    innerWidth = width * 0.8;
                    innerHeight = innerWidth / imageRatio;
                } else {
                    innerHeight = height * 0.8;
                    innerWidth = innerHeight * imageRatio;
                }
            }

            // Apply scale factor
            innerWidth *= this.scale;
            innerHeight *= this.scale;
        } else {
            // Fallback to current hardcoded behavior when no image
            if (this.aspectRatio === "cover") {
                innerWidth = width * 1.3;
                innerHeight = height * 1.3;
            } else {
                innerWidth = width * 0.6;
                innerHeight = height * 0.6;
            }
        }

        // Position by center: the position represents where the
        // image center sits on the display canvas
        const centerX = this.position.x * width;
        const centerY = this.position.y * height;
        const innerX = centerX - innerWidth / 2;
        const innerY = centerY - innerHeight / 2;

        // Clip the fill to the outer rect, but draw the stroke unclipped
        // so the user can see the full image extent when it goes off-canvas
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(2, 2, width - 4, height - 4);
        this.ctx.clip();

        this.ctx.fillStyle = `${colors.blue[500]}40`;
        this.ctx.fillRect(innerX, innerY, innerWidth, innerHeight);

        this.ctx.restore();

        // Draw border (unclipped — shows image bounds outside canvas)
        this.ctx.setLineDash([4, 4]);
        this.ctx.strokeStyle = colors.blue[400];
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(innerX, innerY, innerWidth, innerHeight);
        this.ctx.setLineDash([]);
    }

    private drawHandle(width: number, height: number): void {
        if (!this.ctx) {
            return;
        }

        const centerX = this.position.x * width;
        const centerY = this.position.y * height;

        this.ctx.fillStyle = colors.blue[500];
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, this.HANDLE_RADIUS, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.strokeStyle = colors.white;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, this.HANDLE_RADIUS, 0, Math.PI * 2);
        this.ctx.stroke();
    }

    private emitChange(): void {
        this.dispatchEvent(
            new CustomEvent("position-change", {
                detail: { position: { ...this.position } },
                bubbles: true,
                composed: true,
            }),
        );
    }
}
