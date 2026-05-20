/**
 * Set the --fill CSS custom property on a range input to reflect its
 * current value. Call after programmatic .value changes.
 *
 * The browser positions the thumb center between half-thumb-width from
 * each edge, so a naive percentage drifts ahead/behind the thumb at
 * the extremes. We lerp within that reduced range to stay aligned.
 */
export function updateRangeFill(input: HTMLInputElement): void {
    const min = parseFloat(input.min) || 0;
    const max = parseFloat(input.max) || 1;
    const val = parseFloat(input.value) || 0;
    const ratio = (val - min) / (max - min);

    // Thumb width in px — read from the element's --thumb-width property
    const thumbWidth = parseFloat(
        getComputedStyle(input).getPropertyValue("--thumb-width"),
    ) || 16;
    const trackWidth = input.clientWidth;

    if (trackWidth <= 0) {
        input.style.setProperty("--fill", `${ratio * 100}%`);
        return;
    }

    const halfThumb = thumbWidth / 2;
    const usable = trackWidth - thumbWidth;
    const fillPx = halfThumb + ratio * usable;
    const fillPct = (fillPx / trackWidth) * 100;

    input.style.setProperty("--fill", `${fillPct}%`);
}

/**
 * Keep a range input's --fill CSS custom property in sync with its value.
 *
 * The property drives the fill gradient defined in common.css.
 * Call once after rendering; returns a cleanup function.
 */
export function bindRangeFill(input: HTMLInputElement): () => void {
    const handler = () => updateRangeFill(input);

    handler();
    input.addEventListener("input", handler);

    return () => input.removeEventListener("input", handler);
}

/**
 * Bind all range inputs within a Shadow DOM root.
 * Returns a single cleanup function that unbinds all.
 */
export function bindAllRangeFills(root: ShadowRoot | HTMLElement): () => void {
    const cleanups: Array<() => void> = [];

    for (const input of Array.from(root.querySelectorAll<HTMLInputElement>('input[type="range"]'))) {
        cleanups.push(bindRangeFill(input));
    }

    return () => cleanups.forEach((fn) => fn());
}
