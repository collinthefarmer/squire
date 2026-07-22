import { SERVER_ORIGIN } from "@constants/display";
import { AssetService } from "@core/asset-service";

import type { FontAsset } from "@types";

export class FontService {
    readonly catalog = new AssetService<FontAsset>({
        endpoint: "/api/assets/fonts",
        label: "fonts",
    });

    resolveUrl(ref: string): string {
        return `${SERVER_ORIGIN}/public/fonts/${ref}`;
    }

    async load(asset: FontAsset): Promise<FontFace> {
        const url = this.resolveUrl(asset.filename);
        const face = new FontFace(asset.name, `url(${url})`);

        return await face.load();
    }
}
