import type { AspectRatioMode, BlendMode } from "@types";

// -- Drag event details --

export interface DragStartDetail {
    data: string;
    source?: string;
    element: HTMLElement;
    x: number;
    y: number;
    imageWidth?: number;
    imageHeight?: number;
    [key: string]: unknown;
}

export interface DragMoveDetail {
    data: string;
    source?: string;
    x: number;
    y: number;
}

export interface DragEndDetail {
    data: string;
    source?: string;
    x: number;
    y: number;
}

export interface DragClickDetail {
    data: string;
    source?: string;
    x: number;
    y: number;
    imageWidth?: number;
    imageHeight?: number;
    [key: string]: unknown;
}

export interface DragScaleDetail {
    data: string;
    source?: string;
    scale: number;
}

// -- Layer event details --

export interface LayerSelectDetail {
    layer: string;
}

export interface LayerAddDetail {
    name: string;
}

export interface LayerRemoveDetail {
    layer: string;
}

export interface LayerClearDetail {
    layer: string;
}

export interface LayerVisibilityDetail {
    layer: string;
    visible: boolean;
}

export interface LayerAspectRatioDetail {
    layer: string;
    aspectRatio: AspectRatioMode;
}

export interface LayerReorderDetail {
    order: string[];
}

// -- Audio event details --

export interface ChannelChangeDetail {
    channel: string;
}

export interface AssetChangeDetail {
    asset: string;
}

export interface VolumeChangeDetail {
    volume: number;
}

export interface LoopChangeDetail {
    loop: boolean;
}

export interface AudioDropDetail {
    channel: string;
    asset: string;
}

export interface TrackVolumeChangeDetail {
    channel: string;
    trackId: string;
    volume: number;
}

export interface TrackStopRequestDetail {
    channel: string;
    trackId: string;
}

export interface TabChangeDetail {
    tabId: string;
    layout: string;
}


export interface SourceTypeChangeDetail {
    sourceType: "file" | "live";
}

export interface MicDeviceChangeDetail {
    deviceId: string;
}

export interface MonitorChangeDetail {
    enabled: boolean;
}

export interface GainChangeDetail {
    gain: number;
}

// -- Image event details --

export interface ApplyConfigDetail {
    opacity: number;
    blendMode: BlendMode;
    zIndex: number;
    visible: boolean;
}

// -- Asset event details --

export interface AssetClickDetail {
    assetType: "audio" | "image";
    asset: string;
    imageWidth?: number;
    imageHeight?: number;
}

export interface AssetDragStartDetail {
    assetType: "audio" | "image";
    asset: string;
    x: number;
    y: number;
}

export interface AssetDragEndDetail {
    assetType: "audio" | "image";
    asset: string;
    x: number;
    y: number;
}

// -- Event map --

export interface AppEventMap {
    "drag-start": DragStartDetail;
    "drag-move": DragMoveDetail;
    "drag-end": DragEndDetail;
    "drag-click": DragClickDetail;
    "drag-scale": DragScaleDetail;

    "layer-select": LayerSelectDetail;
    "layer-add": LayerAddDetail;
    "layer-remove": LayerRemoveDetail;
    "layer-clear": LayerClearDetail;
    "layer-visibility": LayerVisibilityDetail;
    "layer-reorder": LayerReorderDetail;
    "layer-aspect-ratio": LayerAspectRatioDetail;

    "channel-change": ChannelChangeDetail;
    "asset-change": AssetChangeDetail;
    "volume-change": VolumeChangeDetail;
    "loop-change": LoopChangeDetail;
    "play-request": void;
    "pause-request": void;
    "resume-request": void;
    "stop-request": void;
    "go-live-request": void;
    "audio-drop": AudioDropDetail;
    "track-volume-change": TrackVolumeChangeDetail;
    "track-stop-request": TrackStopRequestDetail;
    "tab-change": TabChangeDetail;
    "stop-live-request": void;
    "source-type-change": SourceTypeChangeDetail;
    "mic-device-change": MicDeviceChangeDetail;
    "monitor-change": MonitorChangeDetail;
    "gain-change": GainChangeDetail;

    "apply-config": ApplyConfigDetail;

    "asset-click": AssetClickDetail;
    "asset-drag-start": AssetDragStartDetail;
    "asset-drag-end": AssetDragEndDetail;
    "image-asset-change": AssetChangeDetail;

    "audio-enabled": void;
}

// -- Utilities --

/**
 * Dispatch a typed custom DOM event.
 *
 * Always sets `bubbles: true` and `composed: true` so events cross
 * Shadow DOM boundaries. Events with `void` detail take no third argument.
 */
export function emitDomEvent<K extends keyof AppEventMap>(
    target: EventTarget,
    name: K,
    ...args: AppEventMap[K] extends void ? [] : [detail: AppEventMap[K]]
): void {
    const options: CustomEventInit = {
        bubbles: true,
        composed: true,
    };

    if (args.length > 0) {
        options.detail = args[0];
    }

    target.dispatchEvent(new CustomEvent(name, options));
}

/**
 * Add a typed event listener for an app custom event.
 *
 * Returns a cleanup function that removes the listener.
 */
export function onDomEvent<K extends keyof AppEventMap>(
    target: EventTarget,
    name: K,
    callback: (event: CustomEvent<AppEventMap[K]>) => void,
    options?: AddEventListenerOptions,
): () => void {
    target.addEventListener(name, callback as EventListener, options);
    return () => target.removeEventListener(name, callback as EventListener, options);
}

// -- Global augmentation --

type AppCustomEventMap = {
    [K in keyof AppEventMap]: CustomEvent<AppEventMap[K]>;
};

declare global {
    interface HTMLElementEventMap extends AppCustomEventMap {}
    interface DocumentEventMap extends AppCustomEventMap {}
}
