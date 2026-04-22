# Squire Client Architecture Standards

This document defines architecture and implementation standards for the Squire web clients (Display and Master). These standards emphasize **service-driven state management**, **composable Web Components**, **type safety**, and **web standard APIs** without frameworks.

All client code should follow these standards alongside `/docs/CODE_STANDARDS.md` for consistency.

---

## 1. Architecture Principles

### 1.1 Service-Driven State Management

**Principles:**
- Services own all application state and business logic
- Components are pure presentation layer (view only)
- State flows unidirectionally: Server → Services → Components → DOM
- RxJS observables provide reactive state updates

**MUST:**
- Keep all business logic in services, never in components
- Use RxJS `BehaviorSubject` for all stateful observables
- Expose observables (not subjects) to external consumers
- Update state immutably (new references)

**SHOULD:**
- Name observable fields with `$` suffix (`channels$`, `layers$`, `connection$`)
- Provide both sync getters and async observables for state access
- Use RxJS operators for state transformations (map, filter, combineLatest)
- Log state transitions for debugging

**AVOID:**
- Storing application state in component private fields
- Components calling other components directly
- Two-way data binding patterns
- Mutable state updates

**Example - Good:**
```typescript
// Service owns state
export class AudioService {
  private logger = new Logger('AudioService');
  private channels$ = new BehaviorSubject<Map<string, AudioChannelState>>(new Map());

  getChannels$(): Observable<Map<string, AudioChannelState>> {
    return this.channels$.asObservable();
  }

  getChannel(id: string): AudioChannelState | undefined {
    return this.channels$.value.get(id);
  }

  private handlePlay(event: AudioPlayEvent): void {
    const { channel, source, volume, loop } = event.payload;

    this.logger.info('Playing audio', { channel, source: source.ref });

    // Immutable update
    const current = this.channels$.value;
    const updated = new Map(current);
    updated.set(channel, {
      id: channel,
      source,
      playing: true,
      volume,
      loop,
      effects: [],
      respectTimeScale: false,
    });

    this.channels$.next(updated);
  }
}

// Component subscribes to state
export class AudioPlayer extends BaseComponent {
  connectedCallback(): void {
    super.connectedCallback();

    const audioService = ServiceRegistry.get<AudioService>('AudioService');
    this.subscribe(audioService.getChannels$(), (channels) => {
      this.render(channels);
    });
  }

  private render(channels: Map<string, AudioChannelState>): void {
    // Pure render based on state
  }
}
```

**Example - Bad:**
```typescript
// DON'T: Component owns state and business logic
export class AudioPlayer extends BaseComponent {
  private channels = new Map<string, AudioChannelState>(); // State in component!

  handleServerEvent(event: AudioEvent): void {
    // Business logic in component!
    if (event.type === 'audio.play') {
      this.channels.set(event.payload.channel, {
        playing: true,
        // ... setup
      });
      this.render();
    }
  }
}
```

**Rationale:** Service-driven architecture enables shared state across multiple components, improves testability through dependency injection, and maintains clear separation of concerns. Components become pure view functions that are easy to reason about.

---

### 1.2 Event-Driven Communication

**Principles:**
- All server communication flows through WebSocket → ConnectionService → EventBus → Services
- Server events prefixed with `server:` to distinguish from client events
- EventBus provides decoupled pub/sub communication
- Wildcard pattern matching reduces boilerplate

**MUST:**
- Prefix all server events with `server:` (e.g., `server:audio.play`)
- Prefix client-only events with `client:` (e.g., `client:modal.open`)
- Validate server messages with Zod schemas before processing
- Clean up event subscriptions in component `disconnectedCallback()`

**SHOULD:**
- Use wildcard patterns for related events (`server:audio.*`)
- Use RxJS `Subject` for EventBus implementation
- Log event emissions at appropriate levels
- Handle event errors gracefully without crashing

**AVOID:**
- Direct WebSocket access outside ConnectionService
- Silent event handler failures
- Synchronous blocking in event handlers
- Global event listeners without cleanup

**Example - Good:**
```typescript
export class ConnectionService {
  private ws: WebSocket | null = null;
  private logger = new Logger('ConnectionService');

  constructor(private eventBus: EventBus) {}

  connect(url: string): void {
    this.ws = new WebSocket(url);

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);

        // Validate with Zod
        const result = serverEventSchema.safeParse(message);
        if (!result.success) {
          this.logger.error('Invalid event received', {
            errors: result.error.format(),
          });
          return;
        }

        // Route to EventBus with server: prefix
        this.eventBus.emit(`server:${result.data.type}`, result.data);
      } catch (error) {
        this.logger.error('Failed to process message', { error });
      }
    };
  }
}

export class AudioService {
  constructor(private eventBus: EventBus) {
    // Wildcard subscription to all audio events
    this.eventBus.on('server:audio.*', this.handleAudioEvent.bind(this));
  }

  private handleAudioEvent(event: AudioEvent): void {
    switch (event.type) {
      case 'audio.play':
        this.handlePlay(event as AudioPlayEvent);
        break;
      case 'audio.stop':
        this.handleStop(event as AudioStopEvent);
        break;
    }
  }
}
```

**Example - Bad:**
```typescript
// DON'T: Direct WebSocket access, no validation
export class AudioPlayer extends BaseComponent {
  connectedCallback(): void {
    const ws = new WebSocket('ws://localhost:3000'); // Direct access!

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data); // No validation!
      this.play(data); // Throws if data is invalid
    };
  }
}
```

**Rationale:** Centralized event handling through EventBus enables loose coupling and makes event flow traceable. Validation prevents invalid data from propagating through the system. The server: prefix prevents naming collisions.

---

## 2. Web Components Standards

### 2.1 Custom Elements & Lifecycle

**Principles:**
- Use Custom Elements API for all UI components
- Shadow DOM for reusable components with style encapsulation
- Light DOM for layout/document-level components
- Lifecycle hooks manage setup and cleanup

**MUST:**
- Extend `HTMLElement` (or `BaseComponent` helper class)
- Register components with `customElements.define()` in main.ts
- Clean up subscriptions and event listeners in `disconnectedCallback()`
- Use `static observedAttributes` for reactive HTML attributes
- Call `super.connectedCallback()` when overriding BaseComponent

**SHOULD:**
- Use Shadow DOM for reusable components (buttons, cards, modals)
- Use Light DOM for layout components (page containers, grids)
- Create Shadow Root in constructor, not connectedCallback
- Use private fields (prefixed with `_` or `private` keyword)
- Emit custom events for parent communication

**AVOID:**
- Manipulating DOM elements outside component's scope
- Relying on global state in component rendering
- Complex logic in lifecycle hooks (delegate to services)
- Memory leaks from unremoved listeners
- Auto-registering components (use manual registration)

**Example - Good:**
```typescript
export class LayerCanvas extends BaseComponent {
  private canvas: HTMLCanvasElement | null = null;
  private resizeObserver: ResizeObserver | null = null;

  static observedAttributes = ['src', 'opacity', 'blend-mode'];

  constructor() {
    super();
    // Create Shadow DOM in constructor
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    super.connectedCallback(); // Cleanup management
    this.render();
    this.setupCanvas();
    this.observeResize();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback(); // Cleans up subscriptions
    this.resizeObserver?.disconnect();
  }

  attributeChangedCallback(
    name: string,
    oldValue: string,
    newValue: string
  ): void {
    if (oldValue === newValue) return;

    if (name === 'src') {
      this.loadImage(newValue);
    } else {
      this.draw();
    }
  }

  protected render(): void {
    this.shadowRoot!.innerHTML = `
      <style>
        :host {
          display: block;
          position: absolute;
          inset: 0;
        }
        canvas {
          width: 100%;
          height: 100%;
        }
      </style>
      <canvas></canvas>
    `;
    this.canvas = this.shadowRoot!.querySelector('canvas');
  }
}

// main.ts - manual registration
customElements.define('layer-canvas', LayerCanvas);
```

**Example - Bad:**
```typescript
// DON'T: Missing cleanup, no Shadow DOM, side effects
export class LayerCanvas extends HTMLElement {
  connectedCallback() {
    // No super call, no cleanup tracking
    document.body.appendChild(...); // Global scope pollution!

    window.addEventListener('resize', this.handleResize); // Memory leak!
  }

  // Missing disconnectedCallback - listener never removed
}

// DON'T: Auto-registration
customElements.define('layer-canvas', LayerCanvas); // At bottom of file
```

**Rationale:** Web Components provide native encapsulation and lifecycle without framework overhead. Proper lifecycle management prevents memory leaks. Shadow DOM prevents style conflicts. Manual registration enables lazy loading and better control.

---

### 2.2 BaseComponent Helper Class

**Principles:**
- BaseComponent provides common patterns for all components
- Automatic subscription cleanup via `takeUntil` pattern
- Template method for render logic
- TypeScript generic for typed state

**MUST:**
- Extend BaseComponent for all components (not HTMLElement directly)
- Call `super.connectedCallback()` and `super.disconnectedCallback()`
- Use `this.subscribe()` helper for observable subscriptions
- Implement `render()` method (can be empty for non-rendering components)

**SHOULD:**
- Override `render()` for Shadow DOM updates
- Use cleanup array for manual resource disposal
- Keep connectedCallback focused (delegate to helper methods)

**AVOID:**
- Manual subscription management (use this.subscribe())
- Forgetting to call super methods
- Complex logic in BaseComponent subclasses

**Example - Good:**
```typescript
export abstract class BaseComponent<TState = unknown> extends HTMLElement {
  private destroy$ = new Subject<void>();
  protected cleanup: Array<() => void> = [];

  constructor() {
    super();
    if (!this.shadowRoot) {
      this.attachShadow({ mode: 'open' });
    }
  }

  connectedCallback(): void {
    // Subclasses can override and call super
  }

  disconnectedCallback(): void {
    // Cleanup subscriptions
    this.destroy$.next();
    this.destroy$.complete();

    // Cleanup manual resources
    this.cleanup.forEach((fn) => fn());
    this.cleanup = [];
  }

  protected subscribe<T>(
    observable: Observable<T>,
    callback: (value: T) => void
  ): void {
    observable
      .pipe(takeUntil(this.destroy$))
      .subscribe(callback.bind(this));
  }

  protected abstract render(state?: TState): void;
}

// Usage in component
export class AudioPlayer extends BaseComponent<AudioState> {
  connectedCallback(): void {
    super.connectedCallback();

    const service = ServiceRegistry.get<AudioService>('AudioService');
    this.subscribe(service.getChannels$(), (channels) => {
      this.render({ channels });
    });
  }

  protected render(state?: AudioState): void {
    if (!state) return;

    this.shadowRoot!.innerHTML = `
      <div>Channels: ${state.channels.size}</div>
    `;
  }
}
```

**Rationale:** BaseComponent eliminates boilerplate and ensures proper cleanup. The `takeUntil` pattern automatically unsubscribes when component disconnects, preventing memory leaks.

---

## 3. Service Patterns

### 3.1 Singleton Services via ServiceRegistry

**Principles:**
- Services are singletons registered in ServiceRegistry
- Type-safe service resolution with generics
- Constructor injection for dependencies
- Services initialized in main.ts in dependency order

**MUST:**
- Register all services in ServiceRegistry before use
- Use `ServiceRegistry.get<T>(key)` for type-safe resolution
- Never create service instances in components
- Define service dependencies in constructor

**SHOULD:**
- Initialize services in main.ts (display/main.ts or master/main.ts)
- Register in correct dependency order (EventBus first, then dependent services)
- Use string keys matching service class names
- Provide interfaces for service contracts

**AVOID:**
- Creating multiple service instances
- Global service variables outside ServiceRegistry
- Services accessing ServiceRegistry to get other services (use constructor injection)
- Circular service dependencies

**Example - Good:**
```typescript
// service-registry.ts
export class ServiceRegistry {
  private static instances = new Map<string, any>();

  static register<T>(key: string, instance: T): void {
    if (this.instances.has(key)) {
      throw new Error(`Service ${key} already registered`);
    }
    this.instances.set(key, instance);
  }

  static get<T>(key: string): T {
    if (!this.instances.has(key)) {
      throw new Error(`Service ${key} not found`);
    }
    return this.instances.get(key) as T;
  }

  static has(key: string): boolean {
    return this.instances.has(key);
  }
}

// display/main.ts - Initialization
import { Logger } from '../../server/src/utils/logger';
import { EventBus } from '../shared/services/event-bus';
import { ConnectionService } from '../shared/services/connection-service';
import { AudioService } from './services/audio-service';

const logger = new Logger('DisplayClient');

// Instantiate in dependency order
const eventBus = new EventBus();
const connection = new ConnectionService(eventBus, 'ws://localhost:3000');
const audioService = new AudioService(eventBus, connection);

// Register singletons
ServiceRegistry.register('EventBus', eventBus);
ServiceRegistry.register('ConnectionService', connection);
ServiceRegistry.register('AudioService', audioService);

// Initialize
logger.info('Initializing display client');
connection.connect();

// Component usage
export class AudioPlayer extends BaseComponent {
  connectedCallback(): void {
    super.connectedCallback();

    const audioService = ServiceRegistry.get<AudioService>('AudioService');
    this.subscribe(audioService.getChannels$(), this.render.bind(this));
  }
}
```

**Example - Bad:**
```typescript
// DON'T: Direct instantiation, no registry
export class AudioPlayer extends BaseComponent {
  private audioService = new AudioService(); // Creates new instance!

  connectedCallback() {
    // Using instance not shared with other components
  }
}

// DON'T: Service locator within service
export class AudioService {
  private connection = ServiceRegistry.get('ConnectionService'); // Should use constructor injection!
}
```

**Rationale:** ServiceRegistry provides centralized dependency management, ensures singleton behavior, and enables testing through mock injection. Constructor injection makes dependencies explicit and traceable.

---

### 3.2 RxJS State Management

**Principles:**
- BehaviorSubject for state with current value
- Subject for events/actions without current value
- Immutable state updates
- Expose Observable, not Subject

**MUST:**
- Use `BehaviorSubject` for state that components need immediate access to
- Use `Subject` for events that don't have a current value
- Call `.asObservable()` before exposing to consumers
- Create new references for Map/Array/Object updates
- Call `.next(newState)` after every state change

**SHOULD:**
- Name observables with `$` suffix for clarity
- Use RxJS operators for derived state (map, filter, combineLatest)
- Provide sync getters alongside observables
- Use `distinctUntilChanged()` for expensive renders

**AVOID:**
- Exposing Subject directly (breaks encapsulation)
- Mutating state objects directly
- Calling `.next()` without new reference
- Subscribing without cleanup (use BaseComponent.subscribe())

**Example - Good:**
```typescript
export class AudioService {
  private logger = new Logger('AudioService');

  // BehaviorSubject for state (has current value)
  private channels$ = new BehaviorSubject<Map<string, AudioChannelState>>(
    new Map()
  );

  // Subject for actions (no current value)
  private actions$ = new Subject<AudioAction>();

  constructor(private eventBus: EventBus) {
    this.setupEventListeners();
  }

  // Expose Observable, not Subject
  getChannels$(): Observable<Map<string, AudioChannelState>> {
    return this.channels$.asObservable();
  }

  // Sync getter for current value
  getChannel(id: string): AudioChannelState | undefined {
    return this.channels$.value.get(id);
  }

  // Derived observable
  getActiveChannels$(): Observable<AudioChannelState[]> {
    return this.channels$.pipe(
      map((channels) =>
        Array.from(channels.values()).filter((ch) => ch.playing)
      ),
      distinctUntilChanged(
        (a, b) => a.length === b.length && a.every((ch, i) => ch === b[i])
      )
    );
  }

  private handlePlay(event: AudioPlayEvent): void {
    const { channel, source, volume } = event.payload;

    // Immutable update
    const current = this.channels$.value;
    const updated = new Map(current); // New Map instance
    updated.set(channel, {
      id: channel,
      source,
      playing: true,
      volume,
      loop: event.payload.loop,
      effects: [],
      respectTimeScale: false,
    });

    this.channels$.next(updated); // Emit new state
  }
}
```

**Example - Bad:**
```typescript
// DON'T: Expose Subject, mutable updates
export class AudioService {
  // Public Subject - consumers can call .next()!
  channels$ = new BehaviorSubject<Map<string, AudioChannelState>>(new Map());

  handlePlay(event: AudioPlayEvent): void {
    const channels = this.channels$.value;
    channels.set(event.payload.channel, {
      /* ... */
    }); // MUTATES!

    // Forgot to call .next() - subscribers not notified!
  }
}

// DON'T: Subscribe without cleanup
export class AudioPlayer extends HTMLElement {
  connectedCallback() {
    const service = ServiceRegistry.get<AudioService>('AudioService');

    service.getChannels$().subscribe((channels) => {
      this.render(channels);
    }); // Memory leak - never unsubscribed!
  }
}
```

**Rationale:** BehaviorSubject provides current value access while maintaining observable streams. Immutable updates enable change detection and prevent reference bugs. Proper encapsulation prevents external code from corrupting state.

---

### 3.3 Observable Lifecycle & Derived State

**Principles:**
- Choose the right Subject type for the data semantics
- Derived observables are stable references created once, not computed on each access
- Completed subjects cannot emit again — protect against accidental completion

**MUST:**
- Use `BehaviorSubject<T>` for state that has a meaningful initial value and where new subscribers need the current value immediately (channels map, connection status, layer state)
- Use `Subject<T>` for one-shot events with no "current value" semantics (user actions, transient notifications)
- Never use `ReplaySubject` unless you specifically need N-value replay for late subscribers (currently no use case in Squire)
- Create derived observables as `private readonly` class fields, not inside getter methods — a getter creates a new pipeline on every call, which means unbounded subscriptions if called in a render loop

**SHOULD:**
- Use `distinctUntilChanged()` on derived observables to avoid redundant render cycles
- Provide a comparison function for non-primitive values (`distinctUntilChanged(shallowEquals)`)
- Use `combineLatest` when a component needs state from multiple services
- Use `shareReplay({ bufferSize: 1, refCount: true })` if a derived observable is subscribed from multiple consumers and the pipeline is expensive

**AVOID:**
- Calling `.complete()` on a BehaviorSubject that outlives its service (service subjects live for the application lifetime)
- Creating derived observables inside `connectedCallback` — subscribe to the service's pre-built observable instead
- Using `ReplaySubject(1)` as a substitute for `BehaviorSubject` — they differ in `.value` access and initial-emission semantics

**Example - Good (derived observable as class field):**
```typescript
export class AudioService {
  private channels$ = new BehaviorSubject<Map<string, AudioChannelState>>(new Map());

  // Created once, stable reference — safe for multiple subscribers
  private readonly activeChannels$ = this.channels$.pipe(
      map(channels => [...channels.values()].filter(ch => ch.playing)),
      distinctUntilChanged((a, b) =>
          a.length === b.length && a.every((ch, i) => ch === b[i])
      ),
  );

  getActiveChannels$(): Observable<AudioChannelState[]> {
      return this.activeChannels$;
  }
}
```

**Example - Bad (pipeline created per call):**
```typescript
// DON'T: New pipeline on every call — if called in a render loop,
// creates unbounded subscriptions
getActiveChannels$(): Observable<AudioChannelState[]> {
    return this.channels$.pipe(
        map(channels => [...channels.values()].filter(ch => ch.playing)),
    );
}
```

**Rationale:** Choosing the correct Subject type prevents subtle bugs (late subscribers missing state, completed streams silently dropping events). Stable derived observables avoid unnecessary garbage collection pressure and subscription management.

---

### 3.4 Connection Resilience

**Principles:**
- ConnectionService handles WebSocket reconnection automatically
- EventBus is local and independent of WebSocket — it continues functioning during disconnection
- Services must be designed to handle reconnection gracefully

**Key guarantee:** The EventBus is an in-process pub/sub system. It does not depend on WebSocket connectivity. Client-to-client events (prefixed `client:`) work even when the server is unreachable. Only `server:` prefixed events require an active connection.

**MUST:**
- Never assume the WebSocket is connected — always check before sending
- On reconnection, the server sends full state sync — services should accept this as a fresh state replacement, not an incremental merge

**SHOULD:**
- Show connection status to the user via a UI indicator
- Use exponential backoff for reconnection attempts (already implemented in ConnectionService)
- Log connection state transitions at INFO level

**AVOID:**
- Building reconnection logic in individual services — ConnectionService owns this concern
- Assuming EventBus subscriptions are lost on disconnect — they are local and persist across reconnections
- Manual WebSocket management outside ConnectionService

**Rationale:** Separating connection management from event routing means services only need to handle "new state arrived" events, not "connection dropped" recovery logic. This is a deliberate architectural guarantee that simplifies service design.

---

## 4. TypeScript Patterns

### 4.1 Strict Typing & Interfaces

**Principles:**
- Strict TypeScript mode enabled
- Interface-based service contracts
- Type-only imports prevent circular dependencies
- Branded types for domain IDs

**MUST:**
- Enable `strict: true` in tsconfig.json
- Define interfaces for service contracts
- Use `import type` for types and interfaces
- Type all function parameters and return values
- Avoid `any` (use `unknown` for truly dynamic types)

**SHOULD:**
- Use branded types for domain-specific IDs (ChannelId, LayerId)
- Use discriminated unions for event types
- Leverage utility types (Partial, Pick, Omit, Record)
- Document complex types with JSDoc

**AVOID:**
- Type assertions (`as`) unless absolutely necessary
- Mixing type and value imports from same source
- Optional parameters in middle of parameter list
- Returning different types based on parameters

> **See also:** For event handlers with 4+ cases, use typed dispatch maps to eliminate casts — see `/docs/CODE_STANDARDS.md` §3.3.

**Example - Good:**
```typescript
// Branded types for type safety
type Brand<K, T> = K & { __brand: T };
type ChannelId = Brand<string, 'ChannelId'>;
type LayerId = Brand<string, 'LayerId'>;

// Service interface
export interface IAudioService {
  getChannels$(): Observable<Map<ChannelId, AudioChannelState>>;
  getChannel(id: ChannelId): AudioChannelState | undefined;
  play(channel: ChannelId, options: PlayOptions): void;
  stop(channel: ChannelId): void;
}

// Implementation
export class AudioService implements IAudioService {
  private channels$ = new BehaviorSubject<Map<ChannelId, AudioChannelState>>(
    new Map()
  );

  getChannels$(): Observable<Map<ChannelId, AudioChannelState>> {
    return this.channels$.asObservable();
  }

  getChannel(id: ChannelId): AudioChannelState | undefined {
    return this.channels$.value.get(id);
  }

  play(channel: ChannelId, options: PlayOptions): void {
    // Implementation
  }

  stop(channel: ChannelId): void {
    // Implementation
  }
}

// Type-only imports
import type { IAudioService } from '../services/audio-service';
import type { AudioChannelState } from '../../server/src/types';
```

**Example - Bad:**
```typescript
// DON'T: any everywhere, mixing imports, type assertions
import { AudioService } from '../services/audio-service'; // Should be type-only

export class AudioPlayer extends BaseComponent {
  private service: any; // No type safety!

  handleEvent(event: any) {
    // Any everywhere
    const data = event as AudioPlayEvent; // Type assertion
    this.service.play(data.payload.channel);
  }
}
```

**Rationale:** Strict typing catches errors at compile time and provides excellent IDE support. Branded types prevent ID confusion across domains. Type-only imports reduce bundle size and prevent circular dependencies.

---

## 5. HTML/CSS Standards

### 5.1 Semantic HTML & Accessibility

**Principles:**
- Use semantic HTML5 elements
- CSS custom properties for theming
- Shadow DOM for component-scoped styles
- WCAG 2.1 AA compliance minimum

**MUST:**
- Use semantic elements (header, nav, main, article, section)
- Provide ARIA labels for custom controls
- Ensure 4.5:1 color contrast minimum
- Support keyboard navigation (Tab, Enter, Escape)
- Test with screen readers

**SHOULD:**
- Use CSS custom properties for all design tokens
- Scope styles to `:host` in Shadow DOM
- Provide focus indicators for interactive elements
- Use rem/em units for scalable typography
- Use CSS Grid/Flexbox for layouts

**AVOID:**
- Inline styles (use CSS custom properties)
- !important declarations
- Fixed pixel dimensions (use responsive units)
- Divs for everything (use semantic elements)
- Relying solely on color for information

**Example - Good:**
```typescript
export class AudioPlayer extends BaseComponent {
  protected render(): void {
    this.shadowRoot!.innerHTML = `
      <style>
        :host {
          display: block;
          padding: var(--spacing-md);
          background: var(--surface-primary);
          border-radius: var(--radius-md);
        }

        button {
          background: var(--accent-primary);
          color: var(--text-on-accent);
          border: none;
          padding: var(--spacing-sm) var(--spacing-md);
          border-radius: var(--radius-sm);
          cursor: pointer;
          transition: background 0.2s;
        }

        button:hover {
          background: var(--accent-primary-hover);
        }

        button:focus {
          outline: 2px solid var(--focus-ring);
          outline-offset: 2px;
        }

        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border-width: 0;
        }
      </style>

      <div role="region" aria-label="Audio Player">
        <button
          type="button"
          aria-label="${this.playing ? 'Pause' : 'Play'} audio"
        >
          <span aria-hidden="true">${this.playing ? '⏸' : '▶'}</span>
          <span class="sr-only">${this.playing ? 'Pause' : 'Play'}</span>
        </button>
      </div>
    `;
  }
}
```

**Example - Bad:**
```typescript
// DON'T: No semantics, poor a11y, inline styles
export class AudioPlayer extends BaseComponent {
  protected render(): void {
    this.shadowRoot!.innerHTML = `
      <div style="background: #333; padding: 20px;">
        <div onclick="this.play()">Play</div>
      </div>
    `;
  }
}
```

**Rationale:** Semantic HTML improves accessibility and SEO. CSS custom properties enable themeable, maintainable stylesheets. WCAG compliance ensures legal compliance and better UX for all users.

---

### 5.2 CSS Architecture: External Files vs `getStyles()`

**Principles:**
- Two CSS strategies coexist: external `.css` files adopted via Shadow DOM, and `getStyles()` methods returning template strings
- Choose based on CSS volume and reuse needs
- Both approaches use CSS custom properties (theme tokens) for consistency

**MUST:**
- Use an **external `.css` file** when the component's styles exceed ~20 lines of CSS
- Use **`getStyles()`** (inline template string) for small components with fewer than 20 lines of CSS
- Never mix both approaches in a single component
- External CSS files live adjacent to their component: `my-component.css` next to `my-component.ts`

**SHOULD:**
- Import shared style utilities from `shared/styles/common-styles.ts` into `getStyles()` methods
- Use CSS custom properties (theme tokens) in both approaches — never hardcode colors or spacing
- Prefer external `.css` files for layout-heavy components (grids, toolbars, panels)
- Prefer `getStyles()` for components where styles are mostly dynamic or composed from shared utilities

**AVOID:**
- Large inline style blocks (>20 lines) inside `render()` template literals — extract to a `.css` file
- Duplicating theme values — always reference `var(--token-name)`
- Importing `.css` files from unrelated component directories

**Example - Good (external file for complex styles):**
```typescript
// audio-controls.ts — complex layout, many rules
protected override render(): void {
    this.shadowRoot!.innerHTML = `
        <link rel="stylesheet" href="./audio-controls.css">
        <div class="controls">...</div>
    `;
}
```

**Example - Good (getStyles for simple components):**
```typescript
// small-badge.ts — minimal styles
protected override getStyles(): string {
    return `
        :host { display: inline-flex; }
        .badge {
            padding: 2px 8px;
            border-radius: var(--radius-sm);
            background: var(--surface-secondary);
        }
    `;
}
```

For extracting shared CSS utilities (repeated patterns across components), see `/docs/REFACTORING_GUIDE.md` §3.3.

**Rationale:** A clear threshold prevents both over-inlining (giant template strings that obscure component logic) and over-extracting (tiny `.css` files for 3 lines of CSS). Consistent use of theme tokens ensures both approaches produce visually cohesive results.

---

## 6. Event Handling

### 6.1 WebSocket & EventBus Integration

**Principles:**
- Server events flow WebSocket → ConnectionService → EventBus → Services
- Event naming prevents collisions (server: vs client: prefixes)
- Validation at boundaries (Zod schemas)
- Wildcard patterns reduce boilerplate

**MUST:**
- Prefix server events with `server:` (e.g., `server:audio.play`)
- Prefix client-only events with `client:` (e.g., `client:modal.open`)
- Validate all server messages with Zod schemas
- Clean up event subscriptions properly

**SHOULD:**
- Use wildcard patterns for event groups (`server:audio.*`)
- Log event handling errors with context
- Debounce rapid DOM events (input, scroll, resize)
- Use CustomEvent for component communication

**AVOID:**
- Direct WebSocket access outside ConnectionService
- Silent event handler failures
- Global event listeners without cleanup
- Synchronous blocking in event handlers

**Example - Good:**
```typescript
export class EventBus {
  private subjects = new Map<string, Subject<any>>();
  private logger = new Logger('EventBus');

  on<T>(pattern: string, handler: (event: T) => void): () => void {
    const subject = this.getOrCreateSubject(pattern);

    const subscription = subject.subscribe({
      next: handler,
      error: (error) => {
        this.logger.error('Error in event handler', { pattern, error });
      },
    });

    return () => subscription.unsubscribe();
  }

  emit<T>(eventType: string, event: T): void {
    // Emit to exact match
    const exactSubject = this.subjects.get(eventType);
    if (exactSubject) {
      exactSubject.next(event);
    }

    // Emit to wildcard patterns
    for (const [pattern, subject] of this.subjects.entries()) {
      if (this.matches(eventType, pattern)) {
        subject.next(event);
      }
    }
  }

  private matches(eventType: string, pattern: string): boolean {
    if (pattern === eventType) return true;
    if (!pattern.includes('*')) return false;

    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*').replace(/\./g, '\\.') + '$'
    );
    return regex.test(eventType);
  }

  private getOrCreateSubject(pattern: string): Subject<any> {
    if (!this.subjects.has(pattern)) {
      this.subjects.set(pattern, new Subject());
    }
    return this.subjects.get(pattern)!;
  }
}

// ConnectionService routes to EventBus
export class ConnectionService {
  onMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data);
      const result = serverEventSchema.safeParse(message);

      if (!result.success) {
        this.logger.error('Invalid event', { errors: result.error });
        return;
      }

      this.eventBus.emit(`server:${result.data.type}`, result.data);
    } catch (error) {
      this.logger.error('Failed to process message', { error });
    }
  }
}

// Service subscribes with wildcard
export class AudioService {
  constructor(private eventBus: EventBus) {
    this.eventBus.on('server:audio.*', this.handleAudioEvent.bind(this));
  }

  private handleAudioEvent(event: AudioEvent): void {
    switch (event.type) {
      case 'audio.play':
        this.handlePlay(event as AudioPlayEvent);
        break;
      case 'audio.stop':
        this.handleStop(event as AudioStopEvent);
        break;
    }
  }
}
```

**Rationale:** Centralized event handling enables loose coupling. Validation prevents corrupted data. Wildcard patterns reduce subscription boilerplate. The server: prefix prevents naming collisions between server and client events.

---

### 6.2 Error Boundaries in Event Subscriptions

**Principles:**
- A thrown error in an RxJS `Subject.next()` subscriber terminates the Subject permanently
- All future `.next()` calls on a terminated Subject silently no-op
- Services must catch internally in every event handler to prevent cascading failure

**MUST:**
- Wrap the body of every EventBus subscription handler in try/catch:
```typescript
this.eventBus.on('server:audio.*', (event: AudioEvent) => {
    try {
        this.handleAudioEvent(event);
    } catch (error) {
        this.logger.error('Failed to handle audio event', {
            type: event.type,
            error: String(error),
        });
    }
});
```
- Log the error with event type and relevant payload context

**SHOULD:**
- Centralize the try/catch at the subscription site, not inside each individual handler — one try/catch per `eventBus.on()` call
- Consider a wrapper helper to reduce boilerplate:
```typescript
private safeHandle<T>(handler: (event: T) => void): (event: T) => void {
    return (event: T) => {
        try {
            handler.call(this, event);
        } catch (error) {
            this.logger.error('Event handler error', { error: String(error) });
        }
    };
}
```

**AVOID:**
- Relying on the EventBus implementation to catch subscriber errors — defend at both layers
- Rethrowing inside handlers (the outer subscription would still terminate the Subject)

**Rationale:** RxJS Subjects follow the Observable contract: an error terminates the stream. Since EventBus uses Subjects internally, a single unhandled throw in any subscriber silently kills event delivery for every other subscriber on that stream. This is the most dangerous silent-failure mode in the architecture.

---

## 7. State Management

### 7.1 Immutable State Updates

**Principles:**
- All state updates return new references
- Never mutate existing state
- Use helper functions with strict naming
- Pure functions for testability

**MUST:**
- Use `new Map()` or spread operators `{...}` for copies before mutation
- Call `.next(newState)` on BehaviorSubject after updates
- Name helpers with strict prefixes: get*, set*, update*, remove*
- Return new state from helpers (never mutate parameters)
- Use `ReadonlyMap<K, V>` in state interfaces to enforce immutability at the type level (see `/docs/CODE_STANDARDS.md` §2.1 for details and examples)

**SHOULD:**
- Create typed helper functions for complex updates
- Use RxJS operators for derived state
- Provide sync and async access to state
- Log state transitions for debugging

**AVOID:**
- Direct mutation of Map/Array/Object state
- Calling `.next()` without new reference
- Helpers with side effects
- State duplication across services

**Example - Good:**
```typescript
// state-helpers.ts - Pure helper functions
export function getChannel(
  channels: Map<string, ChannelState>,
  id: string
): ChannelState | undefined {
  return channels.get(id);
}

export function setChannel(
  channels: Map<string, ChannelState>,
  id: string,
  state: ChannelState
): Map<string, ChannelState> {
  const updated = new Map(channels); // Immutable copy
  updated.set(id, state);
  return updated;
}

export function updateChannel(
  channels: Map<string, ChannelState>,
  id: string,
  updater: (state: ChannelState) => ChannelState
): Map<string, ChannelState> {
  const channel = channels.get(id);
  if (!channel) return channels;

  const updated = new Map(channels);
  updated.set(id, updater(channel));
  return updated;
}

export function removeChannel(
  channels: Map<string, ChannelState>,
  id: string
): Map<string, ChannelState> {
  const updated = new Map(channels);
  updated.delete(id);
  return updated;
}

// Service usage
export class AudioService {
  private channels$ = new BehaviorSubject<Map<string, ChannelState>>(
    new Map()
  );

  play(id: string, options: PlayOptions): void {
    const currentChannels = this.channels$.value;
    const newState: ChannelState = {
      id,
      playing: true,
      volume: options.volume,
      loop: options.loop,
      effects: [],
    };

    const updatedChannels = setChannel(currentChannels, id, newState);
    this.channels$.next(updatedChannels); // Emit new reference
  }

  stop(id: string): void {
    const currentChannels = this.channels$.value;
    const updatedChannels = updateChannel(currentChannels, id, (ch) => ({
      ...ch,
      playing: false,
      position: 0,
    }));
    this.channels$.next(updatedChannels);
  }
}
```

**Example - Bad:**
```typescript
// DON'T: Mutation, wrong naming, side effects
export class AudioService {
  private channels$ = new BehaviorSubject<Map<string, ChannelState>>(
    new Map()
  );

  play(id: string, options: PlayOptions): void {
    const channels = this.channels$.value;
    channels.set(id, {
      /* ... */
    }); // MUTATES!
    // Forgot to call .next() - subscribers not notified
  }

  stop(id: string): void {
    const channels = this.channels$.value;
    const channel = channels.get(id);
    if (channel) {
      channel.playing = false; // MUTATES nested object!
      this.channels$.next(channels); // Same reference!
    }
  }
}

// DON'T: Helper with side effects
function doChannel(
  channels: Map<string, ChannelState>,
  id: string
): Map<string, ChannelState> {
  console.log('Doing channel'); // Side effect!
  channels.delete(id); // Mutation!
  return channels;
}
```

**Rationale:** Immutable updates prevent bugs from shared references, enable change detection, and make debugging easier. Strict naming makes code predictable. Pure functions are easy to test and compose.

---

## 8. Component Communication

### 8.1 Props, Events, and Services

**Principles:**
- HTML attributes for string props
- JavaScript properties for complex data
- CustomEvent for child→parent communication
- Services for shared state

**MUST:**
- Use kebab-case for HTML attributes
- Use camelCase for JavaScript properties
- Emit CustomEvent with `bubbles: true, composed: true`
- Document component API (attributes, properties, events, slots)

**SHOULD:**
- Keep prop/attribute surface minimal
- Use slots for flexible composition
- Validate prop values in `attributeChangedCallback`
- Provide TypeScript interfaces for component APIs

**AVOID:**
- Deep prop drilling (use services)
- Two-way binding patterns
- Parent accessing child internals
- Tight coupling between sibling components

**Example - Good:**
```typescript
export class LayerCanvas extends BaseComponent {
  // HTML attributes (strings)
  static observedAttributes = ['src', 'opacity', 'blend-mode'];

  // JavaScript properties (complex data)
  private _effects: VisualEffect[] = [];

  get effects(): VisualEffect[] {
    return this._effects;
  }

  set effects(value: VisualEffect[]) {
    this._effects = value;
    this.draw();
  }

  attributeChangedCallback(
    name: string,
    _: string,
    newValue: string
  ): void {
    switch (name) {
      case 'src':
        this.loadImage(newValue);
        break;
      case 'opacity':
        const opacity = parseFloat(newValue);
        if (opacity >= 0 && opacity <= 1) {
          this.updateOpacity(opacity);
        }
        break;
    }
  }

  private emitLoaded(): void {
    // CustomEvent for parent communication
    this.dispatchEvent(
      new CustomEvent('layer-loaded', {
        detail: { src: this.getAttribute('src') },
        bubbles: true,
        composed: true, // Crosses shadow DOM boundary
      })
    );
  }
}

// Parent listens to event
export class LayerStack extends BaseComponent {
  connectedCallback(): void {
    super.connectedCallback();

    this.addEventListener('layer-loaded', (e: Event) => {
      const detail = (e as CustomEvent).detail;
      this.logger.info('Layer loaded', { src: detail.src });
    });
  }
}

// HTML usage
// <layer-canvas src="image.png" opacity="0.8" blend-mode="multiply"></layer-canvas>
```

**Example - Bad:**
```typescript
// DON'T: Direct access, tight coupling
export class LayerCanvas extends BaseComponent {
  public internalState: any; // Exposed internals!
}

export class LayerStack extends BaseComponent {
  connectedCallback(): void {
    const layer = this.querySelector('layer-canvas') as LayerCanvas;
    layer.internalState.opacity = 0.5; // Direct manipulation!
  }
}
```

**Rationale:** Attributes and properties provide declarative API. CustomEvent enables loose coupling. Services avoid prop drilling. Slots enable flexible composition without tight coupling.

---

## 9. Testing Standards

### 9.1 Bun Test Runner

**Principles:**
- Use Bun's built-in test runner
- Test business logic in services
- Test rendering in components
- Mock dependencies at boundaries

**MUST:**
- Use `bun test` for all tests
- Import from `bun:test`
- Test state helpers in isolation (pure functions)
- Mock services in component tests
- Co-locate tests with source files

**SHOULD:**
- Group related tests with `describe()`
- Use descriptive test names
- Test error cases and edge conditions
- Keep tests focused (one assertion preferred)
- Use shared test data factories following the `make{Entity}(overrides?)` convention (see `/docs/CODE_STANDARDS.md` §8.1 for patterns and examples)
- When adding a new event type or state shape, add a corresponding factory

**AVOID:**
- Testing implementation details
- Sharing state between tests
- Flaky tests depending on timing
- Tests requiring manual setup/teardown

**Example - Good:**
```typescript
// state-helpers.test.ts
import { test, expect, describe } from 'bun:test';
import { getChannel, setChannel, updateChannel } from './state-helpers';

describe('State Helpers', () => {
  test('should set channel in map', () => {
    const channels = new Map();
    const state: ChannelState = {
      id: 'ambient',
      playing: true,
      volume: 0.5,
    };

    const updated = setChannel(channels, 'ambient', state);

    expect(updated.get('ambient')).toEqual(state);
    expect(channels.size).toBe(0); // Original unchanged
  });

  test('should update existing channel', () => {
    const channels = new Map([
      ['music', { id: 'music', playing: true, volume: 0.8 }],
    ]);

    const updated = updateChannel(channels, 'music', (ch) => ({
      ...ch,
      volume: 0.5,
    }));

    expect(updated.get('music')?.volume).toBe(0.5);
    expect(channels.get('music')?.volume).toBe(0.8); // Original unchanged
  });
});

// audio-service.test.ts
describe('AudioService', () => {
  test('should emit updated channels on play', () => {
    const eventBus = new EventBus();
    const connection = new ConnectionService(eventBus, 'ws://test');
    const service = new AudioService(eventBus, connection);

    const emissions: Map<string, ChannelState>[] = [];
    service.getChannels$().subscribe((channels) => emissions.push(channels));

    eventBus.emit('server:audio.play', {
      type: 'audio.play',
      payload: {
        channel: 'ambient',
        source: { type: 'file', ref: 'forest.mp3' },
        volume: 0.5,
        loop: true,
      },
    });

    expect(emissions).toHaveLength(2); // Initial + update
    expect(emissions[1].get('ambient')?.playing).toBe(true);
  });
});
```

**Rationale:** Testing provides confidence in refactoring and catches regressions. Pure functions test easily. Mocking dependencies makes tests fast and deterministic. Bun's test runner is fast and integrated.

---

## 10. Code Organization

### 10.1 Feature-Based Structure

**Principles:**
- Organize by feature/domain, not file type
- Consistent naming conventions
- Structured imports
- Manual component registration

**MUST:**
- Use kebab-case for filenames
- Use PascalCase for classes
- Use camelCase for functions/methods
- Group imports: external → core → utils → types
- Use type-only imports with `import type`

**SHOULD:**
- Keep files under 500 lines
- Co-locate tests: `audio-service.test.ts` next to `audio-service.ts`
- Use barrel exports (`index.ts`) sparingly
- One component per file

**AVOID:**
- Generic folders like `/helpers/`, `/utils/`, `/common/`
- Deep nesting (max 3-4 levels)
- Circular dependencies
- Mixing server and client code

**Example - Good:**
```
ts-web-client/src/
├── shared/
│   ├── components/
│   │   └── base/
│   │       ├── base-component.ts
│   │       └── base-component.test.ts
│   ├── services/
│   │   ├── event-bus.ts
│   │   ├── event-bus.test.ts
│   │   ├── connection-service.ts
│   │   └── service-registry.ts
│   └── utils/
│       ├── state-helpers.ts
│       └── state-helpers.test.ts
├── display/
│   ├── main.ts
│   ├── components/
│   │   ├── audio-player.ts
│   │   └── visual-renderer.ts
│   └── services/
│       ├── audio-service.ts
│       └── visual-service.ts
└── master/
    ├── main.ts
    ├── components/
    │   ├── audio-controls.ts
    │   └── image-controls.ts
    └── services/
        └── event-builder.ts
```

**Example - Bad:**
```
src/
├── helpers/
│   └── everything.ts
├── components/
│   ├── DisplayComponents.tsx
│   └── MasterComponents.tsx
└── utils/
    └── misc.ts
```

**Rationale:** Feature-based organization groups related code, making it easy to find and refactor. Consistent naming reduces cognitive load. Structured imports prevent circular dependencies.

---

## 11. Performance Optimization

### 11.1 Lazy Loading & Caching

**Principles:**
- Lazy load components on demand
- Cache expensive operations
- Debounce rapid updates
- Use requestAnimationFrame for visual updates

**MUST:**
- Use `requestAnimationFrame` for visual updates
- Debounce input events (100-300ms)
- Cache loaded assets (images, audio buffers)
- Register components manually (enables code splitting)

**SHOULD:**
- Use dynamic imports for lazy component loading
- Implement exponential backoff for retries
- Use WeakMap for component-associated data
- Profile before optimizing

**AVOID:**
- Synchronous blocking operations
- Re-rendering entire lists
- Memory leaks from retained references
- Premature optimization (measure first)

**Example - Good:**
```typescript
// Lazy component loading
async function loadCountdown() {
  const { CountdownClock } = await import('./components/countdown-clock');

  if (!customElements.get('countdown-clock')) {
    customElements.define('countdown-clock', CountdownClock);
  }
}

// Debounced input
function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

export class VolumeSlider extends BaseComponent {
  private handleChange = debounce((value: number) => {
    this.dispatchEvent(
      new CustomEvent('volume-change', { detail: { value } })
    );
  }, 100);

  connectedCallback(): void {
    super.connectedCallback();

    this.addEventListener('input', (e: Event) => {
      const value = parseFloat((e.target as HTMLInputElement).value);
      this.handleChange(value);
    });
  }
}

// Asset caching
export class AssetService {
  private imageCache = new Map<string, HTMLImageElement>();
  private logger = new Logger('AssetService');

  async loadImage(url: string): Promise<HTMLImageElement> {
    if (this.imageCache.has(url)) {
      this.logger.info('Image cache hit', { url });
      return this.imageCache.get(url)!;
    }

    const img = await this.fetchImage(url);
    this.imageCache.set(url, img);
    return img;
  }

  private fetchImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      img.src = url;
    });
  }
}
```

**Rationale:** Performance optimizations improve UX, especially on lower-end devices. Lazy loading reduces initial bundle size. Caching prevents redundant network requests. Debouncing prevents excessive processing.

---

## 12. Accessibility Standards

### 12.1 ARIA, Keyboard Navigation, Screen Readers

**Principles:**
- WCAG 2.1 AA minimum compliance
- Keyboard navigation for all interactive elements
- Screen reader friendly markup
- Focus management for dynamic content

**MUST:**
- Provide `aria-label` or `aria-labelledby` for custom controls
- Support Tab, Enter, Escape keyboard patterns
- Ensure 4.5:1 color contrast (text/background)
- Manage focus for modals and overlays
- Test with screen reader (NVDA/JAWS/VoiceOver)

**SHOULD:**
- Use semantic HTML before adding ARIA
- Provide focus indicators for all interactive elements
- Announce dynamic content changes with `aria-live`
- Support keyboard shortcuts with visual hints
- Provide skip links for navigation

**AVOID:**
- Div/span buttons (use `<button>`)
- Relying only on color for state
- Keyboard traps without escape
- Unlabeled form controls
- Auto-playing audio/video

**Example - Good:**
```typescript
export class Modal extends BaseComponent {
  private previousFocus: HTMLElement | null = null;

  open(): void {
    this.previousFocus = document.activeElement as HTMLElement;
    this.setAttribute('open', '');

    // Focus first focusable element
    const firstFocusable = this.shadowRoot!.querySelector<HTMLElement>(
      '[tabindex="0"], button, input'
    );
    firstFocusable?.focus();

    // Trap focus within modal
    this.addEventListener('keydown', this.handleKeydown);
  }

  close(): void {
    this.removeAttribute('open');

    // Restore focus
    this.previousFocus?.focus();
    this.removeEventListener('keydown', this.handleKeydown);
  }

  private handleKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      this.close();
      return;
    }

    if (e.key === 'Tab') {
      const focusable = Array.from(
        this.shadowRoot!.querySelectorAll<HTMLElement>(
          'button, input, [tabindex="0"]'
        )
      );

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  protected render(): void {
    this.shadowRoot!.innerHTML = `
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabindex="-1"
      >
        <h2 id="modal-title">
          <slot name="title">Modal Title</slot>
        </h2>

        <div role="document">
          <slot></slot>
        </div>

        <button type="button" aria-label="Close modal" @click="${this.close}">
          <span aria-hidden="true">×</span>
        </button>
      </div>
    `;
  }
}
```

**Rationale:** Accessibility ensures the application works for everyone, including users with disabilities. It's legally required in many jurisdictions and improves overall UX.

---

## Additional Implementation Guidance

### Creating a New Web Component

**Step-by-Step Process:**

1. **Create component file** in appropriate directory:
   - Shared: `src/shared/components/{component-name}.ts`
   - Display: `src/display/components/{component-name}.ts`
   - Master: `src/master/components/{component-name}.ts`

2. **Extend BaseComponent**:
```typescript
import { BaseComponent } from '../base/base-component';

export class MyComponent extends BaseComponent {
  static observedAttributes = ['prop1', 'prop2'];

  constructor() {
    super();
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.render();
  }

  attributeChangedCallback(
    name: string,
    oldValue: string,
    newValue: string
  ): void {
    if (oldValue === newValue) return;
    this.render();
  }

  protected render(): void {
    this.shadowRoot!.innerHTML = `
      <style>
        :host { display: block; }
      </style>
      <div>Content</div>
    `;
  }
}
```

3. **Register in main.ts**:
```typescript
import { MyComponent } from './components/my-component';

customElements.define('my-component', MyComponent);
```

4. **Use in HTML**:
```html
<my-component prop1="value"></my-component>
```

---

### Bootstrap Pattern (main.ts)

**Display Client Bootstrap:**

```typescript
// display/main.ts
import { Logger } from '../../server/src/utils/logger';
import { ServiceRegistry } from '../shared/services/service-registry';
import { EventBus } from '../shared/services/event-bus';
import { ConnectionService } from '../shared/services/connection-service';
import { AudioService } from './services/audio-service';
import { VisualService } from './services/visual-service';
import { AudioPlayer } from './components/audio-player';
import { VisualRenderer } from './components/visual-renderer';

const logger = new Logger('DisplayClient');

// Initialize services in dependency order
logger.info('Initializing display client');

const eventBus = new EventBus();
const connection = new ConnectionService(eventBus, 'ws://localhost:3000');
const audioService = new AudioService(eventBus, connection);
const visualService = new VisualService(eventBus, connection);

// Register singletons
ServiceRegistry.register('EventBus', eventBus);
ServiceRegistry.register('ConnectionService', connection);
ServiceRegistry.register('AudioService', audioService);
ServiceRegistry.register('VisualService', visualService);

// Register components
customElements.define('audio-player', AudioPlayer);
customElements.define('visual-renderer', VisualRenderer);

// Connect to server
connection.connect();

logger.info('Display client initialized');
```

**Master Client Bootstrap:**

```typescript
// master/main.ts
import { Logger } from '../../server/src/utils/logger';
import { ServiceRegistry } from '../shared/services/service-registry';
import { EventBus } from '../shared/services/event-bus';
import { ConnectionService } from '../shared/services/connection-service';
import { AssetService } from '../shared/services/asset-service';
import { EventBuilder } from './services/event-builder';
import { AudioControls } from './components/audio-controls';
import { ImageControls } from './components/image-controls';

const logger = new Logger('MasterClient');

logger.info('Initializing master client');

const eventBus = new EventBus();
const connection = new ConnectionService(eventBus, 'ws://localhost:3000');
const assetService = new AssetService();
const eventBuilder = new EventBuilder(connection);

ServiceRegistry.register('EventBus', eventBus);
ServiceRegistry.register('ConnectionService', connection);
ServiceRegistry.register('AssetService', assetService);
ServiceRegistry.register('EventBuilder', eventBuilder);

customElements.define('audio-controls', AudioControls);
customElements.define('image-controls', ImageControls);

connection.connect();

logger.info('Master client initialized');
```

---

### WebSocket Event Flow Diagram

```
Server (Bun.serve WebSocket)
  ↓ (sends JSON message)
WebSocket.onmessage
  ↓
ConnectionService.onMessage()
  ↓ (parse JSON)
Zod validation (serverEventSchema.safeParse())
  ↓ (if valid)
EventBus.emit('server:audio.play', event)
  ↓ (pattern matching)
AudioService (subscribed to 'server:audio.*')
  ↓
AudioService.handlePlay()
  ↓ (immutable update)
channels$ BehaviorSubject.next(newState)
  ↓ (observable emission)
AudioPlayer component (subscribed to channels$)
  ↓
AudioPlayer.render(channels)
  ↓
Shadow DOM updated
```

---

### RxJS Cleanup Pattern

```typescript
export class MyComponent extends BaseComponent {
  private destroy$ = new Subject<void>();

  connectedCallback(): void {
    super.connectedCallback();

    const service = ServiceRegistry.get<MyService>('MyService');

    // Subscribe with takeUntil for automatic cleanup
    service
      .getData$()
      .pipe(takeUntil(this.destroy$))
      .subscribe((data) => {
        this.render(data);
      });

    // Manual cleanup registration
    const intervalId = setInterval(() => {
      // ...
    }, 1000);

    this.cleanup.push(() => clearInterval(intervalId));
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    // BaseComponent handles:
    // - this.destroy$.next() + complete()
    // - this.cleanup.forEach(fn => fn())
  }
}
```

---

### CSS Scoping Strategies

**Shadow DOM (Scoped Styles):**
```typescript
protected render(): void {
  this.shadowRoot!.innerHTML = `
    <style>
      :host {
        display: block;
        background: var(--surface-primary);
      }

      .button {
        color: var(--text-primary);
      }

      ::slotted(*) {
        margin: var(--spacing-md);
      }
    </style>

    <button class="button">
      <slot></slot>
    </button>
  `;
}
```

**Global Styles (Theme Tokens):**
```css
/* public/styles/tokens.css */
:root {
  --surface-primary: #1a1a1a;
  --surface-secondary: #2d2d2d;

  --text-primary: #ffffff;
  --text-secondary: #a0a0a0;

  --accent-primary: #4a9eff;
  --accent-primary-hover: #6bb0ff;

  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;

  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 1rem;

  --focus-ring: #4a9eff;
}
```

---

### Component Composition Patterns

**Container/Presentational:**
```typescript
// Container (smart - has logic)
export class AudioPlayerContainer extends BaseComponent {
  connectedCallback(): void {
    super.connectedCallback();

    const service = ServiceRegistry.get<AudioService>('AudioService');

    this.subscribe(service.getChannels$(), (channels) => {
      const ui = this.querySelector('audio-player-ui');
      if (ui) {
        (ui as AudioPlayerUI).channels = Array.from(channels.values());
      }
    });
  }

  protected render(): void {
    this.innerHTML = `<audio-player-ui></audio-player-ui>`;
  }
}

// Presentational (dumb - just UI)
export class AudioPlayerUI extends BaseComponent {
  private _channels: AudioChannelState[] = [];

  get channels(): AudioChannelState[] {
    return this._channels;
  }

  set channels(value: AudioChannelState[]) {
    this._channels = value;
    this.render();
  }

  protected render(): void {
    this.shadowRoot!.innerHTML = `
      <style>
        /* scoped styles */
      </style>
      <div>
        ${this._channels.map((ch) => `<div>${ch.id}</div>`).join('')}
      </div>
    `;
  }
}
```

---

## Summary

These client architecture standards emphasize:

1. **Service-Driven State** - RxJS observables, singleton services, immutable updates
2. **Composable Components** - Web Components, Shadow DOM, single responsibility
3. **Type Safety** - Strict TypeScript, branded types, interface contracts
4. **Event-Driven** - WebSocket → EventBus → Services → Components
5. **Web Standards** - No frameworks, native APIs, progressive enhancement
6. **Accessibility** - WCAG 2.1 AA, keyboard navigation, screen reader support
7. **Testability** - Pure functions, dependency injection, Bun test runner
8. **Performance** - Lazy loading, caching, debouncing, RAF
9. **Maintainability** - Feature-based organization, consistent naming, early returns

Following these standards alongside `/docs/CODE_STANDARDS.md` will ensure the Squire client applications are maintainable, testable, performant, and accessible.
