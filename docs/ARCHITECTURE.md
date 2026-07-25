# Squire Architecture

A system overview for humans who want to reason about how Squire works, why it's built this way, and where the boundaries are.

---

## What Squire Is

Squire is a D&D session companion. The DM controls a master client — a tablet-first web UI — and sends commands (play music, show an image, start a countdown) through a WebSocket server. The server validates each command, updates its state, and broadcasts the event to all connected display clients, which render audio, visuals, and overlays on a projector or secondary screen.

Everything is local-network. No cloud, no accounts, no database. State lives in memory on the server and is rebuilt from an event log on restart.

---

## The Three Pieces

```
┌──────────────────────┐
│    MASTER CLIENT     │  Tablet browser — DM's control surface
│  (sends commands)    │  Web Components, RxJS, no framework
└──────────┬───────────┘
           │ WebSocket
           ▼
┌──────────────────────┐
│       SERVER         │  Bun.serve() — validates, stores, broadcasts
│   (event router)     │  DI container, EventBus, StateStore, EventStore
└──────────┬───────────┘
           │ WebSocket
           ▼
┌──────────────────────┐
│   DISPLAY CLIENT     │  Projector browser — renders what the DM triggers
│ (renders everything) │  Web Components, audio elements, canvas layers
└──────────────────────┘
```

### Server

The server is a thin event router, not an application server. It:

1. Accepts a WebSocket message from the master client
2. Validates it against a Zod schema (rejects malformed input)
3. Emits the validated event on an internal EventBus
4. Services subscribed to that event type update the StateStore
5. The event is broadcast to all connected clients
6. The event is persisted in the EventStore for replay

The server has no scheduled work, no background loops, no polling. It reacts to events and that's it.

**Key infrastructure:**
- **EventBus** — in-process pub/sub, routes events to services by type
- **StateStore** — holds current application state (audio channels, image layers, clocks). Immutable updates only.
- **EventStore** — append-only event log with declarative replay rules. On client reconnect, the server replays a compressed version of recent events so the client catches up.
- **ClientRegistry** — tracks connected WebSocket clients, handles broadcast
- **DI Container** — symbol-based dependency injection. Services are registered as factories in `main.ts` and resolved by token.

**Services** follow a consistent pattern: constructor-injected with EventBus + StateStore + ClientRegistry, subscribe to a domain's events, update state, broadcast. Each service owns one domain (audio, image, countdown, time).

### Display Client

Receives server events and renders them. Stateless in the sense that it rebuilds entirely from server state on connect/reconnect.

- **ConnectionService** — WebSocket lifecycle, reconnection with backoff
- **EventBus** — local pub/sub (independent of WebSocket — survives disconnections)
- **Domain services** (AudioService, VisualService, ClockService) — subscribe to `server:*` events, maintain observable state via RxJS BehaviorSubjects
- **Web Components** — subscribe to service observables, render to Shadow DOM

### Master Client

The DM's control interface. Sends commands to the server and mirrors display state so the DM can see what players see.

- Same ConnectionService and EventBus as display
- **AssetService** — fetches available audio/image files from server API
- **EventBuilder** — constructs well-formed events for sending
- **Domain services** — mirror display state using the same shared reducer functions
- **Canvas overlay** — interactive handles over a preview iframe for drag-to-position
- **Scene system** — save/restore named snapshots of current state (client-side, persisted to server)

---

## Event System

### Event Shape

Every event has three fields:

```typescript
{
  type: "audio.play",           // dot-notation domain.action
  payload: { channel, source, volume, loop, ... },
  metadata: { timestamp, source }
}
```

Types are defined in `server/src/types.ts` as discriminated unions. Zod schemas in `server/src/schemas.ts` validate at the boundary.

### Event Flow

```
Master UI action
  → EventBuilder constructs event
  → ConnectionService sends via WebSocket
  → Server validates with Zod
  → EventBus.emit() routes to service
  → Service updates StateStore
  → ClientRegistry.broadcast() sends to all clients
  → EventStore.append() persists for replay
  → Display client EventBus routes to service
  → Service updates BehaviorSubject
  → Component re-renders from observable
```

### Event Domains

| Domain | Prefix | Examples |
|--------|--------|----------|
| Audio | `audio.*` | `audio.play`, `audio.stop`, `audio.volume` |
| Images | `visual.image.*` | `visual.image.set`, `visual.image.transform`, `visual.image.effect` |
| Clocks | `ui.clock.*` | `ui.clock.create`, `ui.clock.start`, `ui.clock.pause` |
| Time | `time.*` | `time.scale_changed` |
| Scenes | (client-only) | Save/load snapshots, no server event types yet |

### EventStore Replay

The EventStore uses a declarative rule system (`replay-configs.ts`) to compress event history. Each creation event declares how subsequent mutations affect it:

- **fold** — merge fields into the creation event (position updates fold into image.set)
- **replace** — keep only the latest (config changes)
- **append** — accumulate in order (clock start/pause/adjust timeline)
- **remove** — delete entity from replay (destroy events)

On reconnect, clients receive one compressed creation event per entity rather than the full mutation history.

---

## State Management

### Server

State lives in a `StateStore` singleton. All updates go through `stateStore.updateState(fn)` where `fn` is a pure function that returns new state. Direct mutation is prohibited — Maps are copied before modification, objects are spread.

State helper functions (`get*`, `set*`, `update*`, `remove*`) in `utils/state-helpers.ts` handle the immutable copy mechanics.

### Client

Client services hold state in RxJS `BehaviorSubject`s. Same immutability rules apply — `new Map(existing)` before mutation, then `.next(newMap)`.

Both display and master clients handle the same event types. To avoid duplicating state transformation logic, shared **reducer functions** live in `shared/state/`:

```
applyAudioPlay(channels, event) → channels
applyImageSet(layers, event) → layers
applyClockCreate(clocks, event) → clocks
```

Convention: `apply{Domain}{Action}`. Pure functions, tested once, used by both clients.

---

## Client Architecture

### No Framework

Both clients use vanilla Web Components (Custom Elements + Shadow DOM) with RxJS for state management. No React, no Vue, no build framework. Bun serves the TypeScript directly.

### Component Pattern

- **BaseComponent** — abstract class extending HTMLElement, provides `subscribe()` for automatic RxJS cleanup on disconnect, `destroy$` Subject for `takeUntil` pattern
- **Services own state**, components own view. Components never hold business logic.
- **Container + presentational** pattern: container components coordinate children and talk to services; presentational components receive data via attributes/properties and emit CustomEvents upward

### CSS

- External `.css` files for components with >20 lines of CSS
- `getStyles()` method for small components
- Shared form/button styles in `common.css`, adopted via Shadow DOM
- All values use CSS custom properties from `theme.css`

---

## Dependency Injection

### Server

Symbol-based tokens in `TOKENS` object. Services registered in `main.ts`:

```typescript
container.registerFactory(TOKENS.AudioService, () =>
  new AudioService(
    container.resolve(TOKENS.EventBus),
    container.resolve(TOKENS.StateStore),
    container.resolve(TOKENS.ClientRegistry),
  )
);
```

Core infrastructure (EventBus, StateStore) registered as instances. Feature services registered as factories.

### Client

`ServiceRegistry` — simple string-keyed singleton map. Services instantiated in `main.ts` in dependency order, then registered. Components resolve via `ServiceRegistry.get<T>(key)`.

---

## Key Design Decisions

**Why event-driven?** Loose coupling. Adding a new feature (clocks, scenes) means adding a service that subscribes to new event types. Nothing existing changes. The EventBus doesn't know or care what services exist.

**Why no framework?** The display client is essentially a media renderer — audio elements and canvas layers. The master client is a control panel. Neither benefits from virtual DOM diffing or component lifecycles that frameworks provide. Web Components give us encapsulation without the weight.

**Why RxJS?** Observable state with automatic cleanup fits the Web Components lifecycle well. `BehaviorSubject` gives current-value access for sync reads and stream access for reactive updates. `takeUntil(destroy$)` prevents subscription leaks.

**Why client-computed state for clocks?** The server relays lifecycle events (start, pause, adjust) but doesn't tick. Clients compute remaining time from `duration - elapsed - (now - startedAt)`. This eliminates server tick loops and per-second broadcasts.

**Why shared reducers?** Both clients need to maintain the same state from the same events. Without shared reducers, the logic gets written twice and drifts. The `apply{Domain}{Action}` pattern ensures one source of truth for event-to-state transformations.

---

## File Structure

```
server/
├── src/
│   ├── core/                    # Infrastructure
│   │   ├── di/                  #   DI container + tokens
│   │   ├── events/              #   EventBus + EventStore + replay configs
│   │   ├── state/               #   StateStore
│   │   ├── transport/           #   ClientRegistry, WebSocket handling
│   │   └── http/                #   Static file serving, API routes
│   ├── services/                # Domain services
│   │   ├── audio/               #   Audio playback state
│   │   ├── image/               #   Image layer state
│   │   ├── countdown/           #   Countdown clock state
│   │   └── time/                #   Time scale state
│   ├── utils/                   # Logger, state helpers
│   ├── types.ts                 # All TypeScript types (discriminated unions)
│   ├── schemas.ts               # All Zod schemas (runtime validation)
│   └── main.ts                  # Entry point, DI registration

ts-web-client/
├── src/
│   ├── shared/                  # Code shared by both clients
│   │   ├── components/          #   BaseComponent, sq-display, sq-layer render primitives
│   │   ├── services/            #   EventBus, AppStore, ConnectionService, image/layer/sound/font/asset
│   │   ├── state/               #   Shared reducers (apply{Domain}{Action})
│   │   ├── events/              #   EventBuilder
│   │   ├── effects/             #   Effect chain, definitions, presets
│   │   ├── scene/               #   Scene types
│   │   ├── constants/           #   Display, drag, layer constants
│   │   ├── utils/               #   Logger, audio/geometry helpers
│   │   └── test-utils/          #   Test factories
│   ├── gestures/                # Gesture recognition — stands alone (pointer tracking, recognizers)
│   ├── display/                 # Display client
│   │   ├── components/          #   sq-stage
│   │   └── services.ts          #   Wiring (all services shared; display owns none exclusively)
│   ├── master/                  # Master client
│   │   ├── components/          #   Control panels (workspace, palette, settings, layer-handle)
│   │   └── services/            #   Master-owned services (settings, panel-transform) + wiring
│   └── sandbox/                 # Dev playground for gestures

scripts/
└── serve.ts                     # Runs server + client concurrently
```

---

## Adding a New Feature Domain

The steps are always the same:

1. **Types** — add payload interface + event type to `server/src/types.ts`
2. **Schemas** — add Zod schema to `server/src/schemas.ts`, add to `eventSchema` union
3. **Server service** — create in `server/src/services/{domain}/`, subscribe to events, update state, broadcast
4. **Register** — add token to `TOKENS`, register factory in `main.ts`
5. **Shared reducer** — create `shared/state/{domain}-state.ts` with `apply{Domain}{Action}` functions
6. **Client services** — display and master services import shared reducers
7. **Components** — display renderer + master controls
8. **EventStore replay** — add config in `replay-configs.ts` if the domain has persistent entities
