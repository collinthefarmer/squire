import { describe, test, expect } from "bun:test";
import { canScrollInDirection } from "./pointers";
import type { ScrollState } from "./pointers";

function makeScrollState(overrides?: Partial<ScrollState>): ScrollState {
    return {
        scrollTop: 0,
        scrollHeight: 1000,
        clientHeight: 500,
        scrollLeft: 0,
        scrollWidth: 500,
        clientWidth: 500,
        ...overrides,
    };
}

describe("canScrollInDirection", () => {
    test("at top, finger moving down (overscroll) — cannot scroll", () => {
        const scroll = makeScrollState({ scrollTop: 0 });
        expect(canScrollInDirection(scroll, 0, 10)).toBe(false);
    });

    test("at top, finger moving up (scroll into content) — can scroll", () => {
        const scroll = makeScrollState({ scrollTop: 0 });
        expect(canScrollInDirection(scroll, 0, -10)).toBe(true);
    });

    test("mid-scroll, finger moving down — can scroll", () => {
        const scroll = makeScrollState({ scrollTop: 200 });
        expect(canScrollInDirection(scroll, 0, 10)).toBe(true);
    });

    test("mid-scroll, finger moving up — can scroll", () => {
        const scroll = makeScrollState({ scrollTop: 200 });
        expect(canScrollInDirection(scroll, 0, -10)).toBe(true);
    });

    test("at bottom, finger moving up (overscroll) — cannot scroll", () => {
        const scroll = makeScrollState({
            scrollTop: 500,
            scrollHeight: 1000,
            clientHeight: 500,
        });
        expect(canScrollInDirection(scroll, 0, -10)).toBe(false);
    });

    test("at bottom, finger moving down (scroll back up) — can scroll", () => {
        const scroll = makeScrollState({
            scrollTop: 500,
            scrollHeight: 1000,
            clientHeight: 500,
        });
        expect(canScrollInDirection(scroll, 0, 10)).toBe(true);
    });

    test("horizontal: at left edge, finger moving right (overscroll) — cannot scroll", () => {
        const scroll = makeScrollState({
            scrollLeft: 0,
            scrollWidth: 1000,
            clientWidth: 500,
        });
        expect(canScrollInDirection(scroll, 10, 0)).toBe(false);
    });

    test("horizontal: at left edge, finger moving left (scroll into content) — can scroll", () => {
        const scroll = makeScrollState({
            scrollLeft: 0,
            scrollWidth: 1000,
            clientWidth: 500,
        });
        expect(canScrollInDirection(scroll, -10, 0)).toBe(true);
    });

    test("no movement — cannot scroll", () => {
        const scroll = makeScrollState();
        expect(canScrollInDirection(scroll, 0, 0)).toBe(false);
    });

    test("dominant axis wins when diagonal", () => {
        const scroll = makeScrollState({ scrollTop: 0 });

        // More vertical than horizontal — uses vertical check
        expect(canScrollInDirection(scroll, 3, 10)).toBe(false);

        // More horizontal — uses horizontal check
        expect(canScrollInDirection(scroll, 10, 3)).toBe(false);
    });
});
