# Squire Code Standards

This document defines code standards for the Squire D&D campaign application. These standards emphasize **extensibility**, **reusable and focused functions**, **readability**, **decoupling**, **simplicity**, and **best practices**.

All code should follow these standards to maintain consistency, enable future growth, and keep the codebase maintainable.

---

## 1. Architecture & Design Principles

### 1.1 Event-Driven Architecture

**Principles:**
- All communication between server and clients happens through typed events
- Events flow unidirectionally through the EventBus
- Services subscribe to specific event types and remain decoupled from each other
- Events are immutable once emitted

**MUST:**
- Define all events in `/server/src/types.ts` with discriminated unions
- Create corresponding Zod schemas in `/server/src/schemas.ts`
- Use dot-notation namespacing (e.g., `audio.play`, `visual.image.set`)
- Include `type`, `payload`, and `metadata` fields in every event

**SHOULD:**
- Keep event types flat and avoid redundant nesting (use `audio.volume` not `audio.channel.volume`)
- Design payloads to be self-contained with all required context
- Use metadata for cross-cutting concerns (timestamp, source, priority, targetClients)

**AVOID:**
- Direct service-to-service coupling
- Business logic in event handlers that modifies other domains
- Emitting multiple events for single user actions unless semantically distinct

**Example - Good:**
```typescript
// types.ts
export type AudioPlayEvent = Event<"audio.play", AudioPlayPayload>;

// schemas.ts
export const audioPlayEventSchema = z.object({
    type: z.literal("audio.play"),
    payload: audioPlayPayloadSchema,
    metadata: eventMetadataSchema,
});

// Service subscribes and handles
this.eventBus.on("audio.play", this.handlePlay.bind(this));
```

**Example - Bad:**
```typescript
// DON'T: Calling other services directly
private handlePlay(event: AudioPlayEvent): void {
    this.imageService.updateSomething(); // Tight coupling!
}
```

**Rationale:** Event-driven architecture enables loose coupling, making it easy to add new features without modifying existing code. Services can be added, removed, or modified independently as long as they respect event contracts.

---

### 1.2 Dependency Injection

**Principles:**
- Use symbol-based DI tokens to avoid magic strings
- Register services in `/server/src/main.ts` during initialization
- Services declare dependencies through constructor injection
- Container manages singleton lifecycle

**MUST:**
- Define all service tokens in `TOKENS` object in `/server/src/core/di/container.ts`
- Use `import type` for dependency declarations to avoid circular dependencies
- Register core infrastructure as instances, feature services as factories
- Inject all dependencies through constructor, never use global state

**SHOULD:**
- Order constructor parameters: EventBus, StateStore, ClientRegistry, then domain-specific
- Use factories for services that depend on other services
- Document service dependencies in class-level JSDoc

**AVOID:**
- Importing service instances directly
- Lazy initialization or service locator patterns
- Mixing constructor injection with property injection

**Example - Good:**
```typescript
// Container registration in main.ts
container.registerFactory(TOKENS.AudioService, () => {
    return new AudioService(
        container.resolve(TOKENS.EventBus),
        container.resolve(TOKENS.StateStore),
        container.resolve(TOKENS.ClientRegistry)
    );
});

// Service declaration in audio-service.ts
export class AudioService {
    constructor(
        private eventBus: EventBus,
        private stateStore: StateStore,
        private clientRegistry: ClientRegistry,
    ) {
        this.setupEventListeners();
    }
}
```

**Example - Bad:**
```typescript
// DON'T: Direct imports or global state
import { eventBus } from './core/events/event-bus'; // Avoid!

export class AudioService {
    private eventBus: EventBus;

    initialize() {
        this.eventBus = globalEventBus; // No global state!
    }
}
```

**Rationale:** DI makes dependencies explicit, facilitates testing, and enables swapping implementations without changing consumer code. Symbol tokens prevent typos and refactoring issues.

---

### 1.3 Service Design Pattern

**Principles:**
- Services are stateless coordinators that delegate to StateStore
- Each service handles one domain (audio, image, etc.)
- Services subscribe to events, update state, and broadcast to clients
- Public methods provide read-only access to domain state

**MUST:**
- Follow the template: constructor injection → `setupEventListeners()` → private handlers → public getters
- Update state through `stateStore.updateState()` with immutable functions
- Broadcast events through `clientRegistry.broadcast()`
- Name event handlers `handleXxx` (e.g., `handlePlay`, `handlePause`)

**SHOULD:**
- Keep handlers focused on single responsibility
- Extract complex state transformations to `/server/src/utils/state-helpers.ts`
- Return early for invalid states or no-op conditions
- Use Logger instance for all logging within services

**AVOID:**
- Storing domain state in service instance properties
- Mutating state directly
- Calling other service methods directly
- Complex business logic in handlers (extract to helper functions)

**Example - Good:**
```typescript
/**
 * Audio service handles audio playback state
 */
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
        this.eventBus.on("audio.pause", this.handlePause.bind(this));
    }

    private handlePlay(event: AudioPlayEvent): void {
        const { channel, source, volume, loop } = event.payload;

        this.logger.info("Playing audio", { channel, source: source.ref });

        // Update state immutably
        this.stateStore.updateState((state) => {
            const channelState: AudioChannelState = {
                id: channel,
                source,
                playing: true,
                position: 0,
                volume,
                loop,
                effects: [],
                respectTimeScale: false,
            };
            return setAudioChannel(state, channel, channelState);
        });

        // Broadcast to clients
        this.clientRegistry.broadcast(event);
    }

    // Public read-only access
    getChannel(channelId: string): AudioChannelState | undefined {
        const state = this.stateStore.getState();
        if (!state.audio) {
            return undefined;
        }
        return getAudioChannel(state, channelId);
    }
}
```

**Rationale:** This pattern separates concerns cleanly: EventBus handles messaging, StateStore handles persistence, Services handle coordination. It's easy to test, reason about, and extend.

---

### 1.4 Interface-Based Design

**Principles:**
- Program to interfaces, not implementations
- Use TypeScript interfaces to define contracts
- Enable swapping implementations without changing consumers

**MUST:**
- Define interfaces for all core infrastructure components: `IEventBus`, `IStateStore`, `IClientRegistry`
- Concrete classes implement these interfaces
- Services depend on interface types, not concrete classes
- Update DI container to resolve by interface

**SHOULD:**
- Place interfaces in `/server/src/core/interfaces.ts`
- Keep interface methods minimal (only what consumers need)
- Use interfaces for testing with mocks

**AVOID:**
- Leaking implementation details through interface
- Creating interfaces for simple data structures
- Over-abstracting (create interfaces when they add value)

**Example - Good:**
```typescript
// core/interfaces.ts
export interface IEventBus {
    on<T = any>(eventType: string, handler: (event: T) => void | Promise<void>): () => void;
    emit<T = any>(eventType: string, event: T): Promise<void>;
    emitSync<T = any>(eventType: string, event: T): void;
}

export interface IStateStore {
    getState(): ApplicationState;
    setState(newState: ApplicationState): void;
    updateState(updater: (state: ApplicationState) => ApplicationState): void;
}

export interface IClientRegistry {
    registerClient(client: ConnectedClient): void;
    unregisterClient(clientId: string): void;
    broadcast(event: Event, filter?: (client: ConnectedClient) => boolean): void;
    getAllClients(): ConnectedClient[];
}

// Service uses interfaces
export class AudioService {
    constructor(
        private eventBus: IEventBus,
        private stateStore: IStateStore,
        private clientRegistry: IClientRegistry,
    ) {
        this.setupEventListeners();
    }
}
```

**Rationale:** Interfaces enable testing, mocking, and swapping implementations. They provide clear contracts that make dependencies explicit and reduce coupling to concrete implementations.

---

## 2. State Management

### 2.1 Immutability

**Principles:**
- All state updates return new objects/Maps
- Never mutate existing state
- Use functional update patterns with `updateState(updater)`
- Leverage Map constructor for shallow copying

**MUST:**
- Use `stateStore.updateState()` with updater functions for all state changes
- Copy Maps with `new Map(existingMap)` before mutations
- Use object spread (`{ ...obj }`) for object updates
- Use helper functions from `/server/src/utils/state-helpers.ts`
- Use `ReadonlyMap<K, V>` in state interfaces so `.set()` and `.delete()` are type errors — consumers must create a mutable copy via `new Map(...)` before mutating

**SHOULD:**
- Create domain-specific helpers for common state transformations
- Keep updater functions pure (no side effects)
- Name helpers descriptively with strict prefixes (see Section 2.2)
- Use `Readonly<T>` or `readonly` modifier on state interface properties to reinforce immutability at the type level, not just by convention

**AVOID:**
- Direct mutation: `state.audio.channels.set(...)` without copying
- Retrieving state, mutating it, then calling `setState()`
- Complex inline updaters (extract to helpers)

**Example - Good:**
```typescript
// Helper function (state-helpers.ts)
export function setAudioChannel(
    state: ApplicationState,
    channelId: string,
    channelState: AudioChannelState,
): ApplicationState {
    return updateAudioChannels(state, (channels) => {
        channels.set(channelId, channelState); // Safe because channels is a new Map
        return channels;
    });
}

// Usage in service
this.stateStore.updateState((state) => {
    return setAudioChannel(state, channel, channelState);
});
```

**Example - Bad:**
```typescript
// DON'T: Direct mutation
const state = this.stateStore.getState();
state.audio.channels.set(channel, channelState); // MUTATES STATE!

// DON'T: Incomplete copying
this.stateStore.updateState((state) => {
    state.audio.channels.set(channel, channelState); // Still mutating!
    return state;
});
```

**Example - ReadonlyMap enforcement:**
```typescript
// State interface uses ReadonlyMap — mutation is a type error
interface AudioState {
    channels: ReadonlyMap<string, AudioChannelState>;
    masterVolume: number;
}

state.channels.set("x", val); // Error: Property 'set' does not exist on ReadonlyMap

// State helpers create a mutable copy internally:
export function setAudioChannel(state: ApplicationState, ...): ApplicationState {
    const mutable = new Map(audioState.channels); // ReadonlyMap → Map
    mutable.set(channelId, channelState);
    return { ...state, audio: { ...audioState, channels: mutable } };
}
```

**Rationale:** Immutability prevents bugs from shared state mutations, makes state changes traceable, and enables potential optimizations like time-travel debugging and change detection. `ReadonlyMap` shifts enforcement from convention to compiler — mutations become type errors rather than code review findings.

---

### 2.2 State Helper Functions

**Principles:**
- Extract all state operations to composable helper functions
- Follow functional programming patterns with pure functions
- Build complex operations from simple primitives
- **Use strict naming prefixes for all helpers**

**MUST:**
- Place all state helpers in `/server/src/utils/state-helpers.ts`
- Make helpers pure functions that take state and return new state
- Follow strict naming prefixes:
  - `get*` - Read operations (e.g., `getAudioChannel`, `getImageLayer`)
  - `set*` - Create/replace operations (e.g., `setAudioChannel`, `setImageLayer`)
  - `update*` - Transform operations (e.g., `updateAudioChannel`, `updateImageLayer`)
  - `remove*` - Delete operations (e.g., `removeImageLayer`)
- Export typed helpers for common operations
- Document non-obvious transformations

**SHOULD:**
- Create layers: primitive helpers → composite helpers → domain helpers
- Return early for undefined/null cases
- Use default values for missing nested state
- Compose complex helpers from simple ones
- When both clients handle the same event types, extract state transformations into shared reducers following the `apply{Domain}{Action}` convention (see `/docs/REFACTORING_GUIDE.md` §3.1)

**AVOID:**
- State helpers with side effects (logging, network calls)
- Coupling helpers to specific services
- Helpers that access StateStore directly
- Breaking naming conventions (all helpers must use prefixes)

**Example - Good:**
```typescript
// Primitive helper - uses update* prefix
export function updateAudioChannels(
    state: ApplicationState,
    updater: (channels: Map<string, AudioChannelState>) => Map<string, AudioChannelState>,
): ApplicationState {
    const audioState = getAudioState(state);
    const channels = updater(new Map(audioState.channels)); // Immutable copy
    return setAudioState(state, { ...audioState, channels });
}

// Composite helper built on primitive - uses set* prefix
export function setAudioChannel(
    state: ApplicationState,
    channelId: string,
    channelState: AudioChannelState,
): ApplicationState {
    return updateAudioChannels(state, (channels) => {
        channels.set(channelId, channelState);
        return channels;
    });
}

// Read helper - uses get* prefix
export function getAudioChannel(
    state: ApplicationState,
    channelId: string,
): AudioChannelState | undefined {
    const audioState = state.audio;
    if (!audioState) {
        return undefined;
    }
    return audioState.channels.get(channelId);
}

// Delete helper - uses remove* prefix
export function removeImageLayer(
    state: ApplicationState,
    layerId: string,
): ApplicationState {
    return updateImageLayers(state, (layers) => {
        layers.delete(layerId);
        return layers;
    });
}
```

**Example - Bad:**
```typescript
// DON'T: Side effects in helper
export function setAudioChannel(state, channelId, channelState) {
    console.log("Setting channel", channelId); // Side effect!
    // ...
}

// DON'T: Wrong naming (should be getAudioChannel)
export function fetchAudioChannel(state, channelId) {
    return state.audio?.channels.get(channelId);
}

// DON'T: Wrong naming (should be removeImageLayer)
export function deleteImageLayer(state, layerId) {
    // ...
}
```

**Rationale:** Centralized helpers ensure consistency, reduce duplication, and make state transformations testable in isolation. Strict naming prefixes make code predictable and easy to scan. Composable helpers enable complex operations without complexity.

---

## 3. Type Safety & Validation

### 3.1 TypeScript Types & Interfaces

**Principles:**
- Define all domain types in centralized type files
- Use discriminated unions for event types
- Prefer interfaces for object shapes, types for unions/aliases
- Leverage TypeScript's structural typing

**MUST:**
- Define all server types in `/server/src/types.ts`
- Use `type` for discriminated unions and type aliases
- Use `interface` for object shapes and extendable contracts
- Import types with `import type` to avoid circular dependencies
- Use strict TypeScript configuration (strict mode enabled)

**SHOULD:**
- Use generic `Event<T, P>` base interface for all events
- Create type aliases for complex union types
- Export both specific types and domain unions (e.g., `AudioEvent`)
- Document non-obvious type relationships with JSDoc

**AVOID:**
- Inline type definitions
- `any` type (use `unknown` if truly dynamic)
- Type assertions (`as`) unless absolutely necessary
- Mixing types and runtime values in same file

**Example - Good:**
```typescript
// types.ts - Central type definitions
export interface Event<T extends string = string, P = unknown> {
    type: T;
    payload: P;
    metadata: EventMetadata;
}

export type AudioPlayEvent = Event<"audio.play", AudioPlayPayload>;
export type AudioPauseEvent = Event<"audio.pause", { channel: string }>;

export type AudioEvent =
    | AudioPlayEvent
    | AudioPauseEvent
    | AudioResumeEvent
    | AudioStopEvent
    | AudioVolumeEvent;

// Service - Type-only imports
import type { EventBus } from "../../core/events/event-bus";
import type { AudioPlayEvent } from "../../types";
```

**Example - Bad:**
```typescript
// DON'T: Inline types
function handlePlay(event: { type: string; payload: any }) {
    // ...
}

// DON'T: Runtime import when only type is needed
import { EventBus } from "../../core/events/event-bus"; // Creates circular dep!

// DON'T: Using any
function processEvent(event: any) { // Should be typed!
    // ...
}
```

**Rationale:** Strong typing catches errors at compile time, improves IDE support, and documents contracts. Type-only imports prevent circular dependencies in the module graph.

---

### 3.2 Zod Runtime Validation

**Principles:**
- Validate all external input with Zod schemas
- Define schemas parallel to TypeScript types
- Use discriminated unions for event validation
- Infer types from schemas where beneficial

**MUST:**
- Define all validation schemas in `/server/src/schemas.ts`
- Validate all incoming WebSocket messages against `eventSchema`
- Use `z.discriminatedUnion` for event schemas
- Use `.safeParse()` for validation that may fail (never `.parse()` which throws)

**SHOULD:**
- Mirror TypeScript type structure in schema structure
- Add validation constraints (`.min()`, `.max()`, `.email()`, etc.)
- Compose schemas from smaller schemas
- Use `z.infer<typeof schema>` to derive types from complex schemas

**AVOID:**
- Validating internal messages (server-to-server events)
- Throwing errors from validation (use `.safeParse()`)
- Duplicating validation logic outside Zod schemas
- Schema definitions scattered across files

**Example - Good:**
```typescript
// schemas.ts
export const audioPlayPayloadSchema = z.object({
    channel: z.string(),
    source: audioSourceSchema,
    volume: z.number().min(0).max(1), // Runtime constraint
    loop: z.boolean(),
    effects: z.array(audioEffectSchema).optional(),
    respectTimeScale: z.boolean(),
});

export const audioPlayEventSchema = z.object({
    type: z.literal("audio.play"),
    payload: audioPlayPayloadSchema,
    metadata: eventMetadataSchema,
});

export const eventSchema = z.discriminatedUnion("type", [
    audioPlayEventSchema,
    audioPauseEventSchema,
    imageSetEventSchema,
    // ...
]);

// Validation in main.ts (safeParse, not parse)
const validationResult = eventSchema.safeParse(parsed);
if (!validationResult.success) {
    logger.error("Invalid event:", {
        errors: validationResult.error.format(),
    });
    return; // Graceful handling
}
const event = validationResult.data; // Type-safe now
```

**Example - Bad:**
```typescript
// DON'T: Manual validation
function validateEvent(event: any): boolean {
    if (!event.type || typeof event.type !== 'string') return false;
    if (!event.payload) return false;
    // ... manual checks
}

// DON'T: Using .parse() which throws
try {
    const event = eventSchema.parse(parsed); // Throws on error!
} catch (e) {
    // Error handling
}
```

**Rationale:** Zod provides runtime type safety that TypeScript cannot. Schemas catch malformed client data, prevent injection attacks, and document expected input structure. `safeParse` enables graceful error handling without exceptions.

---

### 3.3 Typed Dispatch Maps for Event Handling

**Principles:**
- Eliminate `event as SpecificEvent` casts in large switch/case blocks
- Use typed dispatch maps where the compiler verifies exhaustiveness
- Let the discriminated union's `type` field drive narrowing automatically

**SHOULD:**
- For event handlers that switch over a union's `type` field, prefer a typed dispatch map over a manual switch when there are 4+ cases
- Type the map using a mapped type over the union's discriminant so the compiler errors on missing handlers
- Keep the switch/case + cast pattern for simple 2-3 case handlers (this remains acceptable per `/docs/REFACTORING_GUIDE.md` §6.2)

**AVOID:**
- Casting inside individual switch cases (`event as AudioPlayEvent`) when the handler count is large enough to warrant a dispatch map
- Partial dispatch maps that silently ignore missing cases — always type the full union

**Example - Good (typed dispatch map):**
```typescript
type HandlerMap<U extends { type: string }> = {
    [K in U["type"]]: (event: Extract<U, { type: K }>) => void;
};

// Compiler errors if a ClockEvent type is missing from this map
const handlers: HandlerMap<ClockEvent> = {
    "ui.clock.create": (e) => this.handleCreate(e),    // e: ClockCreateEvent
    "ui.clock.start":  (e) => this.handleStart(e),     // e: ClockStartEvent
    "ui.clock.pause":  (e) => this.handlePause(e),     // e: ClockPauseEvent
    "ui.clock.adjust": (e) => this.handleAdjust(e),    // e: ClockAdjustEvent
    "ui.clock.destroy": (e) => this.handleDestroy(e),  // e: ClockDestroyEvent
    "ui.clock.update": (e) => this.handleUpdate(e),    // e: ClockUpdateEvent
};

private handleEvent(event: ClockEvent): void {
    const handler = handlers[event.type];
    handler(event as any); // Single cast at call site — map guarantees per-handler safety
}
```

**Example - Acceptable (switch + cast for small unions):**
```typescript
// 2-3 cases: switch + cast is fine, no dispatch map needed
private handleEvent(event: TimeEvent): void {
    switch (event.type) {
        case "time.scale_changed":
            this.handleScaleChanged(event as TimeScaleChangedEvent);
            break;
    }
}
```

**Rationale:** Typed dispatch maps turn missing-handler bugs into compile errors. They replace N casts per handler with one at the call site. For small unions (2-3 cases), the switch/case pattern remains clear and acceptable.

---

## 4. Code Organization & Structure

### 4.1 File & Folder Structure

**Principles:**
- Organize by feature/domain, not by file type
- Keep related code together
- Separate shared infrastructure from domain logic
- Mirror structure between server and client where applicable

**MUST:**
- Follow the established directory structure:
  ```
  server/src/
    core/          # Infrastructure (DI, events, state, transport)
      di/          # Dependency injection container
      events/      # Event bus
      state/       # State store
      transport/   # Client registry/WebSocket
      interfaces.ts # Interface definitions (IEventBus, IStateStore, etc.)
    services/      # Domain services (audio/, image/)
      audio/       # Audio service
      image/       # Image service
    utils/         # Shared utilities (logger, state-helpers)
    types.ts       # All TypeScript types
    schemas.ts     # All Zod schemas
    main.ts        # Entry point
  ```
- Create subdirectories for each service domain: `/services/{domain}/{domain}-service.ts`
- Place shared utilities in `/utils/`
- Keep core infrastructure in `/core/`

**SHOULD:**
- Add README.md to complex feature directories
- Co-locate tests alongside source files
- Use index.ts barrel exports sparingly (only for public APIs)
- Keep file names lowercase with hyphens (kebab-case)

**AVOID:**
- Generic folders like `/helpers/`, `/misc/`, `/common/`
- Deeply nested directories (max 3-4 levels)
- Mixing server and client code
- Large files (>500 lines - consider splitting)

**Rationale:** Feature-based organization makes it easy to find related code, understand domain boundaries, and remove/refactor features. Flat hierarchies reduce cognitive load.

---

### 4.2 Naming Conventions

**Principles:**
- Names should be descriptive, consistent, and unambiguous
- Follow TypeScript and JavaScript community conventions
- Use domain language from D&D/campaign management

**MUST:**
- **Files:** kebab-case (e.g., `audio-service.ts`, `state-helpers.ts`)
- **Classes:** PascalCase (e.g., `AudioService`, `EventBus`, `StateStore`)
- **Interfaces/Types:** PascalCase (e.g., `AudioChannelState`, `Event`, `IEventBus`)
- **Functions/Methods:** camelCase (e.g., `handlePlay`, `getChannel`, `setupEventListeners`)
- **Constants:** SCREAMING_SNAKE_CASE for true constants (e.g., `TOKENS`, `PUBLIC_DIR`)
- **Private members:** Use `private` keyword, no underscore prefix
- **Event types:** dot.notation.lowercase (e.g., `audio.play`, `visual.image.set`)

**SHOULD:**
- Use verb-noun for methods: `getChannel`, `setVolume`, `handlePlay`
- Use noun for classes: `AudioService` (not `AudioManager` or `AudioHandler`)
- Use descriptive names over abbreviations (`channel` not `ch`, `source` not `src`)
- Suffix type names with kind: `AudioEvent`, `AudioState`, `AudioService`

**AVOID:**
- Hungarian notation (no `strName`, `arrItems`)
- Underscores in JavaScript identifiers (except CONSTANTS)
- Single-letter names except loop counters
- Abbreviations that aren't widely known (D&D terms are fine)

**Example - Good:**
```typescript
// File: audio-service.ts
export class AudioService {
    private logger = new Logger("AudioService");

    constructor(
        private eventBus: IEventBus,
        private stateStore: IStateStore,
    ) {}

    private handlePlay(event: AudioPlayEvent): void {
        // ...
    }

    getChannel(channelId: string): AudioChannelState | undefined {
        // ...
    }
}

const TOKENS = {
    EventBus: Symbol("EventBus"),
    StateStore: Symbol("StateStore"),
};
```

**Example - Bad:**
```typescript
// File: AudioService.ts (Wrong casing)
export class audioService { // Wrong casing
    private _eventBus: IEventBus; // Unnecessary underscore
    private ss: IStateStore; // Unclear abbreviation

    constructor(eb: IEventBus, ss: IStateStore) { // Unclear params
        this._eventBus = eb;
        this.ss = ss;
    }

    private play_handler(e: any): void { // Snake case, unclear
        // ...
    }
}
```

**Rationale:** Consistent naming reduces cognitive friction, improves searchability, and makes codebase accessible to new developers. Community conventions ensure external libraries integrate smoothly.

---

### 4.3 Import Organization

**Principles:**
- Organize imports for clarity and maintainability
- Use type-only imports to prevent circular dependencies
- Group related imports together

**MUST:**
- Use `import type` for types and interfaces
- Group imports in this order:
  1. External packages (Bun, Zod, etc.)
  2. Internal core infrastructure
  3. Internal utilities
  4. Internal types (with `import type`)
  5. Relative imports (./...)
- Sort alphabetically within each group

**SHOULD:**
- Use relative imports for same-feature files
- Use absolute imports from `/src/` for cross-feature imports
- Avoid deep relative paths (`../../../`) - restructure instead
- One import statement per source file

**AVOID:**
- Mixing type and value imports from same source
- Wildcard imports (`import * as`) unless necessary
- Importing entire modules when only part is needed
- Circular dependencies (type-only imports can break cycles)

**Example - Good:**
```typescript
// External packages
import { z } from "zod";

// Internal core
import { EventBus } from "../../core/events/event-bus";
import { StateStore } from "../../core/state/state-store";
import { ClientRegistry } from "../../core/transport/client-registry";

// Internal utilities
import { Logger } from "../../utils/logger";
import {
    getAudioChannel,
    setAudioChannel,
    updateAudioChannel,
} from "../../utils/state-helpers";

// Types (type-only imports)
import type {
    AudioChannelState,
    AudioPauseEvent,
    AudioPlayEvent,
} from "../../types";
```

**Example - Bad:**
```typescript
// DON'T: Mixed imports
import { EventBus } from "../../core/events/event-bus";
import { AudioPlayEvent } from "../../types"; // Should be type-only
import type { StateStore } from "../../core/state/state-store"; // Should be value

// DON'T: Wildcard when not needed
import * as helpers from "../../utils/state-helpers";

// DON'T: Deep relative paths
import { something } from "../../../../../../../core/events/event-bus";
```

**Rationale:** Organized imports improve readability and make dependencies explicit. Type-only imports prevent circular dependency issues and reduce bundle size in build systems that support it.

---

## 5. Functions & Methods

### 5.1 Single Responsibility & Focused Functions

**Principles:**
- Each function should do one thing well
- Extract complex logic into helper functions
- Keep functions short and readable (ideally <50 lines)
- Compose complex operations from simple functions

**MUST:**
- Keep event handlers focused on: validate → update state → broadcast
- Extract business logic to separate helper functions
- Name functions after what they do, not how they do it
- Return early for error cases and guard clauses

**SHOULD:**
- Limit function parameters to 3-4 (use objects for more)
- Write pure functions where possible (same input → same output)
- Keep nesting depth to 2-3 levels maximum
- Extract repeated logic into reusable functions

**AVOID:**
- Functions that do multiple unrelated things
- Side effects in pure functions
- Complex conditional logic inline (extract to named functions)
- Functions with many branches (consider polymorphism or strategy pattern)

**Example - Good:**
```typescript
// Focused handler delegates to helpers
private handleResume(event: AudioResumeEvent): void {
    const { channel } = event.payload;

    if (!this.shouldResume(channel)) {
        return;
    }

    this.resumeChannel(channel);
    this.clientRegistry.broadcast(event);
}

// Extracted validation
private shouldResume(channel: string): boolean {
    const channelState = this.getChannel(channel);

    if (!channelState) {
        this.logger.info("Resume ignored - channel does not exist", { channel });
        return false;
    }

    if (channelState.playing) {
        this.logger.info("Resume ignored - channel already playing", { channel });
        return false;
    }

    return true;
}

// Extracted operation
private resumeChannel(channel: string): void {
    this.stateStore.updateState((state) => {
        return updateAudioChannel(state, channel, (ch) => ({
            ...ch,
            playing: true,
        }));
    });
}
```

**Example - Bad:**
```typescript
// DON'T: Everything in one function
private handleResume(event: AudioResumeEvent): void {
    const { channel } = event.payload;
    const state = this.stateStore.getState();

    if (!state.audio) {
        console.log("No audio state");
        return;
    }

    const channelState = state.audio.channels.get(channel);

    if (!channelState) {
        console.log(`Channel ${channel} does not exist`);
        return;
    }

    if (channelState.playing) {
        console.log(`Channel ${channel} already playing`);
        return;
    }

    // Complex state update logic inline...
    this.stateStore.updateState((s) => {
        const audio = s.audio || { channels: new Map(), masterVolume: 1.0 };
        const channels = new Map(audio.channels);
        const ch = channels.get(channel);
        if (ch) {
            channels.set(channel, { ...ch, playing: true });
        }
        return { ...s, audio: { ...audio, channels } };
    });

    this.clientRegistry.broadcast(event);
}
```

**Rationale:** Small, focused functions are easier to test, debug, understand, and reuse. They make code self-documenting and reduce cognitive load.

---

### 5.2 Early Returns & Guard Clauses

**Principles:**
- Handle error cases and edge conditions first
- Return early to avoid deep nesting
- Keep the "happy path" at the lowest indentation level
- Use guard clauses at function entry

**MUST:**
- Check preconditions at the start of functions
- Return early for null/undefined cases
- Return early for validation failures
- Use `continue` in loops for similar effect

**SHOULD:**
- Order guards from most to least likely to fail
- Log or document why early returns happen
- Keep guard conditions simple (extract complex checks to functions)

**AVOID:**
- Deep nesting of if-else statements
- Multiple levels of indentation for happy path
- Checking for success conditions then wrapping all logic

**Example - Good:**
```typescript
private handleResume(event: AudioResumeEvent): void {
    const { channel } = event.payload;

    // Guard clause - channel doesn't exist
    const channelState = this.getChannel(channel);
    if (!channelState) {
        this.logger.info("Resume ignored - channel does not exist", { channel });
        return;
    }

    // Guard clause - already playing
    if (channelState.playing) {
        this.logger.info("Resume ignored - channel already playing", { channel });
        return;
    }

    // Happy path at base indentation
    this.logger.info("Resuming audio", { channel });
    this.stateStore.updateState((state) => {
        return updateAudioChannel(state, channel, (ch) => ({
            ...ch,
            playing: true,
        }));
    });
    this.clientRegistry.broadcast(event);
}
```

**Example - Bad:**
```typescript
// DON'T: Nested conditions
private handleResume(event: AudioResumeEvent): void {
    const { channel } = event.payload;
    const channelState = this.getChannel(channel);

    if (channelState) {
        if (!channelState.playing) {
            // Happy path buried 2 levels deep
            this.logger.info("Resuming audio", { channel });
            this.stateStore.updateState((state) => {
                return updateAudioChannel(state, channel, (ch) => ({
                    ...ch,
                    playing: true,
                }));
            });
            this.clientRegistry.broadcast(event);
        } else {
            this.logger.info("Resume ignored - already playing", { channel });
        }
    } else {
        this.logger.info("Resume ignored - channel does not exist", { channel });
    }
}
```

**Rationale:** Early returns reduce cognitive complexity by eliminating nesting. The happy path becomes obvious, and error handling is clear and upfront.

---

### 5.3 Function Parameters & Return Values

**Principles:**
- Design function signatures for clarity and type safety
- Use TypeScript types to document contracts
- Prefer returning values over mutating parameters

**MUST:**
- Type all parameters and return values explicitly
- Use readonly for parameters that shouldn't be modified
- Return specific types, not `any` or `unknown`
- Prefer returning new values over void + mutation

**SHOULD:**
- Use object parameters when function takes >3 arguments
- Use destructuring for object parameters
- Return `undefined` for "not found" cases (not `null`)
- Use union return types to represent success/failure states

**AVOID:**
- Mutating parameters (especially objects/arrays)
- Optional parameters in the middle (put at end)
- Boolean flags that change behavior dramatically (split into separate functions)
- Returning different types based on parameters

**Example - Good:**
```typescript
// Clear signature with typed parameters
function updateAudioChannel(
    state: ApplicationState,
    channelId: string,
    updater: (channel: AudioChannelState) => AudioChannelState,
): ApplicationState {
    return updateAudioChannels(state, (channels) => {
        const channel = channels.get(channelId);
        if (channel) {
            channels.set(channelId, updater(channel));
        }
        return channels;
    });
}

// Object parameters for many args
interface CreateChannelOptions {
    channel: string;
    source: AudioSource;
    volume: number;
    loop: boolean;
    effects?: AudioEffect[];
}

function createChannel(options: CreateChannelOptions): AudioChannelState {
    const { channel, source, volume, loop, effects } = options;
    return {
        id: channel,
        source,
        playing: false,
        position: 0,
        volume,
        loop,
        effects: effects || [],
        respectTimeScale: false,
    };
}
```

**Example - Bad:**
```typescript
// DON'T: Mutating parameters
function updateChannel(
    channels: Map<string, AudioChannelState>,
    id: string,
    volume: number
): void {
    const channel = channels.get(id);
    if (channel) {
        channels.set(id, { ...channel, volume }); // Mutates parameter!
    }
}

// DON'T: Boolean flag changes behavior drastically
function getChannels(includeInactive: boolean): AudioChannelState[] {
    // Returns completely different data based on flag
}

// Better: Two separate functions
function getActiveChannels(): AudioChannelState[] { /* ... */ }
function getAllChannels(): AudioChannelState[] { /* ... */ }
```

**Rationale:** Clear signatures make functions self-documenting. Immutable parameters prevent bugs. Specific return types enable better IDE support and compile-time checking.

---

## 6. Error Handling & Logging

### 6.1 Error Handling Strategy

**Principles:**
- Handle errors at appropriate boundaries
- Fail fast for programmer errors, gracefully for user errors
- Log errors with context for debugging
- Never silently swallow errors

**MUST:**
- Use try-catch for external I/O (WebSocket, file system, parsing)
- Validate user input with Zod (don't trust external data)
- Log all caught errors with context using Logger
- Use `Promise.allSettled()` when handling multiple async operations
- Wrap event subscription callbacks in try/catch — a thrown error in an RxJS `Subject.next()` subscriber terminates the Subject, silently breaking all future event delivery to every subscriber on that stream

**SHOULD:**
- Distinguish between recoverable and non-recoverable errors
- Return early for error conditions rather than throwing
- Apply error boundaries at the service subscription level — each service's event handler should catch internally rather than relying on the EventBus to protect other subscribers
- Include relevant context in error messages (clientId, event type, etc.)

**AVOID:**
- Empty catch blocks
- Catching errors just to re-throw them
- Using exceptions for control flow
- Generic error messages without context

**Example - Good:**
```typescript
// In EventBus - catch handler errors, don't propagate
async emit<T>(eventType: string, event: T): Promise<void> {
    const handlers = this.handlers.get(eventType);
    if (!handlers) return;

    const promises: Promise<void>[] = [];

    for (const handler of handlers) {
        try {
            const result = handler(event);
            if (result instanceof Promise) {
                promises.push(result);
            }
        } catch (error) {
            this.logger.error("Error in event handler", {
                eventType,
                error,
            });
        }
    }

    await Promise.allSettled(promises);
}

// In main.ts - validate and handle gracefully
function routeMessage(
    container: Container,
    clientId: string,
    message: string
): void {
    try {
        const parsed = JSON.parse(message);
        const validationResult = eventSchema.safeParse(parsed);

        if (!validationResult.success) {
            logger.error("Invalid event received", {
                clientId,
                errors: validationResult.error.format(),
            });
            return; // Graceful handling
        }

        const eventBus = container.resolve<IEventBus>(TOKENS.EventBus);
        eventBus.emitSync(validationResult.data.type, validationResult.data);
    } catch (error) {
        logger.error("Failed to route message", { clientId, error });
    }
}
```

**Example - Bad:**
```typescript
// DON'T: Silent failure
try {
    processEvent(event);
} catch (error) {
    // Nothing - error lost!
}

// DON'T: Throwing in event handlers
private handlePlay(event: AudioPlayEvent): void {
    if (!event.payload.channel) {
        throw new Error("Channel required"); // Don't throw from handlers!
    }
}

// DON'T: Generic error messages
catch (error) {
    console.error("Error occurred"); // What error? Where? Why?
}
```

**Rationale:** Proper error handling makes systems resilient and debuggable. Errors with context enable fast diagnosis. Graceful degradation keeps the system running when non-critical components fail.

---

### 6.2 Logging Standards

**Principles:**
- Use Logger class for all logging (no direct console.* calls)
- Log important events and errors consistently
- Provide enough context for debugging
- Use appropriate log levels
- Balance verbosity with signal-to-noise ratio

**MUST:**
- Create Logger instance with context for each service/class
- Use `this.logger = new Logger("ServiceName")` in constructor or class field
- Use structured logging with context objects: `logger.info("message", { key: value })`
- Remove all direct `console.log/warn/error/debug` calls
- Use log levels appropriately:
  - `debug` - Development/diagnostic information
  - `info` - Significant state transitions and events
  - `warn` - Recoverable issues, unexpected states
  - `error` - Failures and exceptions

**SHOULD:**
- Log state transitions at info level
- Log validation failures at warn level
- Log system errors at error level
- Include relevant IDs and context objects in structured format
- Keep log messages concise but informative

**AVOID:**
- Logging in tight loops or hot paths
- Logging sensitive data (credentials, tokens)
- Logging entire objects without filtering
- Debug logs in production code without proper log levels

**Example - Good:**
```typescript
export class AudioService {
    private logger = new Logger("AudioService");

    private handlePlay(event: AudioPlayEvent): void {
        const { channel, source, volume } = event.payload;

        this.logger.info("Playing audio", {
            channel,
            source: source.ref,
            volume,
        });

        // Update state...

        this.clientRegistry.broadcast(event);
    }

    private handleError(error: Error, context: Record<string, any>): void {
        this.logger.error("Audio service error", {
            error: error.message,
            stack: error.stack,
            ...context,
        });
    }
}
```

**Example - Bad:**
```typescript
// DON'T: Direct console usage
export class AudioService {
    private handlePlay(event: AudioPlayEvent): void {
        console.log("Playing audio"); // No context!

        // Update state...

        console.log(event); // Dumps entire object
    }
}

// DON'T: Inconsistent logging
private handlePause(event: AudioPauseEvent): void {
    const logger = new Logger("AudioService"); // Creates new logger each call!
    logger.info("Paused");
}
```

**Migration Guide (console.* → Logger):**
```typescript
// Before
console.log(`Audio play: channel=${channel}, source=${source.ref}`);
console.warn("Channel not found");
console.error("Failed to process event:", error);

// After
this.logger.info("Playing audio", { channel, source: source.ref });
this.logger.warn("Channel not found", { channel });
this.logger.error("Failed to process event", { error });
```

**Rationale:** Consistent logging with Logger class enables better filtering, monitoring, and debugging. Structured logging with context objects makes logs searchable and analyzable. Standardization improves maintainability.

---

## 7. Extensibility & Future-Proofing

### 7.1 Adding New Event Types

**Principles:**
- New events should integrate without modifying existing code
- Follow established patterns for consistency
- Maintain backward compatibility where possible

**MUST:**
- Follow this exact process for adding new event types:

**Step-by-Step Process:**

```typescript
// 1. Define type in types.ts
export interface MyNewPayload {
    targetId: string;
    value: number;
}

export type MyNewEvent = Event<"domain.action", MyNewPayload>;

// 2. Define schema in schemas.ts
export const myNewPayloadSchema = z.object({
    targetId: z.string(),
    value: z.number().min(0),
});

export const myNewEventSchema = z.object({
    type: z.literal("domain.action"),
    payload: myNewPayloadSchema,
    metadata: eventMetadataSchema,
});

// 3. Add to eventSchema discriminated union
export const eventSchema = z.discriminatedUnion("type", [
    // existing events...
    myNewEventSchema,
]);

// 4. Create or update service
export class MyService {
    private logger = new Logger("MyService");

    constructor(
        private eventBus: IEventBus,
        private stateStore: IStateStore,
        private clientRegistry: IClientRegistry,
    ) {
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        this.eventBus.on("domain.action", this.handleAction.bind(this));
    }

    private handleAction(event: MyNewEvent): void {
        const { targetId, value } = event.payload;

        this.logger.info("Handling action", { targetId, value });

        // Validate, update state, broadcast
        this.stateStore.updateState((state) => {
            // ... state update
            return state;
        });

        this.clientRegistry.broadcast(event);
    }
}

// 5. Register in main.ts
container.registerFactory(TOKENS.MyService, () => {
    return new MyService(
        container.resolve(TOKENS.EventBus),
        container.resolve(TOKENS.StateStore),
        container.resolve(TOKENS.ClientRegistry),
    );
});

// Also add token to container.ts
export const TOKENS = {
    // ... existing tokens
    MyService: Symbol("MyService"),
};
```

**SHOULD:**
- Group related events by domain prefix (e.g., `audio.*`, `visual.*`)
- Reuse existing payload patterns where applicable
- Document new events in CLAUDE.md
- Add example usage

**Rationale:** Following a defined process ensures new features integrate cleanly, remain testable, and don't break existing functionality. The event-driven architecture makes adding features low-risk.

---

### 7.2 Versioning & Backward Compatibility

**Principles:**
- Plan for schema evolution from the start
- Maintain compatibility for deployed clients
- Use optional fields for non-breaking changes

**MUST:**
- Add optional fields to existing schemas (use `.optional()`)
- Never remove or rename required fields in existing events
- Create new event types for breaking changes (e.g., `audio.play.v2`)

**SHOULD:**
- Provide migration paths in documentation
- Consider adding version field to event metadata for future use
- Deprecate old events before removing them

**AVOID:**
- Removing or renaming required fields in existing events
- Changing payload structure without versioning
- Breaking changes without deprecation period

**Example - Good (Non-breaking change):**
```typescript
// Original
export const audioPlayPayloadSchema = z.object({
    channel: z.string(),
    source: audioSourceSchema,
    volume: z.number().min(0).max(1),
    loop: z.boolean(),
});

// Adding optional field (non-breaking)
export const audioPlayPayloadSchema = z.object({
    channel: z.string(),
    source: audioSourceSchema,
    volume: z.number().min(0).max(1),
    loop: z.boolean(),
    fadeInDuration: z.number().optional(), // New optional field - backward compatible
});
```

**Example - Breaking change (needs new event type):**
```typescript
// If source structure needs to change fundamentally, create new event
export type AudioPlayEventV2 = Event<"audio.play.v2", AudioPlayPayloadV2>;

// Or support both during transition
export type AudioPlayEvent =
    | Event<"audio.play", AudioPlayPayload>
    | Event<"audio.play.v2", AudioPlayPayloadV2>;
```

**Rationale:** Backward compatibility prevents breaking deployed display clients when server updates. Graceful evolution reduces deployment friction and supports gradual rollouts.

---

## 8. Testing Standards

### 8.1 Testing Strategy

**Principles:**
- Write tests for business logic and state transformations
- Use Bun's built-in test runner
- Keep tests isolated and deterministic

**MUST:**
- Use `bun test` for running tests
- Place test files adjacent to source (`foo.ts` → `foo.test.ts`)
- Import from `bun:test`: `import { test, expect } from "bun:test"`
- Test all state helper functions (they're pure and easy to test)

**SHOULD:**
- Test state helpers in isolation (pure functions are easy to test)
- Test service event handlers with mock dependencies
- Test Zod schemas with valid and invalid inputs
- Use descriptive test names: `test("should pause channel when audio.pause event received")`
- Group related tests with `describe()` blocks
- Use shared test data factories from `test-utils/factories.ts` rather than creating ad-hoc helpers in each test file
- Factory functions should follow the `make{Entity}(overrides?)` convention, returning a valid default with optional partial overrides

**Example - Test data factory:**
```typescript
// test-utils/factories.ts
export function makeMetadata(overrides?: Partial<EventMetadata>): EventMetadata {
    return {
        timestamp: Date.now(),
        source: "test",
        ...overrides,
    };
}

export function makeAudioPlayEvent(
    overrides?: Partial<AudioPlayPayload>,
): AudioPlayEvent {
    return {
        type: "audio.play",
        payload: {
            channel: "ambient",
            source: { type: "file", ref: "test.mp3" },
            volume: 0.8,
            loop: false,
            effects: [],
            respectTimeScale: false,
            ...overrides,
        },
        metadata: makeMetadata(),
    };
}
```

**AVOID:**
- Testing implementation details (test behavior, not internals)
- Sharing state between tests
- Flaky tests that depend on timing or external state

**Example - Good:**
```typescript
// state-helpers.test.ts
import { test, expect, describe } from "bun:test";
import {
    getAudioChannel,
    setAudioChannel,
    updateAudioChannel,
} from "./state-helpers";
import type { ApplicationState, AudioChannelState } from "../types";

describe("Audio State Helpers", () => {
    test("should set audio channel in state", () => {
        const initialState: ApplicationState = {};

        const channelState: AudioChannelState = {
            id: "ambient",
            source: { type: "file", ref: "forest.mp3" },
            playing: true,
            position: 0,
            volume: 0.5,
            loop: true,
            effects: [],
            respectTimeScale: false,
        };

        const newState = setAudioChannel(initialState, "ambient", channelState);

        expect(getAudioChannel(newState, "ambient")).toEqual(channelState);
        expect(initialState.audio).toBeUndefined(); // Immutable
    });

    test("should update existing audio channel", () => {
        const initialState: ApplicationState = {
            audio: {
                channels: new Map([
                    ["music", {
                        id: "music",
                        playing: true,
                        volume: 0.8,
                        // ...
                    }],
                ]),
                masterVolume: 1.0,
            },
        };

        const updatedState = updateAudioChannel(
            initialState,
            "music",
            (ch) => ({ ...ch, volume: 0.5 })
        );

        expect(getAudioChannel(updatedState, "music")?.volume).toBe(0.5);
        expect(getAudioChannel(initialState, "music")?.volume).toBe(0.8); // Original unchanged
    });
});
```

**Rationale:** Tests provide confidence in refactoring, document expected behavior, and catch regressions. Pure functions and dependency injection make testing straightforward.

---

## 9. Comments & Documentation

### 9.1 Code Comments

**Principles:**
- Code should be self-documenting through clear naming
- Comments explain "why", not "what"
- Keep comments up-to-date with code

**MUST:**
- Add JSDoc comments to all exported classes, interfaces, and public methods
- Document non-obvious behavior or edge cases
- Explain complex algorithms or business rules

**SHOULD:**
- Use `//` for inline comments
- Use `/** */` JSDoc for documentation
- Keep comments concise and relevant
- Update comments when code changes

**AVOID:**
- Commenting obvious code
- Leaving TODO comments without issues/tickets
- Commented-out code (use version control instead)
- Redundant comments that just restate the code

**Example - Good:**
```typescript
/**
 * Audio service handles audio playback state.
 *
 * Subscribes to audio.* events, updates server state,
 * and broadcasts to connected clients.
 */
export class AudioService {
    /**
     * Resume paused audio on a channel.
     *
     * No-op if channel doesn't exist or is already playing.
     */
    private handleResume(event: AudioResumeEvent): void {
        const { channel } = event.payload;

        // Early return for non-existent or playing channels
        const channelState = this.getChannel(channel);
        if (!channelState || channelState.playing) {
            return;
        }

        this.resumeChannel(channel);
        this.clientRegistry.broadcast(event);
    }
}
```

**Example - Bad:**
```typescript
// DON'T: Redundant comments
export class AudioService {
    // This function handles resume
    private handleResume(event: AudioResumeEvent): void {
        // Get the channel from the payload
        const { channel } = event.payload;

        // Get the channel state
        const channelState = this.getChannel(channel);

        // Check if channel state exists
        if (!channelState) {
            return; // return if not
        }

        // Check if playing
        if (channelState.playing) {
            return; // return if yes
        }

        // Resume the channel
        this.resumeChannel(channel);

        // Broadcast
        this.clientRegistry.broadcast(event);
    }
}
```

**Rationale:** Good comments add value by explaining context, decisions, and non-obvious behavior. Self-documenting code reduces the need for comments. Outdated comments are worse than no comments.

---

### 9.2 README & Architecture Documentation

**MUST:**
- Update `/CLAUDE.md` when adding new patterns or conventions
- Document major architectural decisions
- Include examples for common tasks (adding events, services, etc.)

**SHOULD:**
- Create feature-specific documentation in `/docs/`
- Document event types and their purpose
- Provide diagrams for complex flows
- Keep README focused on getting started

**Rationale:** Documentation reduces onboarding time and preserves architectural knowledge. CLAUDE.md ensures AI assistants understand project conventions.

---

## 10. Performance & Optimization

### 10.1 Premature Optimization

**Principles:**
- Write clear code first, optimize later
- Measure before optimizing
- Focus on algorithmic improvements over micro-optimizations

**MUST:**
- Profile performance issues before fixing them
- Use appropriate data structures (Map for lookups, Array for iteration)
- Avoid N+1 problems in loops

**SHOULD:**
- Use `Promise.allSettled()` for parallel async operations
- Cache expensive computations if called repeatedly
- Use early returns to avoid unnecessary work

**AVOID:**
- Micro-optimizations that harm readability
- Premature caching or memoization
- Complex performance tricks without measurements

**Rationale:** Clear, correct code is more valuable than fast, complex code. Performance issues should be addressed when they're measured, not assumed.

---

## 11. Security Considerations

### 11.1 Input Validation

**Principles:**
- Never trust external input
- Validate at boundaries
- Fail securely

**MUST:**
- Validate all WebSocket messages with Zod schemas
- Sanitize file paths (use Bun.file with relative paths)
- Validate event payloads before processing

**SHOULD:**
- Use allowlists over denylists for validation
- Limit string lengths, array sizes, numeric ranges in schemas
- Log validation failures for monitoring

**AVOID:**
- Trusting client-provided data
- Executing arbitrary code from events
- Exposing internal errors to clients

**Rationale:** The server is the authority and must not trust clients. Validation prevents injection attacks and malformed data from crashing services.

---

## 12. Bun-Specific Patterns

### 12.1 Using Bun APIs

**Principles:**
- Prefer Bun APIs over Node.js equivalents
- Leverage Bun's performance and simplicity
- Stay up-to-date with Bun best practices

**MUST:**
- Use `Bun.serve()` for HTTP/WebSocket server
- Use `Bun.file()` for file operations
- Use `bun test` for testing
- Use `bun run` for scripts

**SHOULD:**
- Use Bun's built-in TypeScript support (no transpilation needed)
- Leverage Bun's fast startup time for development
- Use `--hot` flag for development with hot reload

**AVOID:**
- Using `node:` prefixed imports when Bun equivalent exists
- Express or other frameworks (Bun.serve handles routing)
- ts-node, tsx, or other TypeScript runners
- npm/yarn/pnpm (use `bun install`)

**Example - Good:**
```typescript
// Using Bun.serve() with WebSocket
const server = Bun.serve({
    port: 3000,
    fetch(req, server) {
        const upgraded = server.upgrade(req);
        if (upgraded) return undefined;
        return new Response("Hello");
    },
    websocket: {
        open(ws) {
            // Handle connection
        },
        message(ws, message) {
            // Handle message
        },
        close(ws) {
            // Handle disconnect
        },
    },
});

// Using Bun.file()
const file = Bun.file("./public/audio/track.mp3");
return new Response(file);
```

**Rationale:** Bun provides simpler, faster APIs than Node.js. Using Bun-native features reduces dependencies and improves performance.

---

## Summary

These standards emphasize:

1. **Extensibility** - Event-driven architecture, DI, interface-based design
2. **Reusable Functions** - Pure state helpers, composable operations, strict naming
3. **Readability** - Early returns, guard clauses, clear naming, structured logging
4. **Decoupling** - Events over direct calls, DI over imports, interfaces over concrete classes
5. **Simplicity** - Single responsibility, avoid premature optimization, YAGNI
6. **Best Practices** - TypeScript strict mode, Zod validation, immutability, testing

Following these standards will keep the Squire codebase maintainable, testable, and extensible as it grows.
