import { BaseComponent } from "@components/base/base-component";
import { colors, spacing, borderRadius, fontSize, transitions } from "@styles/theme";

interface TabDefinition {
    id: string;
    label: string;
}

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

        this.render();
        this.setupTabListeners();
        this.updateVisibility();
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.render();
    }

    protected override getStyles(): string {
        return `
            :host {
                display: flex;
                flex-direction: column;
                min-height: 0;
            }

            .tab-bar {
                display: flex;
                gap: ${spacing.xs};
                padding: 0 ${spacing.xs};
                border-bottom: 1px solid ${colors.gray[700]};
                margin-bottom: ${spacing.md};
                flex-shrink: 0;
            }

            .tab-btn {
                background: transparent;
                border: none;
                border-bottom: 2px solid transparent;
                color: ${colors.gray[500]};
                cursor: pointer;
                padding: ${spacing.sm} ${spacing.md};
                font-size: ${fontSize.sm};
                font-weight: 500;
                transition: ${transitions.fast};
                margin-bottom: -1px;
            }

            .tab-btn:hover {
                color: ${colors.gray[200]};
            }

            .tab-btn.active {
                color: ${colors.blue[400]};
                border-bottom-color: ${colors.blue[400]};
            }

            .tab-content {
                flex: 1;
                min-height: 0;
                overflow: hidden;
            }

            .tab-panel {
                display: none;
                height: 100%;
            }

            .tab-panel.active {
                display: flex;
                flex-direction: column;
                gap: ${spacing.md};
            }
        `;
    }

    protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        const tabButtons = this.tabs.map((tab) =>
            `<button
                class="tab-btn ${tab.id === this.activeTab ? "active" : ""}"
                data-tab="${tab.id}"
                type="button"
            >${tab.label}</button>`,
        ).join("");

        const tabPanels = this.tabs.map((tab) =>
            `<div class="tab-panel ${tab.id === this.activeTab ? "active" : ""}">
                <slot name="${tab.id}"></slot>
            </div>`,
        ).join("");

        this.shadowRoot.innerHTML = `
            ${this.styleTag(this.getStyles())}

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
}
