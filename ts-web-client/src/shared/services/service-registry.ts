/**
 * Service registry for dependency injection
 *
 * Provides type-safe singleton service registration and resolution
 */
export class ServiceRegistry {
    private static instances = new Map<string, any>();

    /**
     * Register a service singleton
     *
     * Throws if service with same key already registered
     */
    static register<T>(key: string, instance: T): void {
        if (this.instances.has(key)) {
            throw new Error(`Service ${key} already registered`);
        }
        this.instances.set(key, instance);
    }

    /**
     * Get a registered service
     *
     * Throws if service not found
     */
    static get<T>(key: string): T {
        if (!this.instances.has(key)) {
            throw new Error(`Service ${key} not found`);
        }
        return this.instances.get(key) as T;
    }

    /**
     * Check if service is registered
     */
    static has(key: string): boolean {
        return this.instances.has(key);
    }

    /**
     * Clear all registered services (for testing)
     */
    static clear(): void {
        this.instances.clear();
    }
}
