# Client Architecture

This document describes the web client architecture for both Master and Display clients.

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         SERVER                              │
│                  (WebSocket Broadcast)                      │
└────────────┬──────────────────────────────────┬─────────────┘
             │                                  │
             │ Events                           │ Events
             ▼                                  ▼
┌─────────────────────────┐        ┌──────────────────────────┐
│    MASTER CLIENT        │        │    DISPLAY CLIENT        │
│  (Control Interface)    │        │  (Event Consumer)        │
├─────────────────────────┤        ├──────────────────────────┤
│ Services:               │        │ Services:                │
│  - ConnectionService    │        │  - ConnectionService     │
│  - AssetService         │        │  - EventRegistry         │
│  - EventBuilder         │        │  - AudioService          │
│                         │        │  - VisualService         │
├─────────────────────────┤        ├──────────────────────────┤
│ Components:             │        │ Components:              │
│  <audio-controls>       │        │  <audio-player>          │
│  <image-controls>       │        │  <visual-renderer>       │
└─────────────────────────┘        └──────────────────────────┘
```

## Service Architecture

### Shared Services

**ConnectionService** (`shared/connection/connection-service.ts`)
- Manages WebSocket connection lifecycle
- Handles reconnection with exponential backoff
- Publishes connection status changes
- Routes incoming messages to subscribers

**EventRegistry** (`shared/events/event-registry.ts`)
- Registers handlers for specific event types
- Supports wildcard pattern matching (e.g., "audio.*")
- Dispatches events to all matching handlers
- Used by display client to route events to services

**AssetService** (`shared/services/asset-service.ts`)
- Fetches available audio/image assets from server
- Caches asset lists
- Provides URL resolution by asset reference
- Used by master client for asset pickers

### Display Client Services

**AudioService** (`display/services/audio-service.ts`)
- Subscribes to `audio.*` events via EventRegistry
- Manages HTMLAudioElement instances per channel
- Maintains playback state for all channels
- Handles play, pause, stop, volume events

**VisualService** (`display/services/visual-service.ts`)
- Subscribes to `visual.*` events via EventRegistry
- Manages image layers with z-index, opacity, blend modes
- Handles image set/clear, transforms, effects, layer config
- Renders layers to DOM container element

### Master Client Services

**EventBuilder** (`master/services/event-builder.ts`)
- Helper methods to construct well-formed events
- Ensures proper event structure and validation
- Provides type-safe event creation
- Used by control components to build events before sending

## Component Architecture

### Web Components

All UI is built with standard Web Components using the Custom Elements API. Components use Shadow DOM for encapsulation.

**Display Components:**
- `<audio-player>` - Visualizes current audio playback state
- `<visual-renderer>` - Full-screen image layer renderer

**Master Components:**
- `<audio-controls>` - Control panel for audio events (channel, asset, volume, loop)
- `<image-controls>` - Control panel for visual events (layer, image, aspect ratio, opacity)

### Component-Service Communication

Components access singleton services through the client instance:

```typescript
// Display client example
const client = new DisplayClient("ws://localhost:3000");
await client.initialize();

const services = client.getServices();
// Components can access services.audio, services.visual, etc.
```

Components subscribe to service state changes and re-render when needed.

## Event Flow

### Display Client Event Flow

```
WebSocket Message
  ↓
ConnectionService.onMessage()
  ↓
EventRegistry.dispatch()
  ↓
Service Handlers (AudioService, VisualService)
  ↓
DOM Updates / HTMLAudioElement control
```

### Master Client Event Flow

```
User Interaction (button click)
  ↓
Component Event Handler
  ↓
EventBuilder.buildXXX()
  ↓
ConnectionService.send()
  ↓
WebSocket → Server
```

## State Management

State is managed at the service level, not in components. Services are singletons that maintain canonical state and provide methods for querying it.

- **AudioService** maintains `Map<channel, AudioChannelState>`
- **VisualService** maintains `Map<layer, ImageLayerState>`
- **AssetService** maintains cached asset lists

Components query services for current state and subscribe to changes via callbacks.

## Adding New Event Types

1. Add types to `ts-web-client/src/types.ts`
2. For display clients: Create service in `display/services/` if needed
3. Service subscribes to event pattern in EventRegistry
4. Service implements handler methods
5. For master clients: Add builder method to `EventBuilder`
6. Create control component in `master/components/` if needed

## Design Principles

- **Separation of Concerns**: Services handle logic, components handle UI
- **Singleton Services**: One instance per client for state consistency
- **Event-Driven**: Services react to events, not direct coupling
- **Extensible**: New event types don't break existing handlers
- **Type-Safe**: TypeScript interfaces ensure contract compliance
