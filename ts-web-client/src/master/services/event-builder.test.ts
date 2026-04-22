import { test, expect, describe } from "bun:test";
import { EventBuilder } from "./event-builder";

describe("EventBuilder", () => {
    describe("metadata", () => {
        test("should include timestamp and source on all events", () => {
            const event = EventBuilder.audioPlay({
                channel: "music",
                source: "track.mp3",
            });

            expect(event.metadata.timestamp).toBeGreaterThan(0);
            expect(event.metadata.source).toBe("master-client");
        });
    });

    describe("audio events", () => {
        test("audioPlay should set correct type and defaults", () => {
            const event = EventBuilder.audioPlay({
                channel: "music",
                source: "track.mp3",
            });

            expect(event.type).toBe("audio.play");
            expect(event.payload.channel).toBe("music");
            expect(event.payload.source).toEqual({
                type: "file",
                ref: "track.mp3",
            });
            expect(event.payload.volume).toBe(1.0);
            expect(event.payload.loop).toBe(false);
            expect(event.payload.respectTimeScale).toBe(true);
        });

        test("audioPlay should accept overrides", () => {
            const event = EventBuilder.audioPlay({
                channel: "sfx",
                source: "boom.mp3",
                sourceType: "stream",
                trackId: "t1",
                volume: 0.5,
                loop: true,
                respectTimeScale: false,
            });

            expect(event.payload.source.type).toBe("stream");
            expect(event.payload.trackId).toBe("t1");
            expect(event.payload.volume).toBe(0.5);
            expect(event.payload.loop).toBe(true);
            expect(event.payload.respectTimeScale).toBe(false);
        });

        test("audioPause should set correct type", () => {
            const event = EventBuilder.audioPause({ channel: "music" });

            expect(event.type).toBe("audio.pause");
            expect(event.payload.channel).toBe("music");
        });

        test("audioResume should set correct type", () => {
            const event = EventBuilder.audioResume({ channel: "music" });

            expect(event.type).toBe("audio.resume");
            expect(event.payload.channel).toBe("music");
        });

        test("audioStop should set correct type", () => {
            const event = EventBuilder.audioStop({ channel: "music" });

            expect(event.type).toBe("audio.stop");
            expect(event.payload.channel).toBe("music");
        });

        test("audioVolume should include volume", () => {
            const event = EventBuilder.audioVolume({
                channel: "music",
                volume: 0.7,
            });

            expect(event.type).toBe("audio.volume");
            expect(event.payload.volume).toBe(0.7);
        });

        test("audioLoop should include loop flag", () => {
            const event = EventBuilder.audioLoop({
                channel: "music",
                trackId: "t1",
                loop: true,
            });

            expect(event.type).toBe("audio.loop");
            expect(event.payload.loop).toBe(true);
            expect(event.payload.trackId).toBe("t1");
        });

        test("audioChannelEffects should include effects array", () => {
            const effects = [{ type: "reverb", params: { wet: 0.5 } }];
            const event = EventBuilder.audioChannelEffects({
                channel: "music",
                effects,
            });

            expect(event.type).toBe("audio.channel_effects");
            expect(event.payload.effects).toEqual(effects);
        });
    });

    describe("image events", () => {
        test("imageSet should set correct type and fields", () => {
            const event = EventBuilder.imageSet({
                layer: "background",
                imageRef: "forest.png",
                aspectRatio: "cover",
            });

            expect(event.type).toBe("visual.image.set");
            expect(event.payload.layer).toBe("background");
            expect(event.payload.imageRef).toBe("forest.png");
            expect(event.payload.aspectRatio).toBe("cover");
        });

        test("imageClear should set correct type", () => {
            const event = EventBuilder.imageClear({ layer: "background" });

            expect(event.type).toBe("visual.image.clear");
            expect(event.payload.layer).toBe("background");
        });

        test("imageTransform should include transform fields", () => {
            const event = EventBuilder.imageTransform({
                layer: "bg",
                position: { x: 100, y: 200 },
                scale: 1.5,
                rotation: 45,
            });

            expect(event.type).toBe("visual.image.transform");
            expect(event.payload.position).toEqual({ x: 100, y: 200 });
            expect(event.payload.scale).toBe(1.5);
            expect(event.payload.rotation).toBe(45);
        });

        test("imageEffect should include effects and replace flag", () => {
            const event = EventBuilder.imageEffect({
                layer: "bg",
                effects: [{ type: "blur", params: { radius: 5 } }],
                replace: true,
            });

            expect(event.type).toBe("visual.image.effect");
            expect(event.payload.replace).toBe(true);
            expect(event.payload.effects).toHaveLength(1);
        });

        test("layerConfig should include all config fields", () => {
            const event = EventBuilder.layerConfig({
                layer: "bg",
                blendMode: "multiply",
                opacity: 0.8,
                zIndex: 5,
                visible: false,
            });

            expect(event.type).toBe("visual.image.layer_config");
            expect(event.payload.blendMode).toBe("multiply");
            expect(event.payload.opacity).toBe(0.8);
            expect(event.payload.zIndex).toBe(5);
            expect(event.payload.visible).toBe(false);
        });
    });

    describe("clock events", () => {
        test("clockCreate should set correct type and fields", () => {
            const event = EventBuilder.clockCreate({
                id: "timer1",
                duration: 60000,
                autoStart: true,
            });

            expect(event.type).toBe("ui.clock.create");
            expect(event.payload.id).toBe("timer1");
            expect(event.payload.duration).toBe(60000);
            expect(event.payload.autoStart).toBe(true);
        });

        test("clockStart should set correct type", () => {
            const event = EventBuilder.clockStart({ id: "timer1" });
            expect(event.type).toBe("ui.clock.start");
            expect(event.payload.id).toBe("timer1");
        });

        test("clockPause should set correct type", () => {
            const event = EventBuilder.clockPause({ id: "timer1" });
            expect(event.type).toBe("ui.clock.pause");
            expect(event.payload.id).toBe("timer1");
        });

        test("clockAdjust should include delta", () => {
            const event = EventBuilder.clockAdjust({
                id: "timer1",
                delta: -5000,
            });

            expect(event.type).toBe("ui.clock.adjust");
            expect(event.payload.delta).toBe(-5000);
        });

        test("clockDestroy should set correct type", () => {
            const event = EventBuilder.clockDestroy({ id: "timer1" });
            expect(event.type).toBe("ui.clock.destroy");
            expect(event.payload.id).toBe("timer1");
        });

        test("clockUpdate should include position and visibility fields", () => {
            const event = EventBuilder.clockUpdate({
                id: "timer1",
                position: { x: 100, y: 200 },
                zIndex: 10,
                visible: false,
            });

            expect(event.type).toBe("ui.clock.update");
            expect(event.payload.position).toEqual({ x: 100, y: 200 });
            expect(event.payload.zIndex).toBe(10);
            expect(event.payload.visible).toBe(false);
        });
    });

    describe("time events", () => {
        test("timeScaleChanged should set correct type and scale", () => {
            const event = EventBuilder.timeScaleChanged({ scale: 2.0 });

            expect(event.type).toBe("time.scale_changed");
            expect(event.payload.scale).toBe(2.0);
        });
    });
});
