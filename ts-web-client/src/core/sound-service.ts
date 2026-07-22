import { SERVER_ORIGIN } from "@constants/display";
import { AssetService } from "@core/asset-service";

import type { AudioAsset } from "@types";

export class SoundService {
    readonly catalog = new AssetService<AudioAsset>({
        endpoint: "/api/assets/audio",
        label: "audio",
    });

    resolveUrl(ref: string): string {
        return `${SERVER_ORIGIN}/public/audio/${ref}`;
    }
}
