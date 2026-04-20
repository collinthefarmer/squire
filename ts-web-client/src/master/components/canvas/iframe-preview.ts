import { BaseComponent } from "@components/base/base-component";
import { cssSheet } from "@styles/adopt-styles";
import { ServiceRegistry } from "@services/service-registry";
import { observeResize } from "@utils/observe-resize";
import type { ConfigService } from "@services/config-service";
// @ts-expect-error — Bun imports CSS as text
import iframePreviewCss from "./iframe-preview.css" with { type: "text" };
// @ts-expect-error — Bun imports CSS as text
import commonCss from "@styles/common.css" with { type: "text" };

/**
 * Scaled iframe preview of the display client.
 *
 * Embeds the display client in an iframe at 1920x1080 native resolution,
 * then CSS-scales it to fit the container width. A ResizeObserver keeps
 * the scale in sync as the container resizes.
 *
 * Exposes wrapper geometry methods so parent components can convert
 * screen coordinates to display-space positions.
 */
export class IframePreview extends BaseComponent {
    private config!: ConfigService;

    private readonly PREVIEW_WIDTH = 1920;
    private readonly PREVIEW_HEIGHT = 1080;

    override connectedCallback(): void {
        super.connectedCallback();

        this.config = ServiceRegistry.get<ConfigService>("ConfigService");
        this.adoptStyles(cssSheet(commonCss), cssSheet(iframePreviewCss));

        this.render();

        const wrapper = this.shadowRoot?.querySelector(".iframe-wrapper");
        if (wrapper) {
            this.updateScale();
            this.subscribe(observeResize(wrapper), () => this.updateScale());
        }
    }
    protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.innerHTML = `
            <div class="iframe-wrapper">
                <iframe
                    src="${this.config.getDisplayUrl()}"
                    title="Display Preview"
                    loading="lazy"
                ></iframe>
                <slot></slot>
            </div>
        `;
    }

    getWrapperRect(): DOMRect | null {
        const wrapper = this.shadowRoot?.querySelector(".iframe-wrapper");
        if (!wrapper) {
            return null;
        }
        return wrapper.getBoundingClientRect();
    }

    getPreviewScale(): number {
        const wrapper = this.shadowRoot?.querySelector(
            ".iframe-wrapper",
        ) as HTMLElement;
        if (!wrapper) {
            return 0.5;
        }
        return wrapper.clientWidth / this.PREVIEW_WIDTH;
    }

    private updateScale(): void {
        const wrapper = this.shadowRoot?.querySelector(
            ".iframe-wrapper",
        ) as HTMLElement;
        const iframe = this.shadowRoot?.querySelector(
            "iframe",
        ) as HTMLIFrameElement;
        if (!wrapper || !iframe) {
            return;
        }

        const scale = wrapper.clientWidth / this.PREVIEW_WIDTH;
        iframe.style.transform = `scale(${scale})`;
    }
}
