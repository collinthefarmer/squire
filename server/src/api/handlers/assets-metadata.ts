import { Input, FilePathSource, ALL_FORMATS } from "mediabunny";
import { errorResponse, jsonResponse } from "@core/http/responses";
import type { RouteHandler } from "@core/http/router";

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
        } catch {
            // Fall back to zero values if parsing fails
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
    } catch {
        return;
    }

    for (const file of files) {
        if (audioDurationCache.has(file)) {
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
            // Skip files that can't be parsed
        }
    }
}

/**
 * Extract image metadata (stub implementation)
 *
 * TODO: Implement actual metadata extraction using image file parsers
 */
async function extractImageMetadata(
    filename: string,
    size: number,
): Promise<ImageMetadata> {
    const extension = filename.split(".").pop()?.toLowerCase() || "unknown";

    return {
        filename,
        url: `/public/images/${filename}`,
        size,
        format: extension,
        width: 0,
        height: 0,
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
        console.error("Metadata extraction error:", error);
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
        console.error("Metadata extraction error:", error);
        return errorResponse("Failed to extract metadata", 500);
    }
};
