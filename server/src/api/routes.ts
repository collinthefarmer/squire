import type { Router } from "@core/http/router";
import { listAudioAssets, listImageAssets } from "@api/handlers/assets-list";
import {
    uploadAudioAsset,
    uploadImageAsset,
} from "@api/handlers/assets-upload";
import {
    getAudioMetadata,
    getImageMetadata,
} from "@api/handlers/assets-metadata";

/**
 * Register all API routes
 */
export function registerRoutes(router: Router): void {
    // Asset listing
    router.get("/api/assets/audio", listAudioAssets);
    router.get("/api/assets/images", listImageAssets);

    // Asset upload
    router.post("/api/assets/audio", uploadAudioAsset);
    router.post("/api/assets/images", uploadImageAsset);

    // Asset metadata
    router.get("/api/assets/audio/:filename/metadata", getAudioMetadata);
    router.get("/api/assets/images/:filename/metadata", getImageMetadata);
}
