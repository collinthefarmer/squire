import { BaseComponent } from "@components/base/base-component";
import { cssSheet } from "@styles/adopt-styles";
// @ts-expect-error — Bun imports CSS as text
import scenePanelCss from "./scene-panel.css" with { type: "text" };
// @ts-expect-error — Bun imports CSS as text
import commonCss from "@styles/common.css" with { type: "text" };

/**
 * Collapsible scene management panel for the bottom section.
 *
 * Contains the scene list (left) and save form (right)
 * in a two-column grid when expanded.
 */
export class ScenePanel extends BaseComponent {
    override connectedCallback(): void {
        super.connectedCallback();
        this.adoptStyles(cssSheet(commonCss), cssSheet(scenePanelCss));
        this.render();
        this.setupListeners();
    }

    protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.innerHTML = `
            <div class="panel-header" id="toggle">
                <span class="panel-title">Scenes</span>
                <span class="chevron">&#9662;</span>
            </div>
            <div class="panel-body">
                <scene-list></scene-list>
                <scene-save-form></scene-save-form>
            </div>
        `;
    }

    private setupListeners(): void {
        const toggle = this.shadowRoot?.querySelector("#toggle");
        toggle?.addEventListener("click", () => {
            this.toggleAttribute("expanded");
        });
    }
}
