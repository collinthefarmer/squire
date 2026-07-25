# Squire Web Clients

TypeScript web clients for the Squire D&D campaign app, built with vanilla Web Components, RxJS, and lit-html — no framework. Bun serves the TypeScript directly (see `server.ts`).

There are two clients plus a dev sandbox, all sharing one pool of code under `src/shared/`:

- **Display** (`/`) — receives server events and renders them (image layers, audio, effects).
- **Master** (`/master`) — the DM's control surface; builds and sends events, and mirrors display state.
- **Sandbox** (`/sandbox`) — an isolated playground for the gesture system.

## Directory Structure

```
src/
├── shared/              # Shared by both clients
│   ├── components/      #   BaseComponent, sq-display, sq-layer
│   ├── services/       #   EventBus, AppStore, ConnectionService, image/layer/sound/font/asset
│   ├── state/          #   Shared reducers (apply{Domain}{Action})
│   ├── events/         #   EventBuilder
│   ├── effects/        #   Effect chain, definitions, presets
│   ├── scene/          #   Scene types
│   ├── constants/      #   Display, drag, layer constants
│   ├── utils/          #   Logger, audio/geometry helpers
│   └── test-utils/     #   Test factories
├── gestures/           # Gesture recognition — stands alone (pointer tracking, recognizers)
├── display/            # Display client: main.ts, services.ts, components/ (sq-stage)
├── master/             # Master client: main.ts, services/ (own services + wiring), components/
├── sandbox/            # Dev playground for gestures
├── types.ts            # Types (re-exported from server)
└── schemas.ts          # Zod schemas (re-exported from server)
```

Path aliases are defined in `tsconfig.json` — `@shared`, `@components`, `@services`, `@state`, `@events`, `@effects`, `@scene`, `@constants`, `@utils`, `@test-utils`, `@gestures`, `@display`, `@master`, `@types`, `@schemas`. Prefer them over deep relative imports.

## Services

Every service is a plain singleton. Both clients wire the shared ones — `EventBus`, `AppStore`, `ConnectionService`, `ImageService`, `LayerService`, `SoundService`, `FontService` (with `AssetService` underneath the asset-backed ones) — in a small wiring module and export the instances:

- Display wires them in `display/services.ts`.
- Master wires the same set plus its own `SettingsService` in `master/services/index.ts`.

Components import the ready-made singletons from `@display/services` or `@master/services` rather than constructing their own.

## Development

Run from this directory (or `bun run serve` at the repo root to start server + client together):

```bash
bun run dev          # Serve all three entrypoints on port 3001
bun run type-check   # tsc --noEmit
bun run lint         # oxlint src/
bun test             # Run the suite
bun run check        # type-check + lint + test
```

Open `http://localhost:3001` for the display, `/master` for the control surface, `/sandbox` for the gesture playground. The server is expected at `wss://<host>:3000/ws`.
