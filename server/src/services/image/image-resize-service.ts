import { resize } from "imgkit";
import { existsSync, mkdirSync } from "fs";
import { Logger } from "@utils/logger";

const CACHE_DIR = "public/.thumbs";
const MAX_DIMENSION = 2048;
const MIN_DIMENSION = 16;

/**
 * Service for resizing images on-demand with disk caching
 *
 * Generates resized WebP images and caches them to disk.
 * Cache structure: .thumbs/{width}x{height}/{basename}.webp
 */
export class ImageResizeService {
    private logger = new Logger("ImageResizeService");

    constructor() {
        if (!existsSync(CACHE_DIR)) {
            mkdirSync(CACHE_DIR, { recursive: true });
        }
        this.logger.info("ImageResizeService initialized");
    }

    /**
     * Get a resized image, generating and caching if needed
     *
     * @param filename - Original image filename
     * @param width - Target width (null for auto)
     * @param height - Target height (null for auto)
     * @returns Resized image buffer and content type, or null if source not found
     */
    async getResizedImage(
        filename: string,
        width: number | null,
        height: number | null,
    ): Promise<{ buffer: Buffer; contentType: string } | null> {
        if (!width && !height) {
            return null;
        }

        // Validate dimensions
        if (width && (width < MIN_DIMENSION || width > MAX_DIMENSION)) {
            this.logger.warn("Invalid width requested", { width, filename });
            return null;
        }
        if (height && (height < MIN_DIMENSION || height > MAX_DIMENSION)) {
            this.logger.warn("Invalid height requested", { height, filename });
            return null;
        }

        const cacheKey = `${width ?? 0}x${height ?? 0}`;
        const cachePath = this.getCachePath(filename, cacheKey);
        const sourcePath = `public/images/${filename}`;

        // Check cache first
        const cacheFile = Bun.file(cachePath);
        if (await cacheFile.exists()) {
            this.logger.debug("Serving cached resize", { filename, cacheKey });
            return {
                buffer: Buffer.from(await cacheFile.arrayBuffer()),
                contentType: "image/webp",
            };
        }

        // Check source exists
        const sourceFile = Bun.file(sourcePath);
        if (!(await sourceFile.exists())) {
            this.logger.warn("Source image not found", { filename });
            return null;
        }

        // Generate resized image
        this.logger.info("Generating resized image", {
            filename,
            width,
            height,
        });

        const sourceBuffer = Buffer.from(await sourceFile.arrayBuffer());

        const resized = await resize(sourceBuffer, {
            width: width ?? undefined,
            height: height ?? undefined,
        });

        // Ensure cache directory exists
        const cacheDir = `${CACHE_DIR}/${cacheKey}`;
        if (!existsSync(cacheDir)) {
            mkdirSync(cacheDir, { recursive: true });
        }

        // Write to cache
        await Bun.write(cachePath, resized);
        this.logger.info("Cached resized image", {
            cachePath,
            size: resized.length,
        });

        return {
            buffer: resized,
            contentType: "image/webp",
        };
    }

    private getCachePath(filename: string, cacheKey: string): string {
        const baseName = filename.replace(/\.[^.]+$/, "");
        return `${CACHE_DIR}/${cacheKey}/${baseName}.webp`;
    }
}
