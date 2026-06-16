/**
 * Typed service tokens for the ServiceRegistry
 *
 * Each token maps a unique symbol to a concrete service type,
 * giving compile-time safety to service resolution. Components
 * and services should import tokens from here rather than using
 * raw string keys.
 *
 * Usage:
 *   ServiceRegistry.get(TOKENS.DisplayAudioService)  // returns DisplayAudioService
 */

import type { ConfigService } from "@services/config-service";
import type { EventBus } from "@services/event-bus";
import type { ConnectionService } from "@services/connection-service";
import type { LocalStore } from "@services/local-store";
import type { TimeScaleService } from "@services/time-scale-service";
import type { ContextMenuService } from "@services/context-menu-service";
import type { WebRTCSignalingService } from "@services/webrtc-signaling-service";

// Display-only services
import type { DisplayAudioService } from "@display/services/audio-service";
import type { DisplayVisualService } from "@display/services/visual-service";
import type { DisplayClockService } from "@display/services/clock-service";
import type { WebRTCReceiverService } from "@display/services/webrtc-receiver-service";

// Master-only services
import type { AssetService } from "@master/services/asset-service";
import type { ImageToolbarService } from "@master/services/image-toolbar-service";
import type { MasterVisualService } from "@master/services/visual-service";
import type { MasterClockService } from "@master/services/clock-service";
import type { MasterAudioService } from "@master/services/master-audio-service";
import type { LiveAudioService } from "@master/services/live-audio-service";
import type { MicCaptureService } from "@master/services/mic-capture-service";
import type { WebRTCBroadcastService } from "@master/services/webrtc-broadcast-service";
import type { EffectChainLibrary } from "@master/services/effect-chain-library";
import type { SceneService } from "@master/services/scene-service";

/**
 * A typed service token that carries its resolved type
 * as a phantom generic parameter.
 */
export interface ServiceToken<T> {
    readonly symbol: symbol;
    readonly _type?: T; // phantom — used only for type inference
}

function token<T>(name: string): ServiceToken<T> {
    return { symbol: Symbol(name) };
}

// -- Shared tokens (available to both display and master) --

export const TOKENS = {
    ConfigService: token<ConfigService>("ConfigService"),
    EventBus: token<EventBus>("EventBus"),
    ConnectionService: token<ConnectionService>("ConnectionService"),
    LocalStore: token<LocalStore>("LocalStore"),
    TimeScaleService: token<TimeScaleService>("TimeScaleService"),
    ContextMenuService: token<ContextMenuService>("ContextMenuService"),
    WebRTCSignalingService: token<WebRTCSignalingService>("WebRTCSignalingService"),

    // Display
    DisplayAudioService: token<DisplayAudioService>("DisplayAudioService"),
    DisplayVisualService: token<DisplayVisualService>("DisplayVisualService"),
    ClockService: token<DisplayClockService>("ClockService"),
    WebRTCReceiverService: token<WebRTCReceiverService>("WebRTCReceiverService"),

    // Master
    AssetService: token<AssetService>("AssetService"),
    ImageToolbarService: token<ImageToolbarService>("ImageToolbarService"),
    MasterVisualService: token<MasterVisualService>("MasterVisualService"),
    MasterClockService: token<MasterClockService>("MasterClockService"),
    MasterAudioService: token<MasterAudioService>("MasterAudioService"),
    LiveAudioService: token<LiveAudioService>("LiveAudioService"),
    MicCaptureService: token<MicCaptureService>("MicCaptureService"),
    WebRTCBroadcastService: token<WebRTCBroadcastService>("WebRTCBroadcastService"),
    EffectChainLibrary: token<EffectChainLibrary>("EffectChainLibrary"),
    SceneService: token<SceneService>("SceneService"),
} as const;
