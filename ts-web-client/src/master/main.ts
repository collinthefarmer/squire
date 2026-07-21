/**
 * Master client entry point
 *
 * DM control panel — sends commands to the server,
 * mirrors display state for preview.
 */

import { EventBus } from "@core/event-bus";
import { AppStore } from "@core/store";
import { ConnectionService } from "@core/connection-service";
import { Logger } from "@utils/logger";

const logger = new Logger("Master");

const SERVER_URL = `ws://${window.location.hostname}:3000/ws`;

const eventBus = new EventBus();
const connection = new ConnectionService(SERVER_URL, "master");
const store = new AppStore(eventBus, (event) => connection.send(event));
connection.bindStore(store);

export { store, eventBus, connection };

connection.connect();
logger.info("Master client initialized");
