# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Squire is an event-driven D&D campaign application built with Bun and TypeScript. A WebSocket server broadcasts events to connected clients, enabling synchronized audio, visual, and game state across displays and devices.

## Documentation

- `/docs/ARCHITECTURE.md` — System overview (start here)
- `/docs/FEATURE_STATUS.md` — What's built, what's planned
- `/docs/standards/CODE_STYLE.md` — Shared coding rules (TypeScript, naming, functions, errors, logging, testing)
- `/docs/standards/SERVER_STANDARDS.md` — Server-specific rules (events, DI, services, state, Zod)
- `/docs/standards/CLIENT_STANDARDS.md` — Client-specific rules (AppStore, components, observables, CSS)

**All code must follow `/docs/standards/`.** Review the relevant standards doc before making significant changes.

## Runtime & Commands

This project uses **Bun** as the runtime and package manager. No npm, yarn, Express, or ts-node.

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

# Client (in ts-web-client/ directory)
cd ts-web-client
bun run dev          # Start display client on port 3001
bun run type-check   # Type checking only

# Testing (either directory)
bun test
```

**Quick Start:**
1. Start server: `cd server && bun run dev` (port 3000)
2. Start client: `cd ts-web-client && bun run dev` (port 3001)
3. Open `http://localhost:3001` in browser

## Import Aliases

### Server (server/tsconfig.json)

- `@core/*` — Core infrastructure (DI, events, state, transport, HTTP)
- `@services/*` — Business logic services
- `@utils/*` — Utility functions
- `@api/*` — HTTP API handlers
- `@types` — Type definitions
- `@schemas` — Zod validation schemas

### Client (ts-web-client/tsconfig.json)

- `@core/*` — Core infrastructure (BaseComponent, EventBus, AppStore, ConnectionService)
- `@state/*` — Shared state reducers (audio, visual, clock)
- `@events/*` — EventBuilder
- `@gestures` / `@gestures/*` — Gesture recognition system
- `@effects/*` — Effect chain and definitions
- `@scene/*` — Scene types
- `@constants/*` — Display, drag, layer constants
- `@utils/*` — Utilities (logger, audio helpers)
- `@types` — Type definitions (re-exported from server)
- `@schemas` — Zod schemas (re-exported from server)

## Architecture

See `/docs/ARCHITECTURE.md` for the full system overview.

- **Event-driven:** master client → server (validates + broadcasts) → display clients
- **Server:** thin event router with EventBus, StateStore, EventStore, and DI container
- **Clients:** Web Components + RxJS + lit-html, no framework
- **Shared reducers:** `apply{Domain}{Action}` functions in `@state/` keep event-to-state logic DRY

### File Structure

```
server/
├── src/
│   ├── core/           # DI, events, state, transport, HTTP
│   ├── services/       # Domain services (audio, image, clock, time)
│   ├── utils/          # Logger, state-helpers
│   ├── types.ts        # All TypeScript types
│   ├── schemas.ts      # All Zod schemas
│   └── main.ts         # Entry point
└── public/             # Static assets (audio/, images/)

ts-web-client/
├── src/
│   ├── core/           # BaseComponent, EventBus, AppStore, ConnectionService
│   ├── state/          # Shared reducers (audio-channel-state, layer-state, clock-state)
│   ├── events/         # EventBuilder
│   ├── effects/        # Effect chain, definitions, presets
│   ├── gestures/       # Pointer tracking, drag/pinch recognizers
│   ├── scene/          # Scene types
│   ├── constants/      # Display, drag, layer constants
│   ├── utils/          # Logger, audio helpers
│   ├── display/        # Display client (main.ts, index.html)
│   └── master/         # Master client (main.ts, index.html, components/)
├── vite.config.ts      # Vite build config
└── tsconfig.json

scripts/
└── serve.ts            # Runs both server and client concurrently
```

### Key Server Files

- `server/src/types.ts` — TypeScript types (discriminated unions, interfaces)
- `server/src/schemas.ts` — Zod schemas (runtime validation)
- `server/src/core/events/event-bus.ts` — Pub/sub event bus
- `server/src/core/di/container.ts` — DI container + `TOKENS`
- `server/src/core/state/state-store.ts` — Server state
- `server/src/core/transport/client-registry.ts` — WebSocket clients
- `server/src/core/events/replay-configs.ts` — EventStore replay transformations

### Key Client Files

- `ts-web-client/src/core/base-component.ts` — Web Component base class
- `ts-web-client/src/core/store.ts` — AppStore (reactive state container)
- `ts-web-client/src/core/connection-service.ts` — WebSocket with reconnection
- `ts-web-client/src/core/event-bus.ts` — Client-side pub/sub
- `ts-web-client/src/events/event-builder.ts` — Type-safe event construction

## Event Types

Events use `<domain>.<action>` dot-notation (e.g., `audio.play`, `visual.image.set`). Every event has `type`, `payload`, and `metadata` fields.

### Audio Events

- `audio.play` — Play audio on a channel
- `audio.pause` — Pause audio on a channel
- `audio.resume` — Resume paused audio (no-op if not paused)
- `audio.stop` — Stop audio and clear channel
- `audio.volume` — Set channel volume

### Visual Events

- `visual.image.set` — Set image on a layer
- `visual.image.clear` — Clear image from layer
- `visual.image.transform` — Transform image (position, scale, rotation)
- `visual.image.effect` — Apply/remove effects
- `visual.image.layer_config` — Configure layer (blend mode, opacity, z-index, visibility)

Static assets served from `server/public/audio/` and `server/public/images/`.

## Code Style

See `/docs/standards/CODE_STYLE.md` for full rules. Principles that apply everywhere:

- Early returns and guard clauses — keep happy path at lowest indentation
- White-space is meaningful — bookend related code between empty lines to convey grouping and importance
- Keep try blocks sparse — only wrap code that could throw
- Never cast to `any` or `unknown` — use type guards to assert types
- Logger class for all logging — no direct `console.*` calls
- Single responsibility, focused functions
