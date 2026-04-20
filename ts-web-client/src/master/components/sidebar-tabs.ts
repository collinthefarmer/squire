import { BaseComponent } from "@components/base/base-component";
import { cssSheet } from "@styles/adopt-styles";
import { emitDomEvent } from "@utils/dom-events";
// @ts-expect-error — Bun imports CSS as text
import sidebarTabsCss from "./sidebar-tabs.css" with { type: "text" };
// @ts-expect-error — Bun imports CSS as text
import commonCss from "@styles/common.css" with { type: "text" };

interface TabDefinition {
    id: string;
    label: string;
    layout?: string;
}

const DEFAULT_LAYOUT = "minmax(0, 1fr) 1fr";

/**
 * Generic tabbed container for the sidebar
 *
 * Renders a tab bar and shows/hides slotted content by matching
 * named slots to the active tab ID. Components in inactive tabs
 * stay in the DOM — their state and subscriptions are preserved.
 *
 * @example
 * ```html
 * <sidebar-tabs>
 *     <div slot="image">...</div>
 *     <div slot="audio">...</div>
 * </sidebar-tabs>
 * ```
 */
export class SidebarTabs extends BaseComponent {
    private tabs: TabDefinition[] = [];
    private activeTab = "";

    setTabs(tabs: TabDefinition[]): void {
        this.tabs = tabs;
        if (!this.activeTab && tabs.length > 0) {
            this.activeTab = tabs[0]?.id ?? "";
        }

        this.adoptStyles(cssSheet(commonCss), cssSheet(sidebarTabsCss));

        this.render();
        this.setupTabListeners();
        this.updateVisibility();
        this.emitTabChange();
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.render();
    }
    protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        const tabButtons = this.tabs
            .map(
                (tab) =>
                    `<button
                class="tab-btn ${tab.id === this.activeTab ? "active" : ""}"
                data-tab="${tab.id}"
                type="button"
            >${tab.label}</button>`,
            )
            .join("");

        const tabPanels = this.tabs
            .map(
                (tab) =>
                    `<div class="tab-panel ${tab.id === this.activeTab ? "active" : ""}">
                <slot name="${tab.id}"></slot>
            </div>`,
            )
            .join("");

        this.shadowRoot.innerHTML = `
            <div class="tab-bar">${tabButtons}</div>
            <div class="tab-content">${tabPanels}</div>
        `;
    }

    private setupTabListeners(): void {
        if (!this.shadowRoot) {
            return;
        }

        const bar = this.shadowRoot.querySelector(".tab-bar");
        if (!bar) {
            return;
        }

        bar.addEventListener("click", (e) => {
            const target = e.target as HTMLElement;
            const tabId = target.dataset.tab;
            if (!tabId || tabId === this.activeTab) {
                return;
            }

            this.activeTab = tabId;
            this.updateVisibility();
            this.emitTabChange();
        });
    }

    private updateVisibility(): void {
        if (!this.shadowRoot) {
            return;
        }

        const buttons = this.shadowRoot.querySelectorAll(".tab-btn");
        for (const btn of Array.from(buttons)) {
            const el = btn as HTMLElement;
            el.classList.toggle("active", el.dataset.tab === this.activeTab);
        }

        const panels = this.shadowRoot.querySelectorAll(".tab-panel");
        for (const panel of Array.from(panels)) {
            const slot = panel.querySelector("slot");
            const slotName = slot?.getAttribute("name") ?? "";
            panel.classList.toggle("active", slotName === this.activeTab);
        }
    }

    private emitTabChange(): void {
        const tab = this.tabs.find((t) => t.id === this.activeTab);
        emitDomEvent(this, "tab-change", {
            tabId: this.activeTab,
            layout: tab?.layout ?? DEFAULT_LAYOUT,
        });
    }
}
