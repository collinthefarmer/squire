import { Subject } from "rxjs";
import { Logger } from "../utils/logger";

/**
 * Event bus for pub/sub communication with wildcard pattern matching
 *
 * Supports exact event type matching and wildcard patterns (e.g., 'server:audio.*')
 */
export class EventBus {
    private subjects = new Map<string, Subject<any>>();
    private logger = new Logger("EventBus");

    /**
     * Subscribe to events matching the pattern
     *
     * Returns unsubscribe function for cleanup
     */
    on<T>(pattern: string, handler: (event: T) => void): () => void {
        const subject = this.getOrCreateSubject(pattern);

        const subscription = subject.subscribe({
            next: handler,
            error: (error) => {
                this.logger.error("Error in event handler", { pattern, error });
            },
        });

        return () => subscription.unsubscribe();
    }

    /**
     * Emit an event to all matching subscribers
     *
     * Emits to both exact matches and wildcard patterns
     */
    emit<T>(eventType: string, event: T): void {
        // Emit to exact match
        const exactSubject = this.subjects.get(eventType);
        if (exactSubject) {
            exactSubject.next(event);
        }

        // Emit to wildcard patterns
        for (const [pattern, subject] of this.subjects.entries()) {
            if (pattern !== eventType && this.matches(eventType, pattern)) {
                subject.next(event);
            }
        }
    }

    /**
     * Check if event type matches pattern
     *
     * Supports wildcard patterns like 'server:audio.*' or 'server:*'
     */
    private matches(eventType: string, pattern: string): boolean {
        if (pattern === eventType) {
            return true;
        }

        if (!pattern.includes("*")) {
            return false;
        }

        // Build regex pattern:
        // 1. Split by * to preserve wildcards
        // 2. Escape regex special chars in each segment
        // 3. Join with .* for wildcards
        const segments = pattern.split("*");
        const escapedSegments = segments.map((segment) =>
            segment.replace(/[.+?^${}()|[\]\\]/g, "\\$&"),
        );
        const regexPattern = escapedSegments.join(".*");

        const regex = new RegExp("^" + regexPattern + "$");
        return regex.test(eventType);
    }

    /**
     * Get or create subject for pattern
     */
    private getOrCreateSubject(pattern: string): Subject<any> {
        if (!this.subjects.has(pattern)) {
            this.subjects.set(pattern, new Subject());
        }
        return this.subjects.get(pattern)!;
    }
}
