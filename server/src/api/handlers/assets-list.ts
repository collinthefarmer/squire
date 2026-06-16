import { readdirSync, mkdirSync, readFileSync } from "node:fs";
import { imageSize } from "image-size";
import { jsonResponse, errorResponse } from "@core/http/responses";
import { isValidAudioFile, isValidImageFile, isValidFontFile } from "@core/http/validation";
import { getAudioDuration } from "./assets-metadata";
import type { RouteHandler } from "@core/http/router";
import { Logger } from "@utils/logger";

const PUBLIC_DIR = "public";
const logger = new Logger("AssetsListHandler");

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
 * List all audio assets
 */
export const listAudioAssets: RouteHandler = async () => {
    const audioDir = `${PUBLIC_DIR}/audio`;

    try {
        mkdirSync(audioDir, { recursive: true });
        const files = readdirSync(audioDir);

        const audioFiles = files.filter(isValidAudioFile).map((f) => ({
            name: f,
            url: `/${PUBLIC_DIR}/audio/${f}`,
            duration: getAudioDuration(f) ?? 0,
        }));

        return jsonResponse(audioFiles);
    } catch (error) {
        logger.error("Failed to list audio files", { error: extractErrorDetail(error) });
        return errorResponse("Failed to list audio files", 500);
    }
};

/**
 * List all image assets with dimensions
 */
export const listImageAssets: RouteHandler = async () => {
    const imagesDir = `${PUBLIC_DIR}/images`;

    try {
        mkdirSync(imagesDir, { recursive: true });
        const files = readdirSync(imagesDir);

        const imageFiles = files.filter(isValidImageFile).map((f) => {
            const filePath = `${imagesDir}/${f}`;
            let width = 0;
            let height = 0;

            try {
                const buffer = readFileSync(filePath);
                const dimensions = imageSize(buffer);
                width = dimensions.width ?? 0;
                height = dimensions.height ?? 0;
            } catch (dimError) {
                const detail = dimError instanceof Error ? dimError.stack ?? dimError.message : String(dimError);
                logger.debug("Could not read image dimensions", { file: f, error: detail });
            }

            return {
                name: f,
                url: `/${PUBLIC_DIR}/images/${f}`,
                width,
                height,
            };
        });

        return jsonResponse(imageFiles);
    } catch (error) {
        logger.error("Failed to list image files", { error: extractErrorDetail(error) });
        return errorResponse("Failed to list image files", 500);
    }
};

/**
 * List all font assets
 */
export const listFontAssets: RouteHandler = async () => {
    const fontsDir = `${PUBLIC_DIR}/fonts`;

    try {
        mkdirSync(fontsDir, { recursive: true });
        const files = readdirSync(fontsDir);

        const fontFiles = files.filter(isValidFontFile).map((f) => {
            const name = f.replace(/\.(ttf|otf|woff|woff2)$/i, "");
            return {
                name,
                filename: f,
                url: `/${PUBLIC_DIR}/fonts/${f}`,
            };
        });

        return jsonResponse(fontFiles);
    } catch (error) {
        logger.error("Failed to list font files", { error: extractErrorDetail(error) });
        return errorResponse("Failed to list font files", 500);
    }
};
