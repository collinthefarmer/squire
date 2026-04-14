/**
 * Simple logger utility for client
 *
 * Serializes data objects to JSON so structured values are
 * visible in stdout-based log consumers (e.g., SSE forwarding).
 */
export class Logger {
    constructor(private context: string) {}

    info(message: string, data?: Record<string, unknown>): void {
        console.log(this.format(message, data));
    }

    error(message: string, data?: Record<string, unknown>): void {
        console.error(this.format(message, data));
    }

    warn(message: string, data?: Record<string, unknown>): void {
        console.warn(this.format(message, data));
    }

    debug(message: string, data?: Record<string, unknown>): void {
        console.debug(this.format(message, data));
    }

    private format(message: string, data?: Record<string, unknown>): string {
        if (!data) {
            return `[${this.context}] ${message}`;
        }
        return `[${this.context}] ${message} ${JSON.stringify(data)}`;
    }
}
