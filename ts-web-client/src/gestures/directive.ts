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
import { merge, type Observable, type Subscription } from "rxjs";
import { finalize, ignoreElements, share, tap } from "rxjs/operators";
import { gestures } from "./coordination";
import { pointers$ } from "./pointers";
import { GESTURE_ATTR } from "./gesture-styles";
import type { GestureSource, Recognizer } from "./recognizers/recognizer";

// ── Shared source per element ─────────────────────────────────

type ElementBinding = {
    source: GestureSource;
    /**
     * Never emits — it exists for its effect. Merging it into each
     * gesture subscription refcounts it: the attribute is driven for
     * as long as any recognizer is bound, and cleared when the last
     * one goes away.
     */
    reflect$: Observable<never>;
    /**
     * Custom properties written by the running gesture. Shared across
     * every recognizer bound to the element, since only one of them
     * holds the pointers at a time.
     */
    vars: Set<string>;
};

const bindings = new WeakMap<Element, ElementBinding>();

function bindingFor(el: HTMLElement): ElementBinding {
    let binding = bindings.get(el);

    if (!binding) {
        // The DOM binding lives here; coordination just consumes the stream.
        const source = gestures(pointers$(el, { gate: true }));
        const vars = new Set<string>();

        binding = { source, vars, reflect$: reflectAttribute(source, el, vars) };
        bindings.set(el, binding);
    }

    return binding;
}

/**
 * Mirrors the active gesture onto the element as an attribute, so
 * styling is a pure CSS concern: `[data-gesture="drag"] { ... }`.
 *
 * Deliberately outside the render loop. Routing this through
 * component state would mean a full lit-html render per pointer
 * frame to change one attribute — the directive already owns the
 * element, so it writes directly, the way ref() does.
 */
function reflectAttribute(
    source: GestureSource,
    el: HTMLElement,
    vars: Set<string>,
): Observable<never> {
    return source.active$.pipe(
        tap((name) => {
            clearVars(el, vars);

            if (name === null) {
                el.removeAttribute(GESTURE_ATTR);
                return;
            }

            el.setAttribute(GESTURE_ATTR, name);
        }),
        finalize(() => {
            clearVars(el, vars);
            el.removeAttribute(GESTURE_ATTR);
        }),
        ignoreElements(),
        share(),
    );
}

/**
 * Custom properties are scoped to the attribute's presence — CSS
 * should only read them from inside a `[data-gesture=...]` rule.
 *
 * Clearing happens on each transition rather than at gesture end
 * because the marker subscription and the consumer's subscription
 * observe the gesture stream independently, and the marker sees
 * completion first. A trailing end event can therefore write after
 * the attribute is gone. Those values are inert — no selector
 * matches — and the next gesture clears them before setting its own.
 */
function writeVars(
    el: HTMLElement,
    vars: Set<string>,
    next: Record<string, string>,
): void {
    for (const [property, value] of Object.entries(next)) {
        el.style.setProperty(property, value);
        vars.add(property);
    }
}

function clearVars(el: HTMLElement, vars: Set<string>): void {
    for (const property of vars) {
        el.style.removeProperty(property);
    }

    vars.clear();
}

// ── Directive ─────────────────────────────────────────────────

class GestureDirective extends AsyncDirective {
    private subscription: Subscription | null = null;
    private element: HTMLElement | null = null;
    private recognizer: Recognizer<unknown> | null = null;
    private handler: ((event: unknown) => void) | null = null;
    private toCssVars: ((event: unknown) => Record<string, string>) | null =
        null;

    override render<T>(
        _recognizer: Recognizer<T>,
        _handler: (event: T) => void,
        _toCssVars?: (event: T) => Record<string, string>,
    ) {
        return nothing;
    }

    override update<T>(
        part: ElementPart,
        [recognizer, handler, toCssVars]: [
            Recognizer<T>,
            (event: T) => void,
            ((event: T) => Record<string, string>)?,
        ],
    ) {
        const el = part.element as HTMLElement;

        // Both are re-read every render — the subscription calls
        // through the fields rather than closing over them, so a
        // handler capturing fresh component state stays current
        // without rebinding the gesture.
        this.handler = handler as (event: unknown) => void;
        this.toCssVars =
            (toCssVars as ((event: unknown) => Record<string, string>)) ?? null;

        if (this.subscription && el === this.element) {
            return nothing;
        }

        this.recognizer = recognizer;

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

        const el = this.element;
        const { source, reflect$, vars } = bindingFor(el);

        // on() registers the recognizer synchronously here, before
        // reflect$ makes the shared competition hot — otherwise the
        // first pointer sequence would find no candidates.
        const gesture$ = source.on(this.recognizer);

        // reflect$ leads the merge so the attribute is set before the
        // first event lands, and the clear it performs can't wipe
        // properties this gesture has already written.
        this.subscription = merge(reflect$, gesture$).subscribe((event) => {
            if (this.toCssVars) writeVars(el, vars, this.toCssVars(event));

            this.handler?.(event);
        });
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
    toCssVars?: (event: T) => Record<string, string>,
) => ReturnType<typeof _onGesture>;
