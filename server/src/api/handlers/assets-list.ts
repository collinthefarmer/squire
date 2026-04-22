import { readdirSync, mkdirSync, readFileSync } from "node:fs";
import { imageSize } from "image-size";
import { jsonResponse, errorResponse } from "@core/http/responses";
import { isValidAudioFile, isValidImageFile } from "@core/http/validation";
import { getAudioDuration } from "./assets-metadata";
import type { RouteHandler } from "@core/http/router";
import { Logger } from "@utils/logger";

const PUBLIC_DIR = "public";
const logger = new Logger("AssetsListHandler");

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
        logger.error("Failed to list audio files", { error });
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
            } catch (error) {
                logger.debug("Could not read image dimensions", { file: f, error });
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
        logger.error("Failed to list image files", { error });
        return errorResponse("Failed to list image files", 500);
    }
};
