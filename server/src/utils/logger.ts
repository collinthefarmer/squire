/**
 * Simple structured logger utility with configurable log levels.
 *
 * Provides context-prefixed logging with structured data support.
 * Usage: logger.info("Playing audio", { channel, source: source.ref })
 *
 * Log level is read from the LOG_LEVEL environment variable.
 * Levels: debug < info < warn < error
 * Default: "debug" (all messages shown)
 */

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type LogLevel = keyof typeof LOG_LEVELS;

function resolveLogLevel(): LogLevel {
    const raw = process.env.LOG_LEVEL?.toLowerCase();

    if (raw && raw in LOG_LEVELS) {
        return raw as LogLevel;
    }

    return "debug";
}

const currentLevel = resolveLogLevel();

function isEnabled(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

/**
 * Extract a readable error string that preserves stack traces.
 */
export function extractErrorDetail(error: unknown): string {
    if (error instanceof Error) {
        return error.stack ?? error.message;
    }
    return String(error);
}

export class Logger {
    constructor(private context: string) {}

    info(message: string, data?: Record<string, unknown>): void {
        if (!isEnabled("info")) {
            return;
        }
        console.log(`[${this.context}] ${message}`, ...this.formatArgs(data));
    }

    error(message: string, data?: Record<string, unknown>): void {
        if (!isEnabled("error")) {
            return;
        }
        console.error(`[${this.context}] ${message}`, ...this.formatArgs(data));
    }

    warn(message: string, data?: Record<string, unknown>): void {
        if (!isEnabled("warn")) {
            return;
        }
        console.warn(`[${this.context}] ${message}`, ...this.formatArgs(data));
    }

    debug(message: string, data?: Record<string, unknown>): void {
        if (!isEnabled("debug")) {
            return;
        }
        console.debug(`[${this.context}] ${message}`, ...this.formatArgs(data));
    }

    private formatArgs(data?: Record<string, unknown>): unknown[] {
        if (!data) {
            return [];
        }
        return [data];
    }
}
