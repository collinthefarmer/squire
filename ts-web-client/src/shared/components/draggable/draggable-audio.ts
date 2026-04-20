import { Draggable } from "./draggable";
import { DragGhost } from "./drag-ghost";

/**
 * Audio-specialized draggable with ghost overlay
 *
 * Extends the base Draggable with a semi-transparent ghost clone
 * that follows the cursor during drag, providing visual feedback
 * for audio file list items being dragged to the timeline.
 */
export class DraggableAudio extends Draggable {
    private ghost = new DragGhost();

    protected override onDragStart(x: number, y: number): void {
        const slotted = this.querySelector("*");
        if (slotted) {
            this.ghost.create(slotted as HTMLElement);
        }
        this.ghost.position(x, y);
    }

    protected override onDragMove(x: number, y: number): void {
        this.ghost.position(x, y);
    }

    protected override onDragEnd(_x: number, _y: number): void {
        this.ghost.destroy();
    }
}
