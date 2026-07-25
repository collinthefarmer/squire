import { test, expect, describe } from "bun:test";
import { Subject } from "rxjs";
import { drag, type DragEvent } from "./recognizers/drag";
import { pinch, type PinchEvent } from "./recognizers/pinch";
import { tap, type TapEvent } from "./recognizers/tap";
import { defineRecognizer, describe as describeGesture, type PointerFrame } from "./harness";
import { fakePointer, gestureOf } from "./gesture-fixture";
import type { PointerStream } from "./pointers";
import type { Recognition, Recognizer } from "./recognizers/recognizer";

/**
 * A minimal absorbing recognizer: claims as soon as it has a pointer
 * and emits the active pointer count each frame. Exercises the growing
 * set and the count < touches end rule.
 */
function counter(): Recognizer<number> {
    return defineRecognizer(
        "counter",
        1,
        ({ pointers$ }) =>
            describeGesture(pointers$, {
                decide: (f: PointerFrame) => (f.positions.length >= 1 ? 1 : null),
                toEvent: (f: PointerFrame) => f.positions.length,
                toEnd: (_end, last: number) => last,
            }),
        { absorbs: true },
    );
}

describe("recognizer harness", () => {
    describe("tap", () => {
        test("claims a quick, still release and emits the tap", () => {
            const p = fakePointer(1, { x: 0, y: 0 });
            const seen: Recognition<TapEvent>[] = [];
            tap().recognize([p.stream]).subscribe((r) => seen.push(r));

            p.lift();

            expect(seen).toHaveLength(1);
            expect(seen[0]!.claimed).toBe(true);

            const events: TapEvent[] = [];
            gestureOf(seen[0]!).subscribe((e) => events.push(e));
            expect(events).toHaveLength(1);
            expect(events[0]!.position).toEqual({ x: 0, y: 0 });
        });

        test("rejects when the finger moves past threshold", () => {
            const p = fakePointer(1, { x: 0, y: 0 });
            const seen: Recognition<TapEvent>[] = [];
            tap().recognize([p.stream]).subscribe((r) => seen.push(r));

            p.moveTo(50, 0);

            expect(seen).toHaveLength(1);
            expect(seen[0]!.claimed).toBe(false);
        });
    });

    describe("drag", () => {
        test("does not claim below threshold", () => {
            const p = fakePointer(1, { x: 0, y: 0 });
            const seen: Recognition<DragEvent>[] = [];
            drag().recognize([p.stream]).subscribe((r) => seen.push(r));

            p.moveTo(5, 0);
            expect(seen).toHaveLength(0);
        });

        test("claims past threshold and emits move… then end", () => {
            const p = fakePointer(1, { x: 0, y: 0 });
            const seen: Recognition<DragEvent>[] = [];
            drag().recognize([p.stream]).subscribe((r) => seen.push(r));

            p.moveTo(20, 0);
            expect(seen).toHaveLength(1);
            expect(seen[0]!.claimed).toBe(true);

            const events: DragEvent[] = [];
            gestureOf(seen[0]!).subscribe((e) => events.push(e));

            p.moveTo(30, 0);
            p.lift(30, 0);

            expect(events.map((e) => e.phase)).toEqual(["move", "move", "end"]);
            expect(events.at(-1)!.delta).toEqual({ x: 30, y: 0 });
        });
    });

    describe("pinch", () => {
        test("the seeded set alone (no movement) does not claim", () => {
            const p1 = fakePointer(1, { x: 0, y: 0 });
            const p2 = fakePointer(2, { x: 100, y: 0 });
            const seen: Recognition<PinchEvent>[] = [];
            pinch().recognize([p1.stream, p2.stream]).subscribe((r) => seen.push(r));

            // both fingers present at their starts → scale 1.0
            expect(seen).toHaveLength(0);
        });

        test("claims when the distance changes — on either finger", () => {
            const p1 = fakePointer(1, { x: 0, y: 0 });
            const p2 = fakePointer(2, { x: 100, y: 0 });
            const seen: Recognition<PinchEvent>[] = [];
            pinch().recognize([p1.stream, p2.stream]).subscribe((r) => seen.push(r));

            // one finger moves; the other held at its start → distance 130
            p1.moveTo(-30, 0); // scale 1.3
            expect(seen).toHaveLength(1);
            expect(seen[0]!.claimed).toBe(true);
        });
    });

    describe("absorbing set", () => {
        test("grows on absorbed pointers, ends only when the set empties", () => {
            const added$ = new Subject<PointerStream>();
            const p1 = fakePointer(1, { x: 0, y: 0 });

            const seen: Recognition<number>[] = [];
            counter().recognize([p1.stream], added$).subscribe((r) => seen.push(r));

            // seeded set → claims immediately with one pointer
            expect(seen).toHaveLength(1);
            expect(seen[0]!.claimed).toBe(true);

            const counts: number[] = [];
            let completed = false;
            gestureOf(seen[0]!).subscribe({
                next: (c) => counts.push(c),
                complete: () => {
                    completed = true;
                },
            });

            expect(counts.at(-1)).toBe(1);

            // absorb a second pointer → the set grows
            const p2 = fakePointer(2, { x: 50, y: 0 });
            added$.next(p2.stream);
            expect(counts.at(-1)).toBe(2);

            // the first finger lifts → still one alive, gesture continues
            p1.lift();
            expect(counts).toContain(1);
            expect(completed).toBe(false);

            // the last finger lifts → set empty → gesture ends
            p2.lift();
            expect(completed).toBe(true);
        });
    });
});
