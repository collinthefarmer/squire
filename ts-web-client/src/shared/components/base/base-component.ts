import { Subject, type Observable } from "rxjs";
import { takeUntil } from "rxjs/operators";

/**
 * Base class for all web components
 *
 * Provides automatic subscription cleanup via takeUntil pattern,
 * template method for render logic, and Shadow DOM setup.
 */
export abstract class BaseComponent<TState = unknown> extends HTMLElement {
    protected destroy$ = new Subject<void>();
    protected cleanup: Array<() => void> = [];

    constructor() {
        super();
        if (!this.shadowRoot) {
            this.attachShadow({ mode: "open" });
        }
    }

    connectedCallback(): void {
        // Subclasses can override and call super
    }

    disconnectedCallback(): void {
        // Cleanup RxJS subscriptions
        this.destroy$.next();
        this.destroy$.complete();

        // Cleanup manual resources
        this.cleanup.forEach((fn) => fn());
        this.cleanup = [];
    }

    /**
     * Subscribe to an observable with automatic cleanup
     *
     * Subscription will be automatically unsubscribed when component disconnects
     */
    protected subscribe<T>(
        observable: Observable<T>,
        callback: (value: T) => void,
    ): void {
        observable
            .pipe(takeUntil(this.destroy$))
            .subscribe(callback.bind(this));
    }

    /**
     * Render method to be implemented by subclasses
     */
    protected abstract render(state?: TState): void;

    /**
     * Get component styles (legacy — use adoptStyles for new components)
     *
     * Override this method to provide component-specific styles.
     * Returns an empty string by default.
     *
     * @returns CSS string to be injected into component's <style> tag
     * @deprecated Use adoptStyles() with CSS file imports instead
     */
    protected getStyles(): string {
        return "";
    }

    /**
     * Helper method to wrap styles in a <style> tag
     *
     * @param styles - CSS string
     * @returns HTML style tag with CSS content
     * @deprecated Use adoptStyles() with CSS file imports instead
     */
    protected styleTag(styles: string): string {
        if (!styles.trim()) {
            return "";
        }
        return `<style>${styles}</style>`;
    }

    /**
     * Adopt constructable stylesheets into this component's Shadow DOM.
     *
     * Stylesheets are shared across all instances of the component,
     * avoiding duplication. Use with `cssSheet()` helper and CSS file imports:
     *
     * @example
     * ```typescript
     * import css from "./my-component.css" with { type: "text" };
     * import { cssSheet } from "@styles/adopt-styles";
     *
     * this.adoptStyles(cssSheet(css));
     * ```
     */
    protected adoptStyles(...sheets: CSSStyleSheet[]): void {
        if (this.shadowRoot) {
            this.shadowRoot.adoptedStyleSheets = sheets;
        }
    }
}
