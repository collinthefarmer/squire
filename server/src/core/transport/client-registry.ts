import { Logger } from "@utils/logger";
import type { ConnectedClient, Event } from "../../types";

/**
 * Registry of connected WebSocket clients
 */
export class ClientRegistry {
    private logger = new Logger("ClientRegistry");
    private clients: Map<string, ConnectedClient> = new Map();

    /**
     * Register a new client
     */
    register(client: ConnectedClient): void {
        this.clients.set(client.id, client);
        this.logger.info("Client registered", { clientId: client.id, type: client.type });
    }

    /**
     * Unregister a client
     */
    unregister(clientId: string): void {
        const client = this.clients.get(clientId);
        if (client) {
            this.clients.delete(clientId);
            this.logger.info("Client unregistered", { clientId });
        }
    }

    /**
     * Get client by ID
     */
    getClient(clientId: string): ConnectedClient | undefined {
        return this.clients.get(clientId);
    }

    /**
     * Get all clients
     */
    getAllClients(): ConnectedClient[] {
        return Array.from(this.clients.values());
    }

    /**
     * Broadcast event to all clients.
     *
     * Snapshots the client list before iterating to avoid
     * TOCTOU issues if a client disconnects mid-broadcast.
     * Returns the count of clients that failed to receive.
     */
    broadcast(
        event: Event,
        filter?: (client: ConnectedClient) => boolean,
    ): number {
        const clients = filter
            ? this.getAllClients().filter(filter)
            : this.getAllClients();

        const message = JSON.stringify(event);
        let failures = 0;

        for (const client of clients) {
            try {
                client.ws.send(message);
            } catch (error) {
                failures++;
                this.logger.error("Failed to send to client", { clientId: client.id, error });
            }
        }

        if (failures > 0) {
            this.logger.warn("Partial broadcast", {
                total: clients.length,
                failures,
                eventType: event.type,
            });
        }

        return failures;
    }

    /**
     * Send event to specific client
     */
    sendToClient(clientId: string, event: Event): void {
        const client = this.clients.get(clientId);
        if (!client) {
            this.logger.warn("Client not found", { clientId });
            return;
        }

        try {
            client.ws.send(JSON.stringify(event));
        } catch (error) {
            this.logger.error("Failed to send to client", { clientId, error });
        }
    }

    /**
     * Get client count
     */
    getCount(): number {
        return this.clients.size;
    }
}
