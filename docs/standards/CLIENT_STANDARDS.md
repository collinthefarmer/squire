# Client Standards

Rules for writing client code (Display and Master). Use alongside `CODE_STANDARDS.md`.

---

## 1. Service-Driven State

- Services own all state and business logic
- Components are pure presentation — view only
- State flows: Server → Services → Components → DOM
- RxJS observables provide reactive updates

**Rules:**
- `BehaviorSubject` for all stateful observables
- Expose `.asObservable()` to consumers — never expose Subject directly
- Name observables with `$` suffix: `channels$`, `layers$`
- Immutable updates: `new Map(existing)` before mutation, then `.next(newMap)`
- Provide sync getters alongside observables: `getChannel(id)` reads `.value`

```typescript
export class AudioService {
  private channels$ = new BehaviorSubject<Map<string, AudioChannelState>>(new Map());

  getChannels$(): Observable<Map<string, AudioChannelState>> {
    return this.channels$.asObservable();
  }

  getChannel(id: string): AudioChannelState | undefined {
    return this.channels$.value.get(id);
  }
}
```

---

## 2. Event-Driven Communication

- Server events: WebSocket → ConnectionService → EventBus → Services
- Prefix server events with `server:` (`server:audio.play`)
- Prefix client-only events with `client:` (`client:modal.open`)
- Validate server messages with Zod before processing
- Clean up subscriptions in `disconnectedCallback()`
- Use wildcard patterns: `server:audio.*`

---

## 3. Web Components

### 3.1 Lifecycle

- Extend `BaseComponent` (not HTMLElement directly)
- Call `super.connectedCallback()` and `super.disconnectedCallback()`
- Create Shadow Root in constructor
- Use `static observedAttributes` for reactive HTML attributes
- Register components manually in `main.ts` with `customElements.define()`
- Clean up in `disconnectedCallback()` — BaseComponent handles subscription cleanup automatically

### 3.2 BaseComponent

Provides automatic RxJS cleanup via `takeUntil(destroy$)`:

```typescript
export class AudioPlayer extends BaseComponent {
  connectedCallback(): void {
    super.connectedCallback();
    const service = ServiceRegistry.get<AudioService>('AudioService');
    this.subscribe(service.getChannels$(), (channels) => this.render(channels));
  }

  protected render(channels?: Map<string, AudioChannelState>): void {
    if (!channels) return;
    this.shadowRoot!.innerHTML = `<div>Channels: ${channels.size}</div>`;
  }
}
```

Use `this.subscribe()` — never subscribe to observables manually without cleanup.

### 3.3 Shadow DOM vs Light DOM

- Shadow DOM for reusable components (buttons, cards, modals)
- Light DOM for layout components (page containers, grids)

---

## 4. ServiceRegistry

- Services are singletons registered in `ServiceRegistry`
- Resolve with `ServiceRegistry.get<T>(key)` — type-safe with generics
- Initialize in `main.ts` in dependency order (EventBus first)
- Constructor injection for service dependencies
- Never create service instances in components

---

## 5. Observable Patterns

### 5.1 Subject Types

- `BehaviorSubject<T>` for state with initial value (channels, layers, connection status)
- `Subject<T>` for one-shot events with no "current value" (actions, notifications)
- Never `ReplaySubject` unless you specifically need N-value replay (no current use case)

### 5.2 Derived Observables

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

### 5.3 Reactive Pipelines

For stateful event processing (pointer tracking, gesture recognition, animation), prefer composed functions returning Observables over imperative classes with mutable fields.

**Structure:**
- Factory function returning `Observable<T>`, not a class with `events$`
- `scan` for state accumulation — state lives in the accumulator, not class fields
- `tap` for side effects — isolated from the pure reduction
- `map` to project internal state to the public type
- Pure reducer functions, testable in isolation without DOM

**Why:** A class with switch/case handlers and mutable state hides the data flow. A pipeline makes each transformation visible and composable. State in `scan` is replaced, not mutated. Side effects in `tap` are explicit, not scattered through method bodies.

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

// Avoid — imperative class wrapping an Observable
class PointerTracker {
    private state = ClaimState.IDLE;
    private readonly activePointers = new Map();
    readonly events$: Observable<PointerSnapshot>;
    // switch/case in every handler, side effects mixed with state updates
}
```

**When classes are appropriate:** Services that manage long-lived subscriptions, expose `BehaviorSubject` state, and need explicit lifecycle (`ConnectionService`, `AppStore`). The distinction: services are stateful singletons; pipelines are data transformations.

### 5.4 Error Boundaries

A thrown error in an RxJS `Subject.next()` subscriber terminates the Subject permanently. Wrap every EventBus subscription handler in try/catch:

```typescript
this.eventBus.on('server:audio.*', (event: AudioEvent) => {
    try {
        this.handleAudioEvent(event);
    } catch (error) {
        this.logger.error('Failed to handle audio event', { type: event.type, error: String(error) });
    }
});
```

---

## 6. Connection Resilience

- ConnectionService handles reconnection with exponential backoff
- EventBus is local and WebSocket-independent — subscriptions survive disconnections
- On reconnect, server sends full state sync — services accept as fresh replacement, not incremental merge
- Never build reconnection logic in individual services
- Never assume WebSocket is connected — check before sending

---

## 7. Component Communication

- HTML attributes for string props (kebab-case)
- JavaScript properties for complex data (camelCase)
- `CustomEvent` with `{ bubbles: true, composed: true }` for child→parent
- Services for shared state — avoid deep prop drilling
- Slots for flexible composition
- Never access child component internals directly

---

## 8. TypeScript

- `strict: true` in tsconfig
- `import type` for types and interfaces
- No `any` — use `unknown` for truly dynamic
- Branded types for domain IDs: `type ChannelId = Brand<string, 'ChannelId'>`
- For typed dispatch maps in event handlers with 4+ cases, see `CODE_STANDARDS.md` §6.3

---

## 9. CSS

### 9.1 Strategy

- External `.css` file when styles exceed ~20 lines — adjacent to component: `my-component.css`
- `getStyles()` method for <20 lines
- Never mix both in one component

### 9.2 Theme

- CSS custom properties for all values — never hardcode colors or spacing
- Adopt `common.css` via `cssSheet(commonCss)` for shared form/button styles
- `common.css` covers: buttons, selects, range sliders, checkboxes, text inputs, layout helpers, typography
- For computed alpha: use `alpha()` helper from `theme.ts`

### 9.3 Accessibility

- Semantic HTML elements (header, nav, main, section)
- ARIA labels for custom controls
- 4.5:1 color contrast minimum
- Keyboard navigation (Tab, Enter, Escape)
- Focus indicators for interactive elements
- No div buttons — use `<button>`

---

## 10. Component Creation Workflow

### 10.1 Planning

Before writing code:
1. What domain? (audio, image, timing)
2. Container or presentational?
3. What state does it manage? (local UI vs service subscriptions)
4. What events does it emit/listen for?
5. Document component API: attributes, events emitted, slots

### 10.2 Container + Child Pattern

- **Container** (e.g., `AudioControls`): coordinates children, aggregates state, sends server events via EventBuilder
- **Child** (e.g., `VolumeControl`): single-responsibility UI, emits CustomEvents upward

### 10.3 Registration

Add to appropriate `main.ts`:
```typescript
import { MyComponent } from "./components/{domain}/{component-name}";
customElements.define("my-component", MyComponent);
```

### 10.4 Style Integration

```typescript
import commonCss from "@styles/common.css" with { type: "text" };
import componentCss from "./my-component.css" with { type: "text" };
this.adoptStyles(cssSheet(commonCss), cssSheet(componentCss));
```

### 10.5 Server-Side Integration

When a new component needs new server events:
1. Types in `server/src/types.ts` — payload interface + event type + domain union
2. Schemas in `server/src/schemas.ts` — payload schema + event schema + add to `eventSchema`
3. Server service if needed
4. EventBuilder method in client

---

## 11. Refactoring Priorities

When reviewing code for cleanup, address in this order:
1. **Correctness bugs** — logic errors, lost state
2. **Architectural violations** — shared components importing domain code
3. **Duplicated logic** — same event handler logic in display and master
4. **Missing abstractions** — inline CSS, hardcoded values
5. **Naming/consistency** — import order, JSDoc

### 11.1 Dependency Direction

- `shared/components/` must never import from `@master/*` or `@display/*`
- Pass domain data into shared components via attributes
- Data flows downward: service → domain component → attribute → shared component

### 11.2 Shared Reducers

When both clients handle the same event type, state transformation **must** live in `shared/services/{domain}-state.ts`:

```typescript
// shared/services/audio-channel-state.ts
export function applyAudioStop(channels, channel, trackId) { /* once */ }

// Both services delegate:
this.channels$.next(applyAudioStop(this.channels$.value, channel, trackId));
```

### 11.3 Canvas Overlay Integration

To make a new object type interactive on the canvas:
1. Service exposes `getCanvasObjects$(): Observable<CanvasObject[]>`
2. Add observable to `combineLatest` merge in `canvas-overlay.ts`
3. Add transform routing in `handleMouseUp`

---

## 12. Code Organization

```
ts-web-client/src/
├── shared/
│   ├── components/base/     # BaseComponent
│   ├── services/            # EventBus, ConnectionService, reducers
│   ├── utils/               # State helpers
│   └── styles/              # Theme, common.css
├── display/
│   ├── components/          # audio-player, visual-renderer, clock-renderer
│   └── services/            # AudioService, VisualService, ClockService
└── master/
    ├── components/          # audio/, image/, clock/, scene/, canvas/
    └── services/            # EventBuilder, AssetService, domain services
```

- Kebab-case files, PascalCase classes, camelCase functions
- One component per file
- Files under 500 lines
- Co-locate tests
- Group imports: external → core → utils → types (with `import type`)
