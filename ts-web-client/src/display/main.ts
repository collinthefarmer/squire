/**
 * Display client entry point
 *
 * Receives events from the server and renders audio,
 * visuals, and clocks for the player-facing display.
 */

import { Logger } from "@utils/logger";
import { SqDisplay } from "@components/sq-display";
import { SqLayer } from "@components/sq-layer";
import { store, connection, layerService } from "./services";

const logger = new Logger("Display");

customElements.define("sq-layer", SqLayer);
customElements.define("sq-display", SqDisplay);

const display = document.createElement("sq-display") as SqDisplay;
display.layerService = layerService;
document.body.appendChild(display);

store.clocks$.subscribe((clocks) => { display.clocks = clocks; });

connection.connect();
logger.info("Display client initialized");
