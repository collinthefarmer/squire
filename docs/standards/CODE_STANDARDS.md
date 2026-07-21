# Code Standards

Rules for writing server-side (and general) code in Squire. For client-specific standards, see `CLIENT_STANDARDS.md`.

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
- Use Logger instance — no direct `console.*` calls

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

**Strict naming prefixes:**
- `get*` — read operations
- `set*` — create/replace operations
- `update*` — transform operations
- `remove*` — delete operations

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

When both display and master clients handle the same event types, extract state transformations into shared reducers in `ts-web-client/src/state/{domain}-state.ts` (aliased as `@state/`).

**Convention:** `apply{Domain}{Action}(map, event) → map`

Each reducer takes current `Map<string, State>` and a typed event, returns a new map. Pure functions — no side effects, no service access.

---

## 6. Type Safety

### 6.1 TypeScript

- All types in `server/src/types.ts`
- `type` for discriminated unions and aliases, `interface` for object shapes
- `import type` for types to avoid circular dependencies
- Strict mode enabled — no `any`, use `unknown` for truly dynamic types
- No type assertions (`as`) unless absolutely necessary
- Type all parameters and return values explicitly

### 6.2 Zod Validation

- All schemas in `server/src/schemas.ts`
- Use `z.discriminatedUnion` for the event schema
- Always `.safeParse()` — never `.parse()` (which throws)
- Add validation constraints (`.min()`, `.max()`, etc.)
- Only validate external input (WebSocket messages), not internal events

### 6.3 Typed Dispatch Maps

For event handlers with 4+ cases, prefer a typed dispatch map over switch/case to get compiler-enforced exhaustiveness:

```typescript
type HandlerMap<U extends { type: string }> = {
    [K in U["type"]]: (event: Extract<U, { type: K }>) => void;
};

const handlers: HandlerMap<ClockEvent> = {
    "ui.clock.create": (e) => this.handleCreate(e),
    "ui.clock.start":  (e) => this.handleStart(e),
    // Compiler errors if a type is missing
};
```

For 2-3 cases, switch/case with cast is fine.

---

## 7. Code Organization

### 7.1 File Structure

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
- Max 3-4 levels of nesting
- Files under 500 lines — split if larger
- Co-locate tests: `foo.ts` → `foo.test.ts`

### 7.2 Naming

- **Files:** kebab-case (`audio-service.ts`)
- **Classes:** PascalCase (`AudioService`)
- **Interfaces/Types:** PascalCase (`AudioChannelState`, `IEventBus`)
- **Functions/Methods:** camelCase (`handlePlay`, `getChannel`)
- **Constants:** SCREAMING_SNAKE_CASE (`TOKENS`, `PUBLIC_DIR`)
- **Event types:** dot.notation (`audio.play`, `visual.image.set`)
- **Private members:** `private` keyword, no underscore prefix

### 7.3 Imports

Group in order, sort alphabetically within groups:
1. External packages (Bun, Zod)
2. Internal core infrastructure
3. Internal utilities
4. Internal types (`import type`)
5. Relative imports

Use `import type` for types. Avoid deep relative paths — use path aliases.

---

## 8. Functions

- Single responsibility — each function does one thing
- Early returns for error cases and guard clauses — keep happy path at lowest indentation
- `continue` in loops to skip early rather than nesting
- Max 3-4 parameters — use object parameter for more
- Prefer returning values over void + mutation
- Return `undefined` for "not found" (not `null`)
- Keep nesting to 2-3 levels max

---

## 9. Error Handling

- Try-catch for external I/O (WebSocket, file system, parsing)
- Keep try blocks sparse — only wrap code that could throw
- Validate user input with Zod — don't trust external data
- Log all caught errors with context using Logger
- Wrap event subscription callbacks in try/catch — a thrown error in an RxJS Subject terminates it permanently
- Use `Promise.allSettled()` for multiple async operations
- No empty catch blocks, no generic error messages without context

---

## 10. Logging

Use Logger class for all logging — no direct `console.*` calls.

```typescript
private logger = new Logger("AudioService");

this.logger.info("Playing audio", { channel, source: source.ref });
this.logger.error("Failed to process event", { error, channel });
```

**Levels:**
- `debug` — development diagnostics
- `info` — state transitions, significant events
- `warn` — recoverable issues, unexpected states
- `error` — failures and exceptions

---

## 11. Adding New Event Types

Step-by-step:

1. Define payload interface + event type in `server/src/types.ts`
2. Define Zod schema in `server/src/schemas.ts`
3. Add to `eventSchema` discriminated union
4. Create/update service in `server/src/services/`
5. Add token to `TOKENS`, register factory in `main.ts`
6. Add EventStore replay config in `replay-configs.ts` if the domain has persistent entities

Non-breaking changes: add optional fields (`.optional()`). Breaking changes: create new event type (`audio.play.v2`).

---

## 12. Testing

- Use `bun test` with Bun's built-in runner
- Import from `bun:test`
- Co-locate tests: `foo.ts` → `foo.test.ts`
- Test state helpers in isolation (pure functions)
- Use shared test data factories: `make{Entity}(overrides?)` convention
- Descriptive names: `test("should pause channel when audio.pause received")`
- Group with `describe()`
- Don't test implementation details — test behavior

---

## 13. Bun-Specific

- Use `Bun.serve()` for HTTP/WebSocket
- Use `Bun.file()` for file operations
- Use `bun test`, `bun run`, `bun install`
- No Express, no ts-node, no npm/yarn
- Bun runs TypeScript directly — no transpilation step
