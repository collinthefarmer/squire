import { test, expect, describe } from "bun:test";
import { fitScale } from "./fit-scale";

const W = 1920;
const H = 1080;

describe("fitScale", () => {
    test("exact fit: unit scale, no offset", () => {
        expect(fitScale(W, H, W, H)).toEqual({ scale: 1, offsetX: 0, offsetY: 0 });
    });

    test("uniform scale down for a smaller viewport", () => {
        expect(fitScale(960, 540, W, H)).toEqual({ scale: 0.5, offsetX: 0, offsetY: 0 });
    });

    test("wider viewport pillarboxes (horizontal offset)", () => {
        const fit = fitScale(2000, 1080, W, H);
        expect(fit.scale).toBe(1); // height-bound
        expect(fit.offsetX).toBe(40); // (2000 - 1920) / 2
        expect(fit.offsetY).toBe(0);
    });

    test("taller viewport letterboxes (vertical offset)", () => {
        const fit = fitScale(1920, 1200, W, H);
        expect(fit.scale).toBe(1); // width-bound
        expect(fit.offsetX).toBe(0);
        expect(fit.offsetY).toBe(60); // (1200 - 1080) / 2
    });

    test("scale is bound by the tighter axis, never cropping", () => {
        // 1000 wide is the tight axis: 1000/1920 < 1080/1080
        const fit = fitScale(1000, 1080, W, H);
        expect(fit.scale).toBeCloseTo(1000 / 1920);
        expect(fit.offsetX).toBeCloseTo(0);
        expect(fit.offsetY).toBeCloseTo((1080 - 1080 * (1000 / 1920)) / 2);
    });
});
