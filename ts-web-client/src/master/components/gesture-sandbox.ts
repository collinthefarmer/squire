/**
 * Gesture sandbox — pointer data exploration component.
 *
 * Two zones side by side:
 * - Canvas (left): always-capture mode. Drag/pinch rects freely.
 * - Scroll zone (right): plain native scrolling list. Gesture
 *   recognition will be added when recognizer factories are built.
 *
 * Both zones share the same pointer data panel and event log.
 */

import { html, nothing, type TemplateResult } from "lit-html";
import { tap } from "rxjs/operators";
import { BaseComponent } from "@core/base-component";
import { pointers$ } from "@gestures/pointers";
import { trackedPointers$ } from "@gestures/pointer-tracker";
import { gestures } from "@gestures/gestures";
import { drag } from "@gestures/recognizers";
import type { DragEvent } from "@gestures/recognizers";
import type {
    PointerSnapshot,
    TrackedPointer,
} from "@gestures/pointer-tracker";
import {
    delta,
    velocity,
    pairMetrics,
    pairDelta,
    type Point,
    type PointerPairMetrics,
} from "@gestures/transform";

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

const STYLES = `
:host {
    display: block;
    width: 100%;
    height: 100%;
    font-family: ui-monospace, 'Cascadia Code', 'Fira Code', monospace;
    font-size: 13px;
    color: #e0e0e0;
    background: #1a1a2e;
    overflow: hidden;
}

.layout {
    display: grid;
    grid-template-rows: auto 1fr auto;
    height: 100%;
}

.data-panel {
    padding: 8px 12px;
    background: #16213e;
    border-bottom: 1px solid #0f3460;
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    min-height: 36px;
    align-items: center;
}

.data-label { color: #7f8c9b; }
.data-value { color: #e94560; }
.pair-data { color: #bd93f9; }

.zones {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1px;
    background: #0f3460;
    overflow: hidden;
}

.zone-header {
    padding: 4px 8px;
    background: #16213e;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

/* Canvas zone (left) */
.canvas-zone {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #1a1a2e;
}

.canvas-area {
    position: relative;
    flex: 1;
    overflow: hidden;
    cursor: crosshair;
    touch-action: none;
    user-select: none;
}

.rect {
    position: absolute;
    border: 2px solid rgba(255, 255, 255, 0.6);
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.8);
    font-size: 14px;
    font-weight: bold;
    user-select: none;
    pointer-events: none;
}

.touch-dot {
    position: absolute;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
    box-shadow: 0 0 8px rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    color: #fff;
    z-index: 100;
}

/* Scroll zone (right) */
.scroll-zone {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #1a1a2e;
}

.scroll-area {
    flex: 1;
    overflow-y: auto;
    position: relative;
    touch-action: pan-y;
    overscroll-behavior: contain;
}

.scroll-list {
    padding: 4px;
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.scroll-item {
    padding: 16px 12px;
    border-radius: 4px;
    color: #e0e0e0;
    font-size: 14px;
    user-select: none;
    min-height: 44px;
    display: flex;
    align-items: center;
}

.pull-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #1e3a5f;
    color: #50fa7b;
    font-size: 13px;
    overflow: hidden;
    flex-shrink: 0;
}

.zone-header .claim-badge {
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: bold;
}

.claim-claimed { background: #50fa7b; color: #1a1a2e; }

/* Log panel */
.log-panel {
    height: 140px;
    overflow-y: auto;
    background: #0f0f23;
    border-top: 1px solid #0f3460;
    padding: 4px 0;
}

.log-entry {
    padding: 2px 12px;
    white-space: nowrap;
}

.log-phase {
    display: inline-block;
    width: 50px;
    color: #7f8c9b;
}

.log-phase-start { color: #50fa7b; }
.log-phase-end { color: #ff5555; }
.log-phase-move { color: #6272a4; }
.log-phase-cancel { color: #ffb86c; }

.log-source {
    display: inline-block;
    width: 50px;
    color: #44475a;
}

.log-time {
    float: right;
    color: #44475a;
}

.status-bar {
    padding: 6px 12px;
    background: #16213e;
    border-top: 1px solid #0f3460;
    display: flex;
    gap: 24px;
}
`;

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

    // Shared
    private log: LogEntry[] = [];
    private moveCount = 0;

    private rects: SandboxRect[] = [
        {
            id: "A",
            x: 20,
            y: 40,
            width: 100,
            height: 75,
            scale: 1,
            rotation: 0,
            color: "rgba(233, 69, 96, 0.5)",
        },
        {
            id: "B",
            x: 150,
            y: 80,
            width: 80,
            height: 80,
            scale: 1,
            rotation: 0,
            color: "rgba(80, 250, 123, 0.5)",
        },
        {
            id: "C",
            x: 60,
            y: 180,
            width: 110,
            height: 60,
            scale: 1,
            rotation: 0,
            color: "rgba(98, 114, 164, 0.5)",
        },
    ];

    override connectedCallback(): void {
        super.connectedCallback();
        this.adoptStyles(STYLES);
        this.update();

        requestAnimationFrame(() => {
            this.canvasEl = this.shadowRoot!.querySelector(".canvas-area");
            this.scrollEl = this.shadowRoot!.querySelector(".scroll-area");

            if (this.canvasEl) {
                this.subscribe(
                    trackedPointers$(
                        pointers$(this.canvasEl).pipe(
                            tap((s) => s.capture()),
                        ),
                    ),
                    (snap) => this.handleCanvasEvent(snap),
                );
            }

            if (this.scrollEl) {
                const scrollEl = this.scrollEl;
                const input = gestures(scrollEl);

                this.subscribe(
                    input.on(
                        drag({
                            direction: { x: 0, y: 1 },
                            when: () => scrollEl.scrollTop <= 0,
                        }),
                    ),
                    (e) => this.handlePullDrag(e),
                );
            }
        });
    }

    protected template(): TemplateResult {
        const canvasPointerList = [...this.canvasPointers.values()];

        const canvasPair =
            canvasPointerList.length >= 2
                ? pairMetrics(
                      canvasPointerList[0]!.position,
                      canvasPointerList[1]!.position,
                  )
                : null;

        return html`
            <div class="layout">
                <div class="data-panel">
                    <span>
                        <span class="data-label">Pointers:</span>
                        <span class="data-value"
                            >${canvasPointerList.length}</span
                        >
                    </span>
                    ${canvasPointerList.map(
                        (p) => html`
                            <span>
                                <span class="data-label">#${p.id}:</span>
                                <span class="data-value"
                                    >(${Math.round(p.position.x)},${Math.round(
                                        p.position.y,
                                    )})</span
                                >
                                <span class="data-label">${p.pointerType}</span>
                            </span>
                        `,
                    )}
                    ${canvasPair
                        ? html`
                              <span class="pair-data">
                                  dist=${Math.round(canvasPair.distance)}
                                  angle=${canvasPair.angle.toFixed(2)}rad
                              </span>
                          `
                        : nothing}
                </div>

                <div class="zones">
                    <div class="canvas-zone">
                        <div class="zone-header">
                            <span>Canvas (always capture)</span>
                            <span class="data-value"
                                >${canvasPointerList.length} ptr</span
                            >
                        </div>
                        <div class="canvas-area">
                            ${this.rects.map(
                                (r) => html`
                                    <div
                                        class="rect"
                                        style="
                                        left: ${r.x}px; top: ${r.y}px;
                                        width: ${r.width}px; height: ${r.height}px;
                                        background: ${r.color};
                                        transform: scale(${r.scale}) rotate(${r.rotation}rad);
                                    "
                                    >
                                        ${r.id}
                                    </div>
                                `,
                            )}
                            ${canvasPointerList.map(
                                (p) => html`
                                    <div
                                        class="touch-dot"
                                        style="
                                        left: ${p.position.x -
                                        this.canvasOffset().x}px;
                                        top: ${p.position.y -
                                        this.canvasOffset().y}px;
                                        background: hsl(${(p.id * 137) %
                                        360}, 70%, 50%);
                                    "
                                    >
                                        ${p.id}
                                    </div>
                                `,
                            )}
                        </div>
                    </div>

                    <div class="scroll-zone">
                        <div class="zone-header">
                            <span>Scroll (drag recognizer)</span>
                            ${this.refreshing
                                ? html`<span class="claim-badge claim-claimed"
                                      >Refreshing...</span
                                  >`
                                : this.pullDistance > 0
                                  ? html`<span class="claim-badge claim-claimed"
                                        >Pull:
                                        ${Math.round(this.pullDistance)}px</span
                                    >`
                                  : html`<span class="data-label"
                                        >pull down at top to
                                        refresh</span
                                    >`}
                        </div>
                        <div class="scroll-area">
                            ${this.pullDistance > 0
                                ? html`
                                      <div
                                          class="pull-indicator"
                                          style="height: ${Math.min(
                                              this.pullDistance,
                                              120,
                                          )}px"
                                      >
                                          ${this.pullDistance >
                                          PULL_REFRESH_THRESHOLD
                                              ? "Release to refresh"
                                              : "Pull down..."}
                                      </div>
                                  `
                                : nothing}
                            <div class="scroll-list">
                                ${SCROLL_ITEMS.map(
                                    (item) => html`
                                        <div
                                            class="scroll-item"
                                            style="background: ${item.color}"
                                        >
                                            ${item.label}
                                        </div>
                                    `,
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div class="log-panel">
                    ${this.log.map(
                        (entry) => html`
                            <div class="log-entry">
                                <span class="log-source">${entry.source}</span>
                                <span class="log-phase log-phase-${entry.phase}"
                                    >${entry.phase}</span
                                >
                                #${entry.pointerId} ${entry.pointerType}
                                (${Math.round(entry.position.x)},${Math.round(
                                    entry.position.y,
                                )})
                                ${entry.detail}
                                <span class="log-time">${entry.time}</span>
                            </div>
                        `,
                    )}
                </div>

                <div class="status-bar">
                    <span>
                        <span class="data-label">Canvas drag:</span>
                        <span class="data-value"
                            >${this.dragTarget?.id ?? "none"}</span
                        >
                    </span>
                </div>
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

            if (prevPos) {
                this.applyCanvasTransform(snapshot);
            }

            this.previousPositions.set(changed.id, changed.position);

            if (snapshot.activeCount >= 2) {
                this.previousPairMetrics = this.currentCanvasPairMetrics();
            }

            if (this.moveCount % LOG_MOVE_THROTTLE === 0) {
                const d = prevPos
                    ? delta(prevPos, changed.position)
                    : { x: 0, y: 0 };
                const v = prevPos
                    ? velocity(prevPos, changed.position, 16)
                    : { x: 0, y: 0 };
                this.addLogEntry(
                    snapshot,
                    `Δ(${d.x.toFixed(0)},${d.y.toFixed(0)}) vel(${v.x.toFixed(2)},${v.y.toFixed(2)})`,
                    "canvas",
                );
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
        if (!this.dragTarget) {
            return;
        }

        const rect = this.dragTarget;

        if (snapshot.activeCount === 1) {
            const prevPos = this.previousPositions.get(snapshot.changed.id);
            if (!prevPos) {
                return;
            }

            const d = delta(prevPos, snapshot.changed.position);
            rect.x += d.x;
            rect.y += d.y;
            return;
        }

        if (snapshot.activeCount >= 2 && this.previousPairMetrics) {
            const currentMetrics = this.currentCanvasPairMetrics();
            if (!currentMetrics) {
                return;
            }

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

        if (pointers.length < 2) {
            return null;
        }

        return pairMetrics(pointers[0]!.position, pointers[1]!.position);
    }

    private canvasOffset(): Point {
        if (!this.canvasEl) {
            return { x: 0, y: 0 };
        }

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
