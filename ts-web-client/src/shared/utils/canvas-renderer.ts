import { Logger } from "@utils/logger";
import type { ImageLayerState, AspectRatioMode } from "@types";

const logger = new Logger("CanvasRenderer");

/**
 * Calculate position from normalized value (0-1)
 *
 * Converts normalized position to pixel offset within available space.
 * 0 = left/top edge, 0.5 = center, 1 = right/bottom edge
 */
export function calculateNormalizedPosition(
    normalized: number,
    containerSize: number,
    imageSize: number,
): number {
    return (containerSize - imageSize) * normalized;
}

/**
 * Calculate position from string value
 *
 * Supports keywords (center, left, right, top, bottom),
 * percentage values (e.g., "50%"), and pixel values (e.g., "100px").
 */
export function calculateStringPosition(
    pos: string,
    containerSize: number,
    imageSize: number,
): number {
    switch (pos) {
        case "center":
            return (containerSize - imageSize) / 2;
        case "left":
        case "top":
            return 0;
        case "right":
        case "bottom":
            return containerSize - imageSize;
        default:
            if (pos.endsWith("%")) {
                const percent = parseFloat(pos) / 100;
                return (containerSize - imageSize) * percent;
            }
            if (pos.endsWith("px")) {
                return parseFloat(pos);
            }
            return 0;
    }
}

/**
 * Calculate position from string or normalized number
 *
 * Routes to appropriate calculation based on type.
 */
export function calculatePosition(
    pos: string | number,
    containerSize: number,
    imageSize: number,
): number {
    if (typeof pos === "number") {
        return calculateNormalizedPosition(pos, containerSize, imageSize);
    }
    return calculateStringPosition(pos, containerSize, imageSize);
}

/**
 * Map blend mode string to canvas composite operation
 */
export function mapBlendMode(blendMode: string): GlobalCompositeOperation {
    const blendModeMap: Record<string, GlobalCompositeOperation> = {
        normal: "source-over",
        multiply: "multiply",
        screen: "screen",
        overlay: "overlay",
        add: "lighter",
    };

    return blendModeMap[blendMode] || "source-over";
}

/**
 * Calculate scaled image dimensions based on aspect ratio mode
 *
 * - cover: Scale to cover canvas, may crop
 * - contain: Scale to fit within canvas, may letterbox
 * - fill: Stretch to exactly match canvas
 * - native: Use image's natural dimensions
 * - custom: Falls back to contain (not yet implemented)
 */
export function calculateScaledDimensions(
    aspectRatio: AspectRatioMode,
    imageWidth: number,
    imageHeight: number,
    canvasWidth: number,
    canvasHeight: number,
): { width: number; height: number } {
    switch (aspectRatio) {
        case "cover": {
            const scale = Math.max(
                canvasWidth / imageWidth,
                canvasHeight / imageHeight,
            );
            return { width: imageWidth * scale, height: imageHeight * scale };
        }
        case "contain": {
            const scale = Math.min(
                canvasWidth / imageWidth,
                canvasHeight / imageHeight,
            );
            return { width: imageWidth * scale, height: imageHeight * scale };
        }
        case "fill": {
            return { width: canvasWidth, height: canvasHeight };
        }
        case "native":
        default: {
            return { width: imageWidth, height: imageHeight };
        }
    }
}

const DEFAULT_CACHE_MAX_SIZE = 50;

/**
 * Image cache with LRU eviction for efficient loading and reuse
 *
 * Caches loaded images by their reference to avoid redundant network requests.
 * Map insertion order tracks recency: most recently used entries are at the end.
 * When the cache exceeds maxSize, the least recently used entry is evicted.
 */
export class ImageCache {
    private cache = new Map<string, HTMLImageElement>();
    private baseUrl: string;
    private maxSize: number;

    constructor(baseUrl: string, maxSize: number = DEFAULT_CACHE_MAX_SIZE) {
        this.baseUrl = baseUrl;
        this.maxSize = maxSize;
    }

    /**
     * Load an image from cache or fetch from network
     *
     * Cache hits promote the entry to most-recently-used position.
     */
    async loadImage(imageRef: string): Promise<HTMLImageElement | null> {
        if (this.cache.has(imageRef)) {
            this.touchEntry(imageRef);
            return this.cache.get(imageRef)!;
        }

        try {
            const image = await this.fetchImage(imageRef);
            this.evictIfNeeded();
            this.cache.set(imageRef, image);
            return image;
        } catch (error) {
            logger.error("Failed to load image", { imageRef, error });
            return null;
        }
    }

    /**
     * Fetch image from server
     */
    private fetchImage(imageRef: string): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () =>
                reject(new Error(`Failed to load: ${imageRef}`));
            img.src = `${this.baseUrl}/public/images/${imageRef}`;
        });
    }

    /**
     * Move an existing entry to the most-recently-used position
     *
     * Deletes and re-inserts to place it at the end of Map iteration order.
     */
    private touchEntry(imageRef: string): void {
        const image = this.cache.get(imageRef);
        if (!image) {
            return;
        }

        this.cache.delete(imageRef);
        this.cache.set(imageRef, image);
    }

    /**
     * Evict the least recently used entry if cache is at capacity
     *
     * The first key in Map iteration order is the oldest (least recently used).
     */
    private evictIfNeeded(): void {
        if (this.cache.size < this.maxSize) {
            return;
        }

        const oldestKey = this.cache.keys().next().value;
        if (oldestKey !== undefined) {
            this.cache.delete(oldestKey);
        }
    }

    /**
     * Clear all cached images
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * Remove a specific image from cache
     */
    remove(imageRef: string): void {
        this.cache.delete(imageRef);
    }

    /**
     * Current number of cached images
     */
    get size(): number {
        return this.cache.size;
    }
}

/**
 * Draw a single layer to the canvas context
 *
 * Applies aspect ratio scaling, opacity, blend mode, position, scale, and rotation.
 */
export function drawLayer(
    ctx: CanvasRenderingContext2D,
    layer: ImageLayerState,
    image: HTMLImageElement,
    canvasWidth: number,
    canvasHeight: number,
): void {
    ctx.save();

    // Apply global alpha (opacity)
    ctx.globalAlpha = layer.opacity;

    // Apply blend mode
    ctx.globalCompositeOperation = mapBlendMode(layer.blendMode);

    // Calculate dimensions based on aspect ratio mode
    const { width, height } = calculateScaledDimensions(
        layer.aspectRatio,
        image.naturalWidth,
        image.naturalHeight,
        canvasWidth,
        canvasHeight,
    );

    // Calculate position using scaled dimensions
    const x = calculatePosition(layer.position.x, canvasWidth, width);
    const y = calculatePosition(layer.position.y, canvasHeight, height);

    // Apply transforms (translate to center, scale, rotate, draw centered)
    ctx.translate(x + width / 2, y + height / 2);
    ctx.scale(layer.scale, layer.scale);
    ctx.rotate((layer.rotation * Math.PI) / 180);

    // Draw image at calculated dimensions
    ctx.drawImage(image, -width / 2, -height / 2, width, height);

    ctx.restore();
}

/**
 * Draw all layers to the canvas
 *
 * Clears canvas, loads all visible images in parallel, then draws in zIndex order.
 */
export async function drawLayers(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    layers: Map<string, ImageLayerState>,
    imageCache: ImageCache,
): Promise<void> {
    // Get layers sorted by zIndex
    const sortedLayers = Array.from(layers.values()).sort(
        (a, b) => a.zIndex - b.zIndex,
    );

    // Collect visible layers that need images
    const visibleLayers = sortedLayers.filter(
        (layer) => layer.visible && layer.imageRef,
    );

    // Load all images in parallel
    const imageResults = await Promise.all(
        visibleLayers.map((layer) => imageCache.loadImage(layer.imageRef!)),
    );

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw each layer with its loaded image (already in zIndex order)
    for (let i = 0; i < visibleLayers.length; i++) {
        const image = imageResults[i];
        if (!image) {
            continue;
        }

        drawLayer(ctx, visibleLayers[i], image, canvas.width, canvas.height);
    }
}
