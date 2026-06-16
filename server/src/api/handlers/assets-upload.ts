import { basename } from "node:path";
import { errorResponse, jsonResponse } from "@core/http/responses";
import {
    isValidAudioFile,
    isValidImageFile,
    validateFileSize,
    MAX_AUDIO_SIZE,
    MAX_IMAGE_SIZE,
} from "@core/http/validation";
import { Logger } from "@utils/logger";
import type { RouteHandler } from "@core/http/router";

/**
 * Sanitize an uploaded filename to prevent path traversal.
 *
 * Strips directory components, replaces dangerous characters,
 * and rejects empty or dot-only names.
 */
function sanitizeFilename(name: string): string | null {
    const base = basename(name);
    const sanitized = base.replace(/[^a-zA-Z0-9._-]/g, "_");

    if (!sanitized || sanitized === "." || sanitized === "..") {
        return null;
    }

    return sanitized;
}

const logger = new Logger("AssetsUpload");

/**
 * Extract a readable error string that preserves stack traces.
 */
function extractErrorDetail(error: unknown): string {
    if (error instanceof Error) {
        return error.stack ?? error.message;
    }
    return String(error);
}

/**
 * Upload audio file
 */
export const uploadAudioAsset: RouteHandler = async (req) => {
    const contentType = req.headers.get("content-type");
    if (!contentType?.includes("multipart/form-data")) {
        return errorResponse("Expected multipart/form-data", 400);
    }

    try {
        const formData = await req.formData();
        const file = formData.get("file");

        if (!file || !(file instanceof File)) {
            return errorResponse("No file provided", 400);
        }

        if (!isValidAudioFile(file.name)) {
            return errorResponse(
                "Invalid audio file extension. Allowed: mp3, wav, ogg, m4a",
                400,
            );
        }

        if (!validateFileSize(file.size, MAX_AUDIO_SIZE)) {
            return errorResponse("File too large (max 100MB)", 413);
        }

        const safeName = sanitizeFilename(file.name);
        if (!safeName) {
            return errorResponse("Invalid filename", 400);
        }

        const targetPath = `public/audio/${safeName}`;
        await Bun.write(targetPath, file);

        const savedFile = Bun.file(targetPath);

        return jsonResponse(
            {
                name: safeName,
                url: `/public/audio/${safeName}`,
                size: savedFile.size,
                uploadedAt: Date.now(),
            },
            201,
        );
    } catch (error) {
        logger.error("Audio upload error", { error: extractErrorDetail(error) });
        return errorResponse("Upload failed", 500);
    }
};

/**
 * Upload image file
 */
export const uploadImageAsset: RouteHandler = async (req) => {
    const contentType = req.headers.get("content-type");
    if (!contentType?.includes("multipart/form-data")) {
        return errorResponse("Expected multipart/form-data", 400);
    }

    try {
        const formData = await req.formData();
        const file = formData.get("file");

        if (!file || !(file instanceof File)) {
            return errorResponse("No file provided", 400);
        }

        if (!isValidImageFile(file.name)) {
            return errorResponse(
                "Invalid image file extension. Allowed: png, jpg, jpeg, gif, webp, svg",
                400,
            );
        }

        if (!validateFileSize(file.size, MAX_IMAGE_SIZE)) {
            return errorResponse("File too large (max 50MB)", 413);
        }

        const safeName = sanitizeFilename(file.name);
        if (!safeName) {
            return errorResponse("Invalid filename", 400);
        }

        const targetPath = `public/images/${safeName}`;
        await Bun.write(targetPath, file);

        const savedFile = Bun.file(targetPath);

        return jsonResponse(
            {
                name: safeName,
                url: `/public/images/${safeName}`,
                size: savedFile.size,
                uploadedAt: Date.now(),
            },
            201,
        );
    } catch (error) {
        logger.error("Image upload error", { error: extractErrorDetail(error) });
        return errorResponse("Upload failed", 500);
    }
};
