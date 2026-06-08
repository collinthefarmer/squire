# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Squire is an event-driven D&D campaign application built with Bun and TypeScript. The system consists of a WebSocket server that broadcasts events to multiple connected clients, enabling synchronized audio, visual, and game state across different displays and devices.

## Documentation

- `/docs/ARCHITECTURE.md` — Human-readable system overview (start here to understand the system)
- `/docs/FEATURE_STATUS.md` — What's built, what's planned
- `/docs/standards/CODE_STANDARDS.md` — Server and general coding rules (LLM reference)
- `/docs/standards/CLIENT_STANDARDS.md` — Client coding rules, component workflow, refactoring guidance (LLM reference)

**IMPORTANT:** All code must follow the standards in `/docs/standards/`. Review before making significant changes.

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

See `/docs/ARCHITECTURE.md` for the full system overview. Key points:

- Event-driven: master client → server (validates + broadcasts) → display clients
- Server is a thin event router with EventBus, StateStore, EventStore, and DI container
- Both clients use Web Components + RxJS, no framework
- Shared reducer functions (`apply{Domain}{Action}`) keep event-to-state logic DRY across clients

**Key Files:**
- `server/src/types.ts` — TypeScript types (discriminated unions)
- `server/src/schemas.ts` — Zod schemas (runtime validation)
- `server/src/core/events/event-bus.ts` — Pub/sub event bus
- `server/src/core/di/container.ts` — DI container + `TOKENS`
- `server/src/core/state/state-store.ts` — Server state
- `server/src/core/transport/client-registry.ts` — WebSocket clients

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

All client code must follow `/docs/standards/CLIENT_STANDARDS.md`. Key principles: service-driven state (RxJS), Web Components (Shadow DOM), no frameworks, composable single-responsibility components.

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

See `/docs/standards/CODE_STANDARDS.md` for full rules. Key principles:

- Early returns and guard clauses — keep happy path at lowest indentation
- Strict naming: `get*`, `set*`, `update*`, `remove*` for state helpers
- Logger class for all logging — no direct `console.*` calls
- Immutable state updates with helper functions
- Single responsibility, focused functions
- `continue` in loops to skip early
- never cast to any or unknown in TypeScript. Always use type guards to assert types.
- white-space is meaningful. Bookend related code between empty lines to convey meaning. Position properties and variables where they belong, taking into consideration visibility, importance, complexity, etc.
- keep try blocks as sparse as possible. Only wrap code that could throw errors.