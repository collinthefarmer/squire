import { EventBus } from "@services/event-bus";
import { AppStore } from "@services/store";
import { ConnectionService } from "@services/connection-service";
import { ImageService } from "@services/image-service";
import { LayerService } from "@services/layer-service";
import { SoundService } from "@services/sound-service";
import { FontService } from "@services/font-service";

const SERVER_URL = `wss://${window.location.hostname}:3000/ws`;

const eventBus = new EventBus();
const connection = new ConnectionService(SERVER_URL, "display");
const store = new AppStore(eventBus, (event) => connection.send(event));
connection.bindStore(store);

const imageService = new ImageService();
const layerService = new LayerService(store, imageService);
const soundService = new SoundService();
const fontService = new FontService();

export { store, eventBus, connection, imageService, layerService, soundService, fontService };
