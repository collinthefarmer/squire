# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Squire is an event-driven D&D campaign application built with Bun and TypeScript. The system consists of a WebSocket server that broadcasts events to multiple connected clients, enabling synchronized audio, visual, and game state across different displays and devices.

## Code Standards

**IMPORTANT:** All code in this repository must follow the standards documented in `/docs/CODE_STANDARDS.md`. This comprehensive document defines:

- Architecture & design principles (event-driven, DI, service patterns)
- State management (immutability, helper functions with strict naming)
- Type safety & validation (TypeScript + Zod)
- Code organization & structure
- Functions & methods (single responsibility, early returns)
- Error handling & logging (Logger class, structured logging)
- Extensibility patterns (adding events, backward compatibility)
- Testing, documentation, and Bun-specific practices

Please review this document before making significant changes to the codebase.

## Import Aliases

This project uses TypeScript path aliases to simplify imports and eliminate deeply nested relative paths.

### Client Aliases (ts-web-client)

- `@shared/*` - Shared client code (components, services, utils, styles)
- `@components/*` - Shared components (shortcut to `@shared/components/*`)
- `@services/*` - Shared services (shortcut to `@shared/services/*`)
- `@utils/*` - Shared utilities (shortcut to `@shared/utils/*`)
- `@styles/*` - Shared styles (shortcut to `@shared/styles/*`)
- `@display/*` - Display client code
- `@master/*` - Master client code
- `@types` - Type definitions (re-exported from server)
- `@schemas` - Zod schemas (re-exported from server)

### Server Aliases

- `@core/*` - Core infrastructure (DI, events, state, transport, HTTP)
- `@services/*` - Business logic services
- `@utils/*` - Utility functions
- `@api/*` - HTTP API handlers
- `@types` - Type definitions
- `@schemas` - Zod validation schemas

### Examples

```typescript
// Before
import { BaseComponent } from "../../../shared/components/base/base-component";
import { EventBus } from "../../core/events/event-bus";

// After
import { BaseComponent } from "@components/base/base-component";
import { EventBus } from "@core/events/event-bus";
```

**When to use which alias:**
- Use specific aliases (`@components/*`, `@services/*`, etc.) for frequently accessed directories - they're shorter and more descriptive
- Use general aliases (`@shared/*`, `@core/*`) when accessing less common subdirectories
- Both approaches work, choose whichever is most readable for your specific import

## Runtime & Development

This project uses **Bun** as the runtime and package manager. Default to Bun for all operations.

### Common Commands

```bash
# Install all dependencies (run from root)
bun install

# Run both server and client simultaneously
bun run serve

# Server (in server/ directory)
cd server
bun run dev          # Development with hot reload
bun run serve        # Production
bun run type-check   # Type checking only

# Display Client (in ts-web-client/ directory)
cd ts-web-client
bun run dev          # Start display client on port 3001
bun run type-check   # Type checking only
```

**Quick Start:**
1. Start server: `cd server && bun run dev` (port 3000)
2. Start display client: `cd ts-web-client && bun run dev` (port 3001)
3. Open `http://localhost:3001` in browser

### Testing

Use `bun test` to run tests. Tests are written using Bun's built-in test runner.

## Architecture

### Event System

The core architecture is event-driven with a central EventBus that routes messages between the server and clients. All communication happens through typed events validated with Zod schemas.

**Event Flow:**
1. Master client sends event via WebSocket to server
2. Server validates event against Zod schema (`server/src/schemas.ts`)
3. Server emits event on internal EventBus
4. Services subscribed to event types handle state updates
5. Server broadcasts event to all connected clients via ClientRegistry
6. Display clients receive and render events

**Key Files:**
- `server/src/types.ts` - TypeScript type definitions for all events and state
- `server/src/schemas.ts` - Zod schemas for runtime validation
- `server/src/core/events/event-bus.ts` - Pub/sub event bus implementation
- `server/src/core/transport/client-registry.ts` - WebSocket client management
- `server/src/core/state/state-store.ts` - Server-side state persistence

### Dependency Injection

The server uses a simple DI container (`server/src/core/di/container.ts`) with symbol-based tokens. Services are registered either as instances or factories and resolved through the container.

**Service Registration Pattern:**
```typescript
container.registerInstance(TOKENS.EventBus, new EventBus());
container.registerFactory(TOKENS.AudioService, () => {
    return new AudioService(
        container.resolve(TOKENS.EventBus),
        container.resolve(TOKENS.StateStore),
        container.resolve(TOKENS.ClientRegistry)
    );
});
```

All service tokens are defined in `server/src/core/di/container.ts` under `TOKENS`.

### Service Architecture

Services follow a standard pattern:
1. Injected with EventBus, StateStore, and ClientRegistry
2. Subscribe to specific event types in constructor
3. Update state in StateStore
4. Broadcast events to clients via ClientRegistry

**Current Services:**
- `AudioService` (`server/src/services/audio/audio-service.ts`) - Handles audio.* events
- `ImageService` (`server/src/services/image/image-service.ts`) - Handles visual.image.* events

### State Management

State is maintained server-side in a `StateStore` which holds:
- `audio` - Audio channel states (playing, volume, loop, etc.)
- `image` - Image layer states (imageRef, position, effects, etc.)
- `clients` - Connected client registry

When new clients connect, the server sends them the current state via initial sync events.

### Client Connection Lifecycle

1. Client connects via WebSocket to `ws://localhost:3000`
2. Server generates unique `clientId` and registers client
3. Server sends current state (audio playing, images displayed, etc.)
4. Client sends events, server validates and broadcasts
5. On disconnect, server removes client from registry

## Event Types

### Event Naming Convention

Events use dot-notation namespacing with consistent patterns:
- Format: `<domain>.<action>` (e.g., `audio.play`, `visual.image.set`)
- Actions operate on entities specified in the payload
- Avoid redundant nesting (use `audio.volume` not `audio.channel.volume`)

### Audio Events

- `audio.play` - Play audio on a channel
- `audio.pause` - Pause audio on a channel
- `audio.resume` - Resume paused audio on a channel (no-op if not paused)
- `audio.stop` - Stop audio and clear channel
- `audio.volume` - Set channel volume

All audio files are served from `server/public/audio/`.

### Visual Events

- `visual.image.set` - Set image on a layer with aspect ratio and position
- `visual.image.clear` - Clear image from layer
- `visual.image.transform` - Transform image (position, scale, rotation)
- `visual.image.effect` - Apply/remove effects
- `visual.image.layer_config` - Configure layer (blend mode, opacity, z-index, visibility)

All image files are served from `server/public/images/`.

## Adding New Event Types

1. Add TypeScript types to `server/src/types.ts`
2. Add Zod schemas to `server/src/schemas.ts`
3. Add to discriminated union in `eventSchema`
4. Create or update service in `server/src/services/`
5. Register service in DI container (`server/src/main.ts`)
6. Service subscribes to event type and handles state/broadcasting

## File Structure

```
server/
├── src/
│   ├── core/           # Core infrastructure
│   │   ├── di/         # Dependency injection
│   │   ├── events/     # Event bus
│   │   ├── state/      # State store
│   │   └── transport/  # Client registry/WebSocket
│   ├── services/       # Feature services (audio, image, etc.)
│   ├── utils/          # Utilities (logger, helpers)
│   ├── types.ts        # TypeScript types
│   ├── schemas.ts      # Zod schemas
│   └── main.ts         # Entry point
└── public/             # Static assets (audio, images)

ts-web-client/
├── src/
│   ├── shared/         # Shared services (connection, events, assets)
│   ├── display/        # Display client (services + components)
│   ├── master/         # Master client (services + components)
│   └── types.ts        # Client-side types
├── server.ts           # Bun.serve() dev server
└── index.html          # Client HTML

scripts/
└── serve.ts            # Runs both server and client concurrently
```

## Web Client Architecture

**IMPORTANT:** All client code must follow the architecture and implementation standards documented in `/docs/CLIENT_ARCHITECTURE.md`. This comprehensive document defines:

- Service-driven state management (RxJS observables, singletons)
- Web Components standards (Custom Elements, Shadow DOM, lifecycle)
- TypeScript patterns (strict typing, branded types, interfaces)
- Event handling (WebSocket → EventBus → Services → Components)
- State management (immutable updates, helper functions)
- Component communication (props, events, services, slots)
- Connection resilience (EventBus independence, reconnection guarantees)
- Observable lifecycle (BehaviorSubject vs Subject, derived state patterns)
- CSS architecture (external `.css` files vs `getStyles()`)
- Testing, performance, and accessibility standards

The client architecture emphasizes **web standard APIs** (no frameworks), **service-driven logic**, and **composable single-responsibility components**.

For detailed patterns, examples, and step-by-step guidance, see `/docs/CLIENT_ARCHITECTURE.md`.

### Component Creation Workflow

When adding new components to the master client, follow the structured workflow in `/docs/COMPONENT_WORKFLOW.md`. This document covers:

- Planning phase (purpose, patterns, file structure, API design)
- Implementation templates (presentational and container components)
- Refactor pass (code reuse, testability, cohesiveness)
- Server-side integration (when new event types are needed)
- Checklists for each phase

### Display Client

Receives events from server and renders them (audio, visuals).

**Key Services:**
- `ConnectionService` - WebSocket connection with reconnection
- `EventRegistry` - Routes events to registered handlers
- `AudioService` - Manages HTMLAudioElement instances per channel
- `VisualService` - Renders image layers with effects

**Components:**
- `<audio-player>` - Audio playback visualization
- `<visual-renderer>` - Full-screen image layer renderer

### Master Client

Control interface for DM to trigger events.

**Key Services:**
- `ConnectionService` - WebSocket connection
- `AssetService` - Fetches and caches available assets
- `EventBuilder` - Type-safe event construction helpers

**Components:**
- `<audio-controls>` - Audio playback controls
- `<image-controls>` - Image/visual controls

### Client-Side Conventions

- Services are singletons that manage state
- Web Components handle view logic only
- Components access services via client instance
- Services use pub/sub pattern for state changes
- EventRegistry supports wildcard patterns (e.g., `"audio.*"`)

## Conventions

- All events must have `type`, `payload`, and `metadata` fields
- Event types use dot-notation namespacing (e.g., `audio.play`, `visual.image.set`)
- Server services are singletons registered in DI container
- Client services are singletons managed by client instance
- Use Zod for all runtime validation (server-side)
- State updates happen in services, not in main.ts or components
- Broadcast to clients via `clientRegistry.broadcast()`, not direct WebSocket access
- EventBus is local and WebSocket-independent — subscriptions survive disconnections
- Shared reducer functions (`apply{Domain}{Action}`) in `shared/services/` keep event-to-state logic DRY across display and master clients

## Code Style

**See `/docs/CODE_STANDARDS.md` for comprehensive code style standards.**

Key principles covered in the standards document:
- Single responsibility and focused functions
- Early returns and guard clauses (examples below)
- Strict naming conventions (get*, set*, update*, remove* for state helpers)
- Logger class for all logging (no direct console.* calls)
- Interface-based design (IEventBus, IStateStore, IClientRegistry)
- Immutable state updates with helper functions

### Early Returns (Summary)

Always prefer early returns for error cases, validation, and guard clauses. This reduces nesting and makes the happy path clear.

**Good:**
```typescript
function handleEvent(event: any): void {
    if (!event) {
        return;
    }

    if (!event.payload) {
        console.warn("Missing payload");
        return;
    }

    // Happy path with minimal nesting
    processEvent(event);
}
```

**Bad:**
```typescript
function handleEvent(event: any): void {
    if (event) {
        if (event.payload) {
            // Happy path buried in nesting
            processEvent(event);
        } else {
            console.warn("Missing payload");
        }
    }
}
```

### Guard Clauses

Use guard clauses at the start of functions to validate preconditions:

```typescript
function renderLayer(layerId: string): void {
    if (!this.containerElement) {
        console.warn("No container element");
        return;
    }

    const state = this.layers.get(layerId);
    if (!state) {
        console.warn("Layer not found");
        return;
    }

    // Main logic here
}
```

### Continue in Loops

Use `continue` to skip iterations early rather than wrapping logic in conditionals:

```typescript
for (const [pattern, handlers] of this.handlers.entries()) {
    if (!this.matches(event.type, pattern)) {
        continue;
    }
    // Process matching handlers
}
```
- never cast to any or unknown in TypeScript. Always use type guards to assert types.
- white-space is meaningful. Bookend related code between empty lines to convey meaning. Position properties and variables where they belong, taking into consideration visibility, importance, complexity, etc.
- keep try blocks as sparse as possible. Only wrap code that could throw errors.