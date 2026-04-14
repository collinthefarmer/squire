import { colors, alpha } from "@styles/theme";

/**
 * Ghost overlay that follows the cursor during drag.
 *
 * Creates a semi-transparent clone of the dragged element,
 * positions it centered on the cursor, and applies scale transforms.
 * The base lift scale (1.05×) provides visual feedback that the
 * element has been "picked up."
 */
export class DragGhost {
    private element: HTMLElement | null = null;

    private readonly BASE_LIFT_SCALE = 1.05;

    /**
     * Create ghost element from a source element.
     *
     * For elements with Shadow DOM (like image-handle), extracts the
     * visible `<img>` from the shadow root. Otherwise clones the element.
     */
    create(source: HTMLElement): void {
        const shadowImg = source.shadowRoot?.querySelector("img");
        const rect = shadowImg
            ? shadowImg.getBoundingClientRect()
            : source.getBoundingClientRect();

        if (shadowImg) {
            this.element = document.createElement("img");
            (this.element as HTMLImageElement).src = shadowImg.src;
            (this.element as HTMLImageElement).alt = shadowImg.alt;
        } else {
            this.element = source.cloneNode(true) as HTMLElement;
        }

        this.element.style.cssText = `
            position: fixed;
            width: ${rect.width}px;
            height: ${rect.height}px;
            pointer-events: none;
            z-index: 9999;
            opacity: 0.85;
            transform: scale(${this.BASE_LIFT_SCALE});
            box-shadow: 0 8px 24px ${alpha(colors.black, 0.3)};
            border-radius: 4px;
            transition: transform 0.1s ease-out;
        `;

        document.body.appendChild(this.element);
    }

    /**
     * Position ghost centered on cursor coordinates.
     */
    position(x: number, y: number): void {
        if (!this.element) {
            return;
        }

        const width = this.element.offsetWidth;
        const height = this.element.offsetHeight;

        this.element.style.left = `${x - width / 2}px`;
        this.element.style.top = `${y - height / 2}px`;
    }

    /**
     * Update the CSS transform scale.
     *
     * Combines the base lift scale with the user's scale factor.
     */
    setScale(userScale: number): void {
        if (!this.element) {
            return;
        }

        const totalScale = this.BASE_LIFT_SCALE * userScale;
        this.element.style.transform = `scale(${totalScale})`;
    }

    /**
     * Remove ghost element from the DOM.
     */
    destroy(): void {
        if (this.element) {
            this.element.remove();
            this.element = null;
        }
    }

    get exists(): boolean {
        return this.element !== null;
    }
}
