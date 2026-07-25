/**
 * Minimal Web Component base class
 *
 * Bridges lit-html templates with RxJS subscriptions.
 * Provides:
 * - Shadow DOM creation
 * - subscribe() with automatic cleanup on disconnect
 * - update() that calls lit-html render()
 * - Style sheet adoption
 *
 * No decorators, no reactive properties, no framework.
 */

import { render, type TemplateResult } from "lit-html";
import { Subject, type Observable, type Subscription } from "rxjs";
import { takeUntil } from "rxjs/operators";

export abstract class BaseComponent extends HTMLElement {
    private destroy$ = new Subject<void>();
    private subscriptions: Subscription[] = [];

    constructor() {
        super();
        this.attachShadow({ mode: "open" });
    }

    /**
     * Return the component's template.
     * Called by update() to render into the shadow root.
     */
    protected abstract template(): TemplateResult;

    /**
     * Subscribe to an observable with automatic cleanup on disconnect.
     */
    protected subscribe<T>(
        observable: Observable<T>,
        handler: (value: T) => void,
    ): void {
        const sub = observable
            .pipe(takeUntil(this.destroy$))
            .subscribe(handler);

        this.subscriptions.push(sub);
    }

    /**
     * Render the template into the shadow root.
     * Call this when state changes require a re-render.
     */
    protected update(): void {
        render(this.template(), this.shadowRoot!);
    }

    /**
     * Adopt CSS style sheets into the shadow root.
     */
    protected adoptStyles(...styles: Array<CSSStyleSheet | string>): void {
        const sheets: CSSStyleSheet[] = styles.map((s) => {
            if (s instanceof CSSStyleSheet) {
                return s;
            }

            const sheet = new CSSStyleSheet();
            sheet.replaceSync(s);
            return sheet;
        });

        this.shadowRoot!.adoptedStyleSheets = sheets;
    }

    connectedCallback(): void {
        // Re-create destroy$ if previously disconnected
        if (this.destroy$.closed) {
            this.destroy$ = new Subject<void>();
        }
    }

    disconnectedCallback(): void {
        this.destroy$.next();

        for (const sub of this.subscriptions) {
            sub.unsubscribe();
        }

        this.subscriptions = [];
    }
}
