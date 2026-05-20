import { BaseComponent } from "@components/base/base-component";
import { cssSheet } from "@styles/adopt-styles";
import { ServiceRegistry } from "@services/service-registry";
import { TOKENS } from "@services/service-tokens";
import type { SceneService } from "@master/services/scene-service";
import type { SceneFile } from "@master/services/scene-types";
// @ts-expect-error — Bun imports CSS as text
import sceneListCss from "./scene-list.css" with { type: "text" };
// @ts-expect-error — Bun imports CSS as text
import commonCss from "@styles/common.css" with { type: "text" };

const DOMAIN_ICONS: Record<string, string> = {
    image: "\u{1F5BC}",
    audio: "\u{266A}",
    clock: "\u{23F1}",
    time: "\u{23F0}",
};

/**
 * List of saved scenes with load and delete actions.
 */
export class SceneList extends BaseComponent {
    private sceneService!: SceneService;

    override connectedCallback(): void {
        super.connectedCallback();

        this.sceneService = ServiceRegistry.get(TOKENS.SceneService);

        this.adoptStyles(cssSheet(commonCss), cssSheet(sceneListCss));
        this.render();

        this.subscribe(this.sceneService.getScenes$(), (scenes) => {
            this.renderList(scenes);
        });
    }

    protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.innerHTML = `<div class="scene-list" id="list"></div>`;
    }

    private renderList(scenes: SceneFile[]): void {
        const list = this.shadowRoot?.querySelector("#list");
        if (!list) {
            return;
        }

        if (scenes.length === 0) {
            list.innerHTML = '<div class="empty">No saved scenes</div>';
            return;
        }

        list.innerHTML = "";

        for (const scene of scenes) {
            const item = document.createElement("div");
            item.className = "scene-item";

            const domainIcons = scene.includedDomains
                .map((d) => DOMAIN_ICONS[d] ?? d)
                .join(" ");

            item.innerHTML = `
                <span class="scene-name">${scene.name}</span>
                <span class="scene-domains">${domainIcons}</span>
                <div class="scene-actions">
                    <button class="secondary load-btn" type="button">Load</button>
                    <button class="danger delete-btn" type="button">X</button>
                </div>
            `;

            const loadBtn = item.querySelector(".load-btn") as HTMLButtonElement;
            loadBtn.addEventListener("click", () => {
                this.sceneService.loadScene(scene.id);
            });

            const deleteBtn = item.querySelector(".delete-btn") as HTMLButtonElement;
            deleteBtn.addEventListener("click", () => {
                this.sceneService.deleteScene(scene.id);
            });

            list.appendChild(item);
        }
    }
}
