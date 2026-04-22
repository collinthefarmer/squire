import {
    Subject,
    fromEvent,
    merge,
    map,
    filter,
    switchMap,
    takeUntil,
    take,
    tap,
    finalize,
} from "rxjs";
import { DRAG } from "@shared/constants/drag";
import { emitDomEvent, type DragStartDetail } from "@utils/dom-events";
import { ScaleGesture } from "./scale-gesture";

interface Point {
    x: number;
    y: number;
}

interface PointerStart extends Point {
    source: "mouse" | "touch";
}

function distance(a: Point, b: Point): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Base draggable wrapper component
 *
 * Models pointer interaction as a flat observable pipeline:
 *
 *   pointerDown → switchMap(gesture)
 *     gesture: merge(moves, scales) | takeUntil(up) | finalize
 *       - moves update position, trigger drag once threshold crossed
 *       - scales forward to hook while dragging
 *       - finalize emits click or drag-end based on whether drag started
 *
 * Subclasses override lifecycle hooks for visual feedback.
 * ScaleGesture is self-contained (owns its wheel + pinch listeners).
 *
 * @fires drag-start  { detail: { data, element, x, y, ...extraDetail } }
 * @fires drag-move   { detail: { data, x, y } }
 * @fires drag-end    { detail: { data, x, y } }
 * @fires drag-click  { detail: { data, x, y, ...extraDetail } }
 * @fires drag-scale  { detail: { data, scale } }
 *
 * @attr data-drag-data - Data to include in drag events
 * @attr data-drag-source - Source tag for filtering
 */
export class Draggable extends HTMLElement {
    private destroy$ = new Subject<void>();

    protected scaleGesture = new ScaleGesture({
        min: DRAG.SCALE_MIN,
        max: DRAG.SCALE_MAX,
        wheelFactor: DRAG.WHEEL_FACTOR,
    });

    connectedCallback(): void {
        this.style.display = "contents";

        const mouseDown$ = fromEvent<MouseEvent>(this, "mousedown").pipe(
            filter((e) => e.button === 0),
            tap((e) => e.preventDefault()),
            map(
                (e): PointerStart => ({
                    x: e.clientX,
                    y: e.clientY,
                    source: "mouse",
                }),
            ),
        );

        const touchDown$ = fromEvent<TouchEvent>(this, "touchstart", {
            passive: false,
        }).pipe(
            filter((e) => e.touches.length === 1 && !!e.touches[0]),
            tap((e) => e.preventDefault()),
            map(
                (e): PointerStart => ({
                    x: e.touches[0]!.clientX,
                    y: e.touches[0]!.clientY,
                    source: "touch",
                }),
            ),
        );

        merge(mouseDown$, touchDown$)
            .pipe(
                switchMap((start) => this.gesture(start)),
                takeUntil(this.destroy$),
            )
            .subscribe();
    }

    disconnectedCallback(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    // -- Lifecycle hooks for subclasses --

    protected onDragStart(_x: number, _y: number): void {}
    protected onDragMove(_x: number, _y: number): void {}
    protected onDragEnd(_x: number, _y: number): void {}
    protected onScaleChange(_scale: number, _x: number, _y: number): void {}

    protected getExtraDetail(): Partial<DragStartDetail> {
        return {};
    }

    // -- Gesture pipeline --

    private gesture(start: PointerStart) {
        const { move$, up$ } = this.pointerStreams(start.source);
        let pos: Point = start;
        let dragging = false;

        const moves$ = move$.pipe(
            tap((p) => {
                pos = p;

                if (!dragging && distance(p, start) >= DRAG.CLICK_THRESHOLD) {
                    dragging = true;
                    this.beginDrag(start);
                }

                if (dragging) this.emitMove(p);
            }),
        );

        const scales$ = this.scaleGesture.scale$.pipe(
            tap((scale) => this.emitScale(scale, pos)),
        );

        return merge(moves$, scales$).pipe(
            takeUntil(up$),
            finalize(() => (dragging ? this.endDrag(pos) : this.emitClick(start))),
        );
    }

    // -- Pointer event factories --

    private pointerStreams(source: "mouse" | "touch") {
        if (source === "mouse") {
            return {
                move$: fromEvent<MouseEvent>(document, "mousemove").pipe(
                    tap((e) => e.preventDefault()),
                    map((e): Point => ({ x: e.clientX, y: e.clientY })),
                ),
                up$: fromEvent(document, "mouseup").pipe(take(1)),
            };
        }

        return {
            move$: fromEvent<TouchEvent>(document, "touchmove", {
                passive: false,
            }).pipe(
                filter((e) => e.touches.length === 1 && !!e.touches[0]),
                tap((e) => e.preventDefault()),
                map(
                    (e): Point => ({
                        x: e.touches[0]!.clientX,
                        y: e.touches[0]!.clientY,
                    }),
                ),
            ),
            up$: merge(
                fromEvent(document, "touchend"),
                fromEvent(document, "touchcancel"),
            ).pipe(take(1)),
        };
    }

    // -- Event emission --

    private dragData(): string {
        return this.dataset.dragData ?? "";
    }

    private emitClick(pos: Point): void {
        emitDomEvent(this, "drag-click", {
            data: this.dragData(),
            source: this.dataset.dragSource,
            x: pos.x,
            y: pos.y,
            ...this.getExtraDetail(),
        });
    }

    private beginDrag(pos: Point): void {
        this.scaleGesture.reset();
        this.scaleGesture.attach();
        this.onDragStart(pos.x, pos.y);

        document.body.style.userSelect = "none";
        document.body.style.cursor = "grabbing";

        emitDomEvent(this, "drag-start", {
            data: this.dragData(),
            source: this.dataset.dragSource,
            element: this,
            x: pos.x,
            y: pos.y,
            ...this.getExtraDetail(),
        });
    }

    private emitMove(pos: Point): void {
        this.onDragMove(pos.x, pos.y);

        emitDomEvent(this, "drag-move", {
            data: this.dragData(),
            source: this.dataset.dragSource,
            x: pos.x,
            y: pos.y,
        });
    }

    private emitScale(scale: number, pos: Point): void {
        this.onScaleChange(scale, pos.x, pos.y);

        emitDomEvent(this, "drag-scale", {
            data: this.dragData(),
            source: this.dataset.dragSource,
            scale,
        });
    }

    private endDrag(pos: Point): void {
        this.scaleGesture.detach();

        document.body.style.userSelect = "";
        document.body.style.cursor = "";

        this.onDragEnd(pos.x, pos.y);

        emitDomEvent(this, "drag-end", {
            data: this.dragData(),
            source: this.dataset.dragSource,
            x: pos.x,
            y: pos.y,
        });
    }
}
