/**
 * Pure reducer functions for image layer state
 *
 * Each function takes the current layer map and an event payload,
 * returning a new map. Used by both display and master visual services
 * to keep event→state logic DRY and testable.
 */

import { setInMap, updateInMap, removeFromMap } from "@utils/state-helpers";
import type {
    ImageLayerState,
    ImageSetEvent,
    ImageClearEvent,
    ImageTransformEvent,
    ImageEffectEvent,
    ImageLayerConfigEvent,
} from "@types";

const DEFAULT_LAYER: Omit<
    ImageLayerState,
    "id" | "imageRef" | "aspectRatio" | "position" | "scale"
> = {
    rotation: 0,
    blendMode: "normal",
    opacity: 1.0,
    zIndex: 0,
    visible: true,
    effects: [],
};

/**
 * Apply a visual.image.set event.
 *
 * Preserves existing layer properties (opacity, effects, etc.) when
 * changing images. Creates a new layer with defaults if none exists.
 */
export function applyImageSet(
    layers: Map<string, ImageLayerState>,
    event: ImageSetEvent,
): Map<string, ImageLayerState> {
    const { layer, imageRef, aspectRatio, position, scale } = event.payload;
    const existing = layers.get(layer);

    const state: ImageLayerState = existing
        ? {
              ...existing,
              imageRef,
              aspectRatio,
              position: position ?? existing.position,
              scale: scale ?? existing.scale,
          }
        : {
              ...DEFAULT_LAYER,
              id: layer,
              imageRef,
              aspectRatio,
              position: position ?? { x: "center", y: "center" },
              scale: scale ?? 1.0,
          };

    return setInMap(layers, layer, state);
}

/**
 * Apply a visual.image.clear event.
 */
export function applyImageClear(
    layers: Map<string, ImageLayerState>,
    event: ImageClearEvent,
): Map<string, ImageLayerState> {
    return removeFromMap(layers, event.payload.layer);
}

/**
 * Apply a visual.image.transform event.
 *
 * Selectively updates position, scale, and rotation.
 */
export function applyImageTransform(
    layers: Map<string, ImageLayerState>,
    event: ImageTransformEvent,
): Map<string, ImageLayerState> {
    const { layer, position, scale, rotation } = event.payload;

    return updateInMap(layers, layer, (state) => {
        const updates: Partial<ImageLayerState> = {};

        if (position !== undefined) {
            updates.position = position;
        }
        if (scale !== undefined) {
            updates.scale = scale;
        }
        if (rotation !== undefined) {
            updates.rotation = rotation;
        }

        return { ...state, ...updates };
    });
}

/**
 * Apply a visual.image.effect event.
 *
 * Merges effects into existing array or replaces them entirely.
 */
export function applyImageEffect(
    layers: Map<string, ImageLayerState>,
    event: ImageEffectEvent,
): Map<string, ImageLayerState> {
    const { layer, effects, replace } = event.payload;

    return updateInMap(layers, layer, (state) => {
        if (replace) {
            return { ...state, effects };
        }
        return { ...state, effects: [...state.effects, ...effects] };
    });
}

/**
 * Apply a visual.image.layer_config event.
 *
 * Selectively updates blend mode, opacity, z-index, and visibility.
 */
export function applyImageLayerConfig(
    layers: Map<string, ImageLayerState>,
    event: ImageLayerConfigEvent,
): Map<string, ImageLayerState> {
    const { layer, blendMode, opacity, zIndex, visible } = event.payload;

    return updateInMap(layers, layer, (state) => {
        const updates: Partial<ImageLayerState> = {};

        if (blendMode !== undefined) {
            updates.blendMode = blendMode;
        }
        if (opacity !== undefined) {
            updates.opacity = opacity;
        }
        if (zIndex !== undefined) {
            updates.zIndex = zIndex;
        }
        if (visible !== undefined) {
            updates.visible = visible;
        }

        return { ...state, ...updates };
    });
}
