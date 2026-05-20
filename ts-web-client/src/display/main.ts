import { Logger } from "@utils/logger";
import "@utils/dom-events";
import { createDisplayServices, registerDisplayComponents } from "./setup";

const logger = new Logger("DisplayClient");

/**
 * Initialize display client
 */
function init(): void {
    logger.info("Initializing display client");

    const { connection } = createDisplayServices();
    registerDisplayComponents();

    // Show audio enable modal before connecting.
    // This ensures user interaction unlocks audio context for autoplay.
    showAudioEnableModal(() => {
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
            window.parent.postMessage({ type: "squire:audio-enabled" }, window.location.origin);
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
