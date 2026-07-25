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

`AppStore` (`@services/store.ts`) is the central reactive state container. It holds all domain state as `BehaviorSubject` observables and routes events to pure reducers in `@state/`.

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

Client-side `EventBus` (`@services/event-bus.ts`) uses RxJS Subject + filter for strongly typed pub/sub:

- `on<T>(type)` — subscribe to a specific event type with full type narrowing
- `onPrefix(prefix)` — subscribe to events by prefix (e.g., `"audio."`)
- `all$()` — all events
- `emit(event)` — broadcast locally

### 4.2 ConnectionService

`ConnectionService` (`@services/connection-service.ts`) manages the WebSocket lifecycle:

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

All components extend `BaseComponent` (`@components/base-component.ts`), which provides:

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

### 5.2 Templates and Rendering

This project uses lit-html as a rendering library, not a framework. There are no reactive properties, no automatic re-renders, no lifecycle decorators. You call `this.update()` when something changes, and `template()` returns what the component should look like *right now*.

This means the template is a pure function of the component's current state. It runs, produces DOM, and is done. If you find yourself caching DOM references inside `template()` or branching on what changed since last render, you're fighting the model. Describe the end state. Let lit-html diff it.

**Keep `template()` shallow.** The top-level template should read as an outline of the component — the major regions, not their contents. Extract non-trivial conditionals, loops, and repeated structures into private render methods. Each sub-template is a pure function of its arguments, returning `TemplateResult`.

```typescript
// Good — template reads as structure, details are one click away
protected template(): TemplateResult {
    return html`
        <div class="layout">
            ${this.headerTemplate()}
            ${this.channelListTemplate(store.channels)}
            ${when(this.selectedChannel, (ch) => this.detailTemplate(ch))}
        </div>
    `;
}

private channelListTemplate(channels: Map<string, ChannelState>): TemplateResult {
    return html`
        <ul class="channel-list">
            ${repeat(channels.entries(), ([id]) => id, ([id, ch]) =>
                this.channelItemTemplate(id, ch)
            )}
        </ul>
    `;
}
```

When a sub-template grows complex enough to have its own state or lifecycle, it's time to promote it to a standalone component.

**Prefer lit-html directives over manual equivalents.** Directives express intent more clearly than raw JavaScript and let lit-html optimize updates:

- `when(condition, trueCase, falseCase)` over ternaries — reads as intent, not syntax
- `nothing` for "render nothing here" — not empty strings or `undefined`
- `repeat(items, keyFn, template)` for keyed lists — gives lit-html stable identity for efficient DOM reuse
- `map(items, template)` for simple, unkeyed iteration
- `classMap({ active: isActive, disabled })` over string interpolation for conditional classes
- `styleMap({ left: `${x}px`, top: `${y}px` })` over style string building for dynamic inline styles
- `choose(value, cases, defaultCase)` for multi-branch rendering — cleaner than chained ternaries
- `ref(callback)` for element references — prefer over `shadowRoot.querySelector()` in templates
- `guard(deps, () => template)` to skip re-rendering expensive subtrees when dependencies haven't changed
- `ifDefined(value)` to conditionally set an attribute — omits it entirely when `undefined`

**When to call `update()`:** After any state change that should be visible. Observable subscriptions typically end with `() => this.update()`. Event handlers that mutate local state call `this.update()` at the end. If multiple state changes happen synchronously, one `update()` at the end is enough — lit-html's `render()` is synchronous and idempotent.

**What doesn't belong in `template()`:** Side effects, subscriptions, DOM queries, or anything that should only happen once. Those belong in `connectedCallback()`. The template runs every render — it should be fast, pure, and boring.

### 5.3 Component Boundaries

A component exists to own a piece of the screen. If you can point at a region and say "that updates as a unit," it's a component. If two regions update independently, they're two components — even if they sit next to each other visually.

The question isn't "is this complex enough to extract?" It's "does this have its own lifecycle?" A volume slider that emits change events has a lifecycle. A label that displays a channel name does not — it's part of its parent's template.

### 5.4 Containers and Presentational Components

The split is about who knows what.

A **container** knows the system. It subscribes to AppStore observables, dispatches events, and coordinates its children. It doesn't render detailed UI itself — it assembles the components that do. Name containers for what they coordinate: `AudioControls`, `LayerPanel`.

A **presentational component** knows the user. It renders data it receives through attributes or properties and signals user intent upward through `CustomEvent`. It never imports `store` or dispatches domain events. Name presentational components for what they display: `VolumeSlider`, `LayerCard`, `TrackList`.

The test: "would this still work if I deleted the server?" Presentational components would. Containers wouldn't.

### 5.5 Composition

A component with five boolean flags that toggle different layouts is three components wearing a trench coat. When you find yourself adding modes or switches, split instead.

**Slots** let parents assemble children without children knowing about each other. Prefer slots over configuration props whenever a component's content varies by context.

**Parent positions children.** A child component never sets its own margin, position, or placement within a layout. It fills the space its parent gives it — the parent decides where that space is. `:host` styles on a child should describe the child's own display behavior (`display: block`, `overflow: hidden`), not its relationship to siblings.

**Data flows down, intent flows up.** Pass data into children through HTML attributes (strings, kebab-case) or JavaScript properties (complex data, camelCase). Children signal back through `CustomEvent` with `{ bubbles: true, composed: true }`. If a component needs to know about its siblings, that knowledge belongs in the parent.

**Never reach into a child's internals.** No `querySelector` into a child's shadow DOM, no calling methods on child elements. The component boundary is a contract — communicate through attributes, properties, events, and slots.

### 5.6 What Belongs in a Component vs a Service

Components answer "what does the user see?" Services answer "what is true?"

A component that computes derived state from raw observables is doing a service's job. If you find a `pipe(map(...), filter(...))` chain in a component that other components might need, move it to the service and expose a new observable. Components should subscribe to data that's already in the shape they need.

Conversely, a service that knows about DOM structure or visual layout has crossed the line. Services produce state. Components consume it and render.

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

Styles are strings passed to `adoptStyles()`. For small components, define a `STYLES` constant in the same file. For larger stylesheets, extract to an adjacent `.css` file and import with `with { type: "text" }`.

```typescript
// Inline for small components
const STYLES = `
:host { display: block; width: 100%; }
.container { padding: var(--spacing-md); }
`;

// External for larger ones
import componentCss from "./my-component.css" with { type: "text" };

// Either way, adopt in connectedCallback
this.adoptStyles(STYLES);
```

Use CSS custom properties for all visual values — never hardcode colors, spacing, or font sizes. The theme is the single source of truth for how things look. A component that hardcodes `color: #3a3a3a` will break the moment the theme changes.

**Shadow DOM vs Light DOM:** Shadow DOM isolates styles and structure — use it for reusable components (buttons, cards, sliders). Light DOM inherits the page's styles — use it for layout containers (page shells, grids) where isolation would fight the cascade.

**Accessibility is structure, not decoration.** Use semantic elements (`button`, `nav`, `section`) — they carry meaning a `div` never will. Custom controls need ARIA labels. Interactive elements need visible focus indicators and keyboard handling (Tab, Enter, Escape). Minimum 4.5:1 color contrast.

### 7.1 Forwarding Runtime Values to CSS

When a runtime value drives appearance — a panel's live scale, a gesture's magnitude, a connection's status — forward it to CSS as a **custom property**, and let a **core, overridable stylesheet** consume it. Code decides *what the value is*; CSS decides *what it looks like*. The two never blur.

The shape is the same everywhere:

1. **A source exposes custom properties** as a `Record<string, string>` (`PanelTransform.styles`) or a projection function (`pinchVars`). Value only — no selectors, no rules.
2. **A core stylesheet consumes them**, every reference a `var(--x, fallback)` so it degrades to a sane default, adopted alongside the component's own sheet.
3. **Overriding is setting the property**, never restating the rule. A component that wants a different feel writes `--panel-scale` or `--gesture-drag-outline-color`; it does not copy the selector.

**Name properties by concept, not by instance.** Use fixed names — `--panel-scale`, `--gesture-scale` — never per-instance namespaces like `--palette-scale`. Custom properties inherit per-subtree, so every element setting a property on its own root is already isolated from every other; a namespace buys nothing the DOM doesn't already give you, and it forces a bespoke stylesheet per instance instead of one shared core sheet.

**Choose the write mechanism by who owns the value:**

- **Durable component state → forward through the render loop.** Expose the properties and apply them with `styleMap` in `template()`. The value persists, it has an owner, and the per-render cost is a single style-attribute diff. This is the declarative default (§5.2). *Reference: `PanelTransform` + `PANEL_TRANSFORM_CSS`.*
- **Ephemeral or shared-infra signal → reflect directly, outside the loop.** When the value isn't component state (a shared reactive source), updates per frame, or is consumed by many components, write it straight to the element the way a directive does — no `render()` per tick. *Reference: the `onGesture` directive + `GESTURE_STYLES`.*

The difference is legible from the source of the value, and it is the *only* thing that varies between the two — the property-and-overridable-class shape is identical.

**Out-of-loop values are valid only where they're guaranteed present.** A reflected property lingers on the element after the interaction that wrote it ends (clearing it at the exact end races the write). Guard its consumption behind the marker that scopes it — read `--gesture-scale` only inside a `[data-gesture]` rule — so a stale value can never reach a selector that matches.

---

## 8. Building a New Component

Start from what the user sees, then work backward.

What region of the screen is this? What data does it show, and what can the user do with it? That tells you whether it's a container (subscribes to AppStore, dispatches events) or presentational (receives props, emits intent). Most new components are one of these — rarely both.

Once you know the shape:
1. Create the file in `{client}/components/{domain}/`
2. Extend `BaseComponent`, implement `template()`
3. Containers subscribe to AppStore in `connectedCallback()`. Presentational components receive data through attributes or properties.
4. Register in `main.ts` with `customElements.define()`
5. If the component needs new server events: define types in `server/src/types.ts`, schemas in `server/src/schemas.ts`, add to the `eventSchema` union, and add an `EventBuilder` method

---

## 9. Code Organization

```
ts-web-client/src/
├── shared/             # Shared by both clients
│   ├── components/     #   BaseComponent, sq-display, sq-layer
│   ├── services/       #   EventBus, AppStore, ConnectionService, image/layer/sound/font/asset
│   ├── state/          #   Shared reducers: audio-channel-state, layer-state, clock-state
│   ├── events/         #   EventBuilder
│   ├── effects/        #   Effect chain, definitions, presets
│   ├── scene/          #   Scene types
│   ├── constants/      #   Display, drag, layer constants
│   ├── utils/          #   Logger, audio helpers
│   └── test-utils/     #   Test factories
├── gestures/           # Pointer tracking, recognizers (drag, pinch) — stands alone
├── display/            # Display client entry point + components
└── master/             # Master client entry point, own services + components
```

- Kebab-case files, PascalCase classes, camelCase functions
- One component per file
- Files under 500 lines
- Co-locate tests: `foo.ts` → `foo.test.ts`
- Group imports: external → `@services`/`@components` → `@state`/`@events`/etc. → types (with `import type`)

**A component that needs more than one file becomes a directory sub-module.** A single-file component stays flat (`components/sq-foo.ts`); the moment it grows a stylesheet, a pure-logic helper, or a test, move it into `components/sq-foo/` with an `index.ts` that re-exports its public surface. Consumers import the directory (`@components/sq-foo`), so the internal file layout stays private and can change freely. Keep intra-module imports relative (`./sq-foo.css`, `./foo-styles`); only the `index.ts` is the outward contract. Extract DOM-free logic (pure `state → CSS` projections, reducers) into its own file in the sub-module so it is testable without the component's `HTMLElement` base — `sq-layer/` (`sq-layer.ts`, `sq-layer.css`, `layer-styles.ts`, `layer-styles.test.ts`, `index.ts`) is the reference shape.

### Domain vocabulary: image vs layer

Two words describe the visual domain, and they are not interchangeable:

- **layer** — the positioned, styled render slot: `position`, `scale`, `rotation`, `blendMode`, `opacity`, `zIndex`, `visible`, `effects`, plus the `imageRef` it currently holds. Its identity is `LayerId`. A layer is a slot that *may* hold an image; it is not the image.
- **image** — the asset/source (`imageRef`, `ImageAsset`, `/public/images/`, `ImageService`) **and** the event-domain namespace (`visual.image.*`). Image events *reduce into* layer state.

New code follows this split — hence `sq-layer`, `LayerService`, `LayerView`, and the `.layer` CSS render the slot, while `ImageService` resolves the asset. Some existing symbols predate the convention and straddle it (`ImageLayerState`, `visual.image.layer_config`, `ImageState.layers`, `store.layers$`); these are **grandfathered** — not renamed, because the event names are wire protocol — but new names should not extend the ambiguity.

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
