# Client Standards

Rules for writing client code (Display and Master). Use alongside `CODE_STYLE.md` (shared rules) and `SERVER_STANDARDS.md` (server rules).

---

## 1. Service Architecture

No DI container on the client. Services are module-level singletons created in each client's `main.ts` and accessed via direct imports:

```typescript
// main.ts — creates and exports singletons
const eventBus = new EventBus();
const connection = new ConnectionService(SERVER_URL, "display");
const store = new AppStore(eventBus, (event) => connection.send(event));
connection.bindStore(store);
export { store, eventBus, connection };

// Components import directly
import { store, eventBus } from "../main.ts";
```

**Rules:**
- Create services in `main.ts` in dependency order
- Export as named constants — never re-instantiate
- Components never create service instances
- State lives in services, not in components or `main.ts` handlers

---

## 2. AppStore

`AppStore` (`@core/store.ts`) is the central reactive state container. It holds all domain state as `BehaviorSubject` observables and routes events to pure reducers in `@state/`.

**Observables:** `channels$`, `layers$`, `clocks$`, `timeScale$`, `clientId$`
**Sync getters:** `channels`, `layers`, `clocks`, `timeScale`, `clientId` (read `.value`)

**Methods:**
- `dispatch(event)` — apply locally + send to server (optimistic update)
- `applyEvent(event)` — apply locally only (for incoming server events)
- `applyReplay(events)` — batch state hydration from server replay
- `reset()` — clear all state (called before replay)

**Rules:**
- `BehaviorSubject` for all stateful observables
- Expose `.asObservable()` to consumers — never expose Subject directly
- Name observables with `$` suffix: `channels$`, `layers$`
- Immutable updates: `new Map(existing)` before mutation, then `.next(newMap)`
- Provide sync getters alongside observables for imperative reads

---

## 3. Shared Reducers

When both clients handle the same event types, state transformation lives in `@state/{domain}-state.ts`.

**Convention:** `apply{Domain}{Action}(map, event) → map`

Each reducer takes a `Map<string, State>` and a typed event, returns a new map. Pure functions — no side effects, no service access.

```typescript
// @state/audio-channel-state.ts
export function applyAudioStop(channels: Map<string, AudioChannelState>, event: AudioStopEvent): Map<string, AudioChannelState> {
    const next = new Map(channels);
    next.delete(event.payload.channel);
    return next;
}

// AppStore routes events to these reducers
```

---

## 4. Event-Driven Communication

### 4.1 EventBus

Client-side `EventBus` (`@core/event-bus.ts`) uses RxJS Subject + filter for strongly typed pub/sub:

- `on<T>(type)` — subscribe to a specific event type with full type narrowing
- `onPrefix(prefix)` — subscribe to events by prefix (e.g., `"audio."`)
- `all$()` — all events
- `emit(event)` — broadcast locally

### 4.2 ConnectionService

`ConnectionService` (`@core/connection-service.ts`) manages the WebSocket lifecycle:

- Exponential backoff reconnection (1s base, 2x multiplier, 30s max)
- `state$` observable: `"disconnected" | "connecting" | "connected" | "reconnecting"`
- Server protocol: `system.connected` → replay events (array) → live events (single objects)
- Validates incoming events with Zod before processing
- On reconnect, server sends full state — `store.reset()` then `store.applyReplay()`, not incremental merge

**Rules:**
- EventBus is local and WebSocket-independent — subscriptions survive disconnections
- Never build reconnection logic in individual services or components
- Never assume WebSocket is connected — check before sending

### 4.3 EventBuilder

`EventBuilder` (`@events/event-builder.ts`) provides static factory methods for type-safe event construction. All events include `metadata: { timestamp: Date.now(), source: "master-client" }`.

```typescript
// Static methods — no instantiation needed
const event = EventBuilder.audioPlay({ channel: "music", source, volume: 0.8 });
store.dispatch(event);
```

---

## 5. Web Components

### 5.1 BaseComponent

All components extend `BaseComponent` (`@core/base-component.ts`), which provides:

- Automatic Shadow DOM creation
- `protected abstract template(): TemplateResult` — returns lit-html template
- `protected update(): void` — renders template into shadow root
- `protected subscribe<T>(obs$, handler): void` — auto-cleanup via `takeUntil(destroy$)`
- `protected adoptStyles(...styles): void` — adopts CSS into shadow root
- Automatic cleanup on disconnect via `destroy$` Subject

```typescript
export class MyComponent extends BaseComponent {
    connectedCallback(): void {
        super.connectedCallback();
        this.adoptStyles(STYLES);
        this.subscribe(store.channels$, () => this.update());
        this.update();
    }

    protected template(): TemplateResult {
        return html`<div>Channels: ${store.channels.size}</div>`;
    }
}
```

**Rules:**
- Extend `BaseComponent`, never `HTMLElement` directly
- Always call `super.connectedCallback()` and `super.disconnectedCallback()`
- Use `this.subscribe()` for all observable subscriptions — never subscribe manually
- Register components in `main.ts` with `customElements.define()`

### 5.2 Component Responsibilities

- Components are pure presentation — view logic only
- State flows: Server → AppStore → Components → DOM
- No business logic in components — delegate to services or dispatch events

### 5.3 Component Communication

- HTML attributes for string props (kebab-case)
- JavaScript properties for complex data (camelCase)
- `CustomEvent` with `{ bubbles: true, composed: true }` for child → parent
- AppStore for shared state — avoid deep prop drilling
- Slots for flexible composition
- Never access child component internals directly

### 5.4 Container + Child Pattern

- **Container** (e.g., `AudioControls`): coordinates children, aggregates state, dispatches events via `store.dispatch()`
- **Child** (e.g., `VolumeControl`): single-responsibility UI, emits CustomEvents upward

---

## 6. Observable Patterns

### 6.1 Subject Types

- `BehaviorSubject<T>` for state with initial value (channels, layers, connection status)
- `Subject<T>` for one-shot events with no "current value" (actions, notifications)
- Never `ReplaySubject` unless you specifically need N-value replay

### 6.2 Derived Observables

Create as `private readonly` class fields — not inside getter methods. A getter creates a new pipeline per call, causing unbounded subscriptions:

```typescript
// Good — stable reference
private readonly activeChannels$ = this.channels$.pipe(
    map(channels => [...channels.values()].filter(ch => ch.playing)),
    distinctUntilChanged((a, b) => a.length === b.length && a.every((ch, i) => ch === b[i])),
);

getActiveChannels$(): Observable<AudioChannelState[]> {
    return this.activeChannels$;
}
```

### 6.3 Reactive Pipelines

For stateful event processing (pointer tracking, gesture recognition, animation), prefer composed functions returning Observables over imperative classes with mutable fields.

**Structure:**
- Factory function returning `Observable<T>`, not a class with `events$`
- `scan` for state accumulation — state lives in the accumulator, not class fields
- `tap` for side effects — isolated from the pure reduction
- `map` to project internal state to the public type
- Pure reducer functions, testable in isolation without DOM

```typescript
// Good — composed pipeline, state in scan, effects in tap
function trackedPointers$(element: HTMLElement): Observable<PointerSnapshot> {
    return pointers$(element).pipe(
        mergeMap(pointerLifecycle$),
        scan(reduceTracker, emptyState()),
        tap(applyEffects),
        map(toSnapshot),
        share(),
    );
}
```

**When classes are appropriate:** Services that manage long-lived subscriptions, expose `BehaviorSubject` state, and need explicit lifecycle (`ConnectionService`, `AppStore`). The distinction: services are stateful singletons; pipelines are data transformations.

**Code should mirror the shape of the concept it implements:**
- Start from the consumer's contract. Write the public surface first, then work backward.
- If the concept is a sequence of stages, the code should be a chain — not functions calling each other imperatively.
- Each step in a chain does one job. If it branches into two concerns, split it.
- Flatten nested scopes by attaching context to the value flowing through (`{ result, context }`), not by closing over variables.
- Separate transformations from side effects — make the distinction visible.
- The top-level chain should read as the full design. If understanding it requires reading the internals, the boundaries are wrong.

### 6.4 Error Boundaries

A thrown error in an RxJS `Subject.next()` subscriber terminates the Subject permanently. Wrap every EventBus subscription handler in try/catch:

```typescript
eventBus.on('audio.play').subscribe((event) => {
    try {
        this.handleAudioEvent(event);
    } catch (error) {
        this.logger.error('Failed to handle audio event', { type: event.type, error: String(error) });
    }
});
```

---

## 7. CSS

### 7.1 Strategy

Inline CSS strings passed to `adoptStyles()`:

```typescript
const STYLES = `
:host { display: block; width: 100%; }
.container { padding: var(--spacing-md); }
`;

connectedCallback(): void {
    super.connectedCallback();
    this.adoptStyles(STYLES);
}
```

For larger stylesheets, extract to an adjacent `.css` file and import:

```typescript
import componentCss from "./my-component.css" with { type: "text" };
this.adoptStyles(componentCss);
```

### 7.2 Theme

- CSS custom properties for all values — never hardcode colors or spacing
- Shadow DOM for reusable components (buttons, cards, modals)
- Light DOM for layout components (page containers, grids)

### 7.3 Accessibility

- Semantic HTML elements (header, nav, main, section)
- ARIA labels for custom controls
- 4.5:1 color contrast minimum
- Keyboard navigation (Tab, Enter, Escape)
- Focus indicators for interactive elements
- No div buttons — use `<button>`

---

## 8. Component Creation Workflow

Before writing code:
1. What domain? (audio, image, timing)
2. Container or presentational?
3. What state does it need from AppStore?
4. What events does it emit/dispatch?

**Steps:**
1. Create component file in `{client}/components/{domain}/`
2. Extend `BaseComponent`, implement `template()`
3. Subscribe to AppStore observables in `connectedCallback()`
4. Register in `main.ts` with `customElements.define()`
5. If new server events needed: types in `server/src/types.ts`, schemas in `server/src/schemas.ts`, add to `eventSchema`, add `EventBuilder` method

---

## 9. Code Organization

```
ts-web-client/src/
├── core/               # BaseComponent, EventBus, AppStore, ConnectionService
├── state/              # Shared reducers: audio-channel-state, layer-state, clock-state
├── events/             # EventBuilder
├── effects/            # Effect chain, definitions, presets
├── gestures/           # Pointer tracking, recognizers (drag, pinch)
├── scene/              # Scene types
├── constants/          # Display, drag, layer constants
├── utils/              # Logger, audio helpers
├── display/            # Display client entry point + components
└── master/             # Master client entry point + components
```

- Kebab-case files, PascalCase classes, camelCase functions
- One component per file
- Files under 500 lines
- Co-locate tests: `foo.ts` → `foo.test.ts`
- Group imports: external → `@core` → `@state`/`@events`/etc. → types (with `import type`)

---

## 10. Refactoring Priorities

When reviewing code for cleanup, address in this order:
1. **Correctness bugs** — logic errors, lost state
2. **Architectural violations** — shared code importing domain code
3. **Duplicated logic** — same event handler logic in display and master
4. **Missing abstractions** — inline CSS, hardcoded values
5. **Naming/consistency** — import order, naming conventions

### Dependency Direction

- `core/`, `state/`, `events/`, `effects/` must never import from `master/` or `display/`
- Data flows downward: AppStore → domain component → attribute → shared component
