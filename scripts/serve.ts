#!/usr/bin/env bun

import { $ } from "bun";

async function main(): Promise<void> {
    const server_process = $`cd ./server ; bun serve`;
    const client_process = $`cd ./ts-web-client ; bun serve`;

    await Promise.race([server_process, client_process]);
}

main().catch((err) => {
    console.error("Unexpected error!");
    console.error(err);
});
