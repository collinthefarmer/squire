import { BaseComponent } from "@components/base/base-component";
import { colors, borderRadius } from "@styles/theme";

/**
 * Scaled iframe preview of the display client.
 *
 * Embeds the display client in an iframe at 1920×1080 native resolution,
 * then CSS-scales it to fit the container width. A ResizeObserver keeps
 * the scale in sync as the container resizes.
 *
 * Exposes wrapper geometry methods so parent components can convert
 * screen coordinates to display-space positions.
 *
 * @example
 * ```html
 * <iframe-preview></iframe-preview>
 * ```
 */
export class IframePreview extends BaseComponent {
    private resizeObserver: ResizeObserver | null = null;

    private readonly PREVIEW_WIDTH = 1920;
    private readonly PREVIEW_HEIGHT = 1080;

    override connectedCallback(): void {
        super.connectedCallback();

        this.render();
        this.setupResizeObserver();
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.resizeObserver?.disconnect();
    }

    protected override getStyles(): string {
        return `
            :host {
                display: block;
                position: relative;
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
        `;
    }

    protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.innerHTML = `
            ${this.styleTag(this.getStyles())}

            <div class="iframe-wrapper">
                <iframe
                    src="http://localhost:3001"
                    title="Display Preview"
                    loading="lazy"
                ></iframe>
                <slot></slot>
            </div>
        `;
    }

    /**
     * Get the bounding rect of the iframe wrapper element.
     * Used by parent for screen-to-display coordinate conversion.
     */
    getWrapperRect(): DOMRect | null {
        const wrapper = this.shadowRoot?.querySelector(".iframe-wrapper");
        if (!wrapper) {
            return null;
        }
        return wrapper.getBoundingClientRect();
    }

    /**
     * Get the current preview scale factor (container width / 1920).
     */
    getPreviewScale(): number {
        const wrapper = this.shadowRoot?.querySelector(".iframe-wrapper") as HTMLElement;
        if (!wrapper) {
            return 0.5;
        }
        return wrapper.clientWidth / this.PREVIEW_WIDTH;
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

        const scale = wrapper.clientWidth / this.PREVIEW_WIDTH;
        iframe.style.transform = `scale(${scale})`;
    }
}
