import { Input, FilePathSource, ALL_FORMATS } from "mediabunny";
import { errorResponse, jsonResponse } from "@core/http/responses";
import { isValidAudioFile } from "@core/http/validation";
import { Logger, extractErrorDetail } from "@utils/logger";
import type { RouteHandler } from "@core/http/router";

const logger = new Logger("AssetsMetadata");

/**
 * Audio metadata interface
 */
interface AudioMetadata {
    filename: string;
    url: string;
    size: number;
    format: string;
    duration: number;
    bitrate: number;
    sampleRate: number;
    channels: number;
}

/**
 * Image metadata interface
 */
interface ImageMetadata {
    filename: string;
    url: string;
    size: number;
    format: string;
    width: number;
    height: number;
}

/** In-memory cache of audio durations (seconds), keyed by filename */
const audioDurationCache = new Map<string, number>();

/**
 * Get cached audio duration, or null if not yet computed.
 */
export function getAudioDuration(filename: string): number | undefined {
    return audioDurationCache.get(filename);
}

/**
 * Extract audio metadata using mediabunny.
 */
async function extractAudioMetadata(
    filename: string,
    size: number,
): Promise<AudioMetadata> {
    const extension = filename.split(".").pop()?.toLowerCase() || "unknown";
    const filePath = `public/audio/${filename}`;

    let duration = audioDurationCache.get(filename) ?? 0;
    let sampleRate = 0;
    let channels = 0;
    let bitrate = 0;

    if (!audioDurationCache.has(filename)) {
        try {
            const input = new Input({
                source: new FilePathSource(filePath),
                formats: ALL_FORMATS,
            });

            duration = (await input.computeDuration()) ?? 0;
            audioDurationCache.set(filename, duration);

            const audioTrack = await input.getPrimaryAudioTrack();
            if (audioTrack) {
                sampleRate = audioTrack.sampleRate ?? 0;
                channels = audioTrack.numberOfChannels ?? 0;
            }
        } catch (error) {
            logger.debug("Audio metadata extraction failed, using defaults", { filename, error: extractErrorDetail(error) });
        }
    }

    return {
        filename,
        url: `/public/audio/${filename}`,
        size,
        format: extension,
        duration,
        bitrate,
        sampleRate,
        channels,
    };
}

/**
 * Pre-populate the duration cache for all audio files.
 * Called at server startup.
 */
export async function preloadAudioDurations(): Promise<void> {
    const { readdirSync } = await import("node:fs");

    let files: string[];
    try {
        files = readdirSync("public/audio");
    } catch (error) {
        logger.debug("Audio directory not found, skipping preload", { error: extractErrorDetail(error) });
        return;
    }

    for (const file of files) {
        if (audioDurationCache.has(file) || !isValidAudioFile(file)) {
            continue;
        }

        try {
            const input = new Input({
                source: new FilePathSource(`public/audio/${file}`),
                formats: ALL_FORMATS,
            });

            const duration = (await input.computeDuration()) ?? 0;
            audioDurationCache.set(file, duration);
        } catch {
            // mediabunny doesn't support all formats (e.g. WAV).
            // Duration will be computed on first metadata request instead.
            logger.debug("Could not preload duration", { file });
        }
    }
}

/**
 * Extract image metadata using image-size for dimensions.
 */
async function extractImageMetadata(
    filename: string,
    size: number,
): Promise<ImageMetadata> {
    const { readFileSync } = await import("node:fs");
    const { imageSize } = await import("image-size");

    const extension = filename.split(".").pop()?.toLowerCase() || "unknown";
    const filePath = `public/images/${filename}`;

    let width = 0;
    let height = 0;

    try {
        const buffer = readFileSync(filePath);
        const dimensions = imageSize(buffer);
        width = dimensions.width ?? 0;
        height = dimensions.height ?? 0;
    } catch (error) {
        logger.debug("Could not read image dimensions", { filename, error: extractErrorDetail(error) });
    }

    return {
        filename,
        url: `/public/images/${filename}`,
        size,
        format: extension,
        width,
        height,
    };
}

/**
 * Get audio file metadata
 */
export const getAudioMetadata: RouteHandler = async (_req, params) => {
    const { filename } = params;
    const filePath = `public/audio/${filename}`;

    const file = Bun.file(filePath);

    if (!(await file.exists())) {
        return errorResponse("File not found", 404);
    }

    try {
        const metadata = await extractAudioMetadata(filename, file.size);
        return jsonResponse(metadata);
    } catch (error) {
        logger.error("Metadata extraction error", { error: extractErrorDetail(error) });
        return errorResponse("Failed to extract metadata", 500);
    }
};

/**
 * Get image file metadata
 */
export const getImageMetadata: RouteHandler = async (_req, params) => {
    const { filename } = params;
    const filePath = `public/images/${filename}`;

    const file = Bun.file(filePath);

    if (!(await file.exists())) {
        return errorResponse("File not found", 404);
    }

    try {
        const metadata = await extractImageMetadata(filename, file.size);
        return jsonResponse(metadata);
    } catch (error) {
        logger.error("Metadata extraction error", { error: extractErrorDetail(error) });
        return errorResponse("Failed to extract metadata", 500);
    }
};
