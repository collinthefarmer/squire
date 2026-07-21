import { test, expect, describe } from "bun:test";
import {
    fingerCount,
    movedInAxis,
    movedDistance,
    scrollBoundaryPull,
} from "./claim-conditions";
import type { PointerSnapshot, TrackedPointer } from "./pointer-tracker";

function makePointer(
    id: number,
    position: { x: number; y: number },
    startPosition?: { x: number; y: number },
): TrackedPointer {
    return {
        id,
        position,
        startPosition: startPosition ?? position,
        startTime: 0,
        pointerType: "touch",
    };
}

function makeSnapshot(pointers: TrackedPointer[]): PointerSnapshot {
    const active = new Map(pointers.map((p) => [p.id, p]));

    return {
        phase: "move",
        changed: pointers.at(-1)!,
        active,
        activeCount: active.size,
        timestamp: 0,
        originalEvent: {} as PointerEvent,
    };
}

describe("claim conditions", () => {
    describe("fingerCount", () => {
        test("should return true when count met", () => {
            const condition = fingerCount(2);
            const snapshot = makeSnapshot([
                makePointer(1, { x: 0, y: 0 }),
                makePointer(2, { x: 100, y: 0 }),
            ]);

            expect(condition(snapshot)).toBe(true);
        });

        test("should return false when count not met", () => {
            const condition = fingerCount(2);
            const snapshot = makeSnapshot([makePointer(1, { x: 0, y: 0 })]);

            expect(condition(snapshot)).toBe(false);
        });

        test("should return true when count exceeded", () => {
            const condition = fingerCount(2);
            const snapshot = makeSnapshot([
                makePointer(1, { x: 0, y: 0 }),
                makePointer(2, { x: 100, y: 0 }),
                makePointer(3, { x: 200, y: 0 }),
            ]);

            expect(condition(snapshot)).toBe(true);
        });
    });

    describe("movedInAxis", () => {
        test("should detect horizontal movement", () => {
            const condition = movedInAxis("horizontal", 10);
            const snapshot = makeSnapshot([
                makePointer(1, { x: 15, y: 0 }, { x: 0, y: 0 }),
            ]);

            expect(condition(snapshot)).toBe(true);
        });

        test("should not trigger for movement below threshold", () => {
            const condition = movedInAxis("horizontal", 10);
            const snapshot = makeSnapshot([
                makePointer(1, { x: 5, y: 0 }, { x: 0, y: 0 }),
            ]);

            expect(condition(snapshot)).toBe(false);
        });

        test("should detect vertical movement", () => {
            const condition = movedInAxis("vertical", 10);
            const snapshot = makeSnapshot([
                makePointer(1, { x: 0, y: -15 }, { x: 0, y: 0 }),
            ]);

            expect(condition(snapshot)).toBe(true);
        });

        test("should ignore cross-axis movement", () => {
            const condition = movedInAxis("horizontal", 10);
            const snapshot = makeSnapshot([
                makePointer(1, { x: 2, y: 50 }, { x: 0, y: 0 }),
            ]);

            expect(condition(snapshot)).toBe(false);
        });

        test("should trigger if any pointer meets threshold", () => {
            const condition = movedInAxis("horizontal", 10);
            const snapshot = makeSnapshot([
                makePointer(1, { x: 2, y: 0 }, { x: 0, y: 0 }),
                makePointer(2, { x: 20, y: 0 }, { x: 5, y: 0 }),
            ]);

            expect(condition(snapshot)).toBe(true);
        });
    });

    describe("movedDistance", () => {
        test("should detect diagonal movement", () => {
            const condition = movedDistance(10);
            const snapshot = makeSnapshot([
                makePointer(1, { x: 8, y: 8 }, { x: 0, y: 0 }),
            ]);

            // distance = hypot(8, 8) ≈ 11.3
            expect(condition(snapshot)).toBe(true);
        });

        test("should not trigger below threshold", () => {
            const condition = movedDistance(10);
            const snapshot = makeSnapshot([
                makePointer(1, { x: 3, y: 4 }, { x: 0, y: 0 }),
            ]);

            // distance = hypot(3, 4) = 5
            expect(condition(snapshot)).toBe(false);
        });

        test("should trigger if any pointer meets threshold", () => {
            const condition = movedDistance(10);
            const snapshot = makeSnapshot([
                makePointer(1, { x: 1, y: 1 }, { x: 0, y: 0 }),
                makePointer(2, { x: 20, y: 0 }, { x: 0, y: 0 }),
            ]);

            expect(condition(snapshot)).toBe(true);
        });
    });

    describe("scrollBoundaryPull", () => {
        function mockElement(overrides: {
            scrollTop?: number;
            scrollHeight?: number;
            clientHeight?: number;
            scrollLeft?: number;
            scrollWidth?: number;
            clientWidth?: number;
        }): HTMLElement {
            return {
                scrollTop: 0,
                scrollHeight: 1000,
                clientHeight: 500,
                scrollLeft: 0,
                scrollWidth: 500,
                clientWidth: 500,
                ...overrides,
            } as unknown as HTMLElement;
        }

        test("should claim when at top and pulling down past threshold", () => {
            const el = mockElement({ scrollTop: 0 });
            const condition = scrollBoundaryPull(el, "down", 15);
            const snapshot = makeSnapshot([
                makePointer(1, { x: 100, y: 30 }, { x: 100, y: 0 }),
            ]);

            expect(condition(snapshot)).toBe(true);
        });

        test("should not claim when at top but pull is below threshold", () => {
            const el = mockElement({ scrollTop: 0 });
            const condition = scrollBoundaryPull(el, "down", 15);
            const snapshot = makeSnapshot([
                makePointer(1, { x: 100, y: 5 }, { x: 100, y: 0 }),
            ]);

            expect(condition(snapshot)).toBe(false);
        });

        test("should not claim when scrolled away from top", () => {
            const el = mockElement({ scrollTop: 100 });
            const condition = scrollBoundaryPull(el, "down", 15);
            const snapshot = makeSnapshot([
                makePointer(1, { x: 100, y: 30 }, { x: 100, y: 0 }),
            ]);

            expect(condition(snapshot)).toBe(false);
        });

        test("should not claim when pulling up (wrong direction)", () => {
            const el = mockElement({ scrollTop: 0 });
            const condition = scrollBoundaryPull(el, "down", 15);
            const snapshot = makeSnapshot([
                makePointer(1, { x: 100, y: -30 }, { x: 100, y: 0 }),
            ]);

            expect(condition(snapshot)).toBe(false);
        });

        test("should claim at bottom boundary pulling up", () => {
            const el = mockElement({
                scrollTop: 500,
                scrollHeight: 1000,
                clientHeight: 500,
            });
            const condition = scrollBoundaryPull(el, "up", 15);
            const snapshot = makeSnapshot([
                makePointer(1, { x: 100, y: -20 }, { x: 100, y: 0 }),
            ]);

            expect(condition(snapshot)).toBe(true);
        });

        test("should claim at left boundary pulling right", () => {
            const el = mockElement({ scrollLeft: 0 });
            const condition = scrollBoundaryPull(el, "right", 15);
            const snapshot = makeSnapshot([
                makePointer(1, { x: 30, y: 0 }, { x: 0, y: 0 }),
            ]);

            expect(condition(snapshot)).toBe(true);
        });
    });
});
