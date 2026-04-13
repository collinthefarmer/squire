# Squire Web Clients

TypeScript web clients for the Squire D&D campaign app, built with Web Components and singleton services.

## Architecture

### Display Client

The display client receives events from the server and renders them (audio, visuals, etc.).

**Services:**
- `ConnectionService` - WebSocket connection management
- `EventRegistry` - Event handler registration and dispatch
- `AudioService` - Audio playback on multiple channels
- `VisualService` - Image layer rendering and effects

**Components:**
- `<audio-player>` - Audio playback visualization
- `<visual-renderer>` - Image layer renderer

### Master Client

The master client provides the DM control interface for triggering events.

**Services:**
- `ConnectionService` - WebSocket connection management
- `AssetService` - Asset list management (audio/image files)
- `EventBuilder` - Helper for constructing events

**Components:**
- `<audio-controls>` - Audio playback controls
- `<image-controls>` - Image/visual controls

## Directory Structure

```
src/
├── shared/              # Shared between master and display
│   ├── connection/      # WebSocket connection service
│   ├── events/          # Event registry
│   └── services/        # Shared services (assets, etc.)
├── display/             # Display client
│   ├── services/        # Audio, visual services
│   ├── components/      # Web Components
│   └── display-client.ts
├── master/              # Master client
│   ├── services/        # Event builder
│   ├── components/      # Web Components
│   └── master-client.ts
└── types.ts             # Shared type definitions
```

## Development

See root CLAUDE.md for build commands.

## Usage

### Display Client

```typescript
import { DisplayClient } from "./src/display/display-client";

const client = new DisplayClient("ws://localhost:3000");
await client.initialize();
```

### Master Client

```typescript
import { MasterClient } from "./src/master/master-client";

const client = new MasterClient("ws://localhost:3000");
await client.initialize();

// Send events
const event = client.getServices().eventBuilder.buildAudioPlay({
    channel: "music",
    assetRef: "combat-theme.mp3",
    volume: 0.8,
    loop: true,
});
client.sendEvent(event);
```
