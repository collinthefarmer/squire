#!/usr/bin/env bun

/**
 * Test client that sends INVALID events to verify Zod validation
 */

const ws = new WebSocket("ws://localhost:3000");

ws.onopen = () => {
    console.log("Connected to server\n");

    // Test 1: Invalid volume (> 1.0)
    console.log("Test 1: Sending invalid volume (1.5, should be 0-1)");
    ws.send(
        JSON.stringify({
            type: "audio.play",
            payload: {
                channel: "music",
                source: { type: "file", ref: "test.mp3" },
                volume: 1.5, // INVALID: > 1.0
                loop: false,
                effects: [],
                respectTimeScale: true,
            },
            metadata: { timestamp: Date.now(), source: "test" },
        }),
    );

    setTimeout(() => {
        // Test 2: Missing required field
        console.log(
            "\nTest 2: Sending event missing required field (no channel)",
        );
        ws.send(
            JSON.stringify({
                type: "audio.play",
                payload: {
                    // MISSING: channel
                    source: { type: "file", ref: "test.mp3" },
                    volume: 0.8,
                    loop: false,
                    effects: [],
                    respectTimeScale: true,
                },
                metadata: { timestamp: Date.now(), source: "test" },
            }),
        );
    }, 1000);

    setTimeout(() => {
        // Test 3: Invalid source type
        console.log('\nTest 3: Sending invalid source type ("invalid")');
        ws.send(
            JSON.stringify({
                type: "audio.play",
                payload: {
                    channel: "music",
                    source: { type: "invalid", ref: "test.mp3" }, // INVALID type
                    volume: 0.8,
                    loop: false,
                    effects: [],
                    respectTimeScale: true,
                },
                metadata: { timestamp: Date.now(), source: "test" },
            }),
        );
    }, 2000);

    setTimeout(() => {
        // Test 4: Wrong payload type
        console.log(
            "\nTest 4: Sending wrong type for volume (string instead of number)",
        );
        ws.send(
            JSON.stringify({
                type: "audio.play",
                payload: {
                    channel: "music",
                    source: { type: "file", ref: "test.mp3" },
                    volume: "0.8", // INVALID: string instead of number
                    loop: false,
                    effects: [],
                    respectTimeScale: true,
                },
                metadata: { timestamp: Date.now(), source: "test" },
            }),
        );
    }, 3000);

    setTimeout(() => {
        // Test 5: Valid event (should work)
        console.log("\nTest 5: Sending VALID event (should succeed)");
        ws.send(
            JSON.stringify({
                type: "audio.play",
                payload: {
                    channel: "music",
                    source: { type: "file", ref: "test.mp3" },
                    volume: 0.8,
                    loop: false,
                    effects: [],
                    respectTimeScale: true,
                },
                metadata: { timestamp: Date.now(), source: "test" },
            }),
        );
    }, 4000);

    setTimeout(() => {
        console.log("\nDisconnecting...");
        ws.close();
    }, 5000);
};

ws.onmessage = (event) => {
    console.log(
        "✓ Received broadcast (event was valid):",
        JSON.parse(event.data).type,
    );
};

ws.onerror = (error) => {
    console.error("WebSocket error:", error);
};

ws.onclose = () => {
    console.log("\nDisconnected from server");
    process.exit(0);
};
