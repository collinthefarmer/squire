import { ServiceRegistry } from "@services/service-registry";
import { TOKENS } from "@services/service-tokens";
import { ConfigService } from "@services/config-service";
import { EventBus } from "@services/event-bus";
import { ConnectionService } from "@services/connection-service";
import { LocalStore } from "@services/local-store";
import { ContextMenuService } from "@services/context-menu-service";
import { TimeScaleService } from "@services/time-scale-service";
import { WebRTCSignalingService } from "@services/webrtc-signaling-service";
import { AssetService } from "@master/services/asset-service";
import { ImageToolbarService } from "@master/services/image-toolbar-service";
import { MasterVisualService } from "@master/services/visual-service";
import { MasterClockService } from "@master/services/clock-service";
import { MicCaptureService } from "@master/services/mic-capture-service";
import { WebRTCBroadcastService } from "@master/services/webrtc-broadcast-service";
import { LiveAudioService } from "@master/services/live-audio-service";
import { MasterAudioService } from "@master/services/master-audio-service";
import { EffectChainLibrary } from "@master/services/effect-chain-library";
import { SceneService } from "@master/services/scene-service";

import { Draggable } from "@components/draggable/draggable";
import { DraggableImage } from "@components/draggable/draggable-image";
import { DraggableAudio } from "@components/draggable/draggable-audio";
import { ImageHandle } from "@components/image-handle";
import { ImageAssetGridClass } from "@components/asset-gallery";

import { SquireMasterClient } from "@master/components/squire-client";
import { IframePreview } from "@master/components/canvas/iframe-preview";
import { DropZoneOverlay } from "@master/components/canvas/drop-zone-overlay";
import { CanvasOverlay } from "@master/components/canvas/canvas-overlay";
import { CanvasPreview } from "@master/components/canvas/canvas-preview";
import { AudioControls } from "@master/components/audio/audio-controls";
import { ChannelSelector } from "@master/components/audio/channel-selector";
import { AudioAssetPicker } from "@master/components/audio/audio-asset-picker";
import { AudioPlaybackButtons } from "@master/components/audio/audio-playback-buttons";
import { VolumeControl } from "@master/components/audio/volume-control";
import { SourceTypeSelector } from "@master/components/audio/source-type-selector";
import { MicControls } from "@master/components/audio/mic-controls";
import { AudioFileList } from "@master/components/audio/audio-file-list";
import { AudioTimeline } from "@master/components/audio/audio-timeline";
import { EffectsRack } from "@master/components/audio/effects-rack";
import { TimelineChannelLane } from "@master/components/audio/timeline-channel-lane";
import { TimelineTrackBlock } from "@master/components/audio/timeline-track-block";
import { ImageGallery } from "@master/components/image/image-gallery";
import { ClockControls } from "@master/components/clock/clock-controls";
import { TimeScaleControls } from "@master/components/time/time-scale-controls";
import { ImageToolbar } from "@master/components/image/image-toolbar";
import { LayerControlPanel } from "@master/components/image/layer-control-panel";
import { SidebarTabs } from "@master/components/sidebar-tabs";
import { SettingsPanel } from "@master/components/settings/settings-panel";
import { ContextMenu } from "@master/components/context-menu";
import { ScenePanel } from "@master/components/scene/scene-panel";
import { SceneSaveForm } from "@master/components/scene/scene-save-form";
import { SceneList } from "@master/components/scene/scene-list";

/**
 * Initialize all master client services in dependency order
 * and register them in the ServiceRegistry.
 */
export function createMasterServices() {
    const config = new ConfigService({ clientType: "master" });
    ServiceRegistry.register(TOKENS.ConfigService, config);

    const eventBus = new EventBus();
    ServiceRegistry.register(TOKENS.EventBus, eventBus);

    const connection = new ConnectionService(eventBus, config);
    ServiceRegistry.register(TOKENS.ConnectionService, connection);

    const localStore = new LocalStore();
    ServiceRegistry.register(TOKENS.LocalStore, localStore);

    const contextMenuService = new ContextMenuService();
    ServiceRegistry.register(TOKENS.ContextMenuService, contextMenuService);

    const assetService = new AssetService(config);
    ServiceRegistry.register(TOKENS.AssetService, assetService);

    const imageToolbarService = new ImageToolbarService();
    ServiceRegistry.register(TOKENS.ImageToolbarService, imageToolbarService);

    const timeScaleService = new TimeScaleService(eventBus, connection);
    ServiceRegistry.register(TOKENS.TimeScaleService, timeScaleService);

    const visualService = new MasterVisualService(connection, eventBus);
    ServiceRegistry.register(TOKENS.MasterVisualService, visualService);

    const clockService = new MasterClockService(connection, eventBus);
    ServiceRegistry.register(TOKENS.MasterClockService, clockService);

    const signalingService = new WebRTCSignalingService(connection, eventBus);
    ServiceRegistry.register(TOKENS.WebRTCSignalingService, signalingService);

    const micCaptureService = new MicCaptureService();
    ServiceRegistry.register(TOKENS.MicCaptureService, micCaptureService);

    const broadcastService = new WebRTCBroadcastService(signalingService);
    ServiceRegistry.register(TOKENS.WebRTCBroadcastService, broadcastService);

    const masterAudioService = new MasterAudioService(
        eventBus,
        connection,
        localStore,
        assetService,
    );
    ServiceRegistry.register(TOKENS.MasterAudioService, masterAudioService);

    const liveAudioService = new LiveAudioService(
        connection,
        eventBus,
        micCaptureService,
        broadcastService,
    );
    ServiceRegistry.register(TOKENS.LiveAudioService, liveAudioService);

    const effectChainLibrary = new EffectChainLibrary(localStore);
    ServiceRegistry.register(TOKENS.EffectChainLibrary, effectChainLibrary);

    const sceneService = new SceneService(
        localStore,
        masterAudioService,
        visualService,
        clockService,
        timeScaleService,
    );
    ServiceRegistry.register(TOKENS.SceneService, sceneService);

    return { connection, assetService, contextMenuService };
}

/**
 * Register all master client custom elements.
 */
export function registerMasterComponents(): void {
    customElements.define("squire-draggable", DraggableImage);
    customElements.define("squire-draggable-handle", Draggable);
    customElements.define("squire-draggable-audio", DraggableAudio);
    customElements.define("image-handle", ImageHandle);
    customElements.define("image-asset-grid", ImageAssetGridClass);

    customElements.define("channel-selector", ChannelSelector);
    customElements.define("audio-asset-picker", AudioAssetPicker);
    customElements.define("audio-playback-buttons", AudioPlaybackButtons);
    customElements.define("volume-control", VolumeControl);
    customElements.define("source-type-selector", SourceTypeSelector);
    customElements.define("mic-controls", MicControls);
    customElements.define("audio-file-list", AudioFileList);
    customElements.define("timeline-track-block", TimelineTrackBlock);
    customElements.define("timeline-channel-lane", TimelineChannelLane);
    customElements.define("audio-timeline", AudioTimeline);
    customElements.define("audio-controls", AudioControls);
    customElements.define("effects-rack", EffectsRack);

    customElements.define("layer-control-panel", LayerControlPanel);
    customElements.define("image-toolbar", ImageToolbar);
    customElements.define("image-gallery", ImageGallery);

    customElements.define("clock-controls", ClockControls);
    customElements.define("time-scale-controls", TimeScaleControls);

    customElements.define("iframe-preview", IframePreview);
    customElements.define("drop-zone-overlay", DropZoneOverlay);
    customElements.define("canvas-overlay", CanvasOverlay);
    customElements.define("canvas-preview", CanvasPreview);

    customElements.define("sidebar-tabs", SidebarTabs);
    customElements.define("settings-panel", SettingsPanel);
    customElements.define("context-menu", ContextMenu);
    customElements.define("scene-panel", ScenePanel);
    customElements.define("scene-save-form", SceneSaveForm);
    customElements.define("scene-list", SceneList);
    customElements.define("squire-master-client", SquireMasterClient);
}
