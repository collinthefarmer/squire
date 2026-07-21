import { test, expect, describe } from "bun:test";
import {
    getFromMap,
    setInMap,
    updateInMap,
    removeFromMap,
    getAllFromMap,
    mergeObject,
} from "./state-helpers";

describe("state-helpers", () => {
    describe("getFromMap", () => {
        test("should return value for existing key", () => {
            const map = new Map([["a", 1]]);
            expect(getFromMap(map, "a")).toBe(1);
        });

        test("should return undefined for missing key", () => {
            const map = new Map<string, number>();
            expect(getFromMap(map, "a")).toBeUndefined();
        });
    });

    describe("setInMap", () => {
        test("should add a new key", () => {
            const map = new Map<string, number>();
            const result = setInMap(map, "a", 1);

            expect(result.get("a")).toBe(1);
        });

        test("should replace an existing key", () => {
            const map = new Map([["a", 1]]);
            const result = setInMap(map, "a", 2);

            expect(result.get("a")).toBe(2);
        });

        test("should not mutate original map", () => {
            const map = new Map<string, number>();
            setInMap(map, "a", 1);

            expect(map.size).toBe(0);
        });
    });

    describe("updateInMap", () => {
        test("should apply updater to existing key", () => {
            const map = new Map([["a", 1]]);
            const result = updateInMap(map, "a", (v) => v + 10);

            expect(result.get("a")).toBe(11);
        });

        test("should return same map for missing key", () => {
            const map = new Map([["a", 1]]);
            const result = updateInMap(map, "b", (v) => v + 10);

            expect(result).toBe(map);
        });

        test("should not mutate original map", () => {
            const map = new Map([["a", 1]]);
            updateInMap(map, "a", (v) => v + 10);

            expect(map.get("a")).toBe(1);
        });
    });

    describe("removeFromMap", () => {
        test("should remove existing key", () => {
            const map = new Map([["a", 1], ["b", 2]]);
            const result = removeFromMap(map, "a");

            expect(result.has("a")).toBe(false);
            expect(result.get("b")).toBe(2);
        });

        test("should not mutate original map", () => {
            const map = new Map([["a", 1]]);
            removeFromMap(map, "a");

            expect(map.has("a")).toBe(true);
        });
    });

    describe("getAllFromMap", () => {
        test("should return all values as array", () => {
            const map = new Map([["a", 1], ["b", 2], ["c", 3]]);
            const result = getAllFromMap(map);

            expect(result).toEqual([1, 2, 3]);
        });

        test("should return empty array for empty map", () => {
            expect(getAllFromMap(new Map())).toEqual([]);
        });
    });

    describe("mergeObject", () => {
        test("should merge updates into object", () => {
            const obj = { a: 1, b: 2, c: 3 };
            const result = mergeObject(obj, { b: 20 });

            expect(result).toEqual({ a: 1, b: 20, c: 3 });
        });

        test("should not mutate original object", () => {
            const obj = { a: 1, b: 2 };
            mergeObject(obj, { a: 10 });

            expect(obj.a).toBe(1);
        });
    });
});
