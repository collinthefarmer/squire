import { ConfigService } from "@services/config-service";
import { EventBus } from "@services/event-bus";
import { ConnectionService } from "@services/connection-service";
import { LocalStore } from "@services/local-store";
import { ContextMenuService } from "@services/context-menu-service";
import { ServiceRegistry } from "@services/service-registry";
import { AssetService } from "@master/services/asset-service";
import { ImageToolbarService } from "@master/services/image-toolbar-service";
import { MasterVisualService } from "@master/services/visual-service";
import { MasterClockService } from "@master/services/clock-service";
import { TimeScaleService } from "@services/time-scale-service";
import { WebRTCSignalingService } from "@services/webrtc-signaling-service";
import { MicCaptureService } from "@master/services/mic-capture-service";
import { WebRTCBroadcastService } from "@master/services/webrtc-broadcast-service";
import { LiveAudioService } from "@master/services/live-audio-service";
import { MasterAudioService } from "@master/services/master-audio-service";
import { EffectChainLibrary } from "@master/services/effect-chain-library";

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

/**
 * Initialize master client
 */
function init(): void {
    const config = new ConfigService({ clientType: "master" });
    ServiceRegistry.register("ConfigService", config);

    const eventBus = new EventBus();
    ServiceRegistry.register("EventBus", eventBus);

    const connection = new ConnectionService(eventBus, config);
    ServiceRegistry.register("ConnectionService", connection);

    const localStore = new LocalStore();
    ServiceRegistry.register("LocalStore", localStore);

    const contextMenuService = new ContextMenuService();
    ServiceRegistry.register("ContextMenuService", contextMenuService);

    const assetService = new AssetService(config);
    ServiceRegistry.register("AssetService", assetService);

    const imageToolbarService = new ImageToolbarService();
    ServiceRegistry.register("ImageToolbarService", imageToolbarService);

    const timeScaleService = new TimeScaleService(eventBus, connection);
    ServiceRegistry.register("TimeScaleService", timeScaleService);

    const visualService = new MasterVisualService(connection, eventBus);
    ServiceRegistry.register("MasterVisualService", visualService);

    const clockService = new MasterClockService(connection, eventBus);
    ServiceRegistry.register("MasterClockService", clockService);

    const signalingService = new WebRTCSignalingService(connection, eventBus);
    ServiceRegistry.register("WebRTCSignalingService", signalingService);

    const micCaptureService = new MicCaptureService();
    ServiceRegistry.register("MicCaptureService", micCaptureService);

    const broadcastService = new WebRTCBroadcastService(signalingService);
    ServiceRegistry.register("WebRTCBroadcastService", broadcastService);

    const masterAudioService = new MasterAudioService(
        eventBus,
        connection,
        localStore,
        assetService,
    );
    ServiceRegistry.register("MasterAudioService", masterAudioService);

    const liveAudioService = new LiveAudioService(
        connection,
        eventBus,
        micCaptureService,
        broadcastService,
    );
    ServiceRegistry.register("LiveAudioService", liveAudioService);

    const effectChainLibrary = new EffectChainLibrary(localStore);
    ServiceRegistry.register("EffectChainLibrary", effectChainLibrary);

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
    customElements.define("squire-master-client", SquireMasterClient);

    // Mount context menu and effects rack on document.body (outside Shadow DOM)
    document.body.appendChild(document.createElement("context-menu"));

    const effectsRack = document.createElement(
        "effects-rack",
    ) as InstanceType<typeof EffectsRack>;
    document.body.appendChild(effectsRack);

    document.addEventListener("fx-rack-open", (e) => {
        const detail = (e as CustomEvent).detail as {
            channel: string;
            chainId: string;
            x: number;
            y: number;
        };
        effectsRack.show(detail.x, detail.y, detail.channel, detail.chainId);
    });

    // Intercept right-clicks and show custom context menu
    document.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        const path = e.composedPath();
        const items = contextMenuService.collectItems(
            e.target as EventTarget,
            path as EventTarget[],
        );
        if (items.length > 0) {
            contextMenuService.show(e.clientX, e.clientY, items);
        } else {
            contextMenuService.hide();
        }
    });

    // Fetch assets before connecting so image dimensions are
    // available when the server replays image events on connect.
    assetService.refreshAssets().then(() => {
        connection.connect();
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
