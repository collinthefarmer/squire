import { BehaviorSubject, type Observable } from "rxjs";
import { Logger } from "@utils/logger";
import type { ConfigService } from "@services/config-service";

export interface AudioAsset {
    name: string;
    url: string;
    duration: number;
}

export interface ImageAsset {
    name: string;
    url: string;
    width: number;
    height: number;
}

export interface FontAsset {
    name: string;
    filename: string;
    url: string;
}

/**
 * Asset service for master client
 *
 * Fetches and caches available audio and image assets from server
 */
export class AssetService {
    private logger = new Logger("AssetService");
    private audioAssets$ = new BehaviorSubject<AudioAsset[]>([]);
    private imageAssets$ = new BehaviorSubject<ImageAsset[]>([]);
    private fontAssets$ = new BehaviorSubject<FontAsset[]>([]);
    private apiUrl: string;

    constructor(config: ConfigService) {
        this.apiUrl = config.getApiUrl();
    }

    /**
     * Get audio assets observable
     */
    getAudioAssets$(): Observable<AudioAsset[]> {
        return this.audioAssets$.asObservable();
    }

    /**
     * Get image assets observable
     */
    getImageAssets$(): Observable<ImageAsset[]> {
        return this.imageAssets$.asObservable();
    }

    /**
     * Get current audio assets value
     */
    getAudioAssets(): AudioAsset[] {
        return this.audioAssets$.value;
    }

    /**
     * Get current image assets value
     */
    getImageAssets(): ImageAsset[] {
        return this.imageAssets$.value;
    }

    /**
     * Fetch audio assets from server
     */
    async fetchAudioAssets(): Promise<void> {
        try {
            this.logger.info("Fetching audio assets");
            const response = await fetch(`${this.apiUrl}/api/assets/audio`);

            if (!response.ok) {
                this.logger.error("Failed to fetch audio assets", {
                    status: response.status,
                });
                return;
            }

            const assets: AudioAsset[] = await response.json();
            this.audioAssets$.next(assets);
            this.logger.info("Audio assets loaded", {
                count: assets.length,
            });
        } catch (error) {
            this.logger.error("Error fetching audio assets", { error });
        }
    }

    /**
     * Fetch image assets from server
     */
    async fetchImageAssets(): Promise<void> {
        try {
            this.logger.info("Fetching image assets");
            const response = await fetch(`${this.apiUrl}/api/assets/images`);

            if (!response.ok) {
                this.logger.error("Failed to fetch image assets", {
                    status: response.status,
                });
                return;
            }

            const assetsData: ImageAsset[] = await response.json();
            this.imageAssets$.next(assetsData);
            this.logger.info("Image assets loaded", {
                count: assetsData.length,
            });
        } catch (error) {
            this.logger.error("Error fetching image assets", { error });
        }
    }

    /**
     * Get font assets observable
     */
    getFontAssets$(): Observable<FontAsset[]> {
        return this.fontAssets$.asObservable();
    }

    /**
     * Get current font assets value
     */
    getFontAssets(): FontAsset[] {
        return this.fontAssets$.value;
    }

    /**
     * Fetch font assets from server and register them as CSS @font-face
     */
    async fetchFontAssets(): Promise<void> {
        try {
            this.logger.info("Fetching font assets");
            const response = await fetch(`${this.apiUrl}/api/assets/fonts`);

            if (!response.ok) {
                this.logger.error("Failed to fetch font assets", {
                    status: response.status,
                });
                return;
            }

            const assets: FontAsset[] = await response.json();

            for (const font of assets) {
                const face = new FontFace(font.name, `url(${this.apiUrl}${font.url})`);
                try {
                    const loaded = await face.load();
                    (document.fonts as FontFaceSet & { add(font: FontFace): void }).add(loaded);
                } catch (error) {
                    this.logger.debug("Failed to load font", { font: font.name, error });
                }
            }

            this.fontAssets$.next(assets);
            this.logger.info("Font assets loaded", { count: assets.length });
        } catch (error) {
            this.logger.error("Error fetching font assets", { error });
        }
    }

    /**
     * Refresh all assets
     */
    async refreshAssets(): Promise<void> {
        await Promise.all([
            this.fetchAudioAssets(),
            this.fetchImageAssets(),
            this.fetchFontAssets(),
        ]);
    }
}
