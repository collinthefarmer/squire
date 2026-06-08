# Display Client Implementation Architecture - Web

## Core Architectural Principles

### HTMX-Driven Interactions

HTMX 2 handles server communication and DOM updates with minimal JavaScript. The client is HTML-first, with HTMX attributes driving dynamic behavior.

**Key Concepts:**

- **Declarative Updates**: HTML attributes define behavior, not imperative JavaScript
- **WebSocket Events**: HTMX 2's WebSocket support receives server events
- **Partial Updates**: Replace/append DOM fragments without full page reload
- **Progressive Enhancement**: Works with basic HTML, enhanced with HTMX
- **Server-Driven UI**: Server sends HTML fragments, client renders them

### Web Components for Encapsulation

Web Components provide reusable, encapsulated UI elements. Each feature (layer renderer, audio player, countdown clock) is a custom element.

**Component Characteristics:**

- **Shadow DOM**: Encapsulated styles and markup
- **Custom Elements**: Register with `customElements.define()`
- **Lifecycle Hooks**: Connected, disconnected, attribute changed callbacks
- **Event-Based Communication**: Components emit custom events, listen to global events
- **Framework-Agnostic**: Pure web standards, no framework lock-in

### Event-Driven State Management

Like the server, the client is event-driven. Server events flow in, state updates, components re-render.

**State Flow:**

1. Server sends event via WebSocket
2. Event router parses and dispatches
3. Relevant components receive event
4. Components update internal state
5. Components re-render affected DOM

No heavy state management library needed - components hold their own state, global state lives in lightweight store.

### Shared Architecture with Master Client

Display client and master client share:

- **Core Libraries**: WebSocket client, event types, state types
- **Web Components**: Many components used by both (layer renderer, clock display)
- **Utilities**: Time calculations, asset loading, effect rendering
- **Styling**: Base CSS, design tokens, theme system

Differences:

- **Display Client**: Read-only, renders server state, no controls
- **Master Client**: Read-write, includes control panels, scene editor, mixing console

Shared code lives in `clients/shared/`, client-specific code in `clients/display/` and `clients/master/`.

## Project Structure

```
clients/
├── shared/                        # Shared between display and master
│   ├── core/                      # Core client infrastructure
│   │   ├── websocket/
│   │   │   ├── client.ts          # WebSocket client implementation
│   │   │   ├── reconnect.ts       # Reconnection logic
│   │   │   └── message-queue.ts   # Message queuing/buffering
│   │   │
│   │   ├── events/
│   │   │   ├── event-bus.ts       # Client-side event bus
│   │   │   ├── event-router.ts    # Route server events to handlers
│   │   │   └── event-types.ts     # Type definitions (imported from common/)
│   │   │
│   │   ├── state/
│   │   │   ├── store.ts           # Lightweight state store
│   │   │   ├── reactive.ts        # Reactive state primitives
│   │   │   └── sync.ts            # State sync with server
│   │   │
│   │   └── assets/
│   │       ├── loader.ts          # Asset loading (images, audio)
│   │       ├── cache.ts           # Asset caching
│   │       └── preloader.ts       # Preload assets
│   │
│   ├── components/                # Shared Web Components
│   │   ├── visual/
│   │   │   ├── layer-renderer.ts  # <squire-layer> - Single layer
│   │   │   ├── layer-stack.ts     # <squire-layer-stack> - All layers
│   │   │   ├── effects/           # Effect implementations
│   │   │   │   ├── blur.ts
│   │   │   │   ├── tint.ts
│   │   │   │   └── ...
│   │   │   └── transitions.ts     # Scene transition animations
│   │   │
│   │   ├── audio/
│   │   │   ├── audio-engine.ts    # <squire-audio-engine> - Web Audio wrapper
│   │   │   ├── channel.ts         # <squire-audio-channel> - Single channel
│   │   │   ├── effects/           # Audio effect implementations
│   │   │   │   ├── reverb.ts
│   │   │   │   ├── filter.ts
│   │   │   │   └── ...
│   │   │   └── visualizer.ts      # <squire-audio-viz> - Spectrum analyzer
│   │   │
│   │   ├── clock/
│   │   │   ├── countdown.ts       # <squire-countdown> - Countdown clock
│   │   │   ├── formats/           # Display format variants
│   │   │   │   ├── digital.ts
│   │   │   │   ├── analog.ts
│   │   │   │   └── progress-bar.ts
│   │   │   └── effects.ts         # Clock visual effects
│   │   │
│   │   └── base/
│   │       ├── component.ts       # Base component class
│   │       └── reactive.ts        # Reactive properties decorator
│   │
│   ├── utils/
│   │   ├── time.ts                # Time calculation utilities
│   │   ├── logger.ts              # Client-side logging
│   │   ├── dom.ts                 # DOM utilities
│   │   └── webgl.ts               # WebGL utilities (for effects)
│   │
│   └── styles/
│       ├── tokens.css             # Design tokens (colors, spacing)
│       ├── base.css               # Base styles
│       ├── utilities.css          # Utility classes
│       └── themes/                # Theme variations
│
├── display/                       # Display client (player view)
│   ├── src/
│   │   ├── main.ts                # Entry point
│   │   ├── app.ts                 # Main app component
│   │   │
│   │   ├── components/
│   │   │   ├── display-view.ts    # <squire-display-view> - Main display
│   │   │   ├── log-overlay.ts     # <squire-log-overlay> - Event log overlay
│   │   │   └── connection-status.ts  # <squire-connection> - Connection indicator
│   │   │
│   │   ├── handlers/              # Server event handlers
│   │   │   ├── visual-handler.ts  # Handle visual.* events
│   │   │   ├── audio-handler.ts   # Handle audio.* events
│   │   │   ├── clock-handler.ts   # Handle ui.clock.* events
│   │   │   ├── scene-handler.ts   # Handle scene.* events
│   │   │   └── time-handler.ts    # Handle time.* events
│   │   │
│   │   └── config.ts              # Display client config
│   │
│   ├── public/
│   │   ├── index.html             # Main HTML page
│   │   ├── styles.css             # Display-specific styles
│   │   └── assets/                # Static assets
│   │
│   └── package.json
│
├── master/                        # Master client (DM view)
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.ts
│   │   │
│   │   ├── components/
│   │   │   ├── master-view.ts     # Main DM interface
│   │   │   ├── controls/          # Control panels
│   │   │   │   ├── audio-mixer.ts  # Audio mixing console
│   │   │   │   ├── layer-panel.ts  # Layer management
│   │   │   │   ├── clock-panel.ts  # Clock controls
│   │   │   │   └── scene-browser.ts # Scene library
│   │   │   └── editors/           # Content editors
│   │   │       ├── scene-editor.ts
│   │   │       └── effect-editor.ts
│   │   │
│   │   └── config.ts
│   │
│   └── public/
│       └── index.html
│
└── common/                        # Shared type definitions (from server)
    ├── events.ts                  # Event payload types
    ├── state.ts                   # State shape types
    └── protocols.ts               # Communication protocols
```

## Core Infrastructure

### WebSocket Client

**Responsibilities:**

- Connect to server
- Handle reconnection with exponential backoff
- Send events to server (master client only)
- Receive events from server
- Queue messages during disconnect
- Emit connection status events

**Implementation:**

```typescript
// Conceptual interface

class WebSocketClient {
  private ws: WebSocket | null;
  private reconnectAttempts: number;
  private messageQueue: Message[];

  constructor(
    private url: string,
    private eventBus: EventBus,
  ) {}

  connect(): void {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.eventBus.emit("connection:open", {});
      this.flushMessageQueue();
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.eventBus.emit(`server:${message.type}`, message);
    };

    this.ws.onclose = () => {
      this.eventBus.emit("connection:close", {});
      this.scheduleReconnect();
    };

    this.ws.onerror = (error) => {
      this.eventBus.emit("connection:error", { error });
    };
  }

  send(event: Event): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event));
    } else {
      this.messageQueue.push(event);
    }
  }

  private scheduleReconnect(): void {
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30000);
    setTimeout(() => this.connect(), delay);
    this.reconnectAttempts++;
  }
}
```

**HTMX Integration:**

HTMX 2 has built-in WebSocket support:

```html
<div hx-ws="connect:/ws">
  <!-- HTMX automatically handles WebSocket connection -->

  <!-- Send events (master client) -->
  <button hx-ws="send:{'type': 'audio.play', 'payload': {...}}">
    Play Audio
  </button>
</div>
```

However, for complex event handling and state management, a custom WebSocket client provides more control. HTMX can still trigger sends via JavaScript:

```javascript
htmx.ajax('ws', '/ws', {
  verb: 'send',
  values: { type: 'audio.play', payload: {...} }
})
```

### Event Bus

**Responsibilities:**

- Client-side pub/sub system
- Route server events to handlers
- Allow components to emit local events
- Type-safe event handling

**Implementation:**

```typescript
type EventHandler<T = any> = (event: T) => void;

class EventBus {
  private handlers: Map<string, Set<EventHandler>>;

  on<T>(eventType: string, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType).add(handler);

    // Return unsubscribe function
    return () => this.off(eventType, handler);
  }

  off(eventType: string, handler: EventHandler): void {
    this.handlers.get(eventType)?.delete(handler);
  }

  emit<T>(eventType: string, event: T): void {
    const handlers = this.handlers.get(eventType);
    if (!handlers) return;

    handlers.forEach((handler) => {
      try {
        handler(event);
      } catch (error) {
        console.error(`Error in event handler for ${eventType}:`, error);
      }
    });
  }
}

// Global singleton
export const eventBus = new EventBus();
```

### State Store

**Responsibilities:**

- Hold current client state
- Provide reactive state updates
- Sync with server state
- Notify subscribers of changes

**Reactive State with Proxies:**

```typescript
type StateListener<T> = (newValue: T, oldValue: T) => void

class ReactiveStore<T extends object> {
  private listeners: Map<string, Set<StateListener<any>>>
  private state: T

  constructor(initialState: T) {
    this.listeners = new Map()
    this.state = this.makeReactive(initialState)
  }

  private makeReactive(obj: any, path: string = ''): any {
    return new Proxy(obj, {
      get: (target, prop) => {
        const value = target[prop]
        if (typeof value === 'object' && value !== null) {
          return this.makeReactive(value, `${path}${prop}.`)
        }
        return value
      },

      set: (target, prop, value) => {
        const oldValue = target[prop]
        target[prop] = value

        const fullPath = `${path}${String(prop)}`
        this.notify(fullPath, value, oldValue)

        return true
      }
    })
  }

  get<K extends keyof T>(key: K): T[K] {
    return this.state[key]
  }

  set<K extends keyof T>(key: K, value: T[K]): void {
    this.state[key] = value
  }

  subscribe<V>(path: string, listener: StateListener<V>): () => void {
    if (!this.listeners.has(path)) {
      this.listeners.set(path, new Set())
    }
    this.listeners.get(path).add(listener)

    return () => this.unsubscribe(path, listener)
  }

  private notify(path: string, newValue: any, oldValue: any): void {
    this.listeners.get(path)?.forEach(listener => listener(newValue, oldValue))
  }
}

// Global state store
interface ClientState {
  audio: AudioClientState
  visual: VisualClientState
  clocks: ClocksClientState
  time: TimeClientState
  connection: ConnectionState
}

export const store = new ReactiveStore<ClientState>({...})
```

### Asset Loader

**Responsibilities:**

- Load images and audio files
- Cache loaded assets
- Preload anticipated assets
- Handle loading errors gracefully

**Implementation:**

```typescript
class AssetLoader {
  private imageCache: Map<string, HTMLImageElement>;
  private audioCache: Map<string, AudioBuffer>;
  private audioContext: AudioContext;

  constructor() {
    this.imageCache = new Map();
    this.audioCache = new Map();
    this.audioContext = new AudioContext();
  }

  async loadImage(url: string): Promise<HTMLImageElement> {
    if (this.imageCache.has(url)) {
      return this.imageCache.get(url)!;
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.imageCache.set(url, img);
        resolve(img);
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  async loadAudio(url: string): Promise<AudioBuffer> {
    if (this.audioCache.has(url)) {
      return this.audioCache.get(url)!;
    }

    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

    this.audioCache.set(url, audioBuffer);
    return audioBuffer;
  }

  async preload(assets: {
    images?: string[];
    audio?: string[];
  }): Promise<void> {
    const promises: Promise<any>[] = [];

    assets.images?.forEach((url) => promises.push(this.loadImage(url)));
    assets.audio?.forEach((url) => promises.push(this.loadAudio(url)));

    await Promise.allSettled(promises);
  }

  clearCache(): void {
    this.imageCache.clear();
    this.audioCache.clear();
  }
}

export const assetLoader = new AssetLoader();
```

## Web Components

### Base Component

**Shared base class for all components:**

```typescript
class SquireComponent extends HTMLElement {
  protected eventBus: EventBus;
  protected unsubscribers: (() => void)[];

  constructor() {
    super();
    this.eventBus = eventBus;
    this.unsubscribers = [];
    this.attachShadow({ mode: "open" });
  }

  connectedCallback(): void {
    this.render();
    this.setupEventListeners();
  }

  disconnectedCallback(): void {
    this.cleanup();
  }

  protected render(): void {
    // Override in subclass
  }

  protected setupEventListeners(): void {
    // Override in subclass
  }

  protected cleanup(): void {
    // Unsubscribe from all events
    this.unsubscribers.forEach((unsub) => unsub());
    this.unsubscribers = [];
  }

  protected subscribe(eventType: string, handler: EventHandler): void {
    const unsub = this.eventBus.on(eventType, handler.bind(this));
    this.unsubscribers.push(unsub);
  }

  protected emit(eventType: string, detail: any): void {
    this.dispatchEvent(new CustomEvent(eventType, { detail, bubbles: true }));
  }
}
```

### Layer Stack Component

**`<squire-layer-stack>` - Renders all visual layers**

**Responsibilities:**

- Render all layers in z-index order
- Apply blend modes and opacity
- Handle layer transitions
- Resize responsively

**Usage:**

```html
<squire-layer-stack></squire-layer-stack>
```

**Implementation Sketch:**

```typescript
class LayerStackComponent extends SquireComponent {
  private layers: LayerState[] = [];

  connectedCallback(): void {
    super.connectedCallback();

    // Subscribe to visual events
    this.subscribe("server:visual.image.set", this.handleImageSet);
    this.subscribe("server:visual.image.clear", this.handleImageClear);
    this.subscribe("server:scene.loaded", this.handleSceneLoad);

    // Load initial state from store
    this.layers = store.get("visual").layers;
    this.render();
  }

  protected render(): void {
    if (!this.shadowRoot) return;

    // Sort layers by z-index
    const sortedLayers = [...this.layers].sort((a, b) => a.zIndex - b.zIndex);

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          position: relative;
          width: 100%;
          height: 100%;
          overflow: hidden;
        }
      </style>
      <div class="layer-container">
        ${sortedLayers.map((layer) => this.renderLayer(layer)).join("")}
      </div>
    `;
  }

  private renderLayer(layer: LayerState): string {
    if (!layer.visible || !layer.imageRef) return "";

    return `
      <squire-layer
        alias="${layer.alias}"
        src="${layer.imageRef}"
        opacity="${layer.opacity}"
        blend-mode="${layer.blendMode}"
        aspect-ratio="${layer.aspectRatio}"
        effects='${JSON.stringify(layer.effects)}'
      ></squire-layer>
    `;
  }

  private handleImageSet(event: Event<ImageSetPayload>): void {
    // Update layer state
    const layerIndex = this.layers.findIndex(
      (l) => l.alias === event.payload.layer,
    );
    if (layerIndex >= 0) {
      this.layers[layerIndex] = {
        ...this.layers[layerIndex],
        ...event.payload,
      };
    } else {
      this.layers.push({ alias: event.payload.layer, ...event.payload });
    }

    // Re-render
    this.render();
  }
}

customElements.define("squire-layer-stack", LayerStackComponent);
```

### Layer Component

**`<squire-layer>` - Renders a single layer with effects**

**Responsibilities:**

- Load and display image
- Apply aspect ratio fitting
- Apply visual effects (blur, tint, etc.)
- Handle transitions

**Usage:**

```html
<squire-layer
  alias="background"
  src="assets/images/tavern.jpg"
  opacity="1.0"
  blend-mode="normal"
  aspect-ratio="cover"
  effects='[{"type": "blur", "params": {"radius": 5}}]'
></squire-layer>
```

**Implementation with Canvas/WebGL:**

```typescript
class LayerComponent extends SquireComponent {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private image: HTMLImageElement | null;

  static observedAttributes = ["src", "opacity", "effects"];

  connectedCallback(): void {
    super.connectedCallback();
    this.render();
    this.loadImage();
  }

  protected render(): void {
    this.shadowRoot!.innerHTML = `
      <style>
        :host {
          display: block;
          position: absolute;
          inset: 0;
        }
        canvas {
          width: 100%;
          height: 100%;
          object-fit: ${this.getAttribute("aspect-ratio") || "cover"};
        }
      </style>
      <canvas></canvas>
    `;

    this.canvas = this.shadowRoot!.querySelector("canvas")!;
    this.ctx = this.canvas.getContext("2d");
  }

  private async loadImage(): Promise<void> {
    const src = this.getAttribute("src");
    if (!src) return;

    this.image = await assetLoader.loadImage(src);
    this.draw();
  }

  private draw(): void {
    if (!this.image || !this.ctx) return;

    // Set canvas size to match display size
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;

    // Draw image with aspect ratio fitting
    this.drawWithAspectRatio();

    // Apply effects
    this.applyEffects();
  }

  private drawWithAspectRatio(): void {
    const mode = this.getAttribute("aspect-ratio") || "cover";
    const canvasRatio = this.canvas.width / this.canvas.height;
    const imageRatio = this.image!.width / this.image!.height;

    let drawWidth, drawHeight, drawX, drawY;

    if (mode === "cover") {
      if (canvasRatio > imageRatio) {
        drawWidth = this.canvas.width;
        drawHeight = drawWidth / imageRatio;
        drawX = 0;
        drawY = (this.canvas.height - drawHeight) / 2;
      } else {
        drawHeight = this.canvas.height;
        drawWidth = drawHeight * imageRatio;
        drawX = (this.canvas.width - drawWidth) / 2;
        drawY = 0;
      }
    } else if (mode === "contain") {
      if (canvasRatio > imageRatio) {
        drawHeight = this.canvas.height;
        drawWidth = drawHeight * imageRatio;
        drawX = (this.canvas.width - drawWidth) / 2;
        drawY = 0;
      } else {
        drawWidth = this.canvas.width;
        drawHeight = drawWidth / imageRatio;
        drawX = 0;
        drawY = (this.canvas.height - drawHeight) / 2;
      }
    } else {
      // fill
      drawWidth = this.canvas.width;
      drawHeight = this.canvas.height;
      drawX = 0;
      drawY = 0;
    }

    this.ctx!.drawImage(this.image!, drawX, drawY, drawWidth, drawHeight);
  }

  private applyEffects(): void {
    const effectsAttr = this.getAttribute("effects");
    if (!effectsAttr) return;

    const effects = JSON.parse(effectsAttr);
    effects.forEach((effect: VisualEffect) => {
      this.applyEffect(effect);
    });
  }

  private applyEffect(effect: VisualEffect): void {
    switch (effect.type) {
      case "blur":
        this.ctx!.filter = `blur(${effect.params.radius}px)`;
        break;
      case "tint":
        this.ctx!.globalCompositeOperation = "multiply";
        this.ctx!.fillStyle = effect.params.color;
        this.ctx!.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx!.globalCompositeOperation = "source-over";
        break;
      // ... more effects
    }
  }

  attributeChangedCallback(
    name: string,
    oldValue: string,
    newValue: string,
  ): void {
    if (name === "src") {
      this.loadImage();
    } else {
      this.draw();
    }
  }
}

customElements.define("squire-layer", LayerComponent);
```

For complex effects, use WebGL via a shader system. Effects like ripple, chromatic aberration, etc. benefit from GPU acceleration.

### Audio Engine Component

**`<squire-audio-engine>` - Manages Web Audio API context and channels**

**Responsibilities:**

- Initialize AudioContext
- Create audio channels
- Route channels to master output
- Apply time scale to playback rate
- Handle ducking

**Usage:**

```html
<squire-audio-engine></squire-audio-engine>
```

**Implementation:**

```typescript
class AudioEngineComponent extends SquireComponent {
  private audioContext: AudioContext;
  private masterGain: GainNode;
  private channels: Map<string, AudioChannelNode>;

  connectedCallback(): void {
    super.connectedCallback();

    // Initialize Web Audio
    this.audioContext = new AudioContext();
    this.masterGain = this.audioContext.createGain();
    this.masterGain.connect(this.audioContext.destination);

    this.channels = new Map();

    // Subscribe to audio events
    this.subscribe("server:audio.play", this.handlePlay);
    this.subscribe("server:audio.pause", this.handlePause);
    this.subscribe("server:audio.stop", this.handleStop);
    this.subscribe("server:audio.channel.volume", this.handleVolumeChange);
    this.subscribe("server:time.scale_changed", this.handleTimeScaleChange);
  }

  private async handlePlay(event: Event<AudioPlayPayload>): Promise<void> {
    const { channel, source, volume, loop, effects, respectTimeScale } =
      event.payload;

    // Load audio buffer
    const buffer = await assetLoader.loadAudio(source.ref);

    // Create channel if doesn't exist
    if (!this.channels.has(channel)) {
      this.channels.set(
        channel,
        new AudioChannelNode(this.audioContext, this.masterGain),
      );
    }

    const channelNode = this.channels.get(channel)!;
    channelNode.play(buffer, { volume, loop, effects, respectTimeScale });
  }

  private handlePause(event: Event<AudioPausePayload>): void {
    const channelNode = this.channels.get(event.payload.channel);
    channelNode?.pause();
  }

  private handleTimeScaleChange(event: Event<TimeScalePayload>): void {
    const scale = event.payload.scale;

    this.channels.forEach((channel) => {
      if (channel.respectsTimeScale) {
        channel.setPlaybackRate(scale);
      }
    });
  }
}

class AudioChannelNode {
  private sourceNode: AudioBufferSourceNode | null;
  private gainNode: GainNode;
  private effectNodes: AudioNode[];
  public respectsTimeScale: boolean;

  constructor(
    private audioContext: AudioContext,
    private destination: AudioNode,
  ) {
    this.gainNode = audioContext.createGain();
    this.effectNodes = [];
  }

  play(buffer: AudioBuffer, options: PlayOptions): void {
    // Stop existing playback
    this.sourceNode?.stop();

    // Create source node
    this.sourceNode = this.audioContext.createBufferSource();
    this.sourceNode.buffer = buffer;
    this.sourceNode.loop = options.loop;
    this.respectsTimeScale = options.respectTimeScale;

    // Set volume
    this.gainNode.gain.value = options.volume;

    // Build effect chain
    let currentNode: AudioNode = this.sourceNode;

    options.effects?.forEach((effect) => {
      const effectNode = this.createEffectNode(effect);
      currentNode.connect(effectNode);
      currentNode = effectNode;
      this.effectNodes.push(effectNode);
    });

    // Connect to output
    currentNode.connect(this.gainNode);
    this.gainNode.connect(this.destination);

    // Start playback
    this.sourceNode.start();
  }

  pause(): void {
    // Web Audio doesn't support pause, need to track position and restart
    // Implementation requires tracking currentTime and using offset parameter
  }

  setPlaybackRate(rate: number): void {
    if (this.sourceNode) {
      this.sourceNode.playbackRate.value = rate;
    }
  }

  private createEffectNode(effect: AudioEffect): AudioNode {
    switch (effect.type) {
      case "reverb":
        return this.createReverbNode(effect.params);
      case "filter":
        return this.createFilterNode(effect.params);
      // ... more effects
      default:
        return this.audioContext.createGain(); // pass-through
    }
  }

  private createReverbNode(params: any): ConvolverNode {
    const convolver = this.audioContext.createConvolver();
    // Load impulse response for reverb
    // ...
    return convolver;
  }

  private createFilterNode(params: any): BiquadFilterNode {
    const filter = this.audioContext.createBiquadFilter();
    filter.type = params.filterType || "lowpass";
    filter.frequency.value = params.frequency || 1000;
    filter.Q.value = params.q || 1;
    return filter;
  }
}

customElements.define("squire-audio-engine", AudioEngineComponent);
```

### Countdown Clock Component

**`<squire-countdown>` - Displays countdown clock**

**Responsibilities:**

- Render clock in specified format
- Update countdown based on time scale
- Trigger visual effects at thresholds
- Handle visibility modes

**Usage:**

```html
<squire-countdown
  id="turn-timer"
  remaining="30000"
  duration="30000"
  format="digital"
  style-theme="dramatic"
  visibility="always"
></squire-countdown>
```

**Implementation:**

```typescript
class CountdownComponent extends SquireComponent {
  private remaining: number;
  private lastUpdate: number;
  private animationFrame: number | null;

  static observedAttributes = ["remaining", "format", "style-theme"];

  connectedCallback(): void {
    super.connectedCallback();

    this.remaining = parseInt(this.getAttribute("remaining") || "0");
    this.lastUpdate = performance.now();

    this.render();
    this.startTicking();

    // Subscribe to time scale changes
    this.subscribe("server:time.scale_changed", this.handleTimeScaleChange);
    this.subscribe("server:ui.clock.tick", this.handleServerTick);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
  }

  protected render(): void {
    const format = this.getAttribute("format") || "digital";
    const styleTheme = this.getAttribute("style-theme") || "minimal";

    this.shadowRoot!.innerHTML = `
      <style>
        ${this.getThemeStyles(styleTheme)}
      </style>
      <div class="clock ${styleTheme}">
        ${this.renderFormat(format)}
      </div>
    `;
  }

  private renderFormat(format: string): string {
    switch (format) {
      case "digital":
        return this.renderDigital();
      case "analog":
        return this.renderAnalog();
      case "progress-bar":
        return this.renderProgressBar();
      default:
        return this.renderDigital();
    }
  }

  private renderDigital(): string {
    const seconds = Math.max(0, Math.floor(this.remaining / 1000));
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;

    return `
      <div class="digital-display">
        <span class="minutes">${minutes.toString().padStart(2, "0")}</span>
        <span class="separator">:</span>
        <span class="seconds">${secs.toString().padStart(2, "0")}</span>
      </div>
    `;
  }

  private renderAnalog(): string {
    const duration = parseInt(this.getAttribute("duration") || "0");
    const progress = this.remaining / duration;
    const degrees = progress * 360;

    return `
      <svg class="analog-clock" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" class="background" />
        <circle
          cx="50"
          cy="50"
          r="45"
          class="progress"
          style="--progress: ${degrees}deg"
        />
      </svg>
    `;
  }

  private renderProgressBar(): string {
    const duration = parseInt(this.getAttribute("duration") || "0");
    const progress = (this.remaining / duration) * 100;

    return `
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${progress}%"></div>
      </div>
    `;
  }

  private startTicking(): void {
    const tick = (now: number) => {
      const deltaMs = now - this.lastUpdate;
      this.lastUpdate = now;

      // Get current time scale
      const timeScale = store.get("time").scale;

      // Update remaining time
      const scaledDelta = deltaMs * timeScale;
      this.remaining = Math.max(0, this.remaining - scaledDelta);

      // Re-render
      this.render();

      // Check for completion
      if (this.remaining <= 0) {
        this.handleCompletion();
      } else {
        this.animationFrame = requestAnimationFrame(tick);
      }
    };

    this.animationFrame = requestAnimationFrame(tick);
  }

  private handleTimeScaleChange(event: Event<TimeScalePayload>): void {
    // Time scale updated in store, tick loop will use new value
  }

  private handleServerTick(event: Event<ClockTickPayload>): void {
    // Server sends periodic sync to prevent drift
    if (event.payload.clockId === this.getAttribute("id")) {
      this.remaining = event.payload.remaining;
    }
  }

  private handleCompletion(): void {
    this.emit("countdown:complete", { clockId: this.getAttribute("id") });

    // Apply completion effect
    this.shadowRoot!.querySelector(".clock")?.classList.add("completed");
  }

  private getThemeStyles(theme: string): string {
    // Return CSS for theme (dramatic, minimal, arcane, etc.)
    return `
      .clock {
        font-family: 'Courier New', monospace;
        font-size: 3rem;
        text-align: center;
      }
      /* ... theme-specific styles */
    `;
  }
}

customElements.define("squire-countdown", CountdownComponent);
```

### Log Overlay Component

**`<squire-log-overlay>` - Displays recent events**

**Responsibilities:**

- Show recent log events
- Filter by event type
- Auto-scroll or manual scroll
- Fade out old events

**Usage:**

```html
<squire-log-overlay
  max-events="10"
  filter="combat,rolls"
  auto-fade="true"
></squire-log-overlay>
```

**Implementation:**

```typescript
class LogOverlayComponent extends SquireComponent {
  private events: LogEvent[] = [];

  connectedCallback(): void {
    super.connectedCallback();

    this.subscribe("server:log.write", this.handleLogEvent);
    this.render();
  }

  protected render(): void {
    const maxEvents = parseInt(this.getAttribute("max-events") || "10");
    const recentEvents = this.events.slice(-maxEvents);

    this.shadowRoot!.innerHTML = `
      <style>
        :host {
          position: fixed;
          bottom: 20px;
          left: 20px;
          right: 20px;
          pointer-events: none;
          z-index: 1000;
        }
        .event {
          background: rgba(0, 0, 0, 0.7);
          color: white;
          padding: 8px 12px;
          margin: 4px 0;
          border-radius: 4px;
          animation: fadeIn 0.3s ease-in;
        }
        .event.fading {
          animation: fadeOut 1s ease-out forwards;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeOut {
          to { opacity: 0; }
        }
      </style>
      <div class="events">
        ${recentEvents.map((e) => this.renderEvent(e)).join("")}
      </div>
    `;

    // Auto-fade if enabled
    if (this.getAttribute("auto-fade") === "true") {
      this.scheduleAutoFade();
    }
  }

  private renderEvent(event: LogEvent): string {
    return `
      <div class="event ${event.eventType}">
        ${this.formatEvent(event)}
      </div>
    `;
  }

  private formatEvent(event: LogEvent): string {
    switch (event.eventType) {
      case "roll.attack":
        return `<strong>${event.data.character}</strong> rolled ${event.data.total} to hit`;
      case "combat.damage":
        return `<strong>${event.data.target}</strong> takes ${event.data.amount} damage`;
      default:
        return event.note || event.eventType;
    }
  }

  private handleLogEvent(event: Event<LogWritePayload>): void {
    // Check filter
    const filter = this.getAttribute("filter")?.split(",") || [];
    if (
      filter.length > 0 &&
      !filter.some((f) => event.payload.eventType.startsWith(f))
    ) {
      return;
    }

    this.events.push(event.payload);
    this.render();
  }

  private scheduleAutoFade(): void {
    setTimeout(() => {
      const eventElements = this.shadowRoot!.querySelectorAll(".event");
      eventElements.forEach((el) => el.classList.add("fading"));
    }, 5000);
  }
}

customElements.define("squire-log-overlay", LogOverlayComponent);
```

### Connection Status Component

**`<squire-connection>` - Shows WebSocket connection status**

**Usage:**

```html
<squire-connection></squire-connection>
```

**Implementation:**

```typescript
class ConnectionStatusComponent extends SquireComponent {
  private status: "connected" | "disconnected" | "reconnecting";

  connectedCallback(): void {
    super.connectedCallback();

    this.subscribe("connection:open", () => this.setStatus("connected"));
    this.subscribe("connection:close", () => this.setStatus("disconnected"));
    this.subscribe("connection:reconnecting", () =>
      this.setStatus("reconnecting"),
    );

    this.render();
  }

  private setStatus(status: typeof this.status): void {
    this.status = status;
    this.render();
  }

  protected render(): void {
    const icons = {
      connected: "●",
      disconnected: "○",
      reconnecting: "◐",
    };

    const colors = {
      connected: "green",
      disconnected: "red",
      reconnecting: "yellow",
    };

    this.shadowRoot!.innerHTML = `
      <style>
        .status {
          position: fixed;
          top: 10px;
          right: 10px;
          padding: 4px 8px;
          border-radius: 4px;
          background: rgba(0, 0, 0, 0.7);
          color: ${colors[this.status]};
          font-size: 0.9rem;
        }
      </style>
      <div class="status">
        ${icons[this.status]} ${this.status}
      </div>
    `;
  }
}

customElements.define("squire-connection", ConnectionStatusComponent);
```

## Display Client Application

### Main HTML Structure

**public/index.html:**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Squire - Display</title>
    <link rel="stylesheet" href="/styles.css" />
    <script type="module" src="/src/main.ts"></script>
  </head>
  <body>
    <!-- Connection status -->
    <squire-connection></squire-connection>

    <!-- Main display area -->
    <squire-display-view>
      <!-- Visual layers -->
      <squire-layer-stack></squire-layer-stack>

      <!-- Countdown clocks (rendered dynamically) -->
      <div id="clocks-container"></div>

      <!-- Log overlay -->
      <squire-log-overlay max-events="5" auto-fade="true"></squire-log-overlay>
    </squire-display-view>

    <!-- Audio engine (invisible) -->
    <squire-audio-engine></squire-audio-engine>
  </body>
</html>
```

### Main Entry Point

**src/main.ts:**

```typescript
import { eventBus } from "../shared/core/events/event-bus";
import { WebSocketClient } from "../shared/core/websocket/client";
import { store } from "../shared/core/state/store";

// Import all components (registers custom elements)
import "../shared/components/visual/layer-stack";
import "../shared/components/visual/layer-renderer";
import "../shared/components/audio/audio-engine";
import "../shared/components/clock/countdown";
import "./components/log-overlay";
import "./components/connection-status";
import "./components/display-view";

// Import event handlers
import { VisualHandler } from "./handlers/visual-handler";
import { AudioHandler } from "./handlers/audio-handler";
import { ClockHandler } from "./handlers/clock-handler";
import { TimeHandler } from "./handlers/time-handler";
import { SceneHandler } from "./handlers/scene-handler";

// Initialize application
async function init() {
  // Load config
  const config = {
    serverUrl: import.meta.env.VITE_SERVER_URL || "ws://localhost:3000/ws",
    clientType: "display",
  };

  // Initialize WebSocket client
  const wsClient = new WebSocketClient(config.serverUrl, eventBus);
  wsClient.connect();

  // Initialize event handlers
  new VisualHandler(eventBus, store);
  new AudioHandler(eventBus, store);
  new ClockHandler(eventBus, store);
  new TimeHandler(eventBus, store);
  new SceneHandler(eventBus, store);

  // Ready
  console.log("Squire Display Client initialized");
}

// Start when DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
```

### Event Handlers

**src/handlers/clock-handler.ts:**

```typescript
export class ClockHandler {
  constructor(
    private eventBus: EventBus,
    private store: ReactiveStore,
  ) {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.eventBus.on("server:ui.clock.create", this.handleCreate.bind(this));
    this.eventBus.on("server:ui.clock.destroy", this.handleDestroy.bind(this));
    this.eventBus.on("server:ui.clock.tick", this.handleTick.bind(this));
  }

  private handleCreate(event: Event<ClockCreatePayload>): void {
    // Update store
    const clocks = this.store.get("clocks");
    clocks.set(event.payload.id, event.payload);

    // Create DOM element
    const container = document.getElementById("clocks-container");
    if (!container) return;

    const clockElement = document.createElement("squire-countdown");
    clockElement.setAttribute("id", event.payload.id);
    clockElement.setAttribute("remaining", event.payload.duration.toString());
    clockElement.setAttribute("duration", event.payload.duration.toString());
    clockElement.setAttribute("format", event.payload.style || "digital");
    clockElement.setAttribute("visibility", event.payload.visibility);

    container.appendChild(clockElement);
  }

  private handleDestroy(event: Event<ClockDestroyPayload>): void {
    // Remove from store
    const clocks = this.store.get("clocks");
    clocks.delete(event.payload.id);

    // Remove DOM element
    const clockElement = document.getElementById(event.payload.id);
    clockElement?.remove();
  }

  private handleTick(event: Event<ClockTickPayload>): void {
    // Server sync - update clock element
    const clockElement = document.getElementById(
      event.payload.clockId,
    ) as CountdownComponent;
    if (clockElement) {
      clockElement.setAttribute(
        "remaining",
        event.payload.remaining.toString(),
      );
    }
  }
}
```

## HTMX Integration Patterns

While the display client is mostly reactive (receiving server events), HTMX can still enhance certain interactions:

### Polling for Updates

If WebSocket connection fails, fall back to polling:

```html
<div
  hx-get="/api/state"
  hx-trigger="every 2s"
  hx-swap="none"
  hx-on::after-request="handleStateUpdate(event)"
></div>
```

### Loading States

Show loading indicators during asset loading:

```html
<div hx-trigger="load">
  <div class="htmx-indicator">Loading...</div>
</div>
```

### Error Handling

Display connection errors:

```html
<div
  hx-get="/api/health"
  hx-trigger="every 10s"
  hx-swap="outerHTML"
  hx-target="#health-status"
>
  <div id="health-status">Checking connection...</div>
</div>
```

### Reconnection UI

Trigger reconnection attempts:

```html
<button
  hx-post="/api/reconnect"
  hx-trigger="click"
  hx-swap="none"
  hx-on::after-request="location.reload()"
>
  Reconnect
</button>
```

## Shared Architecture

### Shared Component Library

Both display and master clients use the same base components:

- `<squire-layer-stack>` - Display renders layers, master previews them
- `<squire-countdown>` - Both show clocks
- `<squire-audio-engine>` - Both play audio

**Difference:** Master client wraps components with controls:

```html
<!-- Display client: just render -->
<squire-layer-stack></squire-layer-stack>

<!-- Master client: render + controls -->
<div class="layer-editor">
  <squire-layer-stack></squire-layer-stack>
  <layer-control-panel></layer-control-panel>
</div>
```

### Shared State Types

Types defined in `common/` are imported by both:

```typescript
// common/state.ts
export interface VisualState {
  layers: Map<string, LayerState>;
}

export interface LayerState {
  alias: string;
  zIndex: number;
  imageRef: string | null;
  // ... etc
}

// Both clients import
import { VisualState, LayerState } from "../common/state";
```

### Shared Utilities

Time calculations, asset loading, effect rendering - all shared:

```typescript
// shared/utils/time.ts
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

// Both clients use it
import { formatDuration } from "../../shared/utils/time";
```

## Build and Development

### Vite Configuration

Use Vite for fast dev server and optimized builds:

**vite.config.ts:**

```typescript
import { defineConfig } from "vite";

export default defineConfig({
  root: "./public",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@shared": "/clients/shared",
      "@common": "/common",
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/ws": {
        target: "ws://localhost:3000",
        ws: true,
      },
      "/api": {
        target: "http://localhost:3000",
      },
    },
  },
});
```

### Development Workflow

```bash
# Terminal 1: Start server
cd server
bun run dev

# Terminal 2: Start display client
cd clients/display
bun run dev  # or npm run dev

# Terminal 3: Start master client
cd clients/master
bun run dev
```

### Production Build

```bash
# Build display client
cd clients/display
bun run build
# Output: dist/

# Build master client
cd clients/master
bun run build
# Output: dist/

# Serve static files from server or CDN
```

## Performance Optimizations

### Lazy Component Loading

Load components on-demand:

```typescript
// Only import clock component when needed
async function showClock(id: string) {
  await import("../shared/components/clock/countdown");

  const clock = document.createElement("squire-countdown");
  clock.setAttribute("id", id);
  document.body.appendChild(clock);
}
```

### Virtual Scrolling for Logs

For long log lists, use virtual scrolling:

```typescript
// Only render visible log entries
class VirtualLogList extends SquireComponent {
  private visibleRange: [number, number];

  protected render(): void {
    const [start, end] = this.visibleRange;
    const visibleEvents = this.events.slice(start, end);

    // Render only visible events
    this.shadowRoot!.innerHTML = `
      <div style="height: ${this.events.length * 40}px">
        <div style="transform: translateY(${start * 40}px)">
          ${visibleEvents.map((e) => this.renderEvent(e)).join("")}
        </div>
      </div>
    `;
  }
}
```

### Web Workers for Heavy Processing

Offload effect rendering, large state updates:

```typescript
// worker.ts
self.onmessage = (e) => {
  const { type, data } = e.data

  if (type === 'apply-effect') {
    const result = applyComplexEffect(data)
    self.postMessage({ type: 'effect-result', result })
  }
}

// main.ts
const worker = new Worker('/worker.ts')
worker.postMessage({ type: 'apply-effect', data: {...} })
worker.onmessage = (e) => {
  // Use result
}
```

### Debouncing Rapid Events

Debounce high-frequency events like slider changes:

```typescript
import { debounce } from "../shared/utils/debounce";

class VolumeSlider extends SquireComponent {
  private handleChange = debounce((value: number) => {
    this.emit("volume:change", { value });
  }, 100);
}
```

## Testing

### Component Testing

Test components in isolation:

```typescript
import { expect, test } from "vitest";
import "./layer-renderer";

test("LayerComponent renders image", async () => {
  const layer = document.createElement("squire-layer");
  layer.setAttribute("src", "test.jpg");
  layer.setAttribute("aspect-ratio", "cover");

  document.body.appendChild(layer);
  await layer.updateComplete;

  const canvas = layer.shadowRoot.querySelector("canvas");
  expect(canvas).toBeTruthy();
});
```

### Integration Testing

Test component interactions:

```typescript
test("Clock updates when time event received", async () => {
  const clock = document.createElement("squire-countdown");
  clock.setAttribute("remaining", "30000");
  document.body.appendChild(clock);

  // Emit time scale change
  eventBus.emit("server:time.scale_changed", { payload: { scale: 0.5 } });

  await new Promise((resolve) => setTimeout(resolve, 200));

  // Clock should have updated at half speed
  const newRemaining = parseInt(clock.getAttribute("remaining"));
  expect(newRemaining).toBeCloseTo(29900, -2);
});
```

### E2E Testing with Playwright

Test full client behavior:

```typescript
import { test, expect } from '@playwright/test'

test('Display client renders scene', async ({ page }) => {
  await page.goto('http://localhost:5173')

  // Wait for WebSocket connection
  await page.waitForSelector('squire-connection:has-text("connected")')

  // Trigger scene load from server
  await page.evaluate(() => {
    window.eventBus.emit('server:scene.loaded', {
      payload: { sceneId: 'test-scene', ... }
    })
  })

  // Verify layers rendered
  const layers = await page.locator('squire-layer').count()
  expect(layers).toBeGreaterThan(0)
})
```

## Security Considerations

### Content Security Policy

Restrict what can execute:

```html
<meta
  http-equiv="Content-Security-Policy"
  content="
    default-src 'self';
    connect-src 'self' ws://localhost:3000;
    img-src 'self' data: blob:;
    style-src 'self' 'unsafe-inline';
    script-src 'self';
  "
/>
```

### Input Sanitization

Sanitize any user-generated content in logs:

```typescript
import DOMPurify from "dompurify";

function renderLogEvent(event: LogEvent): string {
  const sanitized = DOMPurify.sanitize(event.note);
  return `<div>${sanitized}</div>`;
}
```

### WebSocket Authentication

Include auth token in WebSocket connection:

```typescript
const token = localStorage.getItem("auth-token");
const wsClient = new WebSocketClient(
  `ws://localhost:3000/ws?token=${token}`,
  eventBus,
);
```

## Deployment

### Static Hosting

Display client is just static files, can host anywhere:

- Netlify, Vercel, GitHub Pages
- Server's static file endpoint
- CDN (CloudFront, Cloudflare)

**Build output:**

```
dist/
├── index.html
├── assets/
│   ├── main-[hash].js
│   ├── main-[hash].css
│   └── ...
└── ...
```

### Docker

Serve with nginx:

```dockerfile
FROM nginx:alpine
COPY dist/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Progressive Web App

Make it installable:

**manifest.json:**

```json
{
  "name": "Squire Display",
  "short_name": "Squire",
  "start_url": "/",
  "display": "fullscreen",
  "background_color": "#000000",
  "theme_color": "#000000",
  "icons": [...]
}
```

**Service Worker for offline support:**

```typescript
// Cache assets for offline use
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("squire-v1").then((cache) => {
      return cache.addAll(["/", "/assets/main.js", "/assets/main.css"]);
    }),
  );
});
```

## Summary

This architecture provides:

- **Web Standards**: Web Components, native APIs, progressive enhancement
- **HTMX Simplicity**: Declarative, HTML-first where applicable
- **Shared Code**: Maximum reuse between display and master clients
- **Performance**: Lazy loading, Web Workers, efficient rendering
- **Maintainability**: Component-based, event-driven, clear separation
- **Extensibility**: Easy to add new components and features
- **Deployment**: Static files, works anywhere

The display client is a lightweight, reactive renderer that receives server events and updates the DOM through Web Components. HTMX handles any server communication needs, while custom JavaScript manages real-time WebSocket events and complex rendering (audio, visual effects). The architecture shares as much as possible with the master client while keeping display-specific concerns isolated.
