/**
 * Display client entry point
 *
 * Receives events from the server and renders audio,
 * visuals, and clocks for the player-facing display.
 */

import { EventBus } from "@core/event-bus";
import { AppStore } from "@core/store";
import { ConnectionService } from "@core/connection-service";
import { Logger } from "@utils/logger";

const logger = new Logger("Display");

const SERVER_URL = `ws://${window.location.hostname}:3000/ws`;

const eventBus = new EventBus();
const connection = new ConnectionService(SERVER_URL, "display");
const store = new AppStore(eventBus, (event) => connection.send(event));
connection.bindStore(store);

export { store, eventBus, connection };

connection.connect();
logger.info("Display client initialized");
