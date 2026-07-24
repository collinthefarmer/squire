import { html, type TemplateResult } from "lit-html";

import { BaseComponent } from "@core/base-component";
import { drag, tap, onGesture } from "@gestures";
import panelCss from "./sq-settings-panel.css" with { type: "text" };

import type { DragEvent } from "@gestures";

/** Movement before the tab starts pulling the drawer (px). */
const FOLLOW_THRESHOLD = 8;
/** How far a pull must travel to latch — and to unstick — the drawer (px).
 *  Injected as `--settle` so the CSS curve unsticks at the same distance. */
const SETTLE = 40;

/**
 * The design / interface settings drawer.
 *
 * One self-contained piece: it docks at the right edge wider than it
 * shows, so its body overflows off-screen and only the left-edge tab —
 * the sliders button — peeks in. Dragging that tab pulls the whole drawer
 * across; because the gesture and the thing it moves are the same
 * element, the drag drives the host transform directly, no plumbing. A
 * pull that clears the settle distance latches; short of it, the drawer
 * falls back. A tap toggles.
 *
 * The control rows are placeholders for now — the layout and motion are
 * real, the sliders and toggle are not yet wired to the settings service.
 */
export class SqSettingsPanel extends BaseComponent {
    private _open = false;

    override connectedCallback(): void {
        super.connectedCallback();
        this.adoptStyles(panelCss);
        this.style.setProperty("--settle", `${SETTLE}px`);
        this.update();
    }

    protected template(): TemplateResult {
        return html`
            <div
                class="tab"
                role="button"
                tabindex="0"
                aria-label="Design settings"
                aria-expanded=${this._open}
                @keydown=${this.onKey}
                ${onGesture(tap(), () => this.setOpen(!this._open))}
                ${onGesture(
                    drag({ threshold: FOLLOW_THRESHOLD }),
                    (e: DragEvent) => this.onDrag(e),
                )}
            >
                ${SLIDERS_ICON}
            </div>

            <div class="body">
                <header class="head">
                    <h2>Design</h2>
                </header>

                <section class="group" aria-label="Snapping">
                    ${this.row("Snapping")} ${this.row("Grid size")}
                    ${this.row("Rotation")}
                </section>
            </div>
        `;
    }

    private row(label: string): TemplateResult {
        return html`
            <div class="row">
                <span class="label">${label}</span>
                <div class="control placeholder" aria-hidden="true"></div>
            </div>
        `;
    }

    private setOpen(open: boolean): void {
        if (open === this._open) return;
        this._open = open;
        // The slide is a pure CSS concern keyed on :host([open]).
        this.toggleAttribute("open", open);
    }

    private onKey = (e: KeyboardEvent): void => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            this.setOpen(!this._open);
        }
    };

    /**
     * Track the tab live during a pull, then latch (or fall back) on
     * release. The handler only writes the raw finger delta to `--drag`;
     * the sticky-snap curve — resist, snap onto the finger, track 1:1 —
     * is shaped entirely in CSS. The latch reads that same raw delta, and
     * `_open` still holds the pre-drag state at release.
     */
    private onDrag(e: DragEvent): void {
        if (e.phase === "move") {
            this.setAttribute("dragging", "");
            this.style.setProperty("--drag", `${e.delta.x}px`);
            return;
        }

        const open = this._open
            ? e.delta.x < SETTLE // was open — close only on a decisive push right
            : e.delta.x <= -SETTLE; // was closed — open only on a decisive pull left

        // Drop [dragging] and set the settled base together, so the
        // transform transitions home from wherever the finger left it.
        this.removeAttribute("dragging");
        this.setOpen(open);
    }
}

// Two sliders with offset knobs — reads as "adjust settings".
const SLIDERS_ICON = html`
    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
        <line x1="4" y1="9" x2="20" y2="9" />
        <circle class="knob" cx="9" cy="9" r="2.6" />
        <line x1="4" y1="15" x2="20" y2="15" />
        <circle class="knob" cx="15" cy="15" r="2.6" />
    </svg>
`;
