import { test, expect, describe } from "bun:test";
import { Subject } from "rxjs";
import { longPress, type LongPressEvent } from "./long-press";
import { fakePointer, gestureOf } from "../gesture-fixture";
import type { PointerStream } from "../pointers";
import type { Recognition } from "./recognizer";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("long-press", () => {
    test("claims once the hold elapses without movement", async () => {
        const added$ = new Subject<PointerStream>();
        const p1 = fakePointer(1, { x: 0, y: 0 });

        const seen: Recognition<LongPressEvent>[] = [];
        longPress({ duration: 30 }).recognize([p1.stream], added$).subscribe((r) => seen.push(r));

        // Nothing fires on the initial press — the hold hasn't elapsed.
        expect(seen).toHaveLength(0);

        await delay(60);

        expect(seen).toHaveLength(1);
        expect(seen[0]!.claimed).toBe(true);

        const events: LongPressEvent[] = [];
        gestureOf(seen[0]!).subscribe((e) => events.push(e));
        expect(events.at(-1)!.position).toEqual({ x: 0, y: 0 });
    });

    test("rejects when the finger wanders past the threshold", () => {
        const added$ = new Subject<PointerStream>();
        const p1 = fakePointer(1, { x: 0, y: 0 });

        const seen: Recognition<LongPressEvent>[] = [];
        longPress({ duration: 1000, threshold: 10 })
            .recognize([p1.stream], added$)
            .subscribe((r) => seen.push(r));

        p1.moveTo(20, 0); // past the threshold before the hold elapses

        expect(seen).toHaveLength(1);
        expect(seen[0]!.claimed).toBe(false);
    });

    test("rejects when the finger lifts before the hold elapses", () => {
        const added$ = new Subject<PointerStream>();
        const p1 = fakePointer(1, { x: 0, y: 0 });

        const seen: Recognition<LongPressEvent>[] = [];
        longPress({ duration: 1000 }).recognize([p1.stream], added$).subscribe((r) => seen.push(r));

        p1.lift();

        expect(seen).toHaveLength(1);
        expect(seen[0]!.claimed).toBe(false);
    });

    test("tolerates a wander that stays within the threshold", async () => {
        const added$ = new Subject<PointerStream>();
        const p1 = fakePointer(1, { x: 0, y: 0 });

        const seen: Recognition<LongPressEvent>[] = [];
        longPress({ duration: 30, threshold: 10 })
            .recognize([p1.stream], added$)
            .subscribe((r) => seen.push(r));

        p1.moveTo(4, 0); // small jitter, under threshold
        expect(seen).toHaveLength(0);

        await delay(60);

        expect(seen).toHaveLength(1);
        expect(seen[0]!.claimed).toBe(true);
    });
});
