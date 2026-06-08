# Server Implementation Architecture - Bun

## Core Architectural Principles

### Data-Oriented Design

The server treats state as immutable data structures that flow through the system. Services operate on data, transforming and routing it, but don't hold mutable state themselves. State lives in dedicated storage layers, services are stateless processors.

**Key Concepts:**

- **Immutable State Objects**: State is read-only data structures
- **Pure Transformations**: Services transform data without side effects (where possible)
- **Centralized State**: State lives in repositories, not scattered across services
- **Data Flow**: Events flow in → state transforms → events flow out
- **Serializable Everything**: All state can be serialized to JSON for persistence/transmission

### Service-Driven Architecture

The application is composed of independent services, each responsible for a specific domain. Services communicate through events and dependency injection, never through direct coupling.

**Service Characteristics:**

- **Single Responsibility**: Each service owns one feature domain
- **Dependency Injection**: Services receive dependencies via constructor
- **Event-Based Communication**: Services emit and listen to events
- **Testable**: Easy to mock dependencies and test in isolation
- **Lifecycle Managed**: Container handles initialization and shutdown

### Dependency Injection

A lightweight DI container manages service instantiation and wiring. Services declare their dependencies, container resolves and injects them.

**DI Benefits:**

- **Loose Coupling**: Services don't know about each other's implementations
- **Easy Testing**: Mock dependencies for unit tests
- **Configuration Flexibility**: Swap implementations without changing service code
- **Clear Dependencies**: Constructor parameters document what service needs

## Project Structure

```
server/
├── src/
│   ├── core/                      # Core infrastructure
│   │   ├── di/                    # Dependency injection container
│   │   │   ├── container.ts       # DI container implementation
│   │   │   ├── decorators.ts      # @Injectable, @Inject decorators
│   │   │   └── types.ts           # DI type definitions
│   │   │
│   │   ├── events/                # Event system
│   │   │   ├── event-bus.ts       # Central event bus
│   │   │   ├── event-types.ts     # Event type definitions
│   │   │   └── event-emitter.ts   # Base event emitter
│   │   │
│   │   ├── state/                 # State management
│   │   │   ├── state-store.ts     # In-memory state store
│   │   │   ├── state-types.ts     # State shape definitions
│   │   │   └── state-manager.ts   # State update coordination
│   │   │
│   │   ├── transport/             # Network communication
│   │   │   ├── websocket-server.ts  # WebSocket handling
│   │   │   ├── client-registry.ts   # Connected clients
│   │   │   └── message-router.ts    # Route messages to services
│   │   │
│   │   └── persistence/           # Data persistence
│   │       ├── file-store.ts      # File-based storage
│   │       ├── repository.ts      # Base repository pattern
│   │       └── serialization.ts   # JSON serialization helpers
│   │
│   ├── services/                  # Feature services
│   │   ├── audio/
│   │   │   ├── audio-service.ts   # Audio playback coordination
│   │   │   ├── audio-state.ts     # Audio state types
│   │   │   └── audio-repository.ts  # Audio persistence
│   │   │
│   │   ├── visual/
│   │   │   ├── visual-service.ts  # Image layer management
│   │   │   ├── layer-state.ts     # Layer state types
│   │   │   └── visual-repository.ts
│   │   │
│   │   ├── time/
│   │   │   ├── time-service.ts    # Time scale management
│   │   │   ├── time-state.ts      # Time state types
│   │   │   └── time-repository.ts
│   │   │
│   │   ├── clock/
│   │   │   ├── clock-service.ts   # Countdown clock logic
│   │   │   ├── clock-state.ts     # Clock state types
│   │   │   ├── clock-engine.ts    # Clock progression engine
│   │   │   └── clock-repository.ts
│   │   │
│   │   ├── scene/
│   │   │   ├── scene-service.ts   # Scene save/load/transition
│   │   │   ├── scene-state.ts     # Scene data structures
│   │   │   ├── scene-builder.ts   # Assemble scenes from services
│   │   │   └── scene-repository.ts
│   │   │
│   │   ├── log/
│   │   │   ├── log-service.ts     # Event logging
│   │   │   ├── log-query.ts       # Log search/filter
│   │   │   ├── log-state.ts       # Log entry types
│   │   │   └── log-repository.ts
│   │   │
│   │   └── session/
│   │       ├── session-service.ts # Session lifecycle
│   │       ├── session-state.ts   # Session metadata
│   │       └── session-repository.ts
│   │
│   ├── api/                       # API endpoints (optional REST)
│   │   ├── routes/
│   │   │   ├── health.ts          # Health check endpoint
│   │   │   ├── scenes.ts          # Scene CRUD endpoints
│   │   │   └── logs.ts            # Log query endpoints
│   │   └── middleware/
│   │       ├── auth.ts            # Authentication middleware
│   │       ├── validation.ts      # Request validation
│   │       └── error-handler.ts   # Error handling
│   │
│   ├── config/                    # Configuration
│   │   ├── default.ts             # Default configuration
│   │   ├── development.ts         # Dev overrides
│   │   ├── production.ts          # Prod overrides
│   │   └── types.ts               # Config type definitions
│   │
│   ├── utils/                     # Shared utilities
│   │   ├── logger.ts              # Logging utility
│   │   ├── time.ts                # Time calculation helpers
│   │   ├── validation.ts          # Data validation
│   │   └── id-generator.ts        # Unique ID generation
│   │
│   └── main.ts                    # Application entry point
│
├── data/                          # Runtime data (gitignored)
│   ├── scenes/                    # Saved scenes
│   ├── sessions/                  # Session logs
│   ├── state/                     # Current state snapshots
│   └── assets/                    # Uploaded assets metadata
│
├── tests/
│   ├── unit/                      # Unit tests per service
│   ├── integration/               # Integration tests
│   └── fixtures/                  # Test data
│
├── package.json
├── tsconfig.json
└── bunfig.toml                    # Bun configuration
```

## Core Infrastructure

### Dependency Injection Container

**Container Responsibilities:**

- Register services with their dependencies
- Resolve dependency graphs
- Instantiate services lazily (on first request)
- Manage singleton vs transient lifecycles
- Provide service retrieval by token/type

**Implementation Approach:**

```typescript
// Simplified conceptual interface (not actual code)

interface Container {
  // Register a service class with its dependencies
  register<T>(
    token: symbol,
    serviceClass: Class<T>,
    lifecycle: "singleton" | "transient",
  ): void;

  // Retrieve service instance (instantiates if needed)
  resolve<T>(token: symbol): T;

  // Initialize all registered services
  initialize(): Promise<void>;

  // Shutdown all services gracefully
  shutdown(): Promise<void>;
}
```

**Usage Pattern:**

Services declare dependencies in constructor:

```typescript
class AudioService {
  constructor(
    private eventBus: EventBus,
    private stateStore: StateStore,
    private audioRepository: AudioRepository,
    private timeService: TimeService,
  ) {}
}
```

Container wires them automatically:

```typescript
container.register(TOKENS.AudioService, AudioService, "singleton");
container.register(TOKENS.TimeService, TimeService, "singleton");
// ... etc

// Later, resolve with all dependencies injected
const audioService = container.resolve<AudioService>(TOKENS.AudioService);
```

### Event Bus

**Event Bus Responsibilities:**

- Central publish/subscribe hub
- Type-safe event emission and handling
- Synchronous event delivery (predictable order)
- Event middleware (logging, validation)
- Wildcard subscriptions (listen to `audio.*`)

**Event Flow:**

1. Client sends message via WebSocket
2. Message router parses event type
3. Router emits event on event bus
4. Subscribed services receive event
5. Services update state
6. Services emit outbound events
7. Event bus delivers to transport layer
8. Transport broadcasts to clients

**Event Structure:**

```typescript
interface Event<T = unknown> {
  type: string; // e.g., "audio.play"
  payload: T; // Type-specific data
  metadata: {
    timestamp: number;
    source: string; // Which client/service emitted
    targetClients?: string[];
    priority?: "low" | "normal" | "high";
  };
}
```

**Subscription Pattern:**

```typescript
// Services subscribe in constructor or initialize()
class AudioService {
  constructor(private eventBus: EventBus) {
    eventBus.on("audio.play", this.handlePlay.bind(this));
    eventBus.on("audio.pause", this.handlePause.bind(this));
    eventBus.on("time.scale_changed", this.handleTimeScaleChange.bind(this));
  }

  private handlePlay(event: Event<AudioPlayPayload>) {
    // Handle play event
    // Update state
    // Emit response events
  }
}
```

### State Store

**State Store Responsibilities:**

- Hold current application state in memory
- Provide immutable read access to state
- Accept state updates (new immutable state)
- Notify subscribers of state changes
- Persist state snapshots to disk

**State Organization:**

State is a single nested object with feature slices:

```typescript
interface ApplicationState {
  audio: AudioState;
  visual: VisualState;
  time: TimeState;
  clocks: ClocksState;
  scenes: ScenesState;
  logs: LogsState;
  session: SessionState;
  clients: ClientsState;
}
```

Each feature service owns its slice of state.

**State Update Pattern:**

Immutable updates using structural sharing:

```typescript
// Service wants to update audio channel volume
const currentState = stateStore.getState();
const newState = {
  ...currentState,
  audio: {
    ...currentState.audio,
    channels: currentState.audio.channels.map((ch) =>
      ch.id === "music" ? { ...ch, volume: 0.8 } : ch,
    ),
  },
};
stateStore.setState(newState);
```

Or using helper utilities like Immer for cleaner syntax.

**State Persistence:**

Periodically serialize state to disk:

- On state changes (debounced)
- On scene save
- On session end
- Auto-save interval (every N minutes)

### WebSocket Server

**WebSocket Server Responsibilities:**

- Accept client connections
- Authenticate clients (master vs display)
- Route incoming messages to event bus
- Broadcast outgoing events to clients
- Handle disconnects/reconnects
- Client capability negotiation

**Implementation with Bun:**

Bun provides native WebSocket support with excellent performance:

```typescript
Bun.serve({
  port: 3000,

  fetch(req, server) {
    // Upgrade HTTP to WebSocket
    if (server.upgrade(req)) {
      return; // WebSocket handled
    }

    // Handle HTTP requests (REST API, health check)
    return new Response("HTTP Server");
  },

  websocket: {
    open(ws) {
      // Client connected
      // Register in client registry
      // Send initial state
    },

    message(ws, message) {
      // Parse message as event
      // Emit on event bus
    },

    close(ws) {
      // Client disconnected
      // Cleanup
    },
  },
});
```

**Client Registry:**

Track connected clients:

```typescript
interface ConnectedClient {
  id: string;
  type: "master" | "display";
  capabilities: string[]; // What features this client supports
  ws: ServerWebSocket;
  connectedAt: number;
}

class ClientRegistry {
  private clients: Map<string, ConnectedClient>;

  register(client: ConnectedClient): void;
  unregister(clientId: string): void;
  broadcast(event: Event, filter?: (client: ConnectedClient) => boolean): void;
  getClient(id: string): ConnectedClient | undefined;
  getAllClients(): ConnectedClient[];
}
```

**Message Router:**

Bridge between WebSocket and event bus:

```typescript
class MessageRouter {
  constructor(
    private eventBus: EventBus,
    private clientRegistry: ClientRegistry,
  ) {}

  handleIncomingMessage(clientId: string, message: string) {
    // Parse message
    const event = JSON.parse(message);

    // Validate event structure
    if (!this.isValidEvent(event)) return;

    // Add metadata (source client)
    event.metadata.source = clientId;

    // Emit on event bus
    this.eventBus.emit(event.type, event);
  }

  handleOutgoingEvent(event: Event) {
    // Determine target clients
    const clients = this.selectClients(event);

    // Broadcast to clients
    clients.forEach((client) => {
      client.ws.send(JSON.stringify(event));
    });
  }
}
```

### Persistence Layer

**Repository Pattern:**

Each service has a repository for persistence:

```typescript
interface Repository<T> {
  save(id: string, data: T): Promise<void>;
  load(id: string): Promise<T | null>;
  delete(id: string): Promise<void>;
  list(): Promise<string[]>;
  query(filter: QueryFilter): Promise<T[]>;
}
```

**File-Based Implementation:**

Using Bun's fast file I/O:

```typescript
class FileRepository<T> implements Repository<T> {
  constructor(private basePath: string) {}

  async save(id: string, data: T): Promise<void> {
    const filePath = `${this.basePath}/${id}.json`;
    await Bun.write(filePath, JSON.stringify(data, null, 2));
  }

  async load(id: string): Promise<T | null> {
    const filePath = `${this.basePath}/${id}.json`;
    const file = Bun.file(filePath);
    if (!(await file.exists())) return null;
    return await file.json();
  }

  // ... etc
}
```

**Alternative Storage:**

Architecture supports swapping implementations:

- SQLite for structured queries (Bun has native SQLite)
- PostgreSQL for production deployments
- Redis for caching/sessions
- Cloud storage (S3, etc.)

Just implement the Repository interface.

## Service Implementations

### Service Base Class

Common functionality for all services:

```typescript
abstract class Service {
  protected eventBus: EventBus
  protected stateStore: StateStore
  protected logger: Logger

  // Lifecycle hooks
  async initialize(): Promise<void> {}
  async shutdown(): Promise<void> {}

  // Helper: emit event
  protected emit(type: string, payload: unknown): void {
    this.eventBus.emit(type, { type, payload, metadata: {...} })
  }

  // Helper: get current state
  protected getState(): ApplicationState {
    return this.stateStore.getState()
  }

  // Helper: update state
  protected updateState(updater: (state: ApplicationState) => ApplicationState): void {
    const newState = updater(this.getState())
    this.stateStore.setState(newState)
  }
}
```

### Audio Service

**Responsibilities:**

- Manage audio channel state
- Handle playback control events (play, pause, stop)
- Coordinate with time service for playback rate
- Persist audio configuration
- Broadcast audio state changes to clients

**Dependencies:**

- EventBus (receive/send events)
- StateStore (read/write audio state)
- AudioRepository (persist audio configs)
- TimeService (query time scale)

**Key Methods:**

```typescript
class AudioService extends Service {
  async handlePlay(event: Event<AudioPlayPayload>): Promise<void>;
  async handlePause(event: Event<AudioPausePayload>): Promise<void>;
  async handleVolumeChange(event: Event<AudioVolumePayload>): Promise<void>;
  async handleEffectAdd(event: Event<AudioEffectPayload>): Promise<void>;

  // Query methods
  getChannelState(channelId: string): AudioChannelState | null;
  getAllChannels(): AudioChannelState[];

  // Sync method (periodic broadcast of current playback positions)
  broadcastSync(): void;
}
```

**State Shape:**

```typescript
interface AudioState {
  channels: Map<string, AudioChannelState>;
  masterVolume: number;
  ducking: DuckingConfig[];
}

interface AudioChannelState {
  id: string;
  source: AudioSource | null;
  playing: boolean;
  position: number; // Current playback position (ms)
  volume: number;
  loop: boolean;
  effects: AudioEffect[];
  respectTimeScale: boolean;
}
```

### Visual Service

**Responsibilities:**

- Manage layer stack
- Handle image set/clear/transform events
- Apply effects to layers
- Coordinate layer rendering order
- Persist layer configurations

**Dependencies:**

- EventBus
- StateStore
- VisualRepository
- AssetService (validate image references exist)

**Key Methods:**

```typescript
class VisualService extends Service {
  async handleImageSet(event: Event<ImageSetPayload>): Promise<void>;
  async handleImageClear(event: Event<ImageClearPayload>): Promise<void>;
  async handleEffectApply(event: Event<EffectPayload>): Promise<void>;
  async handleLayerConfig(event: Event<LayerConfigPayload>): Promise<void>;

  // Layer management
  createLayer(alias: string, config: LayerConfig): void;
  deleteLayer(alias: string): void;
  reorderLayers(newOrder: string[]): void;

  // Query methods
  getLayer(alias: string): LayerState | null;
  getAllLayers(): LayerState[];
  getLayersByZIndex(): LayerState[]; // Sorted by render order
}
```

**State Shape:**

```typescript
interface VisualState {
  layers: Map<string, LayerState>;
}

interface LayerState {
  alias: string;
  zIndex: number;
  imageRef: string | null;
  aspectRatio: "cover" | "contain" | "fill";
  position: { x: string; y: string };
  opacity: number;
  visible: boolean;
  blendMode: string;
  effects: VisualEffect[];
  transform: Transform;
}
```

### Time Service

**Responsibilities:**

- Manage global time scale
- Broadcast time scale changes
- Provide current time scale to other services
- Track time flow history
- Calculate scaled time intervals

**Dependencies:**

- EventBus
- StateStore
- TimeRepository
- ClockService (notify clocks of scale change)

**Key Methods:**

```typescript
class TimeService extends Service {
  async handleScaleChange(event: Event<TimeScalePayload>): Promise<void>;

  // Query methods
  getCurrentScale(): number;
  calculateScaledDuration(realDuration: number): number; // real ms → scaled ms

  // Sync
  broadcastSync(): void; // Periodic time sync to prevent drift
}
```

**State Shape:**

```typescript
interface TimeState {
  scale: number;
  lastScaleChange: number; // Timestamp of last scale change
  scaleHistory: TimeScaleEvent[]; // For reconstruction
}
```

### Clock Service

**Responsibilities:**

- Manage active countdown clocks
- Tick clocks at scaled rate
- Trigger alerts at thresholds
- Handle clock lifecycle (create, start, pause, destroy)
- Emit completion events

**Dependencies:**

- EventBus
- StateStore
- ClockRepository
- TimeService (query current time scale)

**Clock Engine:**

Separate engine that runs clock progression:

```typescript
class ClockEngine {
  private interval: Timer;

  start() {
    // Tick every 100ms (or configurable)
    this.interval = setInterval(() => this.tick(), 100);
  }

  tick() {
    const currentScale = this.timeService.getCurrentScale();
    const deltaMs = 100 * currentScale; // Scaled time elapsed

    // Update all running clocks
    this.clocks.forEach((clock) => {
      if (!clock.running) return;

      const newRemaining = clock.remaining - deltaMs;

      if (newRemaining <= 0) {
        this.handleClockComplete(clock);
      } else {
        this.updateClockRemaining(clock.id, newRemaining);
        this.checkAlerts(clock, newRemaining);
      }
    });
  }

  stop() {
    clearInterval(this.interval);
  }
}
```

**Key Methods:**

```typescript
class ClockService extends Service {
  async handleCreate(event: Event<ClockCreatePayload>): Promise<void>;
  async handleStart(event: Event<ClockStartPayload>): Promise<void>;
  async handlePause(event: Event<ClockPausePayload>): Promise<void>;
  async handleDestroy(event: Event<ClockDestroyPayload>): Promise<void>;

  // Query methods
  getClock(id: string): ClockState | null;
  getAllClocks(): ClockState[];
  getRunningClocks(): ClockState[];
}
```

**State Shape:**

```typescript
interface ClocksState {
  clocks: Map<string, ClockState>;
}

interface ClockState {
  id: string;
  remaining: number; // ms remaining
  duration: number; // original duration
  running: boolean;
  visibility: VisibilityMode;
  style: string;
  alerts: AlertConfig[];
  createdAt: number;
}
```

### Scene Service

**Responsibilities:**

- Capture current state as scene
- Load scene state
- Manage scene library
- Coordinate transitions between scenes
- Build scenes from all service states

**Dependencies:**

- EventBus
- StateStore
- SceneRepository
- ALL feature services (to query/restore their state)

**Scene Builder:**

Assembles scenes by querying all services:

```typescript
class SceneBuilder {
  constructor(
    private audioService: AudioService,
    private visualService: VisualService,
    private timeService: TimeService,
    private clockService: ClockService,
  ) {}

  buildScene(name: string, description: string): Scene {
    return {
      id: generateId(),
      name,
      description,
      createdAt: Date.now(),
      state: {
        audio: this.audioService.captureState(),
        visual: this.visualService.captureState(),
        time: this.timeService.captureState(),
        clocks: this.clockService.captureState(),
      },
    };
  }

  async loadScene(scene: Scene, transition: TransitionConfig): Promise<void> {
    // Coordinate loading across all services
    await this.audioService.restoreState(scene.state.audio, transition);
    await this.visualService.restoreState(scene.state.visual, transition);
    await this.timeService.restoreState(scene.state.time);
    await this.clockService.restoreState(scene.state.clocks);
  }
}
```

**Key Methods:**

```typescript
class SceneService extends Service {
  async handleSave(event: Event<SceneSavePayload>): Promise<void>;
  async handleLoad(event: Event<SceneLoadPayload>): Promise<void>;
  async handleDelete(event: Event<SceneDeletePayload>): Promise<void>;

  // Scene management
  async saveCurrentState(name: string, description: string): Promise<Scene>;
  async loadScene(sceneId: string, transition: TransitionConfig): Promise<void>;
  async listScenes(filter?: SceneFilter): Promise<SceneMetadata[]>;
  async getScene(id: string): Promise<Scene | null>;
}
```

**State Shape:**

```typescript
interface ScenesState {
  library: Map<string, SceneMetadata>; // Lightweight metadata
  currentSceneId: string | null;
  history: string[]; // Scene load history (for undo/redo)
}

interface Scene {
  id: string;
  name: string;
  description: string;
  tags: string[];
  thumbnail: string | null;
  createdAt: number;
  lastUsed: number;
  state: {
    audio: AudioState;
    visual: VisualState;
    time: TimeState;
    clocks: ClocksState;
    // ... other feature states
  };
}
```

### Log Service

**Responsibilities:**

- Accept log events
- Persist events to storage
- Query/filter logs
- Generate session summaries
- Export logs in various formats

**Dependencies:**

- EventBus
- StateStore
- LogRepository
- TimeService (for timestamp correlation)

**Log Repository:**

Optimized for append-only writes and queries:

```typescript
class LogRepository {
  // Append event to current session log
  async append(event: LogEvent): Promise<void>;

  // Query with filters
  async query(filter: LogQuery): Promise<LogEvent[]>;

  // Get session logs
  async getSession(sessionId: string): Promise<LogEvent[]>;

  // Export
  async export(filter: LogQuery, format: ExportFormat): Promise<string>;
}
```

Could use:

- Append-only JSON file (simple, works well)
- SQLite (fast queries, Bun native support)
- Separate file per session (isolation, easy archival)

**Key Methods:**

```typescript
class LogService extends Service {
  async handleWrite(event: Event<LogWritePayload>): Promise<void>;
  async handleQuery(event: Event<LogQueryPayload>): Promise<void>;

  // Logging
  async logEvent(
    eventType: string,
    data: unknown,
    metadata: LogMetadata,
  ): Promise<void>;

  // Querying
  async queryLogs(query: LogQuery): Promise<LogEvent[]>;
  async getSessionLog(sessionId: string): Promise<LogEvent[]>;

  // Export
  async exportLogs(query: LogQuery, format: ExportFormat): Promise<string>;
}
```

**Auto-Logging:**

Log service subscribes to many events to auto-log:

```typescript
class LogService extends Service {
  constructor(...) {
    super(...)

    // Auto-log scene changes
    this.eventBus.on('scene.loaded', e => this.logSceneChange(e))

    // Auto-log audio events
    this.eventBus.on('audio.play', e => this.logAudioEvent(e))

    // Auto-log time scale changes
    this.eventBus.on('time.scale_changed', e => this.logTimeScale(e))

    // ... etc
  }
}
```

**State Shape:**

```typescript
interface LogsState {
  currentSessionId: string;
  eventCount: number; // Events in current session
  lastEventId: string | null;
}

interface LogEvent {
  id: string;
  sessionId: string;
  eventType: string;
  data: unknown;
  realTime: {
    utc: string;
    sessionElapsed: number;
  };
  gameTime: {
    worldDate?: string;
    sceneTime?: number;
  };
  actor: string;
  tags: string[];
  visibility: string;
}
```

### Session Service

**Responsibilities:**

- Manage session lifecycle
- Track session metadata
- Initialize services at session start
- Cleanup at session end
- Auto-save coordination

**Dependencies:**

- EventBus
- StateStore
- SessionRepository
- ALL services (to initialize/shutdown)

**Key Methods:**

```typescript
class SessionService extends Service {
  async startSession(metadata: SessionMetadata): Promise<void>;
  async endSession(): Promise<void>;
  async getCurrentSession(): SessionMetadata | null;

  // Auto-save coordination
  scheduleAutoSave(): void;
  async performAutoSave(): Promise<void>;
}
```

## Application Initialization

### Bootstrap Process

**main.ts orchestrates startup:**

1. **Load Configuration**
   - Read environment variables
   - Load config files
   - Merge configs (default < env < cli args)

2. **Initialize DI Container**
   - Register core services (EventBus, StateStore, etc.)
   - Register feature services (AudioService, VisualService, etc.)
   - Register repositories
   - Register utilities

3. **Resolve Core Services**
   - Container instantiates singletons
   - Dependencies auto-wired

4. **Initialize Services**
   - Call `initialize()` on each service
   - Services set up event subscriptions
   - Load persisted state from disk

5. **Start Transport Layer**
   - Start WebSocket server
   - Start REST API server (if enabled)
   - Begin accepting connections

6. **Ready**
   - Log "Server ready on port 3000"
   - Services begin processing events

**Shutdown Process:**

1. **Stop Accepting Connections**
   - Close WebSocket server
   - Reject new connections

2. **Notify Clients**
   - Send shutdown warning to connected clients
   - Grace period for client disconnect

3. **Shutdown Services**
   - Call `shutdown()` on each service
   - Services flush pending operations

4. **Persist State**
   - Save current state snapshot
   - Close log files
   - Commit transactions

5. **Exit**
   - Clean shutdown, exit code 0

**Graceful Shutdown Handling:**

```typescript
process.on("SIGINT", async () => {
  logger.info("Received SIGINT, shutting down gracefully...");
  await container.shutdown();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Received SIGTERM, shutting down gracefully...");
  await container.shutdown();
  process.exit(0);
});
```

## Configuration Management

### Configuration Schema

```typescript
interface ServerConfig {
  server: {
    port: number;
    host: string;
    corsOrigins: string[];
  };

  websocket: {
    maxConnections: number;
    pingInterval: number;
    compression: boolean;
  };

  persistence: {
    basePath: string;
    autoSaveInterval: number; // ms
    backupEnabled: boolean;
  };

  features: {
    audio: {
      maxChannels: number;
      syncInterval: number;
    };

    visual: {
      maxLayers: number;
    };

    clock: {
      tickInterval: number;
    };

    log: {
      backend: "file" | "sqlite";
      compressionEnabled: boolean;
    };
  };

  logging: {
    level: "debug" | "info" | "warn" | "error";
    pretty: boolean;
  };
}
```

### Environment-Specific Configs

**config/default.ts:** Base configuration
**config/development.ts:** Dev overrides (verbose logging, no auth)
**config/production.ts:** Prod overrides (compression, auth required)

Load based on `NODE_ENV` or `BUN_ENV`:

```typescript
const env = process.env.NODE_ENV || "development";
const baseConfig = await import("./config/default");
const envConfig = await import(`./config/${env}`);
const config = merge(baseConfig, envConfig);
```

## Type Safety

### Strict TypeScript Configuration

**tsconfig.json:**

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["bun-types"],
    "strictNullChecks": true,
    "noImplicitAny": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true
  }
}
```

### Shared Type Definitions

Types shared between server and clients live in `common/`:

- Event payload types
- State shape types
- Protocol types
- Asset reference types

Server imports from `common/`, clients import same definitions. Single source of truth prevents type drift.

### Event Type Safety

Use discriminated unions for type-safe event handling:

```typescript
type AudioEvent =
  | { type: "audio.play"; payload: AudioPlayPayload }
  | { type: "audio.pause"; payload: AudioPausePayload }
  | { type: "audio.stop"; payload: AudioStopPayload };

function handleAudioEvent(event: AudioEvent) {
  switch (event.type) {
    case "audio.play":
      // TypeScript knows event.payload is AudioPlayPayload
      break;
    case "audio.pause":
      // TypeScript knows event.payload is AudioPausePayload
      break;
  }
}
```

## Performance Considerations

### Bun Advantages

- **Fast Startup**: Bun starts ~4x faster than Node.js
- **Native WebSocket**: Highly optimized, no need for `ws` library
- **Fast File I/O**: Bun.file() and Bun.write() are very fast
- **Native SQLite**: Built-in, no compilation needed
- **TypeScript Native**: No transpilation step in dev

### Optimization Strategies

**1. Event Batching:**

- Batch multiple state updates before broadcasting
- Debounce high-frequency events (mouse positions, continuous sliders)

**2. Selective Broadcasting:**

- Only send events to clients that need them
- Client capability filtering (don't send visual events to audio-only client)

**3. State Diffing:**

- Send only changed state, not entire state tree
- Clients apply patches rather than replacing state

**4. Lazy Loading:**

- Services initialized on first use (lazy DI)
- Load scenes from disk only when needed

**5. Caching:**

- Cache frequently accessed scenes in memory
- Cache log query results with TTL

**6. Worker Threads:**

- Offload heavy processing (log exports, large queries) to workers
- Keep main event loop responsive

## Testing Strategy

### Unit Tests

Test services in isolation with mocked dependencies:

```typescript
describe('AudioService', () => {
  let audioService: AudioService
  let mockEventBus: MockEventBus
  let mockStateStore: MockStateStore

  beforeEach(() => {
    mockEventBus = new MockEventBus()
    mockStateStore = new MockStateStore()
    audioService = new AudioService(mockEventBus, mockStateStore, ...)
  })

  test('handlePlay updates state correctly', async () => {
    const event = { type: 'audio.play', payload: { channel: 'music', ... } }
    await audioService.handlePlay(event)

    const state = mockStateStore.getState()
    expect(state.audio.channels.get('music').playing).toBe(true)
  })
})
```

### Integration Tests

Test service interactions:

```typescript
describe('Scene Loading', () => {
  test('loading scene restores all service states', async () => {
    // Create real container with real services
    const container = createTestContainer()
    const sceneService = container.resolve<SceneService>(TOKENS.SceneService)
    const audioService = container.resolve<AudioService>(TOKENS.AudioService)

    // Save a scene
    await sceneService.saveCurrentState('test-scene', '')

    // Change state
    await audioService.handlePlay(...)

    // Load scene
    await sceneService.loadScene('test-scene', ...)

    // Verify state restored
    const audioState = audioService.getAllChannels()
    expect(audioState).toMatchSnapshot()
  })
})
```

### E2E Tests

Test WebSocket communication:

```typescript
describe('WebSocket Events', () => {
  test('client can trigger audio playback', async () => {
    const client = await connectTestClient()

    client.send({ type: 'audio.play', payload: { ... } })

    const response = await client.waitForEvent('audio.play')
    expect(response.payload.channel).toBe('music')
  })
})
```

## Monitoring and Observability

### Logging

Structured logging with context:

```typescript
logger.info("Audio playback started", {
  channel: "music",
  source: "tavern-ambience.mp3",
  clientId: "display-1",
  timestamp: Date.now(),
});
```

### Metrics

Track key metrics:

- Connected clients count
- Events per second
- State update frequency
- WebSocket message latency
- Memory usage
- Active clocks count
- Log events per session

### Health Checks

REST endpoint for health monitoring:

```
GET /health

Response:
{
  status: "healthy",
  uptime: 3600000,
  clients: {
    total: 3,
    master: 1,
    display: 2
  },
  services: {
    audio: "healthy",
    visual: "healthy",
    ...
  }
}
```

## Security Considerations

### Authentication

Options for client authentication:

- Shared secret token (simple, sufficient for local network)
- JWT tokens (more sophisticated)
- mTLS (for production deployments)

### Authorization

- Master client has full permissions
- Display clients read-only (can't modify state)
- Event filtering based on client role

### Input Validation

Validate all incoming events:

- Schema validation (Zod, TypeBox)
- Sanitize string inputs
- Validate asset references exist
- Rate limiting on event submission

### Data Privacy

- DM-only events never sent to display clients
- Log exports respect visibility flags
- Session data encryption at rest (optional)

## Deployment

### Development

```bash
bun run dev
# Starts server with hot reload
# Verbose logging
# No authentication
```

### Production

```bash
bun run build
bun run start
# Optimized build
# Production config
# Authentication required
# Compression enabled
```

### Docker

Containerize for easy deployment:

```dockerfile
FROM oven/bun:latest
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build
CMD ["bun", "run", "start"]
```

### Systemd Service

Run as system service:

```ini
[Unit]
Description=Squire DND Server
After=network.target

[Service]
Type=simple
User=squire
WorkingDirectory=/opt/squire
ExecStart=/usr/bin/bun run start
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

## Extensibility

### Adding New Services

1. Create service class extending `Service`
2. Define state shape and add to `ApplicationState`
3. Create repository for persistence
4. Register in DI container
5. Service auto-wired and initialized

### Custom Event Types

Define new event types in shared types:

```typescript
type CustomEvent = {
  type: 'custom.special_action'
  payload: { ... }
}
```

Services subscribe to new event types, handle accordingly.

### Plugin System (Future)

Architecture supports plugins:

- Plugins as npm packages
- Plugin exports service classes
- Container loads and registers plugin services
- Plugins integrate via events, no core modification needed

## Summary

This architecture provides:

- **Separation of Concerns**: Each service owns its domain
- **Testability**: DI makes mocking easy
- **Type Safety**: TypeScript throughout
- **Performance**: Bun's speed, efficient state management
- **Flexibility**: Easy to add features, swap implementations
- **Maintainability**: Clear structure, consistent patterns
- **Scalability**: Can grow from local dev to production deployment

The data-oriented approach keeps state predictable and serializable. The service-driven architecture keeps features decoupled. Dependency injection makes everything testable and configurable. Bun provides the performance foundation.
