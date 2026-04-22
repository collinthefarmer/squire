import { BehaviorSubject, timer, type Observable, take } from "rxjs";
import { Logger } from "@utils/logger";
import { eventSchema } from "@schemas";
import type { EventBus } from "@services/event-bus";
import type { ConfigService } from "@services/config-service";

/**
 * Connection states
 */
export type ConnectionState =
    | "disconnected"
    | "connecting"
    | "connected"
    | "reconnecting"
    | "failed";

/**
 * WebSocket connection service
 *
 * Manages WebSocket connection with automatic reconnection,
 * validates incoming messages with Zod, and routes to EventBus
 */
export class ConnectionService {
    private ws: WebSocket | null = null;
    private logger = new Logger("ConnectionService");
    private state$ = new BehaviorSubject<ConnectionState>("disconnected");
    private clientId$ = new BehaviorSubject<string | null>(null);
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectDelay = 1000; // Start with 1 second

    private url: string;

    constructor(
        private eventBus: EventBus,
        private config: ConfigService,
    ) {
        const base = this.config.getWebSocketUrl();
        const separator = base.includes("?") ? "&" : "?";
        this.url = `${base}${separator}type=${this.config.getClientType()}`;
    }

    getClientId(): string | null {
        return this.clientId$.value;
    }

    getClientId$(): Observable<string | null> {
        return this.clientId$.asObservable();
    }

    /**
     * Get connection state as observable
     */
    getState$(): Observable<ConnectionState> {
        return this.state$.asObservable();
    }

    /**
     * Get current connection state
     */
    getState(): ConnectionState {
        return this.state$.value;
    }

    /**
     * Connect to WebSocket server
     */
    connect(): void {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.logger.info("Already connected");
            return;
        }

        this.state$.next("connecting");
        this.logger.info("Connecting to server", { url: this.url });

        try {
            this.ws = new WebSocket(this.url);
            this.setupEventHandlers();
        } catch (error) {
            this.logger.error("Failed to create WebSocket", { error });
            this.state$.next("failed");
            this.scheduleReconnect();
        }
    }

    /**
     * Disconnect from server
     */
    disconnect(): void {
        if (this.ws) {
            this.logger.info("Disconnecting");
            this.ws.close();
            this.ws = null;
            this.state$.next("disconnected");
            this.reconnectAttempts = 0;
        }
    }

    /**
     * Send event to server
     */
    send(event: any): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.logger.warn("Cannot send - not connected");
            return;
        }

        try {
            this.ws.send(JSON.stringify(event));
        } catch (error) {
            this.logger.error("Failed to send event", { error });
        }
    }

    /**
     * Setup WebSocket event handlers
     */
    private setupEventHandlers(): void {
        if (!this.ws) {
            return;
        }

        this.ws.onopen = () => {
            this.logger.info("Connected to server");
            this.state$.next("connected");
            this.reconnectAttempts = 0;
            this.reconnectDelay = 1000;
        };

        this.ws.onmessage = (event: MessageEvent) => {
            this.handleMessage(event);
        };

        this.ws.onerror = (event: Event) => {
            this.logger.error("WebSocket error", { event });
        };

        this.ws.onclose = (event: CloseEvent) => {
            this.logger.info("Connection closed", {
                code: event.code,
                reason: event.reason,
            });

            this.state$.next("disconnected");

            // Reconnect unless intentionally closed
            if (event.code !== 1000) {
                this.scheduleReconnect();
            }
        };
    }

    /**
     * Handle incoming WebSocket message
     */
    /**
     * Handle incoming WebSocket message.
     *
     * Replay events arrive as a JSON array (single batch from server).
     * Live events arrive as single objects. Both are validated and
     * routed to the EventBus synchronously, ensuring all replay state
     * is final before any async rendering begins.
     */
    private handleMessage(event: MessageEvent): void {
        try {
            const parsed = JSON.parse(event.data);
            const events = Array.isArray(parsed) ? parsed : [parsed];

            for (const message of events) {
                // System events are server-originated and bypass schema validation
                if (this.handleSystemEvent(message)) {
                    continue;
                }

                const result = eventSchema.safeParse(message);
                if (!result.success) {
                    this.logger.error("Invalid event received", {
                        errors: result.error.format,
                    });
                    continue;
                }

                this.eventBus.emit(`server:${result.data.type}`, result.data);
            }
        } catch (error) {
            this.logger.error("Failed to process message", { error });
        }
    }

    private handleSystemEvent(message: {
        type?: string;
        payload?: Record<string, unknown>;
    }): boolean {
        if (!message.type?.startsWith("system.")) {
            return false;
        }

        if (message.type === "system.connected") {
            const clientId = message.payload?.clientId as string;
            this.clientId$.next(clientId);
            this.logger.info("Assigned client ID", { clientId });
        }

        this.eventBus.emit(`server:${message.type}`, message);
        return true;
    }

    /**
     * Schedule reconnection with exponential backoff
     */
    private scheduleReconnect(): void {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.logger.error("Max reconnect attempts reached");
            this.state$.next("failed");
            return;
        }

        this.reconnectAttempts++;
        this.state$.next("reconnecting");

        const delay =
            this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

        this.logger.info("Reconnecting", {
            attempt: this.reconnectAttempts,
            delay,
        });

        timer(delay)
            .pipe(take(1))
            .subscribe(() => this.connect());
    }
}
