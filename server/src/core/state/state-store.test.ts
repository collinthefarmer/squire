import { test, expect, describe } from "bun:test";
import { StateStore } from "./state-store";
import type { ApplicationState } from "../../types";

describe("StateStore", () => {
    test("should initialize with empty state by default", () => {
        const store = new StateStore();
        expect(store.getState()).toEqual({});
    });

    test("should initialize with provided state", () => {
        const initial: ApplicationState = { time: { scale: 2.0 } };
        const store = new StateStore(initial);

        expect(store.getState().time?.scale).toBe(2.0);
    });

    test("should replace state with setState", () => {
        const store = new StateStore();
        const newState: ApplicationState = { time: { scale: 1.5 } };

        store.setState(newState);

        expect(store.getState()).toBe(newState);
    });

    test("should update state with updater function", () => {
        const store = new StateStore({ time: { scale: 1.0 } });

        store.updateState((state) => ({
            ...state,
            time: { scale: 3.0 },
        }));

        expect(store.getState().time?.scale).toBe(3.0);
    });

    test("updateState should not mutate previous state reference", () => {
        const store = new StateStore();
        const before = store.getState();

        store.updateState((state) => ({
            ...state,
            time: { scale: 5.0 },
        }));

        const after = store.getState();

        expect(before).not.toBe(after);
        expect(before.time).toBeUndefined();
        expect(after.time?.scale).toBe(5.0);
    });

    test("should apply sequential updates correctly", () => {
        const store = new StateStore();

        store.updateState((state) => ({ ...state, time: { scale: 1.0 } }));
        store.updateState((state) => ({
            ...state,
            audio: { channels: new Map(), masterVolume: 0.5 },
        }));

        const final = store.getState();
        expect(final.time?.scale).toBe(1.0);
        expect(final.audio?.masterVolume).toBe(0.5);
    });
});
