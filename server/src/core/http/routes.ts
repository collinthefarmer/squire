import type { Router } from "@core/http/router";
import { listAudioAssets, listImageAssets, listFontAssets } from "@core/http/handlers/assets-list";
import {
    uploadAudioAsset,
    uploadImageAsset,
} from "@core/http/handlers/assets-upload";
import {
    getAudioMetadata,
    getImageMetadata,
} from "@core/http/handlers/assets-metadata";

/**
 * Register all API routes
 */
export function registerRoutes(router: Router): void {
    // Asset listing
    router.get("/api/assets/audio", listAudioAssets);
    router.get("/api/assets/images", listImageAssets);
    router.get("/api/assets/fonts", listFontAssets);

    // Asset upload
    router.post("/api/assets/audio", uploadAudioAsset);
    router.post("/api/assets/images", uploadImageAsset);

    // Asset metadata
    router.get("/api/assets/audio/:filename/metadata", getAudioMetadata);
    router.get("/api/assets/images/:filename/metadata", getImageMetadata);
}
