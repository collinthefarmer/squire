import type { Event, EventMetadata } from "@types";

/**
 * Shared test data factories.
 *
 * Follow the make{Entity}(overrides?) convention — returns a valid default
 * with optional partial overrides.
 */

export function makeMetadata(
    overrides?: Partial<EventMetadata>,
): EventMetadata {
    return {
        timestamp: Date.now(),
        source: "test",
        ...overrides,
    };
}

export function makeEvent(
    type: string,
    payload: Record<string, unknown> = {},
    metadataOverrides?: Partial<EventMetadata>,
): Event {
    return {
        type,
        payload,
        metadata: makeMetadata(metadataOverrides),
    };
}
