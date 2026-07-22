import { EventBus } from "@core/event-bus";
import { AppStore } from "@core/store";
import { ConnectionService } from "@core/connection-service";

const SERVER_URL = `wss://${window.location.hostname}:3000/ws`;

const eventBus = new EventBus();
const connection = new ConnectionService(SERVER_URL, "master");
const store = new AppStore(eventBus, (event) => connection.send(event));
connection.bindStore(store);

export { store, eventBus, connection };
