/**
 * Simple logger utility for client
 */
export class Logger {
    constructor(private context: string) {}

    info(message: string, data?: Record<string, any>): void {
        console.log(`[${this.context}] ${message}`, data || "");
    }

    error(message: string, data?: Record<string, any>): void {
        console.error(`[${this.context}] ${message}`, data || "");
    }

    warn(message: string, data?: Record<string, any>): void {
        console.warn(`[${this.context}] ${message}`, data || "");
    }

    debug(message: string, data?: Record<string, any>): void {
        console.debug(`[${this.context}] ${message}`, data || "");
    }
}
