import { test, expect, describe } from "bun:test";
import { layerId, imageRef } from "@types";
import { buildLayerStyles } from "./layer-styles";
import type { LayerView } from "@services/layer-service";

const BASE: LayerView = {
    id: layerId("l"),
    imageRef: imageRef("x.png"),
    imageUrl: "img://x.png",
    aspectRatio: "cover",
    position: { x: "center", y: "center" },
    scale: 1,
    rotation: 0,
    blendMode: "normal",
    opacity: 1,
    zIndex: 0,
    visible: true,
    effects: [],
};

function makeLayer(overrides: Partial<LayerView>): LayerView {
    return { ...BASE, ...overrides };
}

describe("buildLayerStyles", () => {
    test("full-bleed aspect fills the stage via inset + object-fit", () => {
        const { host, img, isFull } = buildLayerStyles(makeLayer({ aspectRatio: "contain" }));

        expect(isFull).toBe(true);
        expect(host.inset).toBe("0");
        expect(host.left).toBeUndefined();
        expect(img.objectFit).toBe("contain");
    });

    test("non-full aspect is positioned and transformed, image left unstyled", () => {
        const { host, img, isFull } = buildLayerStyles(
            makeLayer({ aspectRatio: "native", scale: 2, rotation: 90 }),
        );

        expect(isFull).toBe(false);
        expect(host.left).toBe("50%");
        expect(host.top).toBe("50%");
        expect(host.transform).toBe("translateX(-50%) translateY(-50%) scale(2) rotate(90deg)");
        expect(img).toEqual({});
    });

    test("opacity and z-index always mapped", () => {
        const { host } = buildLayerStyles(makeLayer({ opacity: 0.4, zIndex: 7 }));

        expect(host.opacity).toBe("0.4");
        expect(host.zIndex).toBe("7");
    });

    test("blend mode omitted when normal, set otherwise", () => {
        expect(buildLayerStyles(makeLayer({ blendMode: "normal" })).host.mixBlendMode).toBeUndefined();
        expect(buildLayerStyles(makeLayer({ blendMode: "screen" })).host.mixBlendMode).toBe("screen");
    });

    test("effects map to a composed CSS filter string", () => {
        const { host } = buildLayerStyles(makeLayer({
            effects: [
                { type: "blur", params: { radius: 5 } },
                { type: "brightness", params: { level: 1.2 } },
            ],
        }));

        expect(host.filter).toBe("blur(5px) brightness(1.2)");
    });

    test("no filter key when there are no effects", () => {
        expect(buildLayerStyles(makeLayer({ effects: [] })).host.filter).toBeUndefined();
    });
});
