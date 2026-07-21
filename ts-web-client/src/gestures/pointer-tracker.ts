/**
 * Pointer event normalization and tracking.
 *
 * Normalizes mouse, touch, and pen PointerEvents into a single
 * typed RxJS stream. Tracks all active pointers with position,
 * start position, and timing data.
 */

import { Subject, merge, fromEvent, type Observable } from "rxjs";
import { map, filter, takeUntil, share } from "rxjs/operators";
import type { Point } from "./transform";

export type PointerPhase = "start" | "move" | "end" | "cancel";

export interface TrackedPointer {
    id: number;
    position: Point;
    startPosition: Point;
    startTime: number;
    pointerType: "mouse" | "touch" | "pen";
}

export interface PointerSnapshot {
    phase: PointerPhase;
    changed: TrackedPointer;
    active: ReadonlyMap<number, TrackedPointer>;
    activeCount: number;
    timestamp: number;
    originalEvent: PointerEvent;
}

export class PointerTracker {
    private readonly activePointers = new Map<number, TrackedPointer>();
    private readonly destroy$ = new Subject<void>();

    readonly events$: Observable<PointerSnapshot>;

    constructor(private readonly element: HTMLElement) {
        element.style.touchAction = "none";

        const down$ = fromEvent<PointerEvent>(element, "pointerdown").pipe(
            map((e) => this.handleDown(e)),
        );

        const move$ = fromEvent<PointerEvent>(document, "pointermove").pipe(
            filter((e) => this.activePointers.has(e.pointerId)),
            map((e) => this.handleMove(e)),
        );

        const up$ = fromEvent<PointerEvent>(document, "pointerup").pipe(
            filter((e) => this.activePointers.has(e.pointerId)),
            map((e) => this.handleUp(e)),
        );

        const cancel$ = fromEvent<PointerEvent>(document, "pointercancel").pipe(
            filter((e) => this.activePointers.has(e.pointerId)),
            map((e) => this.handleCancel(e)),
        );

        this.events$ = merge(down$, move$, up$, cancel$).pipe(
            takeUntil(this.destroy$),
            share(),
        );
    }

    destroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.activePointers.clear();
    }

    private handleDown(e: PointerEvent): PointerSnapshot {
        e.preventDefault();
        this.element.setPointerCapture(e.pointerId);

        const pointer: TrackedPointer = {
            id: e.pointerId,
            position: { x: e.clientX, y: e.clientY },
            startPosition: { x: e.clientX, y: e.clientY },
            startTime: e.timeStamp,
            pointerType: e.pointerType as TrackedPointer["pointerType"],
        };

        this.activePointers.set(e.pointerId, pointer);

        return this.snapshot("start", pointer, e);
    }

    private handleMove(e: PointerEvent): PointerSnapshot {
        e.preventDefault();

        const existing = this.activePointers.get(e.pointerId)!;

        const updated: TrackedPointer = {
            ...existing,
            position: { x: e.clientX, y: e.clientY },
        };

        this.activePointers.set(e.pointerId, updated);

        return this.snapshot("move", updated, e);
    }

    private handleUp(e: PointerEvent): PointerSnapshot {
        const pointer = this.activePointers.get(e.pointerId)!;
        const updated: TrackedPointer = {
            ...pointer,
            position: { x: e.clientX, y: e.clientY },
        };

        this.activePointers.delete(e.pointerId);

        return this.snapshot("end", updated, e);
    }

    private handleCancel(e: PointerEvent): PointerSnapshot {
        const pointer = this.activePointers.get(e.pointerId)!;
        this.activePointers.delete(e.pointerId);

        return this.snapshot("cancel", pointer, e);
    }

    private snapshot(
        phase: PointerPhase,
        changed: TrackedPointer,
        originalEvent: PointerEvent,
    ): PointerSnapshot {
        return {
            phase,
            changed,
            active: new Map(this.activePointers),
            activeCount: this.activePointers.size,
            timestamp: originalEvent.timeStamp,
            originalEvent,
        };
    }
}
