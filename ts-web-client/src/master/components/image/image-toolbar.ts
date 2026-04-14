import { BaseComponent } from "@components/base/base-component";
import { ServiceRegistry } from "@services/service-registry";
import type { ImageToolbarService } from "@master/services/image-toolbar-service";
import type { AspectRatioMode } from "@types";
import { containerStyles, sectionHeaderStyles, labelStyles } from "@styles/common-styles";
import { colors, spacing, borderRadius } from "@styles/theme";

/**
 * Image toolbar container component
 *
 * Provides controls for configuring how dropped images are placed:
 * - Layer selector
 * - Aspect ratio selector (cover/contain)
 * - Visual position control
 *
 * Coordinates child components and updates ImageToolbarService with settings.
 */
export class ImageToolbar extends BaseComponent {
    private imageToolbarService!: ImageToolbarService;

    override connectedCallback(): void {
        super.connectedCallback();

        this.imageToolbarService = ServiceRegistry.get<ImageToolbarService>("ImageToolbarService");

        this.render();
        this.setupEventListeners();
    }

    protected override getStyles(): string {
        return `
            :host {
                display: block;
            }

            ${containerStyles()}
            ${sectionHeaderStyles()}
            ${labelStyles()}

            .toolbar {
                background: ${colors.gray[800]};
                border-radius: ${borderRadius.lg};
                padding: ${spacing.md};
                display: flex;
                flex-direction: column;
                gap: ${spacing.md};
            }

            .section-header {
                margin-bottom: 0;
            }

            .control-group {
                display: flex;
                flex-direction: column;
                gap: ${spacing.xs};
            }

            .control-row {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: ${spacing.sm};
            }

            label {
                font-size: 0.625rem;
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }
        `;
    }

    protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.innerHTML = `
            ${this.styleTag(this.getStyles())}

            <div class="toolbar">
                <div class="section-header">Image Settings</div>

                <div class="control-row">
                    <div class="control-group">
                        <label>Layer</label>
                        <layer-selector></layer-selector>
                    </div>
                    <div class="control-group">
                        <label>Fit</label>
                        <aspect-ratio-selector></aspect-ratio-selector>
                    </div>
                </div>

            </div>
        `;
    }

    private setupEventListeners(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.addEventListener("layer-change", ((e: CustomEvent) => {
            this.imageToolbarService.setLayer(e.detail.layer);
        }) as EventListener);

        this.shadowRoot.addEventListener("aspect-ratio-change", ((e: CustomEvent) => {
            const aspectRatio = e.detail.aspectRatio as AspectRatioMode;
            this.imageToolbarService.setAspectRatio(aspectRatio);
        }) as EventListener);

    }
}
