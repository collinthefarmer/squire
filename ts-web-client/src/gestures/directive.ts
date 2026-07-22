/**
 * lit-html directive for declarative gesture binding.
 *
 * Wraps the gesture coordination layer so that recognizers
 * can be bound directly in templates:
 *
 *   <div
 *       ${onGesture(tap(), (e) => this.handleTap(e))}
 *       ${onGesture(drag(), (e) => this.handleDrag(e))}
 *   >
 *
 * Multiple onGesture directives on the same element share a
 * single gestures() source, so recognizers compete as expected.
 * Subscriptions are torn down on disconnect and restored on
 * reconnect.
 */

import { nothing } from "lit-html";
import { AsyncDirective } from "lit-html/async-directive.js";
import { directive, type ElementPart } from "lit-html/directive.js";
import type { Subscription } from "rxjs";
import { gestures } from "./coordination";
import type { GestureSource, Recognizer } from "./recognizers/recognizer";

// ── Shared source per element ─────────────────────────────────

const sources = new WeakMap<Element, GestureSource>();

function sourceFor(el: HTMLElement): GestureSource {
    let source = sources.get(el);

    if (!source) {
        source = gestures(el);
        sources.set(el, source);
    }

    return source;
}

// ── Directive ─────────────────────────────────────────────────

class GestureDirective extends AsyncDirective {
    private subscription: Subscription | null = null;
    private element: HTMLElement | null = null;
    private recognizer: Recognizer<unknown> | null = null;
    private handler: ((event: unknown) => void) | null = null;

    override render<T>(
        _recognizer: Recognizer<T>,
        _handler: (event: T) => void,
    ) {
        return nothing;
    }

    override update<T>(
        part: ElementPart,
        [recognizer, handler]: [Recognizer<T>, (event: T) => void],
    ) {
        const el = part.element as HTMLElement;

        this.recognizer = recognizer;
        this.handler = handler as (event: unknown) => void;

        if (el !== this.element) {
            this.teardown();
            this.element = el;
        }

        this.bind();

        return nothing;
    }

    protected override disconnected(): void {
        this.teardown();
    }

    protected override reconnected(): void {
        this.bind();
    }

    private bind(): void {
        this.subscription?.unsubscribe();

        if (!this.element || !this.recognizer || !this.handler) return;

        const source = sourceFor(this.element);

        this.subscription = source
            .on(this.recognizer)
            .subscribe(this.handler);
    }

    private teardown(): void {
        this.subscription?.unsubscribe();
        this.subscription = null;
    }
}

/**
 * Bind a gesture recognizer to an element declaratively.
 * Stack multiple directives for competing recognizers:
 *
 *   <div
 *       ${onGesture(tap(), (e) => this.handleTap(e))}
 *       ${onGesture(drag(), (e) => this.handleDrag(e))}
 *       ${onGesture(pinch(), (e) => this.handlePinch(e))}
 *   >
 */

// directive() erases the generic T from render<T>(), collapsing
// it to unknown. Re-assert the intended generic signature so
// callers get proper inference from recognizer → handler.
const _onGesture = directive(GestureDirective);

export const onGesture = _onGesture as <T>(
    recognizer: Recognizer<T>,
    handler: (event: T) => void,
) => ReturnType<typeof _onGesture>;
