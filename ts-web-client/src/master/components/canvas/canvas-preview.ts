import { BaseComponent } from "@components/base/base-component";
import { ServiceRegistry } from "@services/service-registry";
import type { MasterVisualService } from "@master/services/visual-service";
import type { ImageToolbarService, ToolbarPosition } from "@master/services/image-toolbar-service";
import { containerStyles, sectionHeaderStyles } from "@styles/common-styles";
import { colors, spacing, borderRadius } from "@styles/theme";

/**
 * Canvas preview component for master client
 *
 * Embeds the display client in an iframe to provide a live preview
 * of what the display shows. This guarantees pixel-perfect parity
 * since it's the actual display client running in a frame.
 *
 * Supports drag-and-drop image placement from the image gallery.
 */
export class CanvasPreview extends BaseComponent {
    private visualService!: MasterVisualService;
    private imageToolbarService!: ImageToolbarService;
    private isDragActive = false;
    private currentDragAsset: string | null = null;
    private resizeObserver: ResizeObserver | null = null;

    private readonly PREVIEW_WIDTH = 1920;
    private readonly PREVIEW_HEIGHT = 1080;

    override connectedCallback(): void {
        super.connectedCallback();

        this.visualService = ServiceRegistry.get<MasterVisualService>("MasterVisualService");
        this.imageToolbarService = ServiceRegistry.get<ImageToolbarService>("ImageToolbarService");

        this.render();
        this.setupResizeObserver();
        this.setupDropZone();
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.resizeObserver?.disconnect();
        this.cleanupDropZone();
    }

    protected override getStyles(): string {
        return `
            :host {
                display: block;
            }

            ${containerStyles()}
            ${sectionHeaderStyles()}

            .preview-container {
                display: flex;
                flex-direction: column;
                gap: ${spacing.md};
            }

            .header {
                font-size: 1.125rem;
            }

            .iframe-wrapper {
                position: relative;
                width: 100%;
                aspect-ratio: 16 / 9;
                background: ${colors.black};
                border-radius: ${borderRadius.md};
                overflow: hidden;
            }

            iframe {
                position: absolute;
                top: 0;
                left: 0;
                width: 1920px;
                height: 1080px;
                border: none;
                display: block;
                transform-origin: top left;
            }

            .drop-zone {
                position: absolute;
                inset: 0;
                display: none;
                align-items: center;
                justify-content: center;
                background: rgba(59, 130, 246, 0.2);
                border: 3px dashed ${colors.blue[500]};
                border-radius: ${borderRadius.md};
                pointer-events: none;
                z-index: 10;
            }

            .drop-zone.active {
                display: flex;
                pointer-events: auto;
            }

            .drop-zone.hover {
                background: rgba(59, 130, 246, 0.4);
                border-color: ${colors.blue[400]};
            }

            .drop-zone-text {
                color: ${colors.white};
                font-size: 1rem;
                font-weight: 500;
                text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
                padding: ${spacing.md};
                background: rgba(0, 0, 0, 0.5);
                border-radius: ${borderRadius.sm};
            }
        `;
    }

    protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.innerHTML = `
            ${this.styleTag(this.getStyles())}

            <div class="container preview-container">
                <div class="section-header header">Display Preview</div>
                <div class="iframe-wrapper">
                    <iframe
                        src="http://localhost:3001"
                        title="Display Preview"
                        loading="lazy"
                    ></iframe>
                    <div class="drop-zone">
                        <span class="drop-zone-text">Drop image here</span>
                    </div>
                </div>
            </div>
        `;
    }

    private setupResizeObserver(): void {
        const wrapper = this.shadowRoot?.querySelector(".iframe-wrapper");
        if (!wrapper) {
            return;
        }

        this.resizeObserver = new ResizeObserver(() => {
            this.updateScale();
        });

        this.resizeObserver.observe(wrapper);
        this.updateScale();
    }

    private updateScale(): void {
        const wrapper = this.shadowRoot?.querySelector(".iframe-wrapper") as HTMLElement;
        const iframe = this.shadowRoot?.querySelector("iframe") as HTMLIFrameElement;
        if (!wrapper || !iframe) {
            return;
        }

        const containerWidth = wrapper.clientWidth;
        const scale = containerWidth / this.PREVIEW_WIDTH;

        iframe.style.transform = `scale(${scale})`;
    }

    private setupDropZone(): void {
        document.addEventListener("drag-start", this.handleDragStart);
        document.addEventListener("drag-move", this.handleDragMove);
        document.addEventListener("drag-end", this.handleDragEnd);
    }

    private cleanupDropZone(): void {
        document.removeEventListener("drag-start", this.handleDragStart);
        document.removeEventListener("drag-move", this.handleDragMove);
        document.removeEventListener("drag-end", this.handleDragEnd);
    }

    private handleDragStart = (e: Event): void => {
        const customEvent = e as CustomEvent;
        const dropZone = this.shadowRoot?.querySelector(".drop-zone");
        if (!dropZone) {
            return;
        }

        this.isDragActive = true;
        this.currentDragAsset = customEvent.detail?.data ?? null;
        dropZone.classList.add("active");

        dropZone.addEventListener("mouseenter", this.handleDropZoneEnter);
        dropZone.addEventListener("mouseleave", this.handleDropZoneLeave);
        dropZone.addEventListener("mouseup", this.handleDrop as EventListener);
        dropZone.addEventListener("touchend", this.handleTouchDrop as EventListener);
    };

    private handleDragEnd = (_e: Event): void => {
        const dropZone = this.shadowRoot?.querySelector(".drop-zone");
        if (!dropZone) {
            return;
        }

        this.isDragActive = false;
        this.currentDragAsset = null;
        dropZone.classList.remove("active", "hover");

        dropZone.removeEventListener("mouseenter", this.handleDropZoneEnter);
        dropZone.removeEventListener("mouseleave", this.handleDropZoneLeave);
        dropZone.removeEventListener("mouseup", this.handleDrop as EventListener);
        dropZone.removeEventListener("touchend", this.handleTouchDrop as EventListener);
    };

    private handleDragMove = (e: Event): void => {
        if (!this.isDragActive) {
            return;
        }

        const customEvent = e as CustomEvent;
        const { x, y } = customEvent.detail;
        const normalizedPos = this.screenToNormalizedPosition(x, y);

        this.imageToolbarService.setPosition(normalizedPos);
    };

    private screenToNormalizedPosition(screenX: number, screenY: number): ToolbarPosition {
        const wrapper = this.shadowRoot?.querySelector(".iframe-wrapper");
        if (!wrapper) {
            return { x: 0.5, y: 0.5 };
        }

        const rect = wrapper.getBoundingClientRect();

        const x = (screenX - rect.left) / rect.width;
        const y = (screenY - rect.top) / rect.height;

        return {
            x: Math.max(0, Math.min(1, x)),
            y: Math.max(0, Math.min(1, y)),
        };
    }

    private handleDropZoneEnter = (): void => {
        const dropZone = this.shadowRoot?.querySelector(".drop-zone");
        dropZone?.classList.add("hover");
    };

    private handleDropZoneLeave = (): void => {
        const dropZone = this.shadowRoot?.querySelector(".drop-zone");
        dropZone?.classList.remove("hover");
    };

    private handleDrop = (e: MouseEvent): void => {
        if (!this.currentDragAsset) {
            return;
        }

        this.visualService.handleImageDrop(
            this.currentDragAsset,
            e.clientX,
            e.clientY,
        );
    };

    private handleTouchDrop = (e: TouchEvent): void => {
        if (!this.currentDragAsset) {
            return;
        }

        const touch = e.changedTouches[0];
        if (!touch) {
            return;
        }

        this.visualService.handleImageDrop(
            this.currentDragAsset,
            touch.clientX,
            touch.clientY,
        );
    };
}
