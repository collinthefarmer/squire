/**
 * Scene data types for client-side scene save/load
 *
 * Scenes are snapshots of selected application state persisted
 * to LocalStore. Loading a scene issues normal commands through
 * existing services — no special server-side support needed.
 */

import type {
    AudioEffect,
    ImageEffect,
    ImagePosition,
    AspectRatioMode,
    BlendMode,
    ClockVisibility,
    ClockCompletionBehavior,
} from "@types";

/**
 * Which entities the user selected for a scene save.
 * IDs within each domain identify specific entities.
 */
export interface SceneSelection {
    audio?: string[];
    image?: string[];
    clock?: string[];
    time?: boolean;
}

/**
 * Persisted scene — the full serialized snapshot.
 */
export interface SceneFile {
    id: string;
    name: string;
    createdAt: number;
    updatedAt: number;
    includedDomains: string[];
    audio?: SceneAudioState;
    image?: SceneImageState;
    clock?: SceneClockState;
    time?: SceneTimeState;
}

export interface SceneAudioState {
    channels: SceneAudioChannel[];
}

export interface SceneAudioChannel {
    id: string;
    volume: number;
    effects: AudioEffect[];
    tracks: SceneAudioTrack[];
}

export interface SceneAudioTrack {
    id: string;
    source: { type: string; ref: string };
    volume: number;
    loop: boolean;
    respectTimeScale: boolean;
}

export interface SceneImageState {
    layers: SceneImageLayer[];
}

export interface SceneImageLayer {
    id: string;
    imageRef: string | null;
    aspectRatio: AspectRatioMode;
    position: ImagePosition;
    scale: number;
    rotation: number;
    blendMode: BlendMode;
    opacity: number;
    zIndex: number;
    visible: boolean;
    effects: ImageEffect[];
}

export interface SceneClockState {
    clocks: SceneClock[];
}

export interface SceneClock {
    id: string;
    remaining: number;
    position: ImagePosition;
    scale: number;
    font: string;
    visibility: ClockVisibility;
    onComplete: ClockCompletionBehavior;
    autoStart: boolean;
    respectTimeScale: boolean;
}

export interface SceneTimeState {
    scale: number;
}
