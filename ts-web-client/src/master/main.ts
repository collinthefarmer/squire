import { ConfigService } from "@services/config-service";
import { EventBus } from "@services/event-bus";
import { ConnectionService } from "@services/connection-service";
import { ServiceRegistry } from "@services/service-registry";
import { AssetService } from "@master/services/asset-service";
import { ImageToolbarService } from "@master/services/image-toolbar-service";
import { MasterVisualService } from "@master/services/visual-service";
import { MasterClockService } from "@master/services/clock-service";

import { Draggable } from "@components/draggable/draggable";
import { DraggableImage } from "@components/draggable/draggable-image";
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
import { ImageGallery } from "@master/components/image/image-gallery";
import { ClockControls } from "@master/components/clock/clock-controls";
import { ImageToolbar } from "@master/components/image/image-toolbar";
import { LayerSelector } from "@master/components/image/layer-selector";
import { AspectRatioSelector } from "@master/components/image/aspect-ratio-selector";
import { PositionControl } from "@master/components/image/position-control";

/**
 * Initialize master client
 */
function init(): void {
    const config = new ConfigService({
        wsUrl: "ws://localhost:3000",
        apiUrl: "http://localhost:3000",
        clientType: "master",
    });

    const eventBus = new EventBus();
    const connection = new ConnectionService(eventBus, config);
    const assetService = new AssetService(config);
    const imageToolbarService = new ImageToolbarService();
    const visualService = new MasterVisualService(connection);
    const clockService = new MasterClockService(connection, eventBus);

    ServiceRegistry.register("ConfigService", config);
    ServiceRegistry.register("EventBus", eventBus);
    ServiceRegistry.register("ConnectionService", connection);
    ServiceRegistry.register("AssetService", assetService);
    ServiceRegistry.register("ImageToolbarService", imageToolbarService);
    ServiceRegistry.register("MasterVisualService", visualService);
    ServiceRegistry.register("MasterClockService", clockService);

    customElements.define("squire-draggable", DraggableImage);
    customElements.define("squire-draggable-handle", Draggable);
    customElements.define("image-handle", ImageHandle);
    customElements.define("image-asset-grid", ImageAssetGridClass);

    customElements.define("channel-selector", ChannelSelector);
    customElements.define("audio-asset-picker", AudioAssetPicker);
    customElements.define("audio-playback-buttons", AudioPlaybackButtons);
    customElements.define("volume-control", VolumeControl);
    customElements.define("audio-controls", AudioControls);

    customElements.define("layer-selector", LayerSelector);
    customElements.define("aspect-ratio-selector", AspectRatioSelector);
    customElements.define("position-control", PositionControl);
    customElements.define("image-toolbar", ImageToolbar);
    customElements.define("image-gallery", ImageGallery);

    customElements.define("clock-controls", ClockControls);

    customElements.define("iframe-preview", IframePreview);
    customElements.define("drop-zone-overlay", DropZoneOverlay);
    customElements.define("canvas-overlay", CanvasOverlay);
    customElements.define("canvas-preview", CanvasPreview);

    customElements.define("squire-master-client", SquireMasterClient);

    connection.connect();
    assetService.refreshAssets();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
