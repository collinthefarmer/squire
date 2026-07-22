import { EventBus } from "@core/event-bus";
import { AppStore } from "@core/store";
import { ConnectionService } from "@core/connection-service";
import { ImageService } from "@core/image-service";
import { SoundService } from "@core/sound-service";
import { FontService } from "@core/font-service";

const SERVER_URL = `wss://${window.location.hostname}:3000/ws`;

const eventBus = new EventBus();
const connection = new ConnectionService(SERVER_URL, "master");
const store = new AppStore(eventBus, (event) => connection.send(event));
connection.bindStore(store);

const imageService = new ImageService();
const soundService = new SoundService();
const fontService = new FontService();

export { store, eventBus, connection, imageService, soundService, fontService };
