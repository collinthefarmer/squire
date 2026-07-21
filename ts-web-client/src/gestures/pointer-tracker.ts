/**
 * Pointer event normalization and tracking.
 *
 * Normalizes mouse, touch, and pen PointerEvents into a single
 * typed RxJS stream. Tracks all active pointers with position,
 * start position, and timing data.
 *
 * Optional claim window: when configured, the element starts with
 * the browser's default touch-action (e.g. pan-y for scroll).
 * Pointer events are tracked passively until a claim condition is
 * met (e.g. second finger arrives), at which point the tracker
 * claims ownership by calling preventDefault on all subsequent
 * events. If no condition is met, the browser handles the
 * interaction normally (scroll, zoom, etc).
 *
 * Gated scroll detection: when gate is true, a non-passive
 * touchmove listener blocks browser scroll during a detection
 * window. Pointer events fire normally while the gate is active.
 * If a claim condition matches, the pointer is captured for JS.
 * If the pointer moves past detectionThresholdPx without a claim,
 * the gate releases and the browser handles scroll natively —
 * firing pointercancel as it takes over. The gate persists through
 * captured gestures to suppress OS gesture interference.
 */

import { Subject, merge, fromEvent, type Observable } from "rxjs";
import { map, filter, takeUntil, share } from "rxjs/operators";
import type { Point } from "./transform";
import type { ClaimCondition } from "./claim-conditions";

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
    /** Present only when claim window is configured. */
    claimState?: "detecting" | "claimed" | "released";
}

export type TouchActionFallback = "pan-y" | "pan-x" | "auto";

export interface ClaimWindowConfig {
    /** Claim conditions — any one matching triggers a claim (OR logic). */
    conditions?: ClaimCondition[];
    /** The touch-action CSS value for the element. */
    fallbackTouchAction: TouchActionFallback;
    /**
     * When true, installs a non-passive touchmove listener that
     * blocks browser scroll during the detection window. If a
     * claim condition matches, the pointer is captured. If the
     * pointer moves past detectionThresholdPx without a claim,
     * the gate releases and the browser handles scroll natively.
     */
    gate?: boolean;
    /** Pixels of movement before releasing to browser (default: 10). */
    detectionThresholdPx?: number;
}

const DEFAULT_DETECTION_THRESHOLD = 10;

const enum ClaimState {
    IDLE,
    DETECTING,
    CLAIMED,
    RELEASED,
}

export class PointerTracker {
    private readonly activePointers = new Map<number, TrackedPointer>();
    private readonly destroy$ = new Subject<void>();
    private readonly claimConfig: ClaimWindowConfig | null;
    private readonly detectionThreshold: number;

    private claimState = ClaimState.IDLE;

    // Touchmove gate for scroll detection
    private gateActive = false;
    private readonly touchMoveGate: ((e: TouchEvent) => void) | null = null;

    readonly events$: Observable<PointerSnapshot>;

    constructor(
        private readonly element: HTMLElement,
        claimWindow?: ClaimWindowConfig,
    ) {
        this.claimConfig = claimWindow ?? null;
        this.detectionThreshold =
            claimWindow?.detectionThresholdPx ?? DEFAULT_DETECTION_THRESHOLD;

        element.style.touchAction = claimWindow
            ? claimWindow.fallbackTouchAction
            : "none";

        if (claimWindow?.gate) {
            element.style.overscrollBehavior = "contain";

            this.touchMoveGate = (e: TouchEvent) => {
                if (this.gateActive) e.preventDefault();
            };

            element.addEventListener("touchmove", this.touchMoveGate, {
                passive: false,
            });
        }

        const down$ = fromEvent<PointerEvent>(element, "pointerdown").pipe(
            map((e) => this.handleDown(e)),
            filter((s): s is PointerSnapshot => s !== null),
        );

        const move$ = fromEvent<PointerEvent>(document, "pointermove").pipe(
            filter((e) => this.activePointers.has(e.pointerId)),
            map((e) => this.handleMove(e)),
            filter((s): s is PointerSnapshot => s !== null),
        );

        const up$ = fromEvent<PointerEvent>(document, "pointerup").pipe(
            filter((e) => this.activePointers.has(e.pointerId)),
            map((e) => this.handleUp(e)),
        );

        const cancel$ = fromEvent<PointerEvent>(
            document,
            "pointercancel",
        ).pipe(
            filter((e) => this.activePointers.has(e.pointerId)),
            map((e) => this.handleCancel(e)),
        );

        this.events$ = merge(down$, move$, up$, cancel$).pipe(
            takeUntil(this.destroy$),
            share(),
        );
    }

    destroy(): void {
        if (this.touchMoveGate) {
            this.element.removeEventListener("touchmove", this.touchMoveGate);
        }

        this.destroy$.next();
        this.destroy$.complete();
        this.activePointers.clear();
        this.claimState = ClaimState.IDLE;
        this.gateActive = false;
    }

    // -- Handlers --

    private handleDown(e: PointerEvent): PointerSnapshot | null {
        const pointer = this.createPointer(e);
        this.activePointers.set(e.pointerId, pointer);

        if (!this.claimConfig) {
            e.preventDefault();
            this.element.setPointerCapture(e.pointerId);
            return this.snapshot("start", pointer, e);
        }

        if (e.pointerType === "mouse") {
            e.preventDefault();
            this.element.setPointerCapture(e.pointerId);
            this.claimState = ClaimState.CLAIMED;
            return this.snapshot("start", pointer, e);
        }

        switch (this.claimState) {
            case ClaimState.IDLE: {
                this.claimState = ClaimState.DETECTING;
                this.gateActive = true;
                const snap = this.snapshot("start", pointer, e);
                this.evaluateClaimConditions(snap, e);
                return snap;
            }

            case ClaimState.DETECTING: {
                const snap = this.snapshot("start", pointer, e);
                this.evaluateClaimConditions(snap, e);
                return snap;
            }

            case ClaimState.CLAIMED: {
                e.preventDefault();
                this.element.setPointerCapture(e.pointerId);
                return this.snapshot("start", pointer, e);
            }

            case ClaimState.RELEASED:
                return this.snapshot("start", pointer, e);
        }
    }

    private handleMove(e: PointerEvent): PointerSnapshot | null {
        const existing = this.activePointers.get(e.pointerId);
        if (!existing) {
            return null;
        }

        const updated: TrackedPointer = {
            ...existing,
            position: { x: e.clientX, y: e.clientY },
        };
        this.activePointers.set(e.pointerId, updated);

        if (!this.claimConfig) {
            e.preventDefault();
            return this.snapshot("move", updated, e);
        }

        switch (this.claimState) {
            case ClaimState.DETECTING: {
                const snap = this.snapshot("move", updated, e);
                this.evaluateClaimConditions(snap, e);

                // Still detecting? Check if past the detection window.
                if (
                    this.claimState === ClaimState.DETECTING &&
                    this.pastDetectionThreshold(updated)
                ) {
                    this.claimState = ClaimState.RELEASED;
                    this.gateActive = false;
                }

                return snap;
            }

            case ClaimState.CLAIMED:
                e.preventDefault();
                return this.snapshot("move", updated, e);

            case ClaimState.RELEASED:
                return this.snapshot("move", updated, e);

            default:
                return null;
        }
    }

    private handleUp(e: PointerEvent): PointerSnapshot {
        const pointer = this.activePointers.get(e.pointerId);
        const updated: TrackedPointer = pointer
            ? { ...pointer, position: { x: e.clientX, y: e.clientY } }
            : this.createPointer(e);

        this.activePointers.delete(e.pointerId);
        const snap = this.snapshot("end", updated, e);

        if (this.activePointers.size === 0) {
            this.resetToIdle();
        }

        return snap;
    }

    private handleCancel(e: PointerEvent): PointerSnapshot {
        const pointer =
            this.activePointers.get(e.pointerId) ?? this.createPointer(e);
        this.activePointers.delete(e.pointerId);
        const snap = this.snapshot("cancel", pointer, e);

        if (this.activePointers.size === 0) {
            this.resetToIdle();
        }

        return snap;
    }

    // -- Claim logic --

    private evaluateClaimConditions(
        snapshot: PointerSnapshot,
        currentEvent: PointerEvent,
    ): void {
        if (this.claimState !== ClaimState.DETECTING || !this.claimConfig) {
            return;
        }

        const conditions = this.claimConfig.conditions ?? [];
        const claimed = conditions.some((condition) => condition(snapshot));

        if (claimed) {
            this.claim(currentEvent);
        }
    }

    private claim(triggerEvent: PointerEvent | null): void {
        this.claimState = ClaimState.CLAIMED;

        if (triggerEvent) {
            triggerEvent.preventDefault();
        }

        // Gate stays active to suppress OS gesture interference.
        // Pointer capture ensures all events reach this element.
        for (const pointerId of this.activePointers.keys()) {
            try {
                this.element.setPointerCapture(pointerId);
            } catch {
                // Pointer may already be gone
            }
        }
    }

    private pastDetectionThreshold(pointer: TrackedPointer): boolean {
        const dx = pointer.position.x - pointer.startPosition.x;
        const dy = pointer.position.y - pointer.startPosition.y;
        return Math.hypot(dx, dy) >= this.detectionThreshold;
    }

    private resetToIdle(): void {
        this.claimState = ClaimState.IDLE;
        this.gateActive = false;
    }

    // -- Helpers --

    private createPointer(e: PointerEvent): TrackedPointer {
        return {
            id: e.pointerId,
            position: { x: e.clientX, y: e.clientY },
            startPosition: { x: e.clientX, y: e.clientY },
            startTime: e.timeStamp,
            pointerType: e.pointerType as TrackedPointer["pointerType"],
        };
    }

    private snapshot(
        phase: PointerPhase,
        changed: TrackedPointer,
        originalEvent: PointerEvent,
    ): PointerSnapshot {
        const snap: PointerSnapshot = {
            phase,
            changed,
            active: new Map(this.activePointers),
            activeCount: this.activePointers.size,
            timestamp: originalEvent.timeStamp,
            originalEvent,
        };

        if (this.claimConfig) {
            switch (this.claimState) {
                case ClaimState.DETECTING:
                    snap.claimState = "detecting";
                    break;
                case ClaimState.CLAIMED:
                    snap.claimState = "claimed";
                    break;
                case ClaimState.RELEASED:
                    snap.claimState = "released";
                    break;
            }
        }

        return snap;
    }
}
