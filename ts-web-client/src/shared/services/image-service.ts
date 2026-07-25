import { SERVER_ORIGIN } from "@constants/display";
import { AssetService } from "@services/asset-service";

import type { ImageAsset, ImageRef, ImageDimensions, ImageResizeOptions } from "@types";

export class ImageService {
    readonly catalog = new AssetService<ImageAsset>({
        endpoint: "/api/assets/images",
        label: "images",
    });

    private readonly loaded = new Map<string, ImageDimensions>();
    private readonly inflight = new Map<string, Promise<ImageDimensions>>();

    resolveUrl(ref: ImageRef, opts?: ImageResizeOptions): string {
        const base = `${SERVER_ORIGIN}/public/images/${ref}`;
        const params = new URLSearchParams();

        if (opts?.width) params.set("w", String(opts.width));
        if (opts?.height) params.set("h", String(opts.height));

        const qs = params.toString();
        return qs ? `${base}?${qs}` : base;
    }

    isCached(ref: ImageRef): boolean {
        return this.loaded.has(ref);
    }

    async preload(ref: ImageRef, opts?: ImageResizeOptions): Promise<ImageDimensions> {
        const url = this.resolveUrl(ref, opts);

        const cached = this.loaded.get(url);
        if (cached) return cached;

        const existing = this.inflight.get(url);
        if (existing) return existing;

        const promise = this.load(url);
        this.inflight.set(url, promise);
        return promise;
    }

    private async load(url: string): Promise<ImageDimensions> {
        try {
            const dims = await new Promise<ImageDimensions>((resolve, reject) => {
                const img = new Image();

                img.onload = () => resolve({
                    naturalWidth: img.naturalWidth,
                    naturalHeight: img.naturalHeight,
                });

                img.onerror = () => reject(new Error(`Failed to load image: ${url}`));

                img.src = url;
            });

            this.loaded.set(url, dims);
            this.inflight.delete(url);
            return dims;
        } catch (error) {
            this.inflight.delete(url);
            throw error;
        }
    }
}
