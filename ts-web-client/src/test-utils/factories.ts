import type { EventMetadata } from "@types";

/**
 * Shared test data factories.
 *
 * Follow the make{Entity}(overrides?) convention — returns a valid default
 * with optional partial overrides.
 */

export function makeMetadata(
    timestamp: number = Date.now(),
): EventMetadata {
    return { timestamp, source: "test" };
}
