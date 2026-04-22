import { test, expect, describe } from "bun:test";
import {
    applyClockCreate,
    applyClockStart,
    applyClockPause,
    applyClockAdjust,
    applyClockDestroy,
    applyClockUpdate,
    applyTimeScaleChange,
    getRemainingTime,
    formatTime,
    getUrgency,
} from "./clock-state";
import { makeMetadata } from "../../test-utils/factories";
import type { ClockState } from "./clock-state";

function makeClocks(
    ...entries: [string, Partial<ClockState>][]
): Map<string, ClockState> {
    const map = new Map<string, ClockState>();

    for (const [id, overrides] of entries) {
        map.set(id, {
            id,
            duration: 60000,
            elapsed: 0,
            running: false,
            startedAt: null,
            position: { x: "center", y: "top" },
            zIndex: 100,
            visible: true,
            respectTimeScale: true,
            scaleAtStart: 1.0,
            visibility: "always",
            onComplete: "persist",
            completed: false,
            ...overrides,
        });
    }

    return map;
}

describe("clock-state computation helpers", () => {
    describe("getRemainingTime", () => {
        test("should return full duration for fresh clock", () => {
            const clocks = makeClocks(["t1", { duration: 60000 }]);
            expect(getRemainingTime(clocks.get("t1")!)).toBe(60000);
        });

        test("should subtract elapsed time for running clock", () => {
            const clocks = makeClocks([
                "t1",
                { duration: 60000, running: true, startedAt: 1000 },
            ]);
            // now=11000, real elapsed=10000, scale=1 → remaining = 60000 - 0 - 10000 = 50000
            expect(getRemainingTime(clocks.get("t1")!, 11000)).toBe(50000);
        });

        test("should apply time scale to running clock", () => {
            const clocks = makeClocks([
                "t1",
                {
                    duration: 60000,
                    running: true,
                    startedAt: 1000,
                    respectTimeScale: true,
                    scaleAtStart: 2.0,
                },
            ]);
            // now=11000, real elapsed=10000, scale=2 → game elapsed=20000
            // remaining = 60000 - 0 - 20000 = 40000
            expect(getRemainingTime(clocks.get("t1")!, 11000)).toBe(40000);
        });

        test("should return 0 for completed clock", () => {
            const clocks = makeClocks(["t1", { completed: true }]);
            expect(getRemainingTime(clocks.get("t1")!)).toBe(0);
        });

        test("should never return negative", () => {
            const clocks = makeClocks([
                "t1",
                { duration: 1000, running: true, startedAt: 0 },
            ]);
            // now=999999 → way past duration
            expect(getRemainingTime(clocks.get("t1")!, 999999)).toBe(0);
        });
    });

    describe("formatTime", () => {
        test("should format minutes and seconds", () => {
            expect(formatTime(90000)).toBe("1:30");
        });

        test("should format seconds only when under a minute", () => {
            expect(formatTime(5000)).toBe("5");
        });

        test("should pad seconds", () => {
            expect(formatTime(65000)).toBe("1:05");
        });

        test("should ceil to nearest second", () => {
            expect(formatTime(1500)).toBe("2");
        });
    });

    describe("getUrgency", () => {
        test("should return 0 for full time remaining", () => {
            const clocks = makeClocks(["t1", { duration: 60000 }]);
            expect(getUrgency(clocks.get("t1")!)).toBe(0);
        });

        test("should return 1 for zero duration", () => {
            const clocks = makeClocks(["t1", { duration: 0 }]);
            expect(getUrgency(clocks.get("t1")!)).toBe(1);
        });

        test("should return ratio for partially elapsed", () => {
            const clocks = makeClocks([
                "t1",
                { duration: 60000, elapsed: 30000 },
            ]);
            expect(getUrgency(clocks.get("t1")!)).toBe(0.5);
        });
    });
});

describe("clock-state event reducers", () => {
    describe("applyClockCreate", () => {
        test("should create a clock with defaults", () => {
            const result = applyClockCreate(new Map(), {
                type: "ui.clock.create",
                payload: { id: "t1", duration: 60000 },
                metadata: makeMetadata(5000),
            });

            const clock = result.get("t1")!;
            expect(clock.duration).toBe(60000);
            expect(clock.running).toBe(false);
            expect(clock.startedAt).toBeNull();
            expect(clock.visible).toBe(true);
        });

        test("should auto-start when autoStart=true", () => {
            const result = applyClockCreate(
                new Map(),
                {
                    type: "ui.clock.create",
                    payload: { id: "t1", duration: 60000, autoStart: true },
                    metadata: makeMetadata(5000),
                },
                2.0, // currentScale
            );

            const clock = result.get("t1")!;
            expect(clock.running).toBe(true);
            expect(clock.startedAt).toBe(5000);
            expect(clock.scaleAtStart).toBe(2.0);
        });
    });

    describe("applyClockStart", () => {
        test("should start a paused clock", () => {
            const clocks = makeClocks(["t1", {}]);

            const result = applyClockStart(
                clocks,
                {
                    type: "ui.clock.start",
                    payload: { id: "t1" },
                    metadata: makeMetadata(5000),
                },
                1.5,
            );

            const clock = result.get("t1")!;
            expect(clock.running).toBe(true);
            expect(clock.startedAt).toBe(5000);
            expect(clock.scaleAtStart).toBe(1.5);
        });
    });

    describe("applyClockPause", () => {
        test("should accumulate elapsed time on pause", () => {
            const clocks = makeClocks([
                "t1",
                {
                    duration: 60000,
                    running: true,
                    startedAt: 1000,
                    scaleAtStart: 1.0,
                    respectTimeScale: true,
                },
            ]);

            const result = applyClockPause(clocks, {
                type: "ui.clock.pause",
                payload: { id: "t1" },
                metadata: makeMetadata(11000), // 10 seconds later
            });

            const clock = result.get("t1")!;
            expect(clock.running).toBe(false);
            expect(clock.elapsed).toBe(10000);
            expect(clock.startedAt).toBeNull();
        });

        test("should apply time scale when accumulating", () => {
            const clocks = makeClocks([
                "t1",
                {
                    duration: 60000,
                    running: true,
                    startedAt: 1000,
                    scaleAtStart: 2.0,
                    respectTimeScale: true,
                },
            ]);

            const result = applyClockPause(clocks, {
                type: "ui.clock.pause",
                payload: { id: "t1" },
                metadata: makeMetadata(6000), // 5 seconds real time
            });

            // 5s real * 2x scale = 10s game time
            expect(result.get("t1")!.elapsed).toBe(10000);
        });
    });

    describe("applyClockAdjust", () => {
        test("should add delta to duration", () => {
            const clocks = makeClocks(["t1", { duration: 60000 }]);

            const result = applyClockAdjust(clocks, {
                type: "ui.clock.adjust",
                payload: { id: "t1", delta: 30000 },
                metadata: makeMetadata(),
            });

            expect(result.get("t1")!.duration).toBe(90000);
        });

        test("should support negative delta", () => {
            const clocks = makeClocks(["t1", { duration: 60000 }]);

            const result = applyClockAdjust(clocks, {
                type: "ui.clock.adjust",
                payload: { id: "t1", delta: -10000 },
                metadata: makeMetadata(),
            });

            expect(result.get("t1")!.duration).toBe(50000);
        });
    });

    describe("applyClockDestroy", () => {
        test("should remove clock from map", () => {
            const clocks = makeClocks(["t1", {}]);

            const result = applyClockDestroy(clocks, {
                type: "ui.clock.destroy",
                payload: { id: "t1" },
                metadata: makeMetadata(),
            });

            expect(result.has("t1")).toBe(false);
        });
    });

    describe("applyClockUpdate", () => {
        test("should update position and visibility", () => {
            const clocks = makeClocks(["t1", {}]);

            const result = applyClockUpdate(clocks, {
                type: "ui.clock.update",
                payload: {
                    id: "t1",
                    position: { x: 500, y: 300 },
                    visible: false,
                },
                metadata: makeMetadata(),
            });

            const clock = result.get("t1")!;
            expect(clock.position).toEqual({ x: 500, y: 300 });
            expect(clock.visible).toBe(false);
        });
    });

    describe("applyTimeScaleChange", () => {
        test("should accumulate elapsed and update scale for running clocks", () => {
            const clocks = makeClocks([
                "t1",
                {
                    running: true,
                    startedAt: 1000,
                    scaleAtStart: 1.0,
                    respectTimeScale: true,
                },
            ]);

            const now = 6000; // 5s real time
            const result = applyTimeScaleChange(clocks, 2.0, now);

            const clock = result.get("t1")!;
            expect(clock.elapsed).toBe(5000); // 5s * 1.0 old scale
            expect(clock.startedAt).toBe(now);
            expect(clock.scaleAtStart).toBe(2.0);
        });

        test("should not affect non-running clocks", () => {
            const clocks = makeClocks([
                "t1",
                { running: false, respectTimeScale: true },
            ]);

            const result = applyTimeScaleChange(clocks, 2.0);
            expect(result.get("t1")!.scaleAtStart).toBe(1.0); // Unchanged
        });

        test("should not affect clocks that don't respect time scale", () => {
            const clocks = makeClocks([
                "t1",
                {
                    running: true,
                    startedAt: 1000,
                    respectTimeScale: false,
                },
            ]);

            const result = applyTimeScaleChange(clocks, 2.0, 6000);
            expect(result.get("t1")!.scaleAtStart).toBe(1.0); // Unchanged
        });

        test("should skip when scale hasn't changed", () => {
            const clocks = makeClocks([
                "t1",
                {
                    running: true,
                    startedAt: 1000,
                    scaleAtStart: 2.0,
                    respectTimeScale: true,
                },
            ]);

            const result = applyTimeScaleChange(clocks, 2.0, 6000);
            expect(result.get("t1")!.elapsed).toBe(0); // No accumulation
        });
    });
});
