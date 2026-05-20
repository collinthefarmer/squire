import { BaseComponent } from "@components/base/base-component";
import { cssSheet } from "@styles/adopt-styles";
import { ServiceRegistry } from "@services/service-registry";
import { TOKENS } from "@services/service-tokens";
import type {
    ContextMenuService,
    MenuState,
} from "@services/context-menu-service";

// @ts-expect-error — Bun imports CSS as text
import contextMenuCss from "./context-menu.css" with { type: "text" };
// @ts-expect-error — Bun imports CSS as text
import commonCss from "@styles/common.css" with { type: "text" };

/**
 * Floating context menu component.
 *
 * Appended to document.body so it renders above all Shadow DOM.
 * Subscribes to ContextMenuService for menu state.
 */
export class ContextMenu extends BaseComponent {
    private contextMenuService!: ContextMenuService;

    override connectedCallback(): void {
        super.connectedCallback();

        this.contextMenuService =
            ServiceRegistry.get(TOKENS.ContextMenuService);

        this.adoptStyles(cssSheet(commonCss), cssSheet(contextMenuCss));
        this.render();
        this.setupSubscriptions();
        this.setupDismissListeners();
    }

    protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.innerHTML = `<div class="menu" id="menu"></div>`;
    }

    private setupSubscriptions(): void {
        this.subscribe(this.contextMenuService.getState$(), (state) => {
            this.updateMenu(state);
        });
    }

    private updateMenu(state: MenuState): void {
        this.classList.toggle("visible", state.visible);

        if (!state.visible) {
            return;
        }

        const menu = this.shadowRoot?.querySelector("#menu") as HTMLElement;
        if (!menu) {
            return;
        }

        // Render items
        menu.innerHTML = "";

        for (const item of state.items) {
            if (item.separator) {
                const sep = document.createElement("div");
                sep.className = "separator";
                menu.appendChild(sep);
            }

            const btn = document.createElement("button");
            btn.className = `menu-item${item.danger ? " danger" : ""}${item.disabled ? " disabled" : ""}`;

            if (item.icon) {
                const icon = document.createElement("span");
                icon.className = "item-icon";
                icon.textContent = item.icon;
                btn.appendChild(icon);
            }

            const label = document.createElement("span");
            label.className = "item-label";
            label.textContent = item.label;
            btn.appendChild(label);

            if (item.suffix) {
                const suffix = document.createElement("span");
                suffix.className = "item-suffix";
                suffix.textContent = item.suffix;
                btn.appendChild(suffix);
            }

            btn.addEventListener("click", () => {
                if (!item.disabled) {
                    item.action();
                    this.contextMenuService.hide();
                }
            });

            menu.appendChild(btn);
        }

        // Position — adjust if overflowing viewport
        this.positionMenu(state.x, state.y, menu);
    }

    private positionMenu(x: number, y: number, menu: HTMLElement): void {
        this.style.left = `${x}px`;
        this.style.top = `${y}px`;

        // Wait for layout, then adjust if overflowing
        requestAnimationFrame(() => {
            const rect = menu.getBoundingClientRect();
            const viewW = window.innerWidth;
            const viewH = window.innerHeight;

            if (rect.right > viewW) {
                this.style.left = `${x - rect.width}px`;
            }

            if (rect.bottom > viewH) {
                this.style.top = `${y - rect.height}px`;
            }
        });
    }

    private setupDismissListeners(): void {
        document.addEventListener("click", (e) => {
            if (!this.contains(e.target as Node)) {
                this.contextMenuService.hide();
            }
        });

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                this.contextMenuService.hide();
            }
        });

        document.addEventListener(
            "scroll",
            () => {
                this.contextMenuService.hide();
            },
            { capture: true },
        );
    }
}
