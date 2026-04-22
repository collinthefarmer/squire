#!/usr/bin/env bun

import { $ } from "bun";

async function main(): Promise<void> {
    const serverProcess = $`cd ./server ; bun serve`;
    const clientProcess = $`cd ./ts-web-client ; bun serve`;

    const results = await Promise.allSettled([serverProcess, clientProcess]);

    for (const result of results) {
        if (result.status === "rejected") {
            console.error("Process exited with error:", result.reason);
        }
    }
}

main().catch((err) => {
    console.error("Unexpected error!");
    console.error(err);
});
