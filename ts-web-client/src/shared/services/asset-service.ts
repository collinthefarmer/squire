import { SERVER_ORIGIN } from "@constants/display";
import { Logger } from "@utils/logger";

interface AssetServiceOptions {
    endpoint: string;
    label: string;
}

export class AssetService<T> {
    private cache: T[] | null = null;
    private inflight: Promise<T[]> | null = null;
    private readonly url: string;
    private readonly logger: Logger;

    constructor(options: AssetServiceOptions) {
        this.url = `${SERVER_ORIGIN}${options.endpoint}`;
        this.logger = new Logger(`AssetService:${options.label}`);
    }

    async get(): Promise<T[]> {
        if (this.cache) return this.cache;

        if (this.inflight) return this.inflight;

        this.inflight = this.fetch();
        return this.inflight;
    }

    async refresh(): Promise<void> {
        this.cache = null;
        this.inflight = null;
        await this.get();
    }

    async upload(file: File): Promise<T> {
        const form = new FormData();
        form.append("file", file);

        const response = await globalThis.fetch(this.url, {
            method: "POST",
            body: form,
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Upload failed (${response.status}): ${text}`);
        }

        const asset = await response.json() as T;

        this.cache = null;
        this.inflight = null;

        return asset;
    }

    private async fetch(): Promise<T[]> {
        try {
            const response = await globalThis.fetch(this.url);

            if (!response.ok) {
                throw new Error(`${response.status} ${response.statusText}`);
            }

            const assets = await response.json() as T[];
            this.cache = assets;
            this.inflight = null;
            return assets;
        } catch (error) {
            this.inflight = null;
            this.logger.error("Failed to fetch assets", { error });
            throw error;
        }
    }
}
