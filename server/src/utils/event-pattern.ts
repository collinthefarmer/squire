/**
 * Match an event type string against a pattern.
 *
 * Supports:
 * - Exact match: "audio.play" matches "audio.play"
 * - Prefix wildcard: "audio.*" matches "audio.play", "audio.pause", etc.
 * - Global wildcard: "*" matches everything
 */
export function matchesPattern(type: string, pattern: string): boolean {
    if (pattern === "*") {
        return true;
    }

    if (pattern.endsWith(".*")) {
        const prefix = pattern.slice(0, -1);
        return type.startsWith(prefix);
    }

    return type === pattern;
}
