/**
 * Configuration service
 *
 * Manages client configuration including WebSocket URLs and other settings
 */
export interface ClientConfig {
    wsUrl: string;
    apiUrl: string;
    clientType: "display" | "master";
}

export class ConfigService {
    private config: ClientConfig;

    constructor(config?: Partial<ClientConfig>) {
        this.config = {
            wsUrl: this.getDefaultWebSocketUrl(),
            apiUrl: this.getDefaultApiUrl(),
            clientType: "display",
            ...config,
        };
    }

    /**
     * Get WebSocket URL
     */
    getWebSocketUrl(): string {
        return this.config.wsUrl;
    }

    /**
     * Get API URL
     */
    getApiUrl(): string {
        return this.config.apiUrl;
    }

    /**
     * Get client type
     */
    getClientType(): "display" | "master" {
        return this.config.clientType;
    }

    /**
     * Update configuration
     */
    updateConfig(updates: Partial<ClientConfig>): void {
        this.config = { ...this.config, ...updates };
    }

    /**
     * Get default WebSocket URL based on current location
     */
    private getDefaultWebSocketUrl(): string {
        if (typeof window === "undefined") {
            return "ws://localhost:3000";
        }

        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const host = window.location.hostname;
        const port = window.location.port || "3000";

        return `${protocol}//${host}:${port}`;
    }

    /**
     * Get default API URL based on current location
     */
    private getDefaultApiUrl(): string {
        if (typeof window === "undefined") {
            return "http://localhost:3000";
        }

        const protocol = window.location.protocol;
        const host = window.location.hostname;
        const port = window.location.port || "3000";

        return `${protocol}//${host}:${port}`;
    }
}
