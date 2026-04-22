import { Container, TOKENS } from "./container";
import { EventBus } from "@core/events/event-bus";
import { EventStore } from "@core/events/event-store";
import { StateStore } from "@core/state/state-store";
import { ClientRegistry } from "@core/transport/client-registry";
import { AudioService } from "@services/audio/audio-service";
import { ImageService } from "@services/image/image-service";
import { CountdownService } from "@services/countdown/countdown-service";
import { TimeService } from "@services/time/time-service";

/**
 * Initialize DI container with all core and feature services.
 */
export function initializeContainer(): Container {
    const container = new Container();

    // Register core services
    container.registerInstance(TOKENS.EventBus, new EventBus());
    container.registerInstance(TOKENS.EventStore, new EventStore());
    container.registerInstance(TOKENS.StateStore, new StateStore({}));
    container.registerInstance(TOKENS.ClientRegistry, new ClientRegistry());

    // Register feature services
    container.registerFactory(TOKENS.AudioService, () => {
        return new AudioService(
            container.resolve(TOKENS.EventStore),
            container.resolve(TOKENS.StateStore),
            container.resolve(TOKENS.ClientRegistry),
        );
    });

    container.registerFactory(TOKENS.ImageService, () => {
        return new ImageService(
            container.resolve(TOKENS.EventStore),
            container.resolve(TOKENS.StateStore),
            container.resolve(TOKENS.ClientRegistry),
        );
    });

    container.registerFactory(TOKENS.CountdownService, () => {
        return new CountdownService(
            container.resolve(TOKENS.EventStore),
            container.resolve(TOKENS.ClientRegistry),
        );
    });

    container.registerFactory(TOKENS.TimeService, () => {
        return new TimeService(
            container.resolve(TOKENS.EventStore),
            container.resolve(TOKENS.StateStore),
            container.resolve(TOKENS.ClientRegistry),
        );
    });

    return container;
}
