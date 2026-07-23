import { html, type TemplateResult } from "lit-html";
import { map } from "lit-html/directives/map.js";
import { ref } from "lit-html/directives/ref.js";
import { repeat } from "lit-html/directives/repeat.js";
import { styleMap } from "lit-html/directives/style-map.js";
import { when } from "lit-html/directives/when.js";
import { tap } from "rxjs/operators";

import { BaseComponent } from "@core/base-component";
import sandboxCss from "./gesture-sandbox.css" with { type: "text" };
import {
    pointers$,
    trackedPointers$,
    onGesture,
    drag,
    pinch,
    tap as tapGesture,
    subtract,
    velocity,
    pairMetrics,
    pairDelta,
} from "@gestures";
import type {
    PointerSnapshot,
    TrackedPointer,
    DragEvent,
    PinchEvent,
    TapEvent,
    Point,
    PointerPairMetrics,
} from "@gestures";

interface SandboxRect {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    scale: number;
    rotation: number;
    color: string;
}

interface LogEntry {
    phase: string;
    pointerId: number;
    position: Point;
    pointerType: string;
    detail: string;
    time: string;
    source: "canvas" | "scroll";
}

const MAX_LOG_ENTRIES = 40;
const LOG_MOVE_THROTTLE = 5;
const PULL_REFRESH_THRESHOLD = 60;

const SCROLL_ITEMS = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    label: `Item ${i + 1}`,
    color: `hsl(${i * 9}, 50%, 25%)`,
}));


export class GestureSandbox extends BaseComponent {
    // Canvas zone
    private canvasPointers: ReadonlyMap<number, TrackedPointer> = new Map();
    private canvasEl: HTMLDivElement | null = null;
    private previousPairMetrics: PointerPairMetrics | null = null;
    private dragTarget: SandboxRect | null = null;
    private previousPositions = new Map<number, Point>();

    // Scroll zone
    private scrollEl: HTMLDivElement | null = null;
    private pullDistance = 0;
    private refreshing = false;
    private twoFingerDelta: Point | null = null;
    private pinchScale: number | null = null;
    private lastTap: TapEvent | null = null;

    // Shared
    private log: LogEntry[] = [];
    private moveCount = 0;

    private rects: SandboxRect[] = [
        { id: "A", x: 20, y: 40, width: 100, height: 75, scale: 1, rotation: 0, color: "rgba(233, 69, 96, 0.5)" },
        { id: "B", x: 150, y: 80, width: 80, height: 80, scale: 1, rotation: 0, color: "rgba(80, 250, 123, 0.5)" },
        { id: "C", x: 60, y: 180, width: 110, height: 60, scale: 1, rotation: 0, color: "rgba(98, 114, 164, 0.5)" },
    ];

    // -- Element refs (stable arrow fields so lit-html ref() only fires once) --

    private canvasRef = (el: Element | undefined): void => {
        if (!el) return;
        this.canvasEl = el as HTMLDivElement;

        this.subscribe(
            trackedPointers$(
                pointers$(this.canvasEl).pipe(tap((s) => s.capture())),
            ),
            (snap) => this.handleCanvasEvent(snap),
        );
    };

    private scrollRef = (el: Element | undefined): void => {
        if (!el) return;
        this.scrollEl = el as HTMLDivElement;
    };

    // -- Lifecycle --

    override connectedCallback(): void {
        super.connectedCallback();
        this.adoptStyles(sandboxCss);
        this.update();
    }

    // -- Template --

    protected template(): TemplateResult {
        return html`
            <div class="layout">
                ${this.dataPanelTemplate()}
                <div class="zones">
                    ${this.canvasZoneTemplate()}
                    ${this.scrollZoneTemplate()}
                </div>
                ${this.logPanelTemplate()}
                ${this.statusBarTemplate()}
            </div>
        `;
    }

    private dataPanelTemplate(): TemplateResult {
        const pointers = [...this.canvasPointers.values()];

        const pair = pointers.length >= 2
            ? pairMetrics(pointers[0]!.position, pointers[1]!.position)
            : null;

        return html`
            <div class="data-panel">
                <span>
                    <span class="data-label">Pointers:</span>
                    <span class="data-value">${pointers.length}</span>
                </span>
                ${map(pointers, (p) => html`
                    <span>
                        <span class="data-label">#${p.id}:</span>
                        <span class="data-value">
                            (${Math.round(p.position.x)},${Math.round(p.position.y)})
                        </span>
                        <span class="data-label">${p.pointerType}</span>
                    </span>
                `)}
                ${when(pair, (p) => html`
                    <span class="pair-data">
                        dist=${Math.round(p.distance)} angle=${p.angle.toFixed(2)}rad
                    </span>
                `)}
            </div>
        `;
    }

    private canvasZoneTemplate(): TemplateResult {
        const pointers = [...this.canvasPointers.values()];
        const offset = this.canvasOffset();

        return html`
            <div class="canvas-zone">
                <div class="zone-header">
                    <span>Canvas (always capture)</span>
                    <span class="data-value">${pointers.length} ptr</span>
                </div>
                <div class="canvas-area" ${ref(this.canvasRef)}>
                    ${repeat(this.rects, (r) => r.id, (r) => this.rectTemplate(r))}
                    ${map(pointers, (p) => this.touchDotTemplate(p, offset))}
                </div>
            </div>
        `;
    }

    private rectTemplate(rect: SandboxRect): TemplateResult {
        return html`
            <div class="rect" style=${styleMap({
                left: `${rect.x}px`,
                top: `${rect.y}px`,
                width: `${rect.width}px`,
                height: `${rect.height}px`,
                background: rect.color,
                transform: `scale(${rect.scale}) rotate(${rect.rotation}rad)`,
            })}>
                ${rect.id}
            </div>
        `;
    }

    private touchDotTemplate(pointer: TrackedPointer, offset: Point): TemplateResult {
        return html`
            <div class="touch-dot" style=${styleMap({
                left: `${pointer.position.x - offset.x}px`,
                top: `${pointer.position.y - offset.y}px`,
                background: `hsl(${(pointer.id * 137) % 360}, 70%, 50%)`,
            })}>
                ${pointer.id}
            </div>
        `;
    }

    private scrollZoneTemplate(): TemplateResult {
        return html`
            <div class="scroll-zone">
                <div class="zone-header">
                    <span>Scroll (drag recognizer)</span>
                    ${this.scrollBadgeTemplate()}
                </div>
                <div class="scroll-area"
                    ${ref(this.scrollRef)}
                    ${onGesture(drag({ direction: { x: 0, y: 1 }, when: () => this.scrollEl!.scrollTop <= 0 }), (e) => this.handlePullDrag(e))}
                    ${onGesture(drag({ touches: 2 }), (e) => this.handleTwoFingerDrag(e))}
                    ${onGesture(pinch(), (e) => this.handlePinch(e))}
                    ${onGesture(tapGesture(), (e) => this.handleTap(e))}
                >
                    ${when(this.pullDistance > 0, () => html`
                        <div class="pull-indicator" style=${styleMap({
                            height: `${Math.min(this.pullDistance, 120)}px`,
                        })}>
                            ${this.pullDistance > PULL_REFRESH_THRESHOLD
                                ? "Release to refresh"
                                : "Pull down..."}
                        </div>
                    `)}
                    <div class="scroll-list">
                        ${repeat(SCROLL_ITEMS, (item) => item.id, (item) => html`
                            <div class="scroll-item" style=${styleMap({ background: item.color })}>
                                ${item.label}
                            </div>
                        `)}
                    </div>
                </div>
            </div>
        `;
    }

    private scrollBadgeTemplate(): TemplateResult {
        if (this.lastTap) {
            return html`<span class="claim-badge">
                Tap: (${Math.round(this.lastTap.position.x)},${Math.round(this.lastTap.position.y)}) ${this.lastTap.duration}ms
            </span>`;
        }

        if (this.pinchScale !== null) {
            return html`<span class="claim-badge">Pinch: ${this.pinchScale.toFixed(2)}x</span>`;
        }

        if (this.twoFingerDelta) {
            return html`<span class="claim-badge">
                2-finger: (${Math.round(this.twoFingerDelta.x)},${Math.round(this.twoFingerDelta.y)})
            </span>`;
        }

        if (this.refreshing) {
            return html`<span class="claim-badge">Refreshing...</span>`;
        }

        if (this.pullDistance > 0) {
            return html`<span class="claim-badge">Pull: ${Math.round(this.pullDistance)}px</span>`;
        }

        return html`<span class="data-label">tap / pull / 2-finger drag</span>`;
    }

    private logPanelTemplate(): TemplateResult {
        return html`
            <div class="log-panel">
                ${map(this.log, (entry) => html`
                    <div class="log-entry">
                        <span class="log-source">${entry.source}</span>
                        <span class="log-phase log-phase-${entry.phase}">${entry.phase}</span>
                        #${entry.pointerId} ${entry.pointerType}
                        (${Math.round(entry.position.x)},${Math.round(entry.position.y)})
                        ${entry.detail}
                        <span class="log-time">${entry.time}</span>
                    </div>
                `)}
            </div>
        `;
    }

    private statusBarTemplate(): TemplateResult {
        return html`
            <div class="status-bar">
                <span>
                    <span class="data-label">Canvas drag:</span>
                    <span class="data-value">${this.dragTarget?.id ?? "none"}</span>
                </span>
            </div>
        `;
    }

    // -- Canvas zone handlers --

    private handleCanvasEvent(snapshot: PointerSnapshot): void {
        this.canvasPointers = snapshot.active;

        const { phase, changed } = snapshot;
        const prevPos = this.previousPositions.get(changed.id);

        if (phase === "start") {
            this.previousPositions.set(changed.id, changed.position);
            this.dragTarget = this.hitTest(changed.position);

            if (snapshot.activeCount >= 2) {
                this.previousPairMetrics = this.currentCanvasPairMetrics();
            }

            this.addLogEntry(snapshot, "", "canvas");
        }

        if (phase === "move") {
            this.moveCount++;
            this.previousPositions.set(changed.id, changed.position);

            if (snapshot.activeCount >= 2) {
                this.previousPairMetrics = this.currentCanvasPairMetrics();
            }

            if (prevPos) {
                this.applyCanvasTransform(snapshot);

                if (this.moveCount % LOG_MOVE_THROTTLE === 0) {
                    const d = subtract(changed.position, prevPos);
                    const v = velocity(prevPos, changed.position, 16);

                    this.addLogEntry(
                        snapshot,
                        `Δ(${d.x.toFixed(0)},${d.y.toFixed(0)}) vel(${v.x.toFixed(2)},${v.y.toFixed(2)})`,
                        "canvas",
                    );
                }
            }
        }

        if (phase === "end" || phase === "cancel") {
            this.previousPositions.delete(changed.id);

            if (snapshot.activeCount === 0) {
                this.dragTarget = null;
                this.previousPairMetrics = null;
            }

            this.addLogEntry(snapshot, "", "canvas");
        }

        this.update();
    }

    private applyCanvasTransform(snapshot: PointerSnapshot): void {
        if (!this.dragTarget) return;

        const rect = this.dragTarget;

        if (snapshot.activeCount === 1) {
            const prevPos = this.previousPositions.get(snapshot.changed.id);
            if (!prevPos) return;

            const d = subtract(snapshot.changed.position, prevPos);
            rect.x += d.x;
            rect.y += d.y;
            return;
        }

        if (snapshot.activeCount >= 2 && this.previousPairMetrics) {
            const currentMetrics = this.currentCanvasPairMetrics();
            if (!currentMetrics) return;

            const pd = pairDelta(this.previousPairMetrics, currentMetrics);
            rect.x += pd.translationDelta.x;
            rect.y += pd.translationDelta.y;
            rect.scale *= pd.scaleRatio;
            rect.rotation += pd.rotationDelta;
        }
    }

    private hitTest(point: Point): SandboxRect | null {
        const offset = this.canvasOffset();
        const localX = point.x - offset.x;
        const localY = point.y - offset.y;

        for (let i = this.rects.length - 1; i >= 0; i--) {
            const r = this.rects[i]!;

            if (
                localX >= r.x &&
                localX <= r.x + r.width * r.scale &&
                localY >= r.y &&
                localY <= r.y + r.height * r.scale
            ) {
                return r;
            }
        }

        return null;
    }

    private currentCanvasPairMetrics(): PointerPairMetrics | null {
        const pointers = [...this.canvasPointers.values()];

        if (pointers.length < 2) return null;

        return pairMetrics(pointers[0]!.position, pointers[1]!.position);
    }

    private canvasOffset(): Point {
        if (!this.canvasEl) return { x: 0, y: 0 };

        const rect = this.canvasEl.getBoundingClientRect();
        return { x: rect.left, y: rect.top };
    }

    // -- Scroll zone handlers --

    private handlePullDrag(event: DragEvent): void {
        if (event.phase === "move") {
            this.pullDistance = Math.max(0, event.delta.y);
        }

        if (event.phase === "end") {
            if (this.pullDistance > PULL_REFRESH_THRESHOLD) {
                this.refreshing = true;

                setTimeout(() => {
                    this.refreshing = false;
                    this.update();
                }, 1000);
            }

            this.pullDistance = 0;
        }

        this.update();
    }

    private handleTwoFingerDrag(event: DragEvent): void {
        if (event.phase === "move") {
            this.twoFingerDelta = event.delta;
        }

        if (event.phase === "end") {
            this.twoFingerDelta = null;
        }

        this.update();
    }

    private handleTap(event: TapEvent): void {
        this.lastTap = event;
        this.update();

        setTimeout(() => {
            this.lastTap = null;
            this.update();
        }, 1000);
    }

    private handlePinch(event: PinchEvent): void {
        if (event.phase === "move") {
            this.pinchScale = event.scale;
        }

        if (event.phase === "end") {
            this.pinchScale = null;
        }

        this.update();
    }

    // -- Shared --

    private addLogEntry(
        snapshot: PointerSnapshot,
        detail: string,
        source: "canvas" | "scroll",
    ): void {
        const now = new Date();
        const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;

        this.log.unshift({
            phase: snapshot.phase,
            pointerId: snapshot.changed.id,
            position: snapshot.changed.position,
            pointerType: snapshot.changed.pointerType,
            detail,
            time,
            source,
        });

        if (this.log.length > MAX_LOG_ENTRIES) {
            this.log.length = MAX_LOG_ENTRIES;
        }
    }
}
