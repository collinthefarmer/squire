# Refactoring Guide

This document distills lessons learned from refactoring work across the Squire codebase into actionable guidance for future contributors. It covers what to look for, how to prioritize, and which patterns to follow when cleaning up or restructuring code.

For foundational rules on writing new code, see `/docs/CODE_STANDARDS.md`. For client-specific architecture standards, see `/docs/CLIENT_ARCHITECTURE.md`.

---

## 1. Refactoring Priorities

Not all improvements are equal. When reviewing code for refactoring, address issues in this order:

1. **Correctness bugs** — Logic errors exposed by integration (e.g., state resets, lost data during event replay)
2. **Architectural violations** — Shared components importing from domain-specific modules, services coupling to each other
3. **Duplicated logic** — Identical or near-identical code across modules that should share a single implementation
4. **Missing abstractions** — Inline CSS, hardcoded values, or repeated patterns that belong in shared utilities
5. **Naming and consistency** — Import order, naming conventions, JSDoc gaps

Resist the urge to fix category 5 issues while ignoring category 1. A codebase with perfect import order but broken state replay is worse than one with messy imports that works correctly.

---

## 2. Dependency Direction

### 2.1 Shared Components Must Not Import Domain Code

Components in `shared/components/` exist to be reusable across contexts (master, display, future clients). They must never import from `@master/*` or `@display/*`.

**When you find a shared component importing a domain service:**
- Move the service interaction to a domain-specific wrapper or parent component
- Pass configuration into the shared component via HTML attributes or constructor parameters
- Use the `attributeChangedCallback` + `static observedAttributes` pattern for reactive attribute propagation

**Example (from Draggable decoupling):**

Before: `Draggable` imported `ImageToolbarService` directly to read aspect ratio.

After: `Draggable` reads `data-aspect-ratio` from its HTML attribute. `ImageGallery` (master-specific) subscribes to the toolbar service and syncs the attribute to its child `<image-asset-grid>`, which passes it through to `<squire-draggable>` elements.

The data flows downward: **service → domain component → attribute → shared component**.

### 2.2 Services Own State, Components Own View

Services manage state and emit observables. Components subscribe and render. When a component is doing both, extract the state management into a service.

Conversely, when a service is reaching into the DOM or caring about presentation, something is wrong.

---

## 3. Extracting Shared Logic

### 3.1 Pure Reducer Functions

When two services handle the same event types with identical logic, extract the handlers into pure reducer functions in a shared module.

**Convention:** `apply{Domain}{Action}(map, event) → map`

Examples from the codebase:
- `layer-state.ts`: `applyImageSet`, `applyImageClear`, `applyImageTransform`, `applyImageEffect`, `applyImageLayerConfig`
- `clock-state.ts`: `applyClockCreate`, `applyClockStart`, `applyClockPause`, `applyClockAdjust`, `applyClockDestroy`

**Signature pattern:** Each reducer takes the current `Map<string, State>` and a typed event, returning a new map. They use the immutable helpers from `@utils/state-helpers` (`setInMap`, `updateInMap`, `removeFromMap`).

**Consuming services** keep a simple switch/case that routes event types to reducers:

```typescript
private handleEvent(event: { type: string }): void {
    const current = this.state$.value;
    let updated: Map<string, State>;

    switch (event.type) {
        case "domain.action":
            updated = applyDomainAction(current, event as DomainActionEvent);
            break;
        default:
            return;
    }

    this.state$.next(updated);
}
```

This pattern keeps each service lean while ensuring event-to-state logic is written once, tested once, and used everywhere.

### 3.2 Shared State Interfaces and Helpers

When both display and master clients need the same state shape and computation logic, define them in `shared/services/`:

- **State interfaces** (e.g., `ClockState`) — shared shape consumed by both services
- **Computation helpers** (e.g., `getRemainingTime`, `formatTime`, `getUrgency`) — pure functions over state
- **Display constants** (e.g., `CLOCK_DISPLAY`) — shared sizing values used by renderers and overlay systems

### 3.3 CSS Style Utilities

When two or more components define similar CSS, extract it into `shared/styles/common-styles.ts`.

**Naming convention:** `{purpose}Styles()` — returns a CSS string. Examples: `outlineButtonStyles()`, `segmentedButtonStyles()`, `headerRowStyles()`.

**When to extract:**
- The same CSS pattern appears in 2+ components
- A button, input, or control variant isn't covered by existing utilities
- Hardcoded color values duplicate theme tokens

**When not to extract:**
- The CSS is domain-specific and unlikely to be reused (canvas drawing, fixed-position overlays)
- Only one component uses the pattern — wait until a second consumer appears

**Color values:** Never use raw `rgba()` in component styles. Use the `alpha()` helper from `theme.ts`:
```typescript
background: ${alpha(colors.blue[500], 0.2)};
```

---

## 4. Event System Patterns

### 4.1 Dedicated Update Events

Every domain that supports post-creation modifications must have explicit update/transform event types. Do not overload create events for updates — it conflates creation semantics with mutation semantics, complicates EventStore replay logic, and forces reducers to guess whether a create is "new" or "update existing."

**Examples:**
- Images use `visual.image.transform` for position/scale/rotation changes after placement
- Clocks should use a dedicated update event for repositioning after creation

**The rule:** If you need to change an entity after it's created, add an update event. Create means create.

### 4.2 Client-Computed vs Server-Computed State

Some state is best computed client-side from event timestamps rather than maintained on the server:

- **Clock remaining time** — clients derive it from `duration - elapsed - (now - startedAt)`. The server just relays lifecycle events. This eliminates server tick loops and bandwidth for periodic updates.
- **Image layer state** — computed identically on both display and master clients from the same event reducers. The server maintains a materialized view for convenience but the client doesn't depend on it.

When using client-computed state, **event timestamps are critical**. The `metadata.timestamp` on lifecycle events (start, pause, resume) is what clients use to reconstruct timing. Ensure these timestamps are preserved accurately through the EventStore replay path.

### 4.3 EventStore Replay — Declarative Domain Rules

Replay behavior is defined declaratively in `server/src/core/events/replay-configs.ts` using the creation-centric rule system. Each creation event declares how mutation events affect it.

**Adding a new domain:**

1. Define a config in `replay-configs.ts` using `defineReplay(keyField, rules)`
2. Add the domain to the `domains` array in `event-store.ts`

```typescript
// replay-configs.ts
export const myReplay = defineReplay("id", {
    "my.create": {
        removes: ["my.destroy"],
        folds: {
            "my.update": ["position", "color"],  // merge fields into create
        },
        replaces: ["my.config"],  // latest only, stored alongside create
        appends: ["my.tick"],     // accumulated in sequence (order matters)
    },
});

// event-store.ts — add one line to the domains array
{ prefix: "my.", domain: myReplay },
```

**Five behaviors:**

| Behavior | Declaration | Effect |
|----------|-------------|--------|
| **create** | Top-level key | Starts fresh replay sequence `[createEvent]` |
| **remove** | `removes: [...]` | Deletes entity from replay |
| **fold** | `folds: { type: [...fields] }` | Merges fields into the creation event's payload |
| **replace** | `replaces: [...]` | Stored alongside creation; only latest per type |
| **append** | `appends: [...]` | Accumulated in sequence (order preserved) |

**The folding pattern:** Fold events merge specified fields into the stored creation event. On replay, clients receive a single creation event per entity with the current effective state — no sequence of mutations to reconstruct.

This prevents a class of bugs where mutation events carry optional fields: if a later mutation omits a field that an earlier one set, the client reducer skips the `undefined` field and the value is lost.

**Custom fold transforms:** For complex cases (e.g., `audio.resume` which adjusts timestamps based on pause duration), use a transform function instead of field names:

```typescript
folds: {
    "audio.resume": { transform: (sequence, trigger) => adjustedSequence },
}
```

**When to fold vs append:** Fold property changes that replace previous values. Append lifecycle events that build a timeline (clock start/pause/adjust) where clients compute state from the event sequence.

---

## 5. Canvas Overlay Integration

The canvas overlay system renders interactive handles over the master client's preview iframe. It is designed to be type-agnostic — any service can contribute `CanvasObject` entries.

### 5.1 Adding a New Object Type

To make a new persistent object type (e.g., text, markers, effects) interactive on the canvas:

1. **Service:** Expose `getCanvasObjects$(): Observable<CanvasObject[]>` from your service, computing display-space bounds for each object
2. **Overlay:** In `canvas-overlay.ts`, add the new service's observable to the `combineLatest` merge in `setupSubscriptions`
3. **Transform routing:** In `handleMouseUp`, add an `else if` branch for your `object.type` that calls the appropriate service method

The `CanvasObject` interface:
```typescript
interface CanvasObject {
    id: string;           // entity identifier
    type: string;         // "image" | "clock" | your type
    bounds: DisplayBounds; // { x, y, width, height } in 1920x1080 space
    scale: number;         // for recovering pre-scale dimensions
    zIndex: number;
}
```

### 5.2 Position Conversion

The overlay works in three coordinate spaces:
- **Screen pixels** — mouse events (`clientX`, `clientY`)
- **Preview pixels** — screen pixels relative to the iframe wrapper
- **Display pixels** — 1920x1080 space

Convert between them using `previewScale = wrapperWidth / 1920`. Drag deltas in screen pixels become display-pixel deltas via `dx / previewScale`.

When computing the position offset for an event, remember that the renderer positions by **pre-scale image offset**, then applies scale around the center. For scaled objects, recover pre-scale dimensions: `preScaleWidth = bounds.width / object.scale`.

---

## 6. Type Safety

### 6.1 No Type Assertions for External Data

When reading data from HTML attributes, event payloads, or other external sources, validate rather than assert:

```typescript
// Bad
const mode = this.getAttribute("data-aspect-ratio") as AspectRatioMode;

// Good
const value = this.getAttribute("data-aspect-ratio");
if (value === "cover" || value === "contain") {
    return value;
}
return "contain";
```

### 6.2 Event Handler Casts

In event handlers where the event type is determined by a discriminated `switch` on `event.type`, casting to the specific event type is acceptable and consistent with codebase conventions:

```typescript
case "ui.clock.create":
    updated = applyClockCreate(current, event as ClockCreateEvent);
```

This is safe because the switch case guarantees the type.

---

## 7. Refactoring Checklist

Use this when reviewing code for refactoring opportunities:

- [ ] Shared components have zero imports from `@master/*` or `@display/*`
- [ ] No duplicated event handler logic between display and master services
- [ ] Pure reducer functions follow `apply{Domain}{Action}` naming
- [ ] CSS uses theme tokens and `alpha()` — no raw `rgba()` values
- [ ] Repeated CSS patterns are extracted to `common-styles.ts`
- [ ] Hardcoded transition values use `transitions.fast` or `transitions.normal`
- [ ] Import order follows: external → aliased internal → relative
- [ ] Type imports use `import type`
- [ ] New event domains have EventStore replay support
- [ ] Canvas objects from new services are merged into the overlay
- [ ] `getStyles()` methods compose shared utilities rather than defining inline CSS
