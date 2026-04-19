import { Logger } from "@utils/logger";
import "@utils/dom-events";
import { ServiceRegistry } from "@services/service-registry";
import { EventBus } from "@services/event-bus";
import { ConnectionService } from "@services/connection-service";
import { ConfigService } from "@services/config-service";
import { AudioService } from "@display/services/audio-service";
import { VisualService } from "@display/services/visual-service";
import { DisplayClockService } from "@display/services/clock-service";
import { TimeScaleService } from "@services/time-scale-service";
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

    // Initialize and register services in dependency order
    const config = new ConfigService({ clientType: "display" });
    ServiceRegistry.register("ConfigService", config);

    const eventBus = new EventBus();
    ServiceRegistry.register("EventBus", eventBus);

    const connection = new ConnectionService(eventBus, config);
    ServiceRegistry.register("ConnectionService", connection);

    const audioService = new AudioService(eventBus, config);
    ServiceRegistry.register("AudioService", audioService);

    const visualService = new VisualService(eventBus);
    ServiceRegistry.register("VisualService", visualService);

    const timeScaleService = new TimeScaleService(eventBus);
    ServiceRegistry.register("TimeScaleService", timeScaleService);

    const clockService = new DisplayClockService(eventBus);
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

        if (window.parent !== window) {
            window.parent.postMessage({ type: "squire:audio-enabled" }, "*");
        }

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
