/**
 * Simple dependency injection container
 */
export class Container {
    private services: Map<symbol, unknown> = new Map();
    private factories: Map<symbol, () => unknown> = new Map();

    /**
     * Register a service instance
     */
    registerInstance<T>(token: symbol, instance: T): void {
        this.services.set(token, instance);
    }

    /**
     * Register a service factory
     */
    registerFactory<T>(token: symbol, factory: () => T): void {
        this.factories.set(token, factory);
    }

    /**
     * Resolve a service
     */
    resolve<T>(token: symbol): T {
        // Check if already instantiated
        if (this.services.has(token)) {
            return this.services.get(token);
        }

        // Check if factory exists
        const factory = this.factories.get(token);
        if (factory) {
            const instance = factory();
            this.services.set(token, instance);
            return instance;
        }

        throw new Error(`Service not found for token: ${token.toString()}`);
    }

    /**
     * Check if service is registered
     */
    has(token: symbol): boolean {
        return this.services.has(token) || this.factories.has(token);
    }
}

/**
 * Service tokens
 */
export const TOKENS = {
    EventBus: Symbol("EventBus"),
    EventStore: Symbol("EventStore"),
    StateStore: Symbol("StateStore"),
    ClientRegistry: Symbol("ClientRegistry"),
    AudioService: Symbol("AudioService"),
    ImageService: Symbol("ImageService"),
    CountdownService: Symbol("CountdownService"),
    TimeService: Symbol("TimeService"),
};
