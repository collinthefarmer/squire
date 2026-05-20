/**
 * Client-side scene service
 *
 * Manages scene save/load using LocalStore for persistence.
 * Saving snapshots current state from service observables.
 * Loading issues commands through existing services, which
 * flow through WebSocket to the server and broadcast to
 * all connected clients.
 */

import { BehaviorSubject, type Observable } from "rxjs";
import { Logger } from "@utils/logger";
import { getRemainingTime } from "@services/clock-state";
import type { LocalStore } from "@services/local-store";
import type { TimeScaleService } from "@services/time-scale-service";
import type { MasterAudioService } from "./master-audio-service";
import type { MasterVisualService } from "./visual-service";
import type { MasterClockService } from "./clock-service";
import type {
    SceneFile,
    SceneSelection,
    SceneAudioChannel,
    SceneImageLayer,
    SceneClock,
} from "./scene-types";

const STORE_KEY = "scenes";

export class SceneService {
    private logger = new Logger("SceneService");
    private scenes$ = new BehaviorSubject<SceneFile[]>([]);

    constructor(
        private localStore: LocalStore,
        private audioService: MasterAudioService,
        private visualService: MasterVisualService,
        private clockService: MasterClockService,
        private timeScaleService: TimeScaleService,
    ) {
        this.loadFromStore();
    }

    // -- Read --

    getScenes$(): Observable<SceneFile[]> {
        return this.scenes$.asObservable();
    }

    getScenes(): SceneFile[] {
        return this.scenes$.value;
    }

    getScene(id: string): SceneFile | undefined {
        return this.scenes$.value.find((s) => s.id === id);
    }

    // -- Save --

    saveScene(name: string, selection: SceneSelection): void {
        const now = Date.now();
        const id = `scene-${now}`;
        const includedDomains: string[] = [];

        const scene: SceneFile = {
            id,
            name,
            createdAt: now,
            updatedAt: now,
            includedDomains,
        };

        if (selection.audio && selection.audio.length > 0) {
            scene.audio = this.captureAudio(selection.audio);
            includedDomains.push("audio");
        }

        if (selection.image && selection.image.length > 0) {
            scene.image = this.captureImage(selection.image);
            includedDomains.push("image");
        }

        if (selection.clock && selection.clock.length > 0) {
            scene.clock = this.captureClocks(selection.clock);
            includedDomains.push("clock");
        }

        if (selection.time) {
            scene.time = { scale: this.timeScaleService.getScale() };
            includedDomains.push("time");
        }

        const scenes = [...this.scenes$.value, scene];
        this.scenes$.next(scenes);
        this.persistToStore(scenes);

        this.logger.info("Scene saved", { id, name, domains: includedDomains });
    }

    // -- Load --

    loadScene(id: string): void {
        const scene = this.getScene(id);
        if (!scene) {
            this.logger.warn("Scene not found", { id });
            return;
        }

        this.logger.info("Loading scene", { id, name: scene.name });

        if (scene.time) {
            this.timeScaleService.setScale(scene.time.scale);
        }

        if (scene.audio) {
            this.clearCurrentAudio();
            this.restoreAudio(scene.audio);
        }

        if (scene.image) {
            this.clearCurrentImage();
            this.restoreImage(scene.image);
        }

        if (scene.clock) {
            this.clearCurrentClocks();
            this.restoreClocks(scene.clock);
        }
    }

    // -- Delete --

    deleteScene(id: string): void {
        const scenes = this.scenes$.value.filter((s) => s.id !== id);
        this.scenes$.next(scenes);
        this.persistToStore(scenes);
        this.logger.info("Scene deleted", { id });
    }

    // -- Capture helpers --

    private captureAudio(channelIds: string[]): { channels: SceneAudioChannel[] } {
        const channels: SceneAudioChannel[] = [];
        const selected = new Set(channelIds);

        for (const [id, channel] of this.audioService.getChannels()) {
            if (!selected.has(id)) {
                continue;
            }

            channels.push({
                id,
                volume: channel.volume,
                effects: [...channel.effects],
                tracks: Array.from(channel.tracks.values()).map((track) => ({
                    id: track.id,
                    source: { ...track.source },
                    volume: track.volume,
                    loop: track.loop,
                    respectTimeScale: track.respectTimeScale,
                })),
            });
        }

        return { channels };
    }

    private captureImage(layerIds: string[]): { layers: SceneImageLayer[] } {
        const layers: SceneImageLayer[] = [];
        const selected = new Set(layerIds);

        for (const [id, layer] of this.visualService.getLayers()) {
            if (!selected.has(id)) {
                continue;
            }

            layers.push({
                id,
                imageRef: layer.imageRef,
                aspectRatio: layer.aspectRatio,
                position: { ...layer.position },
                scale: layer.scale,
                rotation: layer.rotation,
                blendMode: layer.blendMode,
                opacity: layer.opacity,
                zIndex: layer.zIndex,
                visible: layer.visible,
                effects: [...layer.effects],
            });
        }

        return { layers };
    }

    private captureClocks(clockIds: string[]): { clocks: SceneClock[] } {
        const clocks: SceneClock[] = [];
        const selected = new Set(clockIds);

        for (const [id, clock] of this.clockService.getClocks()) {
            if (!selected.has(id)) {
                continue;
            }

            clocks.push({
                id,
                remaining: getRemainingTime(clock),
                position: { ...clock.position },
                scale: clock.scale,
                font: clock.font,
                visibility: clock.visibility,
                onComplete: clock.onComplete,
                autoStart: clock.running,
                respectTimeScale: clock.respectTimeScale,
            });
        }

        return { clocks };
    }

    // -- Clear helpers --

    private clearCurrentAudio(): void {
        for (const [channelId] of this.audioService.getChannels()) {
            this.audioService.stopAudio(channelId);
        }
    }

    private clearCurrentImage(): void {
        for (const [layerId] of this.visualService.getLayers()) {
            this.visualService.clearImage(layerId);
        }
    }

    private clearCurrentClocks(): void {
        for (const [clockId] of this.clockService.getClocks()) {
            this.clockService.destroyClock(clockId);
        }
    }

    // -- Restore helpers --

    private restoreAudio(audio: { channels: SceneAudioChannel[] }): void {
        for (const channel of audio.channels) {
            for (const track of channel.tracks) {
                this.audioService.playAudio(channel.id, track.source.ref, {
                    trackId: track.id,
                    volume: track.volume,
                    loop: track.loop,
                    respectTimeScale: track.respectTimeScale,
                });
            }

            if (channel.effects.length > 0) {
                this.audioService.setChannelEffects(channel.id, channel.effects);
            }
        }
    }

    private restoreImage(image: { layers: SceneImageLayer[] }): void {
        for (const layer of image.layers) {
            if (!layer.imageRef) {
                continue;
            }

            this.visualService.setImage(layer.id, layer.imageRef, {
                aspectRatio: layer.aspectRatio,
                position: layer.position,
                scale: layer.scale,
            });

            this.visualService.setLayerConfig(layer.id, {
                opacity: layer.opacity,
                blendMode: layer.blendMode,
                zIndex: layer.zIndex,
                visible: layer.visible,
            });
        }
    }

    private restoreClocks(clock: { clocks: SceneClock[] }): void {
        for (const c of clock.clocks) {
            this.clockService.createClock({
                id: c.id,
                duration: c.remaining,
                autoStart: c.autoStart,
                position: c.position,
                font: c.font,
                respectTimeScale: c.respectTimeScale,
                visibility: c.visibility,
                onComplete: c.onComplete,
            });
        }
    }

    // -- Persistence --

    private loadFromStore(): void {
        const stored = this.localStore.get<SceneFile[]>(STORE_KEY);
        if (stored) {
            this.scenes$.next(stored);
            this.logger.info("Scenes loaded from store", { count: stored.length });
        }
    }

    private persistToStore(scenes: SceneFile[]): void {
        this.localStore.set(STORE_KEY, scenes);
    }
}
