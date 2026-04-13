# Squire Server

Basic event broadcasting server for Squire DND app.

## Features

- WebSocket server for real-time communication
- Audio playback event handling
- Client registry and broadcasting
- Event-driven architecture
- Dependency injection

## Getting Started

### Install Dependencies

```bash
bun install
```

### Development

Run server with hot reload:

```bash
bun run dev
```

### Production

```bash
bun run start
```

## API

### WebSocket

Connect to: `ws://localhost:3000`

### Audio Events

#### Play Audio

```json
{
    "type": "audio.play",
    "payload": {
        "channel": "music",
        "source": {
            "type": "file",
            "ref": "assets/audio/combat-theme.mp3"
        },
        "volume": 0.8,
        "loop": true,
        "effects": [],
        "respectTimeScale": true
    },
    "metadata": {
        "timestamp": 1234567890,
        "source": "client-123"
    }
}
```

#### Pause Audio

```json
{
    "type": "audio.pause",
    "payload": {
        "channel": "music"
    },
    "metadata": {
        "timestamp": 1234567890,
        "source": "client-123"
    }
}
```

#### Resume Audio

```json
{
    "type": "audio.resume",
    "payload": {
        "channel": "music"
    },
    "metadata": {
        "timestamp": 1234567890,
        "source": "client-123"
    }
}
```

#### Stop Audio

```json
{
    "type": "audio.stop",
    "payload": {
        "channel": "music"
    },
    "metadata": {
        "timestamp": 1234567890,
        "source": "client-123"
    }
}
```

#### Set Volume

```json
{
    "type": "audio.volume",
    "payload": {
        "channel": "music",
        "volume": 0.5
    },
    "metadata": {
        "timestamp": 1234567890,
        "source": "client-123"
    }
}
```

## Health Check

```
GET http://localhost:3000/health
```

Returns:

```json
{
    "status": "healthy",
    "clients": 2
}
```

## Testing

You can test the server using `websocat` or any WebSocket client:

```bash
# Install websocat
brew install websocat  # or your package manager

# Connect to server
websocat ws://localhost:3000

# Send a play audio event
{"type":"audio.play","payload":{"channel":"music","source":{"type":"file","ref":"test.mp3"},"volume":0.8,"loop":false,"effects":[],"respectTimeScale":true},"metadata":{"timestamp":1234567890,"source":"test"}}
```
