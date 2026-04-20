import type {
    ApplicationState,
    AudioState,
    AudioChannelState,
    ImageState,
    ImageLayerState,
} from "../types";

/**
 * Get audio state from application state, or return default
 */
export function getAudioState(state: ApplicationState): AudioState {
    return (
        state.audio || {
            channels: new Map(),
            masterVolume: 1.0,
        }
    );
}

/**
 * Update audio state in application state (immutable)
 */
export function setAudioState(
    state: ApplicationState,
    audioState: AudioState,
): ApplicationState {
    return {
        ...state,
        audio: audioState,
    };
}

/**
 * Update channels in audio state (immutable)
 */
export function updateAudioChannels(
    state: ApplicationState,
    updater: (
        channels: Map<string, AudioChannelState>,
    ) => Map<string, AudioChannelState>,
): ApplicationState {
    const audioState = getAudioState(state);
    const channels = updater(new Map(audioState.channels));

    return setAudioState(state, {
        ...audioState,
        channels,
    });
}

/**
 * Set a channel in audio state (immutable)
 */
export function setAudioChannel(
    state: ApplicationState,
    channelId: string,
    channelState: AudioChannelState,
): ApplicationState {
    return updateAudioChannels(state, (channels) => {
        channels.set(channelId, channelState);
        return channels;
    });
}

/**
 * Remove a channel from audio state (immutable)
 */
export function removeAudioChannel(
    state: ApplicationState,
    channelId: string,
): ApplicationState {
    return updateAudioChannels(state, (channels) => {
        channels.delete(channelId);
        return channels;
    });
}

/**
 * Update a channel in audio state (immutable)
 */
export function updateAudioChannel(
    state: ApplicationState,
    channelId: string,
    updater: (channel: AudioChannelState) => AudioChannelState,
): ApplicationState {
    return updateAudioChannels(state, (channels) => {
        const channel = channels.get(channelId);
        if (channel) {
            channels.set(channelId, updater(channel));
        }
        return channels;
    });
}

/**
 * Get a channel from audio state
 */
export function getAudioChannel(
    state: ApplicationState,
    channelId: string,
): AudioChannelState | undefined {
    const audioState = state.audio;
    if (!audioState) {
        return undefined;
    }
    return audioState.channels.get(channelId);
}

/**
 * Get all channels from audio state
 */
export function getAllAudioChannels(
    state: ApplicationState,
): AudioChannelState[] {
    const audioState = state.audio;
    if (!audioState) {
        return [];
    }
    return Array.from(audioState.channels.values());
}

/**
 * Get image state from application state, or return default
 */
export function getImageState(state: ApplicationState): ImageState {
    return (
        state.image || {
            layers: new Map(),
        }
    );
}

/**
 * Update image state in application state (immutable)
 */
export function setImageState(
    state: ApplicationState,
    imageState: ImageState,
): ApplicationState {
    return {
        ...state,
        image: imageState,
    };
}

/**
 * Update layers in image state (immutable)
 */
export function updateImageLayers(
    state: ApplicationState,
    updater: (
        layers: Map<string, ImageLayerState>,
    ) => Map<string, ImageLayerState>,
): ApplicationState {
    const imageState = getImageState(state);
    const layers = updater(new Map(imageState.layers));

    return setImageState(state, {
        ...imageState,
        layers,
    });
}

/**
 * Set a layer in image state (immutable)
 */
export function setImageLayer(
    state: ApplicationState,
    layerId: string,
    layerState: ImageLayerState,
): ApplicationState {
    return updateImageLayers(state, (layers) => {
        layers.set(layerId, layerState);
        return layers;
    });
}

/**
 * Update a layer in image state (immutable)
 */
export function updateImageLayer(
    state: ApplicationState,
    layerId: string,
    updater: (layer: ImageLayerState) => ImageLayerState,
): ApplicationState {
    return updateImageLayers(state, (layers) => {
        const layer = layers.get(layerId);
        if (layer) {
            layers.set(layerId, updater(layer));
        }
        return layers;
    });
}

/**
 * Get a layer from image state
 */
export function getImageLayer(
    state: ApplicationState,
    layerId: string,
): ImageLayerState | undefined {
    const imageState = state.image;
    if (!imageState) {
        return undefined;
    }
    return imageState.layers.get(layerId);
}

/**
 * Get all layers from image state
 */
export function getAllImageLayers(
    state: ApplicationState,
): ImageLayerState[] {
    const imageState = state.image;
    if (!imageState) {
        return [];
    }
    return Array.from(imageState.layers.values());
}

/**
 * Remove a layer from image state (immutable)
 */
export function removeImageLayer(
    state: ApplicationState,
    layerId: string,
): ApplicationState {
    return updateImageLayers(state, (layers) => {
        layers.delete(layerId);
        return layers;
    });
}
