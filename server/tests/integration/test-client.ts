#!/usr/bin/env bun

/**
 * Simple test client for Squire server
 */

const ws = new WebSocket("ws://localhost:3000");

ws.onopen = () => {
    console.log("Connected to server");

    // Send a play audio event
    const playEvent = {
        type: "audio.play",
        payload: {
            channel: "music",
            source: {
                type: "file",
                ref: "http://localhost:3000/public/273437__magedu__cassette_deck_play_audio_cassette_02.mp3",
            },
            volume: 0.8,
            loop: true,
            effects: [],
            respectTimeScale: true,
        },
        metadata: {
            timestamp: Date.now(),
            source: "test-client",
        },
    };

    console.log("Sending play event:", playEvent);
    ws.send(JSON.stringify(playEvent));

    // Wait a bit, then send volume change
    setTimeout(() => {
        const volumeEvent = {
            type: "audio.volume",
            payload: {
                channel: "music",
                volume: 0.5,
            },
            metadata: {
                timestamp: Date.now(),
                source: "test-client",
            },
        };

        console.log("Sending volume change event:", volumeEvent);
        ws.send(JSON.stringify(volumeEvent));
    }, 2000);

    // Pause after 4 seconds
    setTimeout(() => {
        const pauseEvent = {
            type: "audio.pause",
            payload: {
                channel: "music",
            },
            metadata: {
                timestamp: Date.now(),
                source: "test-client",
            },
        };

        console.log("Sending pause event:", pauseEvent);
        ws.send(JSON.stringify(pauseEvent));
    }, 4000);

    // Disconnect after 6 seconds
    setTimeout(() => {
        console.log("Disconnecting...");
        ws.close();
    }, 6000);
};

ws.onmessage = (event) => {
    console.log("Received:", event.data);
};

ws.onerror = (error) => {
    console.error("WebSocket error:", error);
};

ws.onclose = () => {
    console.log("Disconnected from server");
    process.exit(0);
};
