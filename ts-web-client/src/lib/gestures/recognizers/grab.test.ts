import { test, expect, describe } from "bun:test";
import { Subject } from "rxjs";
import { grab, type GrabEvent } from "./grab";
import { fakePointer, gestureOf } from "../gesture-fixture";
import type { PointerStream } from "../pointers";
import type { Recognition } from "./recognizer";

describe("grab (escalating manipulation)", () => {
    test("one finger translates; a second adds scale with no jump; lift rebases", () => {
        const added$ = new Subject<PointerStream>();
        const p1 = fakePointer(1, { x: 0, y: 0 });

        const seen: Recognition<GrabEvent>[] = [];
        grab().recognize([p1.stream], added$).subscribe((r) => seen.push(r));

        // one finger past threshold → claims
        p1.moveTo(20, 0);
        expect(seen).toHaveLength(1);
        expect(seen[0]!.claimed).toBe(true);

        const events: GrabEvent[] = [];
        let completed = false;
        gestureOf(seen[0]!).subscribe({
            next: (e) => events.push(e),
            complete: () => {
                completed = true;
            },
        });

        expect(events.at(-1)!.translation.x).toBeCloseTo(20);
        expect(events.at(-1)!.scale).toBeCloseTo(1);
        expect(events.at(-1)!.rotating).toBe(false);

        // absorb a second finger — the transform doesn't jump
        const p2 = fakePointer(2, { x: 100, y: 0 });
        added$.next(p2.stream);
        expect(events.at(-1)!.translation.x).toBeCloseTo(20);
        expect(events.at(-1)!.scale).toBeCloseTo(1);

        // spread the fingers along the axis (80 → 120) → scale engages,
        // but with no twist the grab does not read as rotating.
        p2.moveTo(140, 0);
        expect(events.at(-1)!.scale).toBeCloseTo(1.5);
        expect(events.at(-1)!.rotating).toBe(false);

        // first finger lifts, one still down → scale frozen, still alive.
        p1.lift();
        p2.moveTo(160, 0);
        expect(events.at(-1)!.scale).toBeCloseTo(1.5);
        expect(events.at(-1)!.rotating).toBe(false);
        expect(completed).toBe(false);

        // last finger lifts → grab ends
        p2.lift();
        expect(completed).toBe(true);
    });

    test("rotating tracks an actual twist, read from the transform", () => {
        const added$ = new Subject<PointerStream>();
        const p1 = fakePointer(1, { x: 0, y: 0 });

        const seen: Recognition<GrabEvent>[] = [];
        grab().recognize([p1.stream], added$).subscribe((r) => seen.push(r));

        p1.moveTo(20, 0); // claim on one finger

        const events: GrabEvent[] = [];
        gestureOf(seen[0]!).subscribe((e) => events.push(e));

        // second finger lands abreast → the reference pair is horizontal
        const p2 = fakePointer(2, { x: 100, y: 0 });
        added$.next(p2.stream);
        expect(events.at(-1)!.rotating).toBe(false);

        // swing it to vertical → a quarter-turn twist about the pair
        p2.moveTo(20, 100);
        expect(events.at(-1)!.rotating).toBe(true);
        expect(Math.abs(events.at(-1)!.rotation)).toBeCloseTo(Math.PI / 2);
    });
});
