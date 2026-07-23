/**
 * Display client entry point
 *
 * Receives events from the server and renders audio,
 * visuals, and clocks for the player-facing display.
 */

import { Logger } from "@utils/logger";
import { SqDisplay } from "@components/sq-display";
import { SqLayer } from "@components/sq-layer";
import { SqStage } from "./components/sq-stage";
import { connection } from "./services";

const logger = new Logger("Display");

customElements.define("sq-layer", SqLayer);
customElements.define("sq-display", SqDisplay);
customElements.define("sq-stage", SqStage);

document.body.appendChild(document.createElement("sq-stage"));

connection.connect();
logger.info("Display client initialized");
