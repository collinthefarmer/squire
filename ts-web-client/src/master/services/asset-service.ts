import { BehaviorSubject, type Observable } from "rxjs";
import { Logger } from "@utils/logger";
import type { ConfigService } from "@services/config-service";

export interface ImageAsset {
    name: string;
    url: string;
    width: number;
    height: number;
}

/**
 * Asset service for master client
 *
 * Fetches and caches available audio and image assets from server
 */
export class AssetService {
    private logger = new Logger("AssetService");
    private audioAssets$ = new BehaviorSubject<string[]>([]);
    private imageAssets$ = new BehaviorSubject<ImageAsset[]>([]);
    private apiUrl: string;

    constructor(config: ConfigService) {
        this.apiUrl = config.getApiUrl();
    }

    /**
     * Get audio assets observable
     */
    getAudioAssets$(): Observable<string[]> {
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
    getAudioAssets(): string[] {
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

            const assetsData = await response.json();
            const assetNames = assetsData.map(
                (asset: { name: string; url: string }) => asset.name,
            );
            this.audioAssets$.next(assetNames);
            this.logger.info("Audio assets loaded", {
                count: assetNames.length,
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
     * Refresh all assets
     */
    async refreshAssets(): Promise<void> {
        await Promise.all([this.fetchAudioAssets(), this.fetchImageAssets()]);
    }
}
