import type { Event } from "@types";

/**
 * Declarative replay rules for an event domain.
 *
 * Each creation event declares how mutation events affect it:
 * - removes: events that delete the entity from replay
 * - folds: events whose fields merge into the creation event's payload
 * - replaces: events stored alongside creation (latest only per type)
 * - appends: events accumulated in sequence (order matters)
 *
 * @example
 * ```typescript
 * const imageReplay = defineReplay("layer", {
 *     "visual.image.set": {
 *         removes: ["visual.image.clear"],
 *         folds: {
 *             "visual.image.transform": ["position", "scale"],
 *         },
 *         replaces: ["visual.image.effect", "visual.image.layer_config"],
 *     },
 * });
 * ```
 */

/**
 * A fold rule is either an array of field names to merge into
 * the creation event, or an object with a custom transform that
 * receives and returns the full event sequence for complex cases
 * (e.g., audio.resume which needs the pause event's timestamp).
 */
export type FoldRule =
    | string[]
    | { transform: (sequence: Event[], trigger: Event) => Event[] };

export interface CreationReplayRule {
    removes: string[];
    folds?: Record<string, FoldRule>;
    replaces?: string[];
    appends?: string[];
    /**
     * Optional filter applied during getReplayEvents().
     * Receives the full event sequence for an entity.
     * Return false to exclude the entity from replay.
     */
    replayFilter?: (sequence: Event[]) => boolean;
    /**
     * Optional transform applied during getReplayEvents().
     * Receives the full event sequence, returns a modified sequence.
     * Runs after the filter. Use for time-scale adjustments.
     */
    replayTransform?: (sequence: Event[]) => Event[];
}

export type ReplayConfig = Record<string, CreationReplayRule>;

type EventRole =
    | { behavior: "create" }
    | { behavior: "remove" }
    | { behavior: "fold"; rule: FoldRule }
    | { behavior: "replace" }
    | { behavior: "append" };

/**
 * Generic replay domain that interprets declarative rules
 * to maintain event state for client synchronization.
 */
export class ReplayDomain {
    private state = new Map<string, Event[]>();
    private roles = new Map<string, EventRole>();
    private replayFilter?: (sequence: Event[]) => boolean;
    private replayTransform?: (sequence: Event[]) => Event[];
    private keyExtractor: (event: Event) => string | undefined;

    constructor(
        keyField: string | ((event: Event) => string | undefined),
        config: ReplayConfig,
    ) {
        this.keyExtractor =
            typeof keyField === "string"
                ? (event) =>
                      (event.payload as Record<string, unknown>)[keyField] as
                          | string
                          | undefined
                : keyField;
        this.buildRoles(config);
    }

    /**
     * Process an event according to the domain's replay rules.
     */
    update(event: Event): void {
        const key = this.keyExtractor(event);
        const role = this.roles.get(event.type);

        if (!key || !role) {
            return;
        }

        switch (role.behavior) {
            case "create":
                this.state.set(key, [event]);
                break;

            case "remove":
                this.state.delete(key);
                break;

            case "fold":
                this.foldIntoCreation(key, event, role.rule);
                break;

            case "replace":
                this.replaceByType(key, event);
                break;

            case "append":
                this.appendToSequence(key, event);
                break;
        }
    }

    /**
     * Get all events needed to replay current state for a new client.
     * Applies optional filter (exclude stale entities) and transform
     * (adjust timestamps for time-scale) before returning.
     */
    getReplayEvents(): Event[] {
        const events: Event[] = [];

        for (const sequence of this.state.values()) {
            if (this.replayFilter && !this.replayFilter(sequence)) {
                continue;
            }

            const transformed = this.replayTransform
                ? this.replayTransform(sequence)
                : sequence;

            events.push(...transformed);
        }

        return events;
    }

    private foldIntoCreation(key: string, event: Event, rule: FoldRule): void {
        const events = this.state.get(key);
        if (!events || events.length === 0) {
            return;
        }

        if (Array.isArray(rule)) {
            // Simple field merge into the creation event (first in sequence)
            const creation = events[0];
            const triggerPayload = event.payload as Record<string, unknown>;
            const updates: Record<string, unknown> = {};

            for (const field of rule) {
                if (triggerPayload[field] !== undefined) {
                    updates[field] = triggerPayload[field];
                }
            }

            events[0] = {
                ...creation,
                payload: {
                    ...(creation.payload as Record<string, unknown>),
                    ...updates,
                },
            };
        } else {
            // Custom transform: receives full sequence, returns new sequence
            const transformed = rule.transform(events, event);
            this.state.set(key, transformed);
        }
    }

    private replaceByType(key: string, event: Event): void {
        const events = this.state.get(key);
        if (!events) {
            return;
        }

        const filtered = events.filter((e) => e.type !== event.type);
        filtered.push(event);
        this.state.set(key, filtered);
    }

    private appendToSequence(key: string, event: Event): void {
        const events = this.state.get(key);
        if (!events) {
            return;
        }

        events.push(event);
    }

    /**
     * Build the internal role lookup from the declarative config.
     * Each event type mentioned in the config gets a role that the
     * update method dispatches on.
     */
    private buildRoles(config: ReplayConfig): void {
        for (const [createType, rule] of Object.entries(config)) {
            this.roles.set(createType, { behavior: "create" });

            if (rule.replayFilter) {
                this.replayFilter = rule.replayFilter;
            }

            if (rule.replayTransform) {
                this.replayTransform = rule.replayTransform;
            }

            for (const removeType of rule.removes) {
                this.roles.set(removeType, { behavior: "remove" });
            }

            if (rule.folds) {
                for (const [foldType, foldRule] of Object.entries(rule.folds)) {
                    this.roles.set(foldType, {
                        behavior: "fold",
                        rule: foldRule,
                    });
                }
            }

            if (rule.replaces) {
                for (const replaceType of rule.replaces) {
                    this.roles.set(replaceType, { behavior: "replace" });
                }
            }

            if (rule.appends) {
                for (const appendType of rule.appends) {
                    this.roles.set(appendType, { behavior: "append" });
                }
            }
        }
    }
}

/**
 * Factory function to create a ReplayDomain from a declarative config.
 */
export function defineReplay(
    keyField: string | ((event: Event) => string | undefined),
    config: ReplayConfig,
): ReplayDomain {
    return new ReplayDomain(keyField, config);
}
