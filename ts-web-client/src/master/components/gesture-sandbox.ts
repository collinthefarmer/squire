/**
 * Gesture sandbox — pointer data exploration component.
 *
 * Visualizes raw pointer data, geometric relationships between
 * pointers, and lets you interact with draggable/scalable objects.
 * No gesture classification — just data and direct manipulation.
 */

import { html, nothing, type TemplateResult } from "lit-html";
import { BaseComponent } from "@core/base-component";
import { PointerTracker } from "@gestures/pointer-tracker";
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
}

const MAX_LOG_ENTRIES = 30;
const LOG_MOVE_THROTTLE = 5;

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

.data-label {
    color: #7f8c9b;
}

.data-value {
    color: #e94560;
}

.canvas-area {
    position: relative;
    overflow: hidden;
    cursor: crosshair;
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
}

.log-panel {
    height: 160px;
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

.pair-data {
    color: #bd93f9;
}
`;

export class GestureSandbox extends BaseComponent {
    private tracker: PointerTracker | null = null;
    private activePointers: ReadonlyMap<number, TrackedPointer> = new Map();
    private previousPairMetrics: PointerPairMetrics | null = null;
    private log: LogEntry[] = [];
    private moveCount = 0;
    private canvasEl: HTMLDivElement | null = null;

    private rects: SandboxRect[] = [
        {
            id: "A",
            x: 80,
            y: 100,
            width: 120,
            height: 90,
            scale: 1,
            rotation: 0,
            color: "rgba(233, 69, 96, 0.5)",
        },
        {
            id: "B",
            x: 300,
            y: 150,
            width: 100,
            height: 100,
            scale: 1,
            rotation: 0,
            color: "rgba(80, 250, 123, 0.5)",
        },
        {
            id: "C",
            x: 520,
            y: 120,
            width: 140,
            height: 80,
            scale: 1,
            rotation: 0,
            color: "rgba(98, 114, 164, 0.5)",
        },
    ];

    private dragTarget: SandboxRect | null = null;
    private previousPositions = new Map<number, Point>();

    override connectedCallback(): void {
        super.connectedCallback();
        this.adoptStyles(STYLES);
        this.update();

        requestAnimationFrame(() => {
            this.canvasEl = this.shadowRoot!.querySelector(".canvas-area");

            if (this.canvasEl) {
                this.tracker = new PointerTracker(this.canvasEl);

                this.subscribe(this.tracker.events$, (snapshot) => {
                    this.handlePointerEvent(snapshot);
                });
            }
        });
    }

    override disconnectedCallback(): void {
        this.tracker?.destroy();
        this.tracker = null;
        super.disconnectedCallback();
    }

    protected template(): TemplateResult {
        const pointers = [...this.activePointers.values()];
        const pairValues =
            pointers.length >= 2 ? this.currentPairMetrics() : null;

        return html`
            <div class="layout">
                <div class="data-panel">
                    <span>
                        <span class="data-label">Active:</span>
                        <span class="data-value">${pointers.length}</span>
                    </span>
                    ${pointers.map(
                        (p) => html`
                            <span>
                                <span class="data-label">#${p.id}:</span>
                                <span class="data-value"
                                    >(${Math.round(p.position.x)},
                                    ${Math.round(p.position.y)})</span
                                >
                                <span class="data-label">${p.pointerType}</span>
                            </span>
                        `,
                    )}
                    ${pairValues
                        ? html`
                              <span class="pair-data">
                                  <span class="data-label">Pair:</span>
                                  dist=${Math.round(pairValues.distance)}
                                  angle=${pairValues.angle.toFixed(2)}rad
                                  mid=(${Math.round(
                                      pairValues.midpoint.x,
                                  )},${Math.round(pairValues.midpoint.y)})
                              </span>
                          `
                        : nothing}
                </div>

                <div class="canvas-area">
                    ${this.rects.map(
                        (r) => html`
                            <div
                                class="rect"
                                style="
                                    left: ${r.x}px;
                                    top: ${r.y}px;
                                    width: ${r.width}px;
                                    height: ${r.height}px;
                                    background: ${r.color};
                                    transform: scale(${r.scale}) rotate(${r.rotation}rad);
                                    transform-origin: center center;
                                "
                            >
                                ${r.id}
                            </div>
                        `,
                    )}
                    ${pointers.map(
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

                <div class="log-panel">
                    ${this.log.map(
                        (entry) => html`
                            <div class="log-entry">
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
                        <span class="data-label">Pointers:</span>
                        <span class="data-value">${pointers.length}</span>
                    </span>
                    <span>
                        <span class="data-label">Drag target:</span>
                        <span class="data-value"
                            >${this.dragTarget?.id ?? "none"}</span
                        >
                    </span>
                </div>
            </div>
        `;
    }

    private handlePointerEvent(snapshot: PointerSnapshot): void {
        this.activePointers = snapshot.active;

        const { phase, changed } = snapshot;
        const prevPos = this.previousPositions.get(changed.id);

        if (phase === "start") {
            this.previousPositions.set(changed.id, changed.position);
            this.dragTarget = this.hitTest(changed.position);

            if (snapshot.activeCount >= 2) {
                this.previousPairMetrics = this.currentPairMetrics();
            }

            this.addLogEntry(snapshot, "");
        }

        if (phase === "move") {
            this.moveCount++;

            if (prevPos) {
                this.applyTransform(snapshot);
            }

            this.previousPositions.set(changed.id, changed.position);

            if (snapshot.activeCount >= 2) {
                this.previousPairMetrics = this.currentPairMetrics();
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
                );
            }
        }

        if (phase === "end" || phase === "cancel") {
            this.previousPositions.delete(changed.id);

            if (snapshot.activeCount === 0) {
                this.dragTarget = null;
                this.previousPairMetrics = null;
            }

            this.addLogEntry(snapshot, "");
        }

        this.update();
    }

    private applyTransform(snapshot: PointerSnapshot): void {
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
            const currentMetrics = this.currentPairMetrics();
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

    private currentPairMetrics(): PointerPairMetrics | null {
        const pointers = [...this.activePointers.values()];

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

    private addLogEntry(snapshot: PointerSnapshot, detail: string): void {
        const now = new Date();
        const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;

        this.log.unshift({
            phase: snapshot.phase,
            pointerId: snapshot.changed.id,
            position: snapshot.changed.position,
            pointerType: snapshot.changed.pointerType,
            detail,
            time,
        });

        if (this.log.length > MAX_LOG_ENTRIES) {
            this.log.length = MAX_LOG_ENTRIES;
        }
    }
}
