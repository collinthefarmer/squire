/**
 * Gesture recognizer types — the shared contract between
 * recognizers, harness, and coordination.
 *
 * Types only, no runtime code. Recognizers produce Recognition
 * values; the coordination layer consumes them. Neither needs
 * to know about the other's internals.
 */

import type { Observable } from "rxjs";
import type { PointerStream } from "../pointers";

export type Recognition<T> =
    | { claimed: true; confidence: number; gesture$: Observable<T> }
    | { claimed: false };

export type Recognizer<T> = {
    /** Stable identifier used for styling and diagnostics ("drag", "pinch"). */
    readonly name: string;
    /** Minimum pointers to start (and, once active, to stay alive). */
    readonly touches: number;
    /**
     * When true, the coordination layer routes pointers that land while
     * this gesture is active into `recognize`'s `added$`, growing its
     * set instead of opening a fresh competition. Default false.
     */
    readonly absorbs?: boolean;
    /**
     * @param pointers the pointers the gesture starts with
     * @param added$ pointers absorbed while active (only fed when `absorbs`)
     */
    recognize(
        pointers: PointerStream[],
        added$?: Observable<PointerStream>,
    ): Observable<Recognition<T>>;
};

export type GestureSource = {
    on<T>(recognizer: Recognizer<T>): Observable<T>;
    /**
     * Name of the gesture currently driving this element, or null
     * when idle. Emits on every transition — the window is derived
     * from the winning gesture stream's lifetime, so it holds for
     * recognizers with no phase field (tap) as well as those with one.
     */
    readonly active$: Observable<string | null>;
};
