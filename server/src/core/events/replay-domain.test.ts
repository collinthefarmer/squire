import { test, expect, describe } from "bun:test";
import { defineReplay } from "./replay-domain";
import { makeEvent } from "../../test-utils/factories";

describe("ReplayDomain", () => {
    describe("create behavior", () => {
        test("should store creation event", () => {
            const domain = defineReplay("id", {
                "thing.create": { removes: ["thing.destroy"] },
            });

            domain.update(makeEvent("thing.create", { id: "a" }));

            const events = domain.getReplayEvents();
            expect(events).toHaveLength(1);
            expect(events[0].type).toBe("thing.create");
        });

        test("should store multiple entities by key", () => {
            const domain = defineReplay("id", {
                "thing.create": { removes: ["thing.destroy"] },
            });

            domain.update(makeEvent("thing.create", { id: "a" }));
            domain.update(makeEvent("thing.create", { id: "b" }));

            expect(domain.getReplayEvents()).toHaveLength(2);
        });

        test("should replace entity on duplicate create", () => {
            const domain = defineReplay("id", {
                "thing.create": { removes: ["thing.destroy"] },
            });

            domain.update(makeEvent("thing.create", { id: "a", color: "red" }));
            domain.update(makeEvent("thing.create", { id: "a", color: "blue" }));

            const events = domain.getReplayEvents();
            expect(events).toHaveLength(1);
            expect((events[0].payload as Record<string, unknown>).color).toBe("blue");
        });
    });

    describe("remove behavior", () => {
        test("should remove entity on remove event", () => {
            const domain = defineReplay("id", {
                "thing.create": { removes: ["thing.destroy"] },
            });

            domain.update(makeEvent("thing.create", { id: "a" }));
            domain.update(makeEvent("thing.destroy", { id: "a" }));

            expect(domain.getReplayEvents()).toHaveLength(0);
        });

        test("should only remove the targeted entity", () => {
            const domain = defineReplay("id", {
                "thing.create": { removes: ["thing.destroy"] },
            });

            domain.update(makeEvent("thing.create", { id: "a" }));
            domain.update(makeEvent("thing.create", { id: "b" }));
            domain.update(makeEvent("thing.destroy", { id: "a" }));

            const events = domain.getReplayEvents();
            expect(events).toHaveLength(1);
            expect((events[0].payload as Record<string, unknown>).id).toBe("b");
        });

        test("should be a no-op when entity does not exist", () => {
            const domain = defineReplay("id", {
                "thing.create": { removes: ["thing.destroy"] },
            });

            domain.update(makeEvent("thing.destroy", { id: "nonexistent" }));
            expect(domain.getReplayEvents()).toHaveLength(0);
        });
    });

    describe("fold behavior (field merge)", () => {
        test("should merge specified fields into creation event", () => {
            const domain = defineReplay("id", {
                "thing.create": {
                    removes: ["thing.destroy"],
                    folds: {
                        "thing.update": ["position", "scale"],
                    },
                },
            });

            domain.update(
                makeEvent("thing.create", {
                    id: "a",
                    position: { x: 0, y: 0 },
                    scale: 1.0,
                }),
            );

            domain.update(
                makeEvent("thing.update", {
                    id: "a",
                    position: { x: 100, y: 200 },
                }),
            );

            const events = domain.getReplayEvents();
            expect(events).toHaveLength(1);

            const payload = events[0].payload as Record<string, unknown>;
            expect(payload.position).toEqual({ x: 100, y: 200 });
            expect(payload.scale).toBe(1.0); // Unchanged — not in fold event
        });

        test("should skip undefined fields in fold", () => {
            const domain = defineReplay("id", {
                "thing.create": {
                    removes: [],
                    folds: {
                        "thing.update": ["position", "scale"],
                    },
                },
            });

            domain.update(
                makeEvent("thing.create", {
                    id: "a",
                    position: { x: 0, y: 0 },
                    scale: 1.0,
                }),
            );

            // Fold event has scale but not position
            domain.update(
                makeEvent("thing.update", { id: "a", scale: 2.0 }),
            );

            const payload = domain.getReplayEvents()[0].payload as Record<string, unknown>;
            expect(payload.position).toEqual({ x: 0, y: 0 }); // Unchanged
            expect(payload.scale).toBe(2.0);
        });

        test("should apply multiple fold events sequentially", () => {
            const domain = defineReplay("id", {
                "thing.create": {
                    removes: [],
                    folds: {
                        "thing.update": ["value"],
                    },
                },
            });

            domain.update(makeEvent("thing.create", { id: "a", value: 1 }));
            domain.update(makeEvent("thing.update", { id: "a", value: 2 }));
            domain.update(makeEvent("thing.update", { id: "a", value: 3 }));

            const payload = domain.getReplayEvents()[0].payload as Record<string, unknown>;
            expect(payload.value).toBe(3);
        });

        test("should be a no-op for non-existent entity", () => {
            const domain = defineReplay("id", {
                "thing.create": {
                    removes: [],
                    folds: { "thing.update": ["value"] },
                },
            });

            domain.update(makeEvent("thing.update", { id: "missing", value: 5 }));
            expect(domain.getReplayEvents()).toHaveLength(0);
        });
    });

    describe("fold behavior (custom transform)", () => {
        test("should use transform function when provided", () => {
            const domain = defineReplay("id", {
                "thing.create": {
                    removes: [],
                    folds: {
                        "thing.complex": {
                            transform: (sequence, trigger) => {
                                // Custom: append trigger event to sequence
                                return [...sequence, trigger];
                            },
                        },
                    },
                },
            });

            domain.update(makeEvent("thing.create", { id: "a" }));
            domain.update(makeEvent("thing.complex", { id: "a", extra: true }));

            const events = domain.getReplayEvents();
            expect(events).toHaveLength(2);
            expect(events[1].type).toBe("thing.complex");
        });
    });

    describe("replace behavior", () => {
        test("should store latest replace event alongside creation", () => {
            const domain = defineReplay("id", {
                "thing.create": {
                    removes: [],
                    replaces: ["thing.config"],
                },
            });

            domain.update(makeEvent("thing.create", { id: "a" }));
            domain.update(makeEvent("thing.config", { id: "a", mode: "fast" }));

            const events = domain.getReplayEvents();
            expect(events).toHaveLength(2);
            expect(events[0].type).toBe("thing.create");
            expect(events[1].type).toBe("thing.config");
        });

        test("should keep only latest replace event per type", () => {
            const domain = defineReplay("id", {
                "thing.create": {
                    removes: [],
                    replaces: ["thing.config"],
                },
            });

            domain.update(makeEvent("thing.create", { id: "a" }));
            domain.update(makeEvent("thing.config", { id: "a", mode: "fast" }));
            domain.update(makeEvent("thing.config", { id: "a", mode: "slow" }));

            const events = domain.getReplayEvents();
            expect(events).toHaveLength(2);

            const config = events.find((e) => e.type === "thing.config");
            expect((config!.payload as Record<string, unknown>).mode).toBe("slow");
        });

        test("should handle multiple replace event types", () => {
            const domain = defineReplay("id", {
                "thing.create": {
                    removes: [],
                    replaces: ["thing.config", "thing.style"],
                },
            });

            domain.update(makeEvent("thing.create", { id: "a" }));
            domain.update(makeEvent("thing.config", { id: "a" }));
            domain.update(makeEvent("thing.style", { id: "a" }));

            const events = domain.getReplayEvents();
            expect(events).toHaveLength(3);
        });

        test("should be a no-op for non-existent entity", () => {
            const domain = defineReplay("id", {
                "thing.create": {
                    removes: [],
                    replaces: ["thing.config"],
                },
            });

            domain.update(makeEvent("thing.config", { id: "missing" }));
            expect(domain.getReplayEvents()).toHaveLength(0);
        });
    });

    describe("append behavior", () => {
        test("should accumulate events in sequence", () => {
            const domain = defineReplay("id", {
                "thing.create": {
                    removes: [],
                    appends: ["thing.tick"],
                },
            });

            domain.update(makeEvent("thing.create", { id: "a" }));
            domain.update(makeEvent("thing.tick", { id: "a", t: 1 }));
            domain.update(makeEvent("thing.tick", { id: "a", t: 2 }));
            domain.update(makeEvent("thing.tick", { id: "a", t: 3 }));

            const events = domain.getReplayEvents();
            expect(events).toHaveLength(4); // create + 3 ticks
            expect(events[0].type).toBe("thing.create");
            expect(events[1].type).toBe("thing.tick");
            expect(events[3].type).toBe("thing.tick");
        });

        test("should preserve order of appended events", () => {
            const domain = defineReplay("id", {
                "thing.create": {
                    removes: [],
                    appends: ["thing.action"],
                },
            });

            domain.update(makeEvent("thing.create", { id: "a" }));
            domain.update(makeEvent("thing.action", { id: "a", step: 1 }));
            domain.update(makeEvent("thing.action", { id: "a", step: 2 }));

            const events = domain.getReplayEvents();
            const actions = events.filter((e) => e.type === "thing.action");

            expect((actions[0].payload as Record<string, unknown>).step).toBe(1);
            expect((actions[1].payload as Record<string, unknown>).step).toBe(2);
        });

        test("should be a no-op for non-existent entity", () => {
            const domain = defineReplay("id", {
                "thing.create": {
                    removes: [],
                    appends: ["thing.tick"],
                },
            });

            domain.update(makeEvent("thing.tick", { id: "missing" }));
            expect(domain.getReplayEvents()).toHaveLength(0);
        });
    });

    describe("replayFilter", () => {
        test("should exclude entities that fail the filter", () => {
            const domain = defineReplay("id", {
                "thing.create": {
                    removes: [],
                    replayFilter: (sequence) => {
                        const payload = sequence[0].payload as Record<string, unknown>;
                        return payload.active === true;
                    },
                },
            });

            domain.update(makeEvent("thing.create", { id: "a", active: true }));
            domain.update(makeEvent("thing.create", { id: "b", active: false }));

            const events = domain.getReplayEvents();
            expect(events).toHaveLength(1);
            expect((events[0].payload as Record<string, unknown>).id).toBe("a");
        });
    });

    describe("replayTransform", () => {
        test("should transform event sequences during replay", () => {
            const domain = defineReplay("id", {
                "thing.create": {
                    removes: [],
                    replayTransform: (sequence) => {
                        // Add a marker to each event
                        return sequence.map((e) => ({
                            ...e,
                            payload: {
                                ...(e.payload as Record<string, unknown>),
                                transformed: true,
                            },
                        }));
                    },
                },
            });

            domain.update(makeEvent("thing.create", { id: "a" }));

            const events = domain.getReplayEvents();
            expect((events[0].payload as Record<string, unknown>).transformed).toBe(true);
        });
    });

    describe("custom key extractor", () => {
        test("should support function-based key extraction", () => {
            const domain = defineReplay(
                (event) => {
                    const p = event.payload as Record<string, unknown>;
                    return p.entityId as string | undefined;
                },
                {
                    "thing.create": { removes: ["thing.destroy"] },
                },
            );

            domain.update(makeEvent("thing.create", { entityId: "x" }));
            expect(domain.getReplayEvents()).toHaveLength(1);

            domain.update(makeEvent("thing.destroy", { entityId: "x" }));
            expect(domain.getReplayEvents()).toHaveLength(0);
        });
    });

    describe("unknown events", () => {
        test("should ignore events not mentioned in config", () => {
            const domain = defineReplay("id", {
                "thing.create": { removes: ["thing.destroy"] },
            });

            domain.update(makeEvent("thing.create", { id: "a" }));
            domain.update(makeEvent("thing.unknown", { id: "a" }));

            // Unknown event should be ignored, entity still present
            expect(domain.getReplayEvents()).toHaveLength(1);
        });

        test("should ignore events with no extractable key", () => {
            const domain = defineReplay("id", {
                "thing.create": { removes: [] },
            });

            domain.update(makeEvent("thing.create", { noId: true }));
            expect(domain.getReplayEvents()).toHaveLength(0);
        });
    });

    describe("combined behaviors", () => {
        test("should handle fold + replace + append on same entity", () => {
            const domain = defineReplay("id", {
                "thing.create": {
                    removes: ["thing.destroy"],
                    folds: { "thing.move": ["position"] },
                    replaces: ["thing.config"],
                    appends: ["thing.log"],
                },
            });

            domain.update(
                makeEvent("thing.create", { id: "a", position: { x: 0 } }),
            );
            domain.update(
                makeEvent("thing.move", { id: "a", position: { x: 50 } }),
            );
            domain.update(
                makeEvent("thing.config", { id: "a", mode: "turbo" }),
            );
            domain.update(makeEvent("thing.log", { id: "a", msg: "hi" }));
            domain.update(makeEvent("thing.log", { id: "a", msg: "bye" }));

            const events = domain.getReplayEvents();
            // create (with folded position) + config (replace) + 2x log (append) = 4
            expect(events).toHaveLength(4);

            // Creation should have folded position
            const creation = events[0];
            expect((creation.payload as Record<string, unknown>).position).toEqual({ x: 50 });
        });
    });
});
