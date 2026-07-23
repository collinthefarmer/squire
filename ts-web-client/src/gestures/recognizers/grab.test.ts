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

        // absorb a second finger — the transform doesn't jump
        const p2 = fakePointer(2, { x: 100, y: 0 });
        added$.next(p2.stream);
        expect(events.at(-1)!.translation.x).toBeCloseTo(20);
        expect(events.at(-1)!.scale).toBeCloseTo(1);

        // spread the fingers (80 → 120) → scale engages
        p2.moveTo(140, 0);
        expect(events.at(-1)!.scale).toBeCloseTo(1.5);

        // first finger lifts, one still down → scale frozen, still alive
        p1.lift();
        p2.moveTo(160, 0);
        expect(events.at(-1)!.scale).toBeCloseTo(1.5);
        expect(completed).toBe(false);

        // last finger lifts → grab ends
        p2.lift();
        expect(completed).toBe(true);
    });
});
