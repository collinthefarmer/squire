import { channelId, layerId, trackId, clockId } from "@types";
import type {
    EventMetadata,
    ChannelId,
    LayerId,
    TrackId,
    ClockId,
    AudioChannelState,
    AudioTrackState,
    ImageLayerState,
} from "@types";
import type { ClockState } from "../state/clock-state";

/**
 * Shared test data factories.
 *
 * Follow the make{Entity}(overrides?) convention — returns a valid default
 * with optional partial overrides.
 */

export function makeMetadata(
    timestamp: number = Date.now(),
): EventMetadata {
    return { timestamp, source: "test" };
}

// -- Audio --

export function makeTrack(overrides?: Partial<AudioTrackState>): AudioTrackState {
    return {
        id: trackId("t1"),
        source: { type: "file", ref: "track.mp3" },
        playing: true,
        position: 0,
        volume: 1.0,
        loop: false,
        effects: [],
        respectTimeScale: true,
        ...overrides,
    };
}

export function makeChannel(overrides?: Partial<AudioChannelState>): AudioChannelState {
    return {
        id: channelId("music"),
        tracks: new Map<TrackId, AudioTrackState>(),
        volume: 1.0,
        effects: [],
        ...overrides,
    };
}

export function makeChannels(
    ...entries: [ChannelId, Partial<AudioChannelState>][]
): Map<ChannelId, AudioChannelState> {
    const map = new Map<ChannelId, AudioChannelState>();

    for (const [id, overrides] of entries) {
        map.set(id, makeChannel({ id, ...overrides }));
    }

    return map;
}

// -- Image --

export function makeLayer(overrides?: Partial<ImageLayerState>): ImageLayerState {
    return {
        id: layerId("bg"),
        imageRef: "default.png",
        aspectRatio: "cover",
        position: { x: "center", y: "center" },
        scale: 1.0,
        rotation: 0,
        blendMode: "normal",
        opacity: 1.0,
        zIndex: 0,
        visible: true,
        effects: [],
        ...overrides,
    };
}

export function makeLayers(
    ...entries: [LayerId, Partial<ImageLayerState>][]
): Map<LayerId, ImageLayerState> {
    const map = new Map<LayerId, ImageLayerState>();

    for (const [id, overrides] of entries) {
        map.set(id, makeLayer({ id, ...overrides }));
    }

    return map;
}

// -- Clock --

export function makeClock(overrides?: Partial<ClockState>): ClockState {
    return {
        id: clockId("t1"),
        duration: 60000,
        elapsed: 0,
        running: false,
        startedAt: null,
        position: { x: "center", y: "top" },
        zIndex: 100,
        visible: true,
        scale: 1,
        font: "Courier New",
        respectTimeScale: true,
        scaleAtStart: 1.0,
        visibility: "always",
        onComplete: "persist",
        completed: false,
        ...overrides,
    };
}

export function makeClocks(
    ...entries: [string, Partial<ClockState>][]
): Map<ClockId, ClockState> {
    const map = new Map<ClockId, ClockState>();

    for (const [rawId, overrides] of entries) {
        const id = clockId(rawId);
        map.set(id, makeClock({ id, ...overrides }));
    }

    return map;
}
