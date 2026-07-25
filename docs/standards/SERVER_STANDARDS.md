# Server Standards

Rules for writing server-side code in Squire. Use alongside `CODE_STYLE.md` (shared rules) and `CLIENT_STANDARDS.md` (client rules).

---

## 1. Event-Driven Architecture

- All communication happens through typed events validated with Zod
- Events flow unidirectionally through the EventBus
- Services subscribe to event types and remain decoupled from each other

**Rules:**
- Define events in `server/src/types.ts` with discriminated unions
- Create Zod schemas in `server/src/schemas.ts`
- Use dot-notation namespacing: `audio.play`, `visual.image.set`
- Every event has `type`, `payload`, and `metadata` fields
- Keep event types flat — `audio.volume` not `audio.channel.volume`
- No direct service-to-service coupling

```typescript
// types.ts
export type AudioPlayEvent = Event<"audio.play", AudioPlayPayload>;

// schemas.ts
export const audioPlayEventSchema = z.object({
    type: z.literal("audio.play"),
    payload: audioPlayPayloadSchema,
    metadata: eventMetadataSchema,
});

// Service subscribes
this.eventBus.on("audio.play", this.handlePlay.bind(this));
```

---

## 2. Dependency Injection

- Symbol-based DI tokens in `TOKENS` object (`server/src/core/di/container.ts`)
- Register core infrastructure as instances, feature services as factories
- All dependencies through constructor injection — no global state, no direct imports of service instances
- Constructor parameter order: EventBus, StateStore, ClientRegistry, then domain-specific

```typescript
container.registerFactory(TOKENS.AudioService, () => {
    return new AudioService(
        container.resolve(TOKENS.EventBus),
        container.resolve(TOKENS.StateStore),
        container.resolve(TOKENS.ClientRegistry),
    );
});
```

---

## 3. Service Pattern

Services follow this template: constructor injection → `setupEventListeners()` → private handlers → public getters.

**Rules:**
- Update state through `stateStore.updateState()` with immutable functions
- Broadcast through `clientRegistry.broadcast()`
- Name handlers `handleXxx`
- Keep handlers focused: validate → update state → broadcast
- Extract complex state transformations to helpers
- Return early for invalid states or no-op conditions

```typescript
export class AudioService {
    private logger = new Logger("AudioService");

    constructor(
        private eventBus: EventBus,
        private stateStore: StateStore,
        private clientRegistry: ClientRegistry,
    ) {
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        this.eventBus.on("audio.play", this.handlePlay.bind(this));
    }

    private handlePlay(event: AudioPlayEvent): void {
        const { channel, source, volume, loop } = event.payload;
        this.logger.info("Playing audio", { channel, source: source.ref });

        this.stateStore.updateState((state) =>
            setAudioChannel(state, channel, { id: channel, source, playing: true, volume, loop, effects: [], respectTimeScale: false })
        );

        this.clientRegistry.broadcast(event);
    }
}
```

---

## 4. Interface-Based Design

- Define interfaces for core infrastructure: `IEventBus`, `IStateStore`, `IClientRegistry`
- Interfaces live in `server/src/types.ts` alongside other type definitions
- Services depend on interface types, not concrete classes
- Create interfaces when they add value (core infra, testing boundaries) — not for simple data structures

---

## 5. State Management

### 5.1 Immutability

- All state updates return new objects/Maps — never mutate existing state
- Use `stateStore.updateState(fn)` where `fn` is a pure function
- Copy Maps with `new Map(existing)` before mutation
- Object spread `{ ...obj }` for object updates
- Use `ReadonlyMap<K, V>` in state interfaces so `.set()` is a type error

```typescript
// Good
this.stateStore.updateState((state) =>
    setAudioChannel(state, channel, channelState)
);

// Bad — mutates existing state
const state = this.stateStore.getState();
state.audio.channels.set(channel, channelState);
```

### 5.2 State Helper Functions

Place all helpers in `server/src/utils/state-helpers.ts`. Pure functions, no side effects.

Build complex operations from simple primitives:

```typescript
export function setAudioChannel(state: ApplicationState, channelId: string, channelState: AudioChannelState): ApplicationState {
    return updateAudioChannels(state, (channels) => {
        channels.set(channelId, channelState);
        return channels;
    });
}
```

### 5.3 Shared Reducers

When both display and master clients handle the same event types, extract state transformations into shared reducers in `ts-web-client/src/shared/state/{domain}-state.ts` (aliased as `@state/`).

**Convention:** `apply{Domain}{Action}(map, event) → map`

Each reducer takes current `Map<string, State>` and a typed event, returns a new map. Pure functions — no side effects, no service access.

---

## 6. Zod Validation

- All schemas in `server/src/schemas.ts`
- Use `z.discriminatedUnion` for the event schema
- Always `.safeParse()` — never `.parse()` (which throws)
- Add validation constraints (`.min()`, `.max()`, etc.)
- Only validate external input (WebSocket messages), not internal events

---

## 7. File Structure

```
server/src/
  core/          # Infrastructure (DI, events, state, transport)
  services/      # Domain services (audio/, image/, countdown/, time/)
  utils/         # Shared utilities (logger, state-helpers)
  types.ts       # All TypeScript types
  schemas.ts     # All Zod schemas
  main.ts        # Entry point
```

- One service per domain: `services/{domain}/{domain}-service.ts`

---

## 8. Adding New Event Types

Step-by-step:

1. Define payload interface + event type in `server/src/types.ts`
2. Define Zod schema in `server/src/schemas.ts`
3. Add to `eventSchema` discriminated union
4. Create/update service in `server/src/services/`
5. Add token to `TOKENS`, register factory in `main.ts`
6. Add EventStore replay config in `replay-configs.ts` if the domain has persistent entities

Non-breaking changes: add optional fields (`.optional()`). Breaking changes: create new event type (`audio.play.v2`).

---

## 9. Bun-Specific

- Use `Bun.serve()` for HTTP/WebSocket
- Use `Bun.file()` for file operations
- Use `bun test`, `bun run`, `bun install`
- No Express, no ts-node, no npm/yarn
- Bun runs TypeScript directly — no transpilation step
