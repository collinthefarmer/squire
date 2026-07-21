/**
 * Simple logger utility for client with configurable log levels.
 *
 * Serializes data objects to JSON so structured values are
 * visible in stdout-based log consumers (e.g., SSE forwarding).
 *
 * Log level is read from the URL search param "logLevel"
 * (e.g. ?logLevel=warn) or defaults to "debug" (all messages shown).
 * Levels: debug < info < warn < error
 */

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type LogLevel = keyof typeof LOG_LEVELS;

function resolveLogLevel(): LogLevel {
    try {
        const params = new URLSearchParams(window.location.search);
        const raw = params.get("logLevel")?.toLowerCase();

        if (raw && raw in LOG_LEVELS) {
            return raw as LogLevel;
        }
    } catch {
        // Not in a browser context (e.g. SSR or tests)
    }

    return "debug";
}

const currentLevel = resolveLogLevel();

function isEnabled(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

export class Logger {
    constructor(private context: string) {}

    info(message: string, data?: Record<string, unknown>): void {
        if (!isEnabled("info")) {
            return;
        }
        console.log(this.format(message, data));
    }

    error(message: string, data?: Record<string, unknown>): void {
        if (!isEnabled("error")) {
            return;
        }
        console.error(this.format(message, data));
    }

    warn(message: string, data?: Record<string, unknown>): void {
        if (!isEnabled("warn")) {
            return;
        }
        console.warn(this.format(message, data));
    }

    debug(message: string, data?: Record<string, unknown>): void {
        if (!isEnabled("debug")) {
            return;
        }
        console.debug(this.format(message, data));
    }

    private format(message: string, data?: Record<string, unknown>): string {
        if (!data) {
            return `[${this.context}] ${message}`;
        }
        return `[${this.context}] ${message} ${JSON.stringify(data)}`;
    }
}
