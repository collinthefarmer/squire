import { errorResponse, jsonResponse } from "@core/http/responses";
import {
    isValidAudioFile,
    isValidImageFile,
    validateFileSize,
    MAX_AUDIO_SIZE,
    MAX_IMAGE_SIZE,
} from "@core/http/validation";
import type { RouteHandler } from "@core/http/router";

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

        const targetPath = `public/audio/${file.name}`;
        await Bun.write(targetPath, file);

        const savedFile = Bun.file(targetPath);

        return jsonResponse(
            {
                name: file.name,
                url: `/public/audio/${file.name}`,
                size: savedFile.size,
                uploadedAt: Date.now(),
            },
            201,
        );
    } catch (error) {
        console.error("Audio upload error:", error);
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

        const targetPath = `public/images/${file.name}`;
        await Bun.write(targetPath, file);

        const savedFile = Bun.file(targetPath);

        return jsonResponse(
            {
                name: file.name,
                url: `/public/images/${file.name}`,
                size: savedFile.size,
                uploadedAt: Date.now(),
            },
            201,
        );
    } catch (error) {
        console.error("Image upload error:", error);
        return errorResponse("Upload failed", 500);
    }
};
