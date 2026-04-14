import { Logger } from "@utils/logger";
import { ServiceRegistry } from "@services/service-registry";
import { EventBus } from "@services/event-bus";
import { ConnectionService } from "@services/connection-service";
import { ConfigService } from "@services/config-service";
import { AudioService } from "@display/services/audio-service";
import { VisualService } from "@display/services/visual-service";
import { DisplayClockService } from "@display/services/clock-service";
import { AudioEnableModal } from "@display/components/audio-enable-modal";
import { AudioPlayer } from "@display/components/audio-player";
import { AudioChannelCard } from "@display/components/audio-channel-card";
import { VisualRenderer } from "@display/components/visual-renderer";
import { ClockRenderer } from "@display/components/clock-renderer";

const logger = new Logger("DisplayClient");

/**
 * Initialize display client
 */
function init(): void {
    logger.info("Initializing display client");

    // Initialize services in dependency order
    const config = new ConfigService({
        wsUrl: "ws://localhost:3000",
        apiUrl: "http://localhost:3000",
        clientType: "display",
    });
    const eventBus = new EventBus();
    const connection = new ConnectionService(eventBus, config);
    const audioService = new AudioService(eventBus, config);
    const visualService = new VisualService(eventBus);
    const clockService = new DisplayClockService(eventBus);

    // Register singletons
    ServiceRegistry.register("ConfigService", config);
    ServiceRegistry.register("EventBus", eventBus);
    ServiceRegistry.register("ConnectionService", connection);
    ServiceRegistry.register("AudioService", audioService);
    ServiceRegistry.register("VisualService", visualService);
    ServiceRegistry.register("ClockService", clockService);

    // Register components
    customElements.define("audio-enable-modal", AudioEnableModal);
    customElements.define("audio-channel-card", AudioChannelCard);
    customElements.define("audio-player", AudioPlayer);
    customElements.define("visual-renderer", VisualRenderer);
    customElements.define("clock-renderer", ClockRenderer);

    // Show audio enable modal before connecting
    // This ensures user interaction unlocks audio context for autoplay
    showAudioEnableModal(() => {
        // Connect to server after audio is enabled
        connection.connect();
        logger.info("Display client initialized");
    });
}

/**
 * Show the audio enable modal and execute callback when audio is enabled
 */
function showAudioEnableModal(onEnabled: () => void): void {
    const modal = document.createElement("audio-enable-modal");

    modal.addEventListener("audio-enabled", () => {
        logger.info("Audio enabled, proceeding with connection");
        onEnabled();
    });

    document.body.appendChild(modal);
}

// Initialize on DOM ready
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
