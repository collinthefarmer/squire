/**
 * WebSocket connection service
 *
 * Manages the connection to the Squire server, handles
 * reconnection with exponential backoff, and routes
 * incoming messages to the store.
 *
 * Server protocol:
 *   1. system.connected (single JSON object) → client ID
 *   2. replay events (JSON array) → batch state hydration
 *   3. live events (single JSON objects) → incremental updates
 */

import { BehaviorSubject, type Observable } from "rxjs";
import type { DomainEvent, SystemClientListPayload } from "@types";
import { eventSchema } from "@schemas";
import { Logger } from "@utils/logger";
import type { AppStore } from "./store";

const logger = new Logger("Connection");

export type ConnectionState =
    | "disconnected"
    | "connecting"
    | "connected"
    | "reconnecting";

const BACKOFF_BASE_MS = 1000;
const BACKOFF_MAX_MS = 30_000;
const BACKOFF_MULTIPLIER = 2;

export class ConnectionService {
    private readonly _state$ = new BehaviorSubject<ConnectionState>(
        "disconnected",
    );
    private ws: WebSocket | null = null;
    private store: AppStore | null = null;
    private reconnectAttempt = 0;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(
        private readonly serverUrl: string,
        private readonly clientType: "master" | "display",
    ) {}

    get state$(): Observable<ConnectionState> {
        return this._state$.asObservable();
    }

    get state(): ConnectionState {
        return this._state$.value;
    }

    /**
     * Bind to the store after creation.
     * Breaks the circular dependency between store and connection.
     */
    bindStore(store: AppStore): void {
        this.store = store;
    }

    /**
     * Open WebSocket connection. No-ops if already connected.
     */
    connect(): void {
        if (
            this._state$.value === "connected" ||
            this._state$.value === "connecting"
        ) {
            return;
        }

        this._state$.next("connecting");

        const url = `${this.serverUrl}?type=${this.clientType}`;
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
            logger.info("Connected", { url });
            this._state$.next("connected");
            this.reconnectAttempt = 0;
        };

        this.ws.onmessage = (msg: MessageEvent) => {
            this.handleMessage(msg.data as string);
        };

        this.ws.onclose = () => {
            logger.info("Disconnected");
            this.ws = null;
            this.scheduleReconnect();
        };

        this.ws.onerror = (error) => {
            logger.error("WebSocket error", { error: String(error) });
        };
    }

    /**
     * Send an event to the server.
     */
    send(event: DomainEvent): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            logger.warn("Cannot send — not connected", { type: event.type });
            return;
        }

        this.ws.send(JSON.stringify(event));
    }

    /**
     * Close the connection without triggering reconnect.
     */
    disconnect(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.ws) {
            this.ws.onclose = null;
            this.ws.close();
            this.ws = null;
        }

        this._state$.next("disconnected");
    }

    // -- Private --

    private handleMessage(raw: string): void {
        if (!this.store) {
            logger.error("Store not bound — dropping message");
            return;
        }

        let parsed: unknown;

        try {
            parsed = JSON.parse(raw);
        } catch {
            logger.error("Failed to parse message", { raw: raw.slice(0, 200) });
            return;
        }

        if (Array.isArray(parsed)) {
            this.handleReplay(parsed);
            return;
        }

        this.handleSingleEvent(parsed as Record<string, unknown>);
    }

    private handleReplay(events: unknown[]): void {
        if (!this.store) {
            return;
        }

        const validated: DomainEvent[] = [];

        for (const raw of events) {
            const result = eventSchema.safeParse(raw);

            if (result.success) {
                validated.push(result.data as DomainEvent);
            } else {
                logger.warn("Invalid replay event, skipping", {
                    type: String((raw as Record<string, unknown>)?.type),
                });
            }
        }

        logger.info("Replaying events", { count: validated.length });
        this.store.reset();
        this.store.applyReplay(validated);
    }

    private handleSingleEvent(event: Record<string, unknown>): void {
        if (!this.store) {
            return;
        }

        // system.connected — not in the domain schema
        if (event.type === "system.connected") {
            const payload = event.payload as { clientId: string };
            this.store.setClientId(payload.clientId);
            logger.info("Client ID assigned", { clientId: payload.clientId });
            return;
        }

        // system.client_list — pass through to event bus
        if (event.type === "system.client_list") {
            this.store.eventBus.emit({
                type: "system.client_list",
                payload: event.payload as SystemClientListPayload,
                metadata: event.metadata as DomainEvent["metadata"],
            });
            return;
        }

        // Domain events — validate with Zod
        const result = eventSchema.safeParse(event);

        if (!result.success) {
            logger.warn("Invalid event received", { type: String(event.type) });
            return;
        }

        this.store.applyEvent(result.data as DomainEvent);
    }

    private scheduleReconnect(): void {
        this._state$.next("reconnecting");

        const delay = Math.min(
            BACKOFF_BASE_MS *
                Math.pow(BACKOFF_MULTIPLIER, this.reconnectAttempt),
            BACKOFF_MAX_MS,
        );

        logger.info("Reconnecting", {
            attempt: this.reconnectAttempt + 1,
            delayMs: delay,
        });

        this.reconnectTimer = setTimeout(() => {
            this.reconnectAttempt++;
            this.connect();
        }, delay);
    }
}
