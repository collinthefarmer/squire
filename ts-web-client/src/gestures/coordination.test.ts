import { test, expect, describe } from "bun:test";
import { Subject } from "rxjs";
import { gestures } from "./coordination";
import { drag, type DragEvent } from "./recognizers/drag";
import { grab, type GrabEvent } from "./recognizers/grab";
import { fakePointer } from "./gesture-fixture";
import type { PointerStream } from "./pointers";

// Let the concurrent-window debounce (buffer boundary) fire.
const tick = (ms = 5) => new Promise<void>((r) => setTimeout(r, ms));

/** A gesture source over a drivable pointer stream — no DOM. */
function harness() {
    const source$ = new Subject<PointerStream>();
    const src = gestures(source$.asObservable(), { concurrentWindowMs: 1 });
    return {
        src,
        down: (p: ReturnType<typeof fakePointer>) => source$.next(p.stream),
    };
}

describe("coordination", () => {
    test("a winning recognizer captures its pointers and emits its gesture", async () => {
        const { src, down } = harness();
        const events: DragEvent[] = [];
        src.on(drag()).subscribe((e) => events.push(e));

        const p = fakePointer(1, { x: 0, y: 0 });
        down(p);
        await tick(); // buffer closes → the competition subscribes p.move$

        p.moveTo(20, 0);
        p.moveTo(30, 0);
        p.lift(30, 0);

        expect(events.map((e) => e.phase)).toEqual(["move", "move", "end"]);
        expect(p.flags.captured).toBe(true);
    });

    test("releases pointers when no recognizer claims", async () => {
        const { src, down } = harness();
        src.on(drag()).subscribe();

        const p = fakePointer(1, { x: 0, y: 0 });
        down(p);
        await tick();

        p.lift(); // no movement → drag never claims → rejected
        expect(p.flags.released).toBe(true);
    });

    test("absorbs a pointer that lands while a grab is active", async () => {
        const { src, down } = harness();
        const events: GrabEvent[] = [];
        src.on(grab()).subscribe((e) => events.push(e));

        const p1 = fakePointer(1, { x: 0, y: 0 });
        down(p1);
        await tick();

        p1.moveTo(20, 0); // grab claims — one finger, scale 1
        expect(events.at(-1)!.scale).toBeCloseTo(1);

        // a second finger lands after the grab is active: it must join the
        // grab (routed to the absorber), not open a new competition.
        const p2 = fakePointer(2, { x: 100, y: 0 });
        down(p2);
        p2.moveTo(160, 0); // spreads the pair → scale only changes if p2 joined

        expect(events.at(-1)!.scale).toBeGreaterThan(1.1);
        expect(p2.flags.captured).toBe(true);
    });
});
