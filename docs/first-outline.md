# DND Campaign App - Architecture Outline

## High-Level Architecture

### Core Components

**1. Server (Event Broadcaster)**

- Central hub that receives events from the master client and broadcasts to all connected clients
- Maintains list of connected clients and their capabilities/subscriptions
- Handles connection management (websockets/SSE for real-time communication)
- Optional: Event persistence/logging for session history
- Optional: State management (current scene, active effects, etc.)

**2. Master Client (Control Interface)**

- The "DM's console" - sends commands/events to server
- UI for triggering effects, changing scenes, playing audio, etc.
- Could be web-based, desktop app, or even CLI
- May also act as a display client simultaneously

**3. Display Clients (Event Consumers)**

- Receive events from server and render them (audio, visuals, animations)
- Register handlers for specific event types they care about
- Can ignore events they don't support
- Examples: projector display, player screens, ambient audio station

---

## Event System Design

**Event Structure**
Each event should contain:

- Event type/category (audio, visual, scene, game_log, etc.)
- Payload data specific to that event type
- Optional metadata (timestamp, priority, target clients, duration)

**Event Categories (Extensible)**

- `audio.*` - Music, sound effects, ambient sounds
- `visual.*` - Background images, overlays, animations, lighting effects
- `scene.*` - Scene transitions, map changes
- `log.*` - Combat events, story beats, dice rolls
- `state.*` - Session state, initiative tracker, timers
- `custom.*` - User-defined event types

---

## Client Handler Pattern

Clients should be able to:

- Register handlers for specific event types
- Ignore unknown event types gracefully
- Override/extend default handlers
- Queue or immediate execution modes

This allows:

- A projector client that only handles visuals
- An audio client that only plays sounds
- A full-featured client that does everything
- Custom clients for specific purposes (lighting control, props)

---

## Technology Considerations (Not Prescriptive)

**Communication Layer Options:**

- WebSockets (bidirectional, real-time)
- Server-Sent Events (simpler, one-way broadcast)
- Long polling (fallback)

**Server Options:**

- Lightweight Node.js/Python server
- Could run locally on DM's machine
- Optional cloud deployment for remote players

**Client Options:**

- Web apps (most flexible, works on any device)
- Electron/Tauri for desktop apps
- Mobile apps for tablets
- Even IoT devices (smart lights, speakers)

---

## Project Structure Concept

```
project-root/
├── server/                    # Event broadcasting server
│   ├── event-manager/         # Core event routing logic
│   ├── client-registry/       # Track connected clients
│   ├── session-store/         # Optional persistence
│   └── api/                   # REST endpoints (optional)
│
├── clients/
│   ├── master/                # DM control interface
│   │   ├── ui/                # Control panels, triggers
│   │   └── event-builders/    # Helper for creating events
│   │
│   ├── display/               # Generic display client
│   │   ├── handlers/          # Event handler implementations
│   │   │   ├── audio/
│   │   │   ├── visual/
│   │   │   └── scene/
│   │   └── renderer/          # Display logic
│   │
│   └── shared/                # Shared client utilities
│       ├── connection/        # Server connection logic
│       ├── event-types/       # Event type definitions
│       └── handler-registry/  # Handler registration system
│
├── common/                    # Shared between server & clients
│   ├── event-schema/          # Event type definitions
│   ├── protocols/             # Communication protocols
│   └── types/                 # Shared TypeScript types
│
└── assets/                    # Media assets
    ├── audio/
    ├── images/
    └── animations/
```

---

## Key Design Principles

1. **Event-Driven**: Everything is an event, loosely coupled
2. **Extensible**: Easy to add new event types without breaking existing clients
3. **Optional Handling**: Clients can ignore what they don't support
4. **Transport Agnostic**: Could swap websockets for other protocols
5. **Multi-Client**: Support heterogeneous client types simultaneously
6. **Stateless Clients**: Server can optionally hold session state
7. **Asset Management**: Events reference assets, clients handle loading/caching

---

## Example Use Cases

- **Combat Scene**: Master sends `scene.change` event → all displays switch background, audio client plays combat music
- **Thunder Effect**: Master triggers `audio.sfx` + `visual.flash` → coordinated multi-sensory effect
- **Initiative Tracker**: Master sends `state.initiative` → clients that care show initiative order
- **Ambient Tavern**: Master sets `audio.ambient` to tavern sounds + `visual.background` to tavern image

---

## Questions to Consider

Before implementation, you might want to decide:

1. **Asset Storage**: Where do media files live? (server-hosted, CDN, local client caches?)
2. **Client Discovery**: How does master know what clients are connected and their capabilities?
3. **Persistence**: Should sessions be saveable/restorable?
4. **Authentication**: Any security needed for client connections?
5. **Event History**: Should clients be able to replay recent events?
6. **Offline Mode**: Can clients work standalone without server?

---

This structure keeps things flexible and extensible while maintaining clean separation of concerns. The event system is the key - it allows you to add new features (like smart lighting control, physical prop triggers, etc.) without redesigning the core architecture.
