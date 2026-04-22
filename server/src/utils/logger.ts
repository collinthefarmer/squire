/**
 * Simple structured logger utility.
 *
 * Provides context-prefixed logging with structured data support.
 * Usage: logger.info("Playing audio", { channel, source: source.ref })
 */
export class Logger {
    constructor(private context: string) {}

    info(message: string, data?: Record<string, unknown>): void {
        console.log(`[${this.context}] ${message}`, ...this.formatArgs(data));
    }

    error(message: string, data?: Record<string, unknown>): void {
        console.error(`[${this.context}] ${message}`, ...this.formatArgs(data));
    }

    warn(message: string, data?: Record<string, unknown>): void {
        console.warn(`[${this.context}] ${message}`, ...this.formatArgs(data));
    }

    debug(message: string, data?: Record<string, unknown>): void {
        console.debug(`[${this.context}] ${message}`, ...this.formatArgs(data));
    }

    private formatArgs(data?: Record<string, unknown>): unknown[] {
        if (!data) {
            return [];
        }
        return [data];
    }
}
