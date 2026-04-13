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

/**
 * Extract audio metadata (stub implementation)
 *
 * TODO: Implement actual metadata extraction using audio file parsers
 */
async function extractAudioMetadata(
    filename: string,
    size: number
): Promise<AudioMetadata> {
    const extension = filename.split(".").pop()?.toLowerCase() || "unknown";

    return {
        filename,
        url: `/public/audio/${filename}`,
        size,
        format: extension,
        duration: 0,
        bitrate: 0,
        sampleRate: 0,
        channels: 0,
    };
}

/**
 * Extract image metadata (stub implementation)
 *
 * TODO: Implement actual metadata extraction using image file parsers
 */
async function extractImageMetadata(
    filename: string,
    size: number
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
