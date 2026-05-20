import type { ServiceToken } from "./service-tokens";

/**
 * Service registry for dependency injection
 *
 * Provides type-safe singleton service registration and resolution
 * via ServiceToken<T> (see service-tokens.ts).
 */
export class ServiceRegistry {
    private static instances = new Map<symbol, unknown>();

    /**
     * Register a service singleton by typed token.
     *
     * Throws if a service with the same token is already registered.
     */
    static register<T>(token: ServiceToken<T>, instance: T): void {
        if (this.instances.has(token.symbol)) {
            throw new Error(`Service ${token.symbol.toString()} already registered`);
        }
        this.instances.set(token.symbol, instance);
    }

    /**
     * Get a registered service by typed token.
     *
     * The return type is inferred from the token's phantom type parameter,
     * eliminating the need for manual generic annotations at call sites.
     *
     * Throws if the service is not found.
     */
    static get<T>(token: ServiceToken<T>): T {
        if (!this.instances.has(token.symbol)) {
            throw new Error(`Service ${token.symbol.toString()} not found`);
        }
        return this.instances.get(token.symbol) as T;
    }

    /**
     * Check if a service is registered
     */
    static has<T>(token: ServiceToken<T>): boolean {
        return this.instances.has(token.symbol);
    }

    /**
     * Clear all registered services (for testing)
     */
    static clear(): void {
        this.instances.clear();
    }
}
