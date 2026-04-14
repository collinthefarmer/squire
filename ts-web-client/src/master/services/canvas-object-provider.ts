import type { Observable } from "rxjs";
import type { ImagePosition } from "@types";
import type { CanvasObject } from "./visual-service";

/**
 * Interface for services that contribute interactive objects
 * to the canvas overlay system.
 *
 * Each provider supplies a stream of canvas objects with
 * display-space bounds, and a method to handle position/scale
 * transforms initiated by the overlay's drag interaction.
 */
export interface CanvasObjectProvider {
    getCanvasObjects$(): Observable<CanvasObject[]>;
    transformObject(id: string, position: ImagePosition, scale?: number): void;
}
