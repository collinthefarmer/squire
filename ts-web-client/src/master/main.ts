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
import { GestureSandbox } from "./components/gesture-sandbox";

const logger = new Logger("Master");

const SERVER_URL = `wss://${window.location.hostname}:3000/ws`;

const eventBus = new EventBus();
const connection = new ConnectionService(SERVER_URL, "master");
const store = new AppStore(eventBus, (event) => connection.send(event));
connection.bindStore(store);

export { store, eventBus, connection };

customElements.define("gesture-sandbox", GestureSandbox);
document.body.appendChild(document.createElement("gesture-sandbox"));

connection.connect();
logger.info("Master client initialized");
