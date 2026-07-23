/**
 * Master client entry point
 *
 * DM control panel — sends commands to the server,
 * mirrors display state for preview.
 */

import { Logger } from "@utils/logger";
import { SqDisplay } from "@components/sq-display";
import { SqLayer } from "@components/sq-layer";
import { connection } from "./services";
import { SqPalette } from "./components/sq-palette";
import { SqLayerHandle } from "./components/sq-layer-handle";
import { SqWorkspace } from "./components/sq-workspace";

const logger = new Logger("Master");

customElements.define("sq-layer", SqLayer);
customElements.define("sq-display", SqDisplay);
customElements.define("sq-palette", SqPalette);
customElements.define("sq-layer-handle", SqLayerHandle);
customElements.define("sq-workspace", SqWorkspace);
document.body.appendChild(document.createElement("sq-workspace"));

connection.connect();
logger.info("Master client initialized");
