import { ServiceRegistry } from "@services/service-registry";
import { TOKENS } from "@services/service-tokens";
import { EventBus } from "@services/event-bus";
import { ConnectionService } from "@services/connection-service";
import { ConfigService } from "@services/config-service";
import { TimeScaleService } from "@services/time-scale-service";
import { WebRTCSignalingService } from "@services/webrtc-signaling-service";
import { WebRTCReceiverService } from "@display/services/webrtc-receiver-service";
import { DisplayAudioService } from "@display/services/audio-service";
import { DisplayVisualService } from "@display/services/visual-service";
import { DisplayClockService } from "@display/services/clock-service";

import { AudioEnableModal } from "@display/components/audio-enable-modal";
import { AudioPlayer } from "@display/components/audio-player";
import { AudioChannelCard } from "@display/components/audio-channel-card";
import { VisualRenderer } from "@display/components/visual-renderer";
import { ClockRenderer } from "@display/components/clock-renderer";

/**
 * Initialize all display client services in dependency order
 * and register them in the ServiceRegistry.
 */
export function createDisplayServices() {
    const config = new ConfigService({ clientType: "display" });
    ServiceRegistry.register(TOKENS.ConfigService, config);

    const eventBus = new EventBus();
    ServiceRegistry.register(TOKENS.EventBus, eventBus);

    const connection = new ConnectionService(eventBus, config);
    ServiceRegistry.register(TOKENS.ConnectionService, connection);

    const signalingService = new WebRTCSignalingService(connection, eventBus);
    ServiceRegistry.register(TOKENS.WebRTCSignalingService, signalingService);

    const receiverService = new WebRTCReceiverService(signalingService);
    ServiceRegistry.register(TOKENS.WebRTCReceiverService, receiverService);

    const audioService = new DisplayAudioService(eventBus, config);
    ServiceRegistry.register(TOKENS.DisplayAudioService, audioService);

    const visualService = new DisplayVisualService(eventBus);
    ServiceRegistry.register(TOKENS.DisplayVisualService, visualService);

    const timeScaleService = new TimeScaleService(eventBus);
    ServiceRegistry.register(TOKENS.TimeScaleService, timeScaleService);

    const clockService = new DisplayClockService(eventBus);
    ServiceRegistry.register(TOKENS.ClockService, clockService);

    return { connection };
}

/**
 * Register all display client custom elements.
 */
export function registerDisplayComponents(): void {
    customElements.define("audio-enable-modal", AudioEnableModal);
    customElements.define("audio-channel-card", AudioChannelCard);
    customElements.define("audio-player", AudioPlayer);
    customElements.define("visual-renderer", VisualRenderer);
    customElements.define("clock-renderer", ClockRenderer);
}
