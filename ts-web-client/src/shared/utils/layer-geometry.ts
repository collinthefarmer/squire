/**
 * Geometry helpers shared by anything positioned on the display
 * stage — image layers and clocks alike. Pure `state → CSS` maps;
 * no DOM, no side effects.
 */

import type { ImagePosition } from "@types";

export function resolveX(x: ImagePosition["x"]): Record<string, string> {
    if (x === "center") return { left: "50%" };
    if (x === "left") return { left: "0" };
    if (x === "right") return { right: "0" };
    return { left: `${x}px` };
}

export function resolveY(y: ImagePosition["y"]): Record<string, string> {
    if (y === "center") return { top: "50%" };
    if (y === "top") return { top: "0" };
    if (y === "bottom") return { bottom: "0" };
    return { top: `${y}px` };
}

export function buildTransform(
    position: ImagePosition,
    scale: number,
    rotation: number,
): string {
    const parts: string[] = [];

    if (position.x === "center") parts.push("translateX(-50%)");
    if (position.y === "center") parts.push("translateY(-50%)");
    if (scale !== 1) parts.push(`scale(${scale})`);
    if (rotation !== 0) parts.push(`rotate(${rotation}deg)`);

    return parts.join(" ");
}
