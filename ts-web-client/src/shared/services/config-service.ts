/**
 * Configuration service
 *
 * Derives server endpoints from the browser's location by default.
 * Ports can be overridden via query parameters:
 *   ?serverPort=3000&displayPort=3001
 */

const DEFAULT_SERVER_PORT = 3000;
const DEFAULT_DISPLAY_PORT = 3001;

export interface ClientConfig {
    wsUrl?: string;
    apiUrl?: string;
    displayUrl?: string;
    clientType: "display" | "master";
}

export class ConfigService {
    private wsUrl: string;
    private apiUrl: string;
    private displayUrl: string;
    private clientType: "display" | "master";

    constructor(config: ClientConfig) {
        const serverPort = this.getQueryParam("serverPort") ?? DEFAULT_SERVER_PORT;
        const displayPort = this.getQueryParam("displayPort") ?? DEFAULT_DISPLAY_PORT;

        this.wsUrl = config.wsUrl ?? this.buildUrl("ws", serverPort);
        this.apiUrl = config.apiUrl ?? this.buildUrl("http", serverPort);
        this.displayUrl = config.displayUrl ?? this.buildUrl("http", displayPort);
        this.clientType = config.clientType;
    }

    getWebSocketUrl(): string {
        return this.wsUrl;
    }

    getApiUrl(): string {
        return this.apiUrl;
    }

    getDisplayUrl(): string {
        return this.displayUrl;
    }

    getClientType(): "display" | "master" {
        return this.clientType;
    }

    private buildUrl(scheme: "ws" | "http", port: number | string): string {
        if (typeof window === "undefined") {
            return `${scheme}://localhost:${port}`;
        }

        const isSecure = window.location.protocol === "https:";
        const protocol = scheme === "ws"
            ? (isSecure ? "wss:" : "ws:")
            : (isSecure ? "https:" : "http:");
        const host = window.location.hostname;

        return `${protocol}//${host}:${port}`;
    }

    private getQueryParam(name: string): number | null {
        if (typeof window === "undefined") {
            return null;
        }

        const params = new URLSearchParams(window.location.search);
        const value = params.get(name);

        if (value === null) {
            return null;
        }

        const parsed = parseInt(value, 10);
        return isNaN(parsed) ? null : parsed;
    }
}
