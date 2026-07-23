import { test, expect, describe } from "bun:test";
import { AppStore } from "./store";
import { EventBus } from "./event-bus";
import { LayerService, type LayerView } from "./layer-service";
import { layerId, imageRef } from "@types";
import type { DomainEvent, ImageRef } from "@types";
import { makeMetadata } from "../test-utils/factories";

const A = layerId("a");
const B = layerId("b");

function createService() {
    const store = new AppStore(new EventBus(), () => {});
    const resolver = { resolveUrl: (ref: ImageRef) => `img://${ref}` };
    const service = new LayerService(store, resolver);
    return { store, service };
}

function setEvent(layer = A, ref = "forest.png"): DomainEvent {
    return {
        type: "visual.image.set",
        payload: { layer, imageRef: imageRef(ref), aspectRatio: "cover" },
        metadata: makeMetadata(),
    };
}

function transformEvent(layer: typeof A, scale: number): DomainEvent {
    return {
        type: "visual.image.transform",
        payload: { layer, scale },
        metadata: makeMetadata(),
    };
}

function clearEvent(layer: typeof A): DomainEvent {
    return {
        type: "visual.image.clear",
        payload: { layer },
        metadata: makeMetadata(),
    };
}

describe("LayerService", () => {
    test("layer$(id) is memoized — same Observable instance per id", () => {
        const { service } = createService();
        expect(service.layer$(A)).toBe(service.layer$(A));
    });

    test("enriches the view with a resolved imageUrl, keeping domain fields", () => {
        const { store, service } = createService();
        store.applyEvent(setEvent(A, "forest.png"));

        const seen: (LayerView | undefined)[] = [];
        service.layer$(A).subscribe((v) => seen.push(v));

        expect(seen.at(-1)!.imageUrl).toBe("img://forest.png");
        expect(seen.at(-1)!.opacity).toBe(1);
    });

    test("re-emits only when its own layer changes (dedup precedes enrichment)", () => {
        const { store, service } = createService();
        store.applyEvent(setEvent(A, "a.png"));
        store.applyEvent(setEvent(B, "b.png"));

        const seen: unknown[] = [];
        service.layer$(A).subscribe((v) => seen.push(v));
        expect(seen).toHaveLength(1); // replayed current A

        store.applyEvent(transformEvent(B, 2)); // a different layer changed
        expect(seen).toHaveLength(1); // A untouched → no re-emit

        store.applyEvent(transformEvent(A, 2)); // A itself changed
        expect(seen).toHaveLength(2);
    });

    test("emits undefined once its layer is cleared", () => {
        const { store, service } = createService();
        store.applyEvent(setEvent(A));

        const seen: unknown[] = [];
        service.layer$(A).subscribe((v) => seen.push(v));

        store.applyEvent(clearEvent(A));
        expect(seen.at(-1)).toBeUndefined();
    });

    test("layerIds$ tracks the live set and dedups non-structural changes", () => {
        const { store, service } = createService();

        const ids: string[][] = [];
        service.layerIds$.subscribe((v) => ids.push([...v]));

        store.applyEvent(setEvent(A));
        store.applyEvent(setEvent(B));
        store.applyEvent(transformEvent(A, 2)); // same key set → no new emission
        store.applyEvent(clearEvent(A));

        expect(ids.at(-1)).toEqual([B]);
        // [] , [A] , [A,B] , [B]  — the transform did not add an emission
        expect(ids).toHaveLength(4);
    });
});
