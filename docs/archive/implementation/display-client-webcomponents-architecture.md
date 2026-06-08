# Display Client Implementation Architecture - Pure Web Components

## Core Architectural Principles

### Web Standards First

Built entirely on web platform APIs - no frameworks, minimal dependencies. Everything uses native browser capabilities.

**Key Technologies:**

- **Custom Elements**: Define reusable components
- **Shadow DOM**: Encapsulated styles and markup
- **ES Modules**: Native module system
- **Web Components**: Lifecycle callbacks, attributes, events
- **Observable Pattern**: Custom event-based reactivity
- **WebSocket API**: Native WebSocket communication
- **Web Audio API**: Native audio processing
- **Canvas API**: Visual rendering

### Functional Services

Services are pure functions and function collections, not classes. State is immutable and flows through functions.

**Service Characteristics:**

- **Pure Functions**: No side effects where possible
- **Function Composition**: Small functions compose into larger ones
- **Immutable State**: State transformations return new state
- **Module Pattern**: Services exported as function collections
- **No Classes**: Prefer functions and closures over OOP
- **Declarative**: Describe what, not how

### Reactive State Management

Lightweight observable pattern for reactive updates without external libraries.

**Reactivity Pattern:**

- **State Store**: Single source of truth
- **Subscriptions**: Components subscribe to state changes
- **Immutable Updates**: State updates create new objects
- **Selective Updates**: Only notify subscribers of changed paths
- **No Virtual DOM**: Direct DOM updates where needed

### Shared Architecture

Display and master clients share nearly all code:

- **Services**: All business logic shared
- **Components**: Base components shared
- **State**: Same state management
- **WebSocket**: Same connection logic
- **Utilities**: All helpers shared

Only UI controls differ between clients.

## Project Structure

```
clients/
├── shared/
│   ├── services/                  # Functional services
│   │   ├── websocket.js           # WebSocket connection
│   │   ├── state.js               # State management
│   │   ├── events.js              # Event bus
│   │   ├── assets.js              # Asset loading
│   │   ├── audio-engine.js        # Web Audio wrapper
│   │   ├── time.js                # Time calculations
│   │   └── effects.js             # Visual/audio effects
│   │
│   ├── components/                # Shared Web Components
│   │   ├── base/
│   │   │   ├── base-component.js  # Base component utilities
│   │   │   └── connection-status.js
│   │   │
│   │   ├── visual/
│   │   │   ├── layer-stack.js
│   │   │   ├── layer-canvas.js
│   │   │   └── effects/
│   │   │       ├── blur-effect.js
│   │   │       ├── tint-effect.js
│   │   │       └── index.js
│   │   │
│   │   ├── audio/
│   │   │   ├── audio-engine.js
│   │   │   └── audio-visualizer.js
│   │   │
│   │   └── clock/
│   │       ├── countdown-clock.js
│   │       ├── digital-display.js
│   │       ├── analog-display.js
│   │       └── progress-bar.js
│   │
│   ├── utils/
│   │   ├── dom.js                 # DOM utilities
│   │   ├── canvas.js              # Canvas helpers
│   │   ├── math.js                # Math utilities
│   │   └── logger.js              # Logging
│   │
│   └── styles/
│       ├── variables.css
│       ├── base.css
│       └── animations.css
│
├── display/                       # Display client
│   ├── src/
│   │   ├── main.js                # Entry point
│   │   ├── components/
│   │   │   ├── display-view.js
│   │   │   ├── log-overlay.js
│   │   │   └── clock-container.js
│   │   └── config.js
│   │
│   ├── public/
│   │   ├── index.html
│   │   └── styles.css
│   │
│   └── package.json
│
├── master/                        # Master client
│   ├── src/
│   │   ├── main.js
│   │   ├── components/
│   │   │   ├── master-view.js
│   │   │   ├── controls/
│   │   │   │   ├── audio-mixer.js
│   │   │   │   ├── layer-panel.js
│   │   │   │   ├── clock-panel.js
│   │   │   │   └── scene-browser.js
│   │   │   └── editors/
│   │   │       ├── scene-editor.js
│   │   │       └── effect-editor.js
│   │   └── config.js
│   │
│   └── public/
│       └── index.html
│
└── common/                        # Type definitions (JSDoc)
    └── types.js
```

## Functional Services

### State Service

**Responsibilities:**

- Manage application state
- Provide subscription mechanism
- Immutable state updates
- Path-based subscriptions

**Implementation:**

```javascript
// shared/services/state.js

/**
 * Create a reactive state store
 * @returns {Object} Store API
 */
export function createStore(initialState = {}) {
  let state = initialState;
  const listeners = new Map(); // path -> Set of callbacks

  /**
   * Get current state
   * @param {string} [path] - Optional path to nested value
   * @returns {*} State or nested value
   */
  function getState(path) {
    if (!path) return state;

    return path.split(".").reduce((obj, key) => obj?.[key], state);
  }

  /**
   * Set state (immutably)
   * @param {string|Object} pathOrState - Path to update or full state object
   * @param {*} [value] - Value to set at path
   */
  function setState(pathOrState, value) {
    if (typeof pathOrState === "string") {
      // Update specific path
      const path = pathOrState;
      state = updatePath(state, path, value);
      notify(path, value);
    } else {
      // Replace entire state
      const newState = pathOrState;
      state = newState;
      notify("*", newState);
    }
  }

  /**
   * Subscribe to state changes
   * @param {string} path - Path to subscribe to ('*' for all)
   * @param {Function} callback - Called when path changes
   * @returns {Function} Unsubscribe function
   */
  function subscribe(path, callback) {
    if (!listeners.has(path)) {
      listeners.set(path, new Set());
    }
    listeners.get(path).add(callback);

    // Return unsubscribe function
    return () => {
      listeners.get(path)?.delete(callback);
    };
  }

  /**
   * Notify subscribers of changes
   * @private
   */
  function notify(path, value) {
    // Notify exact path subscribers
    listeners.get(path)?.forEach((callback) => callback(value, path));

    // Notify wildcard subscribers
    listeners.get("*")?.forEach((callback) => callback(value, path));

    // Notify parent path subscribers
    const parts = path.split(".");
    for (let i = parts.length - 1; i > 0; i--) {
      const parentPath = parts.slice(0, i).join(".");
      listeners.get(parentPath)?.forEach((callback) => callback(value, path));
    }
  }

  /**
   * Update nested path immutably
   * @private
   */
  function updatePath(obj, path, value) {
    const keys = path.split(".");
    const lastKey = keys.pop();

    let current = obj;
    const newObj = { ...obj };
    let newCurrent = newObj;

    for (const key of keys) {
      newCurrent[key] = { ...current[key] };
      current = current[key];
      newCurrent = newCurrent[key];
    }

    newCurrent[lastKey] = value;
    return newObj;
  }

  return {
    getState,
    setState,
    subscribe,
  };
}

// Global store instance
export const store = createStore({
  audio: {
    channels: new Map(),
    masterVolume: 1.0,
  },
  visual: {
    layers: new Map(),
  },
  clocks: {
    clocks: new Map(),
  },
  time: {
    scale: 1.0,
    lastChange: Date.now(),
  },
  connection: {
    status: "disconnected",
    error: null,
  },
  logs: {
    events: [],
  },
});
```

### WebSocket Service

**Responsibilities:**

- Manage WebSocket connection
- Handle reconnection
- Send and receive events
- Queue messages during disconnect

**Implementation:**

```javascript
// shared/services/websocket.js

import { store } from "./state.js";
import { emit } from "./events.js";

/**
 * Create WebSocket client
 * @param {string} url - WebSocket URL
 * @returns {Object} WebSocket API
 */
export function createWebSocket(url) {
  let ws = null;
  let reconnectAttempts = 0;
  let reconnectTimer = null;
  const messageQueue = [];

  /**
   * Connect to server
   */
  function connect() {
    ws = new WebSocket(url);

    ws.onopen = handleOpen;
    ws.onmessage = handleMessage;
    ws.onclose = handleClose;
    ws.onerror = handleError;
  }

  /**
   * Send event to server
   * @param {Object} event - Event to send
   */
  function send(event) {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
    } else {
      messageQueue.push(event);
    }
  }

  /**
   * Disconnect from server
   */
  function disconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    ws?.close();
  }

  /**
   * Handle connection open
   * @private
   */
  function handleOpen() {
    store.setState("connection.status", "connected");
    reconnectAttempts = 0;

    // Flush message queue
    while (messageQueue.length > 0) {
      const message = messageQueue.shift();
      send(message);
    }

    emit("connection:open", {});
  }

  /**
   * Handle incoming message
   * @private
   */
  function handleMessage(event) {
    try {
      const message = JSON.parse(event.data);
      routeEvent(message);
    } catch (error) {
      console.error("Failed to parse message:", error);
    }
  }

  /**
   * Handle connection close
   * @private
   */
  function handleClose() {
    store.setState("connection.status", "disconnected");
    emit("connection:close", {});
    scheduleReconnect();
  }

  /**
   * Handle connection error
   * @private
   */
  function handleError(error) {
    console.error("WebSocket error:", error);
    store.setState("connection.error", error.message);
    emit("connection:error", { error });
  }

  /**
   * Schedule reconnection attempt
   * @private
   */
  function scheduleReconnect() {
    const delay = Math.min(1000 * 2 ** reconnectAttempts, 30000);
    reconnectAttempts++;

    store.setState("connection.status", "reconnecting");

    reconnectTimer = setTimeout(() => {
      connect();
    }, delay);
  }

  /**
   * Route event to appropriate handler
   * @private
   */
  function routeEvent(event) {
    // Emit as custom event for handlers to catch
    emit(`server:${event.type}`, event);
  }

  return {
    connect,
    send,
    disconnect,
  };
}
```

### Events Service

**Responsibilities:**

- Event bus for pub/sub
- Type-safe event emission
- Wildcard subscriptions

**Implementation:**

```javascript
// shared/services/events.js

const listeners = new Map();

/**
 * Subscribe to events
 * @param {string} eventType - Event type (supports wildcards: 'audio.*')
 * @param {Function} handler - Event handler
 * @returns {Function} Unsubscribe function
 */
export function on(eventType, handler) {
  if (!listeners.has(eventType)) {
    listeners.set(eventType, new Set());
  }

  listeners.get(eventType).add(handler);

  return () => off(eventType, handler);
}

/**
 * Unsubscribe from events
 * @param {string} eventType - Event type
 * @param {Function} handler - Event handler to remove
 */
export function off(eventType, handler) {
  listeners.get(eventType)?.delete(handler);
}

/**
 * Emit event
 * @param {string} eventType - Event type
 * @param {*} data - Event data
 */
export function emit(eventType, data) {
  // Exact match listeners
  listeners.get(eventType)?.forEach((handler) => {
    try {
      handler(data, eventType);
    } catch (error) {
      console.error(`Error in handler for ${eventType}:`, error);
    }
  });

  // Wildcard listeners (e.g., 'audio.*' matches 'audio.play')
  listeners.forEach((handlers, pattern) => {
    if (pattern.includes("*")) {
      const regex = new RegExp("^" + pattern.replace("*", ".*") + "$");
      if (regex.test(eventType)) {
        handlers.forEach((handler) => {
          try {
            handler(data, eventType);
          } catch (error) {
            console.error(`Error in wildcard handler for ${eventType}:`, error);
          }
        });
      }
    }
  });
}

/**
 * Emit event once, then remove all listeners
 * @param {string} eventType - Event type
 * @param {*} data - Event data
 */
export function once(eventType, handler) {
  const unsubscribe = on(eventType, (data) => {
    handler(data);
    unsubscribe();
  });
  return unsubscribe;
}
```

### Assets Service

**Responsibilities:**

- Load and cache images
- Load and cache audio
- Preload assets
- Track loading progress

**Implementation:**

```javascript
// shared/services/assets.js

const imageCache = new Map();
const audioCache = new Map();
const audioContext = new AudioContext();

/**
 * Load image
 * @param {string} url - Image URL
 * @returns {Promise<HTMLImageElement>} Loaded image
 */
export async function loadImage(url) {
  if (imageCache.has(url)) {
    return imageCache.get(url);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imageCache.set(url, img);
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Load audio buffer
 * @param {string} url - Audio URL
 * @returns {Promise<AudioBuffer>} Decoded audio buffer
 */
export async function loadAudio(url) {
  if (audioCache.has(url)) {
    return audioCache.get(url);
  }

  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = await audioContext.decodeAudioData(arrayBuffer);

  audioCache.set(url, buffer);
  return buffer;
}

/**
 * Preload multiple assets
 * @param {Object} assets - Assets to preload
 * @param {string[]} [assets.images] - Image URLs
 * @param {string[]} [assets.audio] - Audio URLs
 * @param {Function} [onProgress] - Progress callback
 * @returns {Promise<void>}
 */
export async function preloadAssets(assets, onProgress) {
  const total = (assets.images?.length || 0) + (assets.audio?.length || 0);
  let loaded = 0;

  const updateProgress = () => {
    loaded++;
    onProgress?.(loaded / total);
  };

  const promises = [];

  assets.images?.forEach((url) => {
    promises.push(loadImage(url).then(updateProgress));
  });

  assets.audio?.forEach((url) => {
    promises.push(loadAudio(url).then(updateProgress));
  });

  await Promise.allSettled(promises);
}

/**
 * Clear all caches
 */
export function clearCache() {
  imageCache.clear();
  audioCache.clear();
}

/**
 * Get audio context
 * @returns {AudioContext}
 */
export function getAudioContext() {
  return audioContext;
}
```

### Audio Engine Service

**Responsibilities:**

- Manage Web Audio nodes
- Create and control channels
- Apply time scale
- Handle effects

**Implementation:**

```javascript
// shared/services/audio-engine.js

import { getAudioContext } from "./assets.js";
import { store } from "./state.js";

const audioContext = getAudioContext();
const masterGain = audioContext.createGain();
masterGain.connect(audioContext.destination);

const channels = new Map();

/**
 * Channel node structure
 * @typedef {Object} ChannelNode
 * @property {AudioBufferSourceNode} sourceNode
 * @property {GainNode} gainNode
 * @property {AudioNode[]} effectNodes
 * @property {boolean} respectsTimeScale
 * @property {number} startTime
 */

/**
 * Play audio on channel
 * @param {string} channelId - Channel identifier
 * @param {AudioBuffer} buffer - Audio buffer to play
 * @param {Object} options - Playback options
 * @returns {void}
 */
export function play(channelId, buffer, options = {}) {
  const {
    volume = 1.0,
    loop = false,
    effects = [],
    respectTimeScale = true,
  } = options;

  // Stop existing playback
  stop(channelId);

  // Create or get channel
  if (!channels.has(channelId)) {
    const gainNode = audioContext.createGain();
    channels.set(channelId, {
      sourceNode: null,
      gainNode,
      effectNodes: [],
      respectsTimeScale: respectTimeScale,
      startTime: 0,
    });
  }

  const channel = channels.get(channelId);

  // Create source
  const sourceNode = audioContext.createBufferSource();
  sourceNode.buffer = buffer;
  sourceNode.loop = loop;

  // Apply time scale
  if (channel.respectsTimeScale) {
    const timeScale = store.getState("time.scale");
    sourceNode.playbackRate.value = timeScale;
  }

  // Set volume
  channel.gainNode.gain.value = volume;

  // Build effect chain
  let currentNode = sourceNode;

  effects.forEach((effect) => {
    const effectNode = createEffectNode(effect);
    currentNode.connect(effectNode);
    currentNode = effectNode;
    channel.effectNodes.push(effectNode);
  });

  // Connect to master
  currentNode.connect(channel.gainNode);
  channel.gainNode.connect(masterGain);

  // Store and start
  channel.sourceNode = sourceNode;
  channel.startTime = audioContext.currentTime;
  sourceNode.start();
}

/**
 * Stop audio on channel
 * @param {string} channelId - Channel identifier
 */
export function stop(channelId) {
  const channel = channels.get(channelId);
  if (!channel?.sourceNode) return;

  channel.sourceNode.stop();
  channel.sourceNode = null;
  channel.effectNodes.forEach((node) => node.disconnect());
  channel.effectNodes = [];
}

/**
 * Set channel volume
 * @param {string} channelId - Channel identifier
 * @param {number} volume - Volume (0-1)
 */
export function setVolume(channelId, volume) {
  const channel = channels.get(channelId);
  if (!channel) return;

  channel.gainNode.gain.value = volume;
}

/**
 * Set master volume
 * @param {number} volume - Master volume (0-1)
 */
export function setMasterVolume(volume) {
  masterGain.gain.value = volume;
}

/**
 * Apply time scale to all channels
 * @param {number} scale - Time scale multiplier
 */
export function applyTimeScale(scale) {
  channels.forEach((channel) => {
    if (channel.respectsTimeScale && channel.sourceNode) {
      channel.sourceNode.playbackRate.value = scale;
    }
  });
}

/**
 * Create effect node
 * @private
 */
function createEffectNode(effect) {
  switch (effect.type) {
    case "filter": {
      const filter = audioContext.createBiquadFilter();
      filter.type = effect.params.filterType || "lowpass";
      filter.frequency.value = effect.params.frequency || 1000;
      filter.Q.value = effect.params.q || 1;
      return filter;
    }

    case "delay": {
      const delay = audioContext.createDelay();
      delay.delayTime.value = (effect.params.delayTime || 500) / 1000;
      return delay;
    }

    case "reverb": {
      const convolver = audioContext.createConvolver();
      // Load impulse response
      return convolver;
    }

    default:
      // Pass-through
      return audioContext.createGain();
  }
}

/**
 * Get all channels
 * @returns {Map<string, ChannelNode>}
 */
export function getChannels() {
  return channels;
}
```

### Time Service

**Responsibilities:**

- Calculate scaled time
- Format durations
- Time utilities

**Implementation:**

```javascript
// shared/services/time.js

import { store } from "./state.js";

/**
 * Calculate scaled duration
 * @param {number} realDuration - Real duration in ms
 * @returns {number} Scaled duration in ms
 */
export function calculateScaledDuration(realDuration) {
  const scale = store.getState("time.scale");
  return realDuration * scale;
}

/**
 * Format duration as MM:SS
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted time
 */
export function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Get current time scale
 * @returns {number} Current time scale
 */
export function getTimeScale() {
  return store.getState("time.scale");
}

/**
 * Check if time is paused
 * @returns {boolean}
 */
export function isPaused() {
  return getTimeScale() === 0;
}
```

### Effects Service

**Responsibilities:**

- Apply visual effects to canvas
- Apply audio effects
- Effect presets

**Implementation:**

```javascript
// shared/services/effects.js

/**
 * Apply visual effect to canvas context
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} effect - Effect definition
 */
export function applyVisualEffect(ctx, effect) {
  switch (effect.type) {
    case "blur":
      ctx.filter = `blur(${effect.params.radius}px)`;
      break;

    case "tint": {
      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = effect.params.color;
      ctx.globalAlpha = effect.params.intensity || 1;
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.restore();
      break;
    }

    case "brightness":
      ctx.filter = `brightness(${effect.params.amount})`;
      break;

    case "contrast":
      ctx.filter = `contrast(${effect.params.amount})`;
      break;

    case "saturate":
      ctx.filter = `saturate(${effect.params.amount})`;
      break;

    case "grayscale":
      ctx.filter = "grayscale(100%)";
      break;

    default:
      console.warn("Unknown effect type:", effect.type);
  }
}

/**
 * Calculate aspect ratio draw dimensions
 * @param {number} canvasWidth - Canvas width
 * @param {number} canvasHeight - Canvas height
 * @param {number} imageWidth - Image width
 * @param {number} imageHeight - Image height
 * @param {string} mode - Aspect ratio mode ('cover', 'contain', 'fill')
 * @returns {Object} Draw dimensions {x, y, width, height}
 */
export function calculateAspectRatio(
  canvasWidth,
  canvasHeight,
  imageWidth,
  imageHeight,
  mode,
) {
  const canvasRatio = canvasWidth / canvasHeight;
  const imageRatio = imageWidth / imageHeight;

  let width, height, x, y;

  if (mode === "cover") {
    if (canvasRatio > imageRatio) {
      width = canvasWidth;
      height = width / imageRatio;
      x = 0;
      y = (canvasHeight - height) / 2;
    } else {
      height = canvasHeight;
      width = height * imageRatio;
      x = (canvasWidth - width) / 2;
      y = 0;
    }
  } else if (mode === "contain") {
    if (canvasRatio > imageRatio) {
      height = canvasHeight;
      width = height * imageRatio;
      x = (canvasWidth - width) / 2;
      y = 0;
    } else {
      width = canvasWidth;
      height = width / imageRatio;
      x = 0;
      y = (canvasHeight - height) / 2;
    }
  } else {
    // fill
    width = canvasWidth;
    height = canvasHeight;
    x = 0;
    y = 0;
  }

  return { x, y, width, height };
}
```

## Web Components

### Base Component Utilities

**Shared utilities for all components:**

```javascript
// shared/components/base/base-component.js

/**
 * Base class for custom elements
 */
export class BaseComponent extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._unsubscribers = [];
  }

  connectedCallback() {
    this.render();
    this.setupListeners();
  }

  disconnectedCallback() {
    this.cleanup();
  }

  /**
   * Override in subclass
   */
  render() {}

  /**
   * Override in subclass
   */
  setupListeners() {}

  /**
   * Cleanup subscriptions
   */
  cleanup() {
    this._unsubscribers.forEach((unsub) => unsub());
    this._unsubscribers = [];
  }

  /**
   * Subscribe to state changes
   * @param {string} path - State path
   * @param {Function} callback - Callback function
   */
  subscribe(path, callback) {
    import("../../services/state.js").then(({ store }) => {
      const unsub = store.subscribe(path, callback.bind(this));
      this._unsubscribers.push(unsub);
    });
  }

  /**
   * Subscribe to events
   * @param {string} eventType - Event type
   * @param {Function} handler - Event handler
   */
  on(eventType, handler) {
    import("../../services/events.js").then(({ on }) => {
      const unsub = on(eventType, handler.bind(this));
      this._unsubscribers.push(unsub);
    });
  }

  /**
   * Emit custom event
   * @param {string} eventType - Event type
   * @param {*} detail - Event detail
   */
  emit(eventType, detail) {
    this.dispatchEvent(
      new CustomEvent(eventType, {
        detail,
        bubbles: true,
        composed: true,
      }),
    );
  }

  /**
   * Get template HTML
   * Override in subclass
   * @returns {string} HTML template
   */
  template() {
    return "";
  }

  /**
   * Get styles
   * Override in subclass
   * @returns {string} CSS styles
   */
  styles() {
    return "";
  }

  /**
   * Update shadow DOM
   */
  updateDOM() {
    this.shadowRoot.innerHTML = `
      <style>${this.styles()}</style>
      ${this.template()}
    `;
  }
}
```

### Layer Stack Component

```javascript
// shared/components/visual/layer-stack.js

import { BaseComponent } from "../base/base-component.js";
import "./layer-canvas.js";

class LayerStack extends BaseComponent {
  constructor() {
    super();
    this.layers = [];
  }

  connectedCallback() {
    super.connectedCallback();

    // Subscribe to visual state changes
    this.subscribe("visual.layers", (layers) => {
      this.layers = Array.from(layers.values()).sort(
        (a, b) => a.zIndex - b.zIndex,
      );
      this.render();
    });
  }

  render() {
    this.updateDOM();
  }

  template() {
    return `
      <div class="layer-stack">
        ${this.layers.map((layer) => this.renderLayer(layer)).join("")}
      </div>
    `;
  }

  renderLayer(layer) {
    if (!layer.visible || !layer.imageRef) return "";

    return `
      <layer-canvas
        data-alias="${layer.alias}"
        data-src="${layer.imageRef}"
        data-opacity="${layer.opacity}"
        data-blend-mode="${layer.blendMode}"
        data-aspect-ratio="${layer.aspectRatio}"
        data-effects='${JSON.stringify(layer.effects)}'
        style="z-index: ${layer.zIndex}"
      ></layer-canvas>
    `;
  }

  styles() {
    return `
      .layer-stack {
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
      }

      layer-canvas {
        position: absolute;
        inset: 0;
      }
    `;
  }
}

customElements.define("layer-stack", LayerStack);
```

### Layer Canvas Component

```javascript
// shared/components/visual/layer-canvas.js

import { BaseComponent } from "../base/base-component.js";
import { loadImage } from "../../services/assets.js";
import {
  applyVisualEffect,
  calculateAspectRatio,
} from "../../services/effects.js";

class LayerCanvas extends BaseComponent {
  constructor() {
    super();
    this.canvas = null;
    this.ctx = null;
    this.image = null;
    this.resizeObserver = null;
  }

  static get observedAttributes() {
    return ["data-src", "data-opacity", "data-effects", "data-aspect-ratio"];
  }

  connectedCallback() {
    super.connectedCallback();
    this.render();
    this.setupCanvas();
    this.loadImage();
    this.observeResize();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;

    if (name === "data-src") {
      this.loadImage();
    } else {
      this.draw();
    }
  }

  render() {
    this.updateDOM();
    this.canvas = this.shadowRoot.querySelector("canvas");
    this.ctx = this.canvas?.getContext("2d");
  }

  setupCanvas() {
    if (!this.canvas) return;

    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
  }

  async loadImage() {
    const src = this.dataset.src;
    if (!src) return;

    try {
      this.image = await loadImage(src);
      this.draw();
    } catch (error) {
      console.error("Failed to load image:", error);
    }
  }

  draw() {
    if (!this.canvas || !this.ctx || !this.image) return;

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Calculate draw dimensions
    const aspectRatio = this.dataset.aspectRatio || "cover";
    const { x, y, width, height } = calculateAspectRatio(
      this.canvas.width,
      this.canvas.height,
      this.image.width,
      this.image.height,
      aspectRatio,
    );

    // Save context state
    this.ctx.save();

    // Apply effects
    const effects = JSON.parse(this.dataset.effects || "[]");
    effects.forEach((effect) => {
      applyVisualEffect(this.ctx, effect);
    });

    // Draw image
    this.ctx.drawImage(this.image, x, y, width, height);

    // Restore context
    this.ctx.restore();
  }

  observeResize() {
    this.resizeObserver = new ResizeObserver(() => {
      this.setupCanvas();
      this.draw();
    });

    this.resizeObserver.observe(this.canvas);
  }

  template() {
    return `
      <canvas
        style="
          opacity: ${this.dataset.opacity || 1};
          mix-blend-mode: ${this.dataset.blendMode || "normal"};
        "
      ></canvas>
    `;
  }

  styles() {
    return `
      :host {
        display: block;
        position: absolute;
        inset: 0;
      }

      canvas {
        width: 100%;
        height: 100%;
      }
    `;
  }
}

customElements.define("layer-canvas", LayerCanvas);
```

### Countdown Clock Component

```javascript
// shared/components/clock/countdown-clock.js

import { BaseComponent } from "../base/base-component.js";
import { formatDuration, getTimeScale } from "../../services/time.js";

class CountdownClock extends BaseComponent {
  constructor() {
    super();
    this.remaining = 0;
    this.duration = 0;
    this.running = false;
    this.lastUpdate = 0;
    this.animationFrame = null;
  }

  static get observedAttributes() {
    return ["data-clock-id", "data-remaining", "data-running"];
  }

  connectedCallback() {
    super.connectedCallback();

    const clockId = this.dataset.clockId;

    // Subscribe to clock state
    this.subscribe(`clocks.clocks.${clockId}`, (clock) => {
      if (clock) {
        this.remaining = clock.remaining;
        this.duration = clock.duration;
        this.running = clock.running;
        this.render();
      }
    });

    // Subscribe to time scale changes
    this.subscribe("time.scale", () => {
      // Time scale affects tick rate, handled in tick loop
    });

    this.startTicking();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
  }

  startTicking() {
    this.lastUpdate = performance.now();

    const tick = (now) => {
      if (this.running) {
        const deltaMs = now - this.lastUpdate;
        this.lastUpdate = now;

        // Apply time scale
        const timeScale = getTimeScale();
        const scaledDelta = deltaMs * timeScale;

        this.remaining = Math.max(0, this.remaining - scaledDelta);

        if (this.remaining <= 0) {
          this.handleComplete();
        }
      }

      this.render();
      this.animationFrame = requestAnimationFrame(tick);
    };

    this.animationFrame = requestAnimationFrame(tick);
  }

  handleComplete() {
    this.running = false;
    this.emit("countdown:complete", { clockId: this.dataset.clockId });
  }

  getUrgencyClass() {
    const progress = (this.remaining / this.duration) * 100;
    if (progress < 10) return "critical";
    if (progress < 25) return "warning";
    if (progress < 50) return "caution";
    return "normal";
  }

  render() {
    this.updateDOM();
  }

  template() {
    return `
      <div class="countdown ${this.getUrgencyClass()}">
        <div class="time-display">
          ${formatDuration(this.remaining)}
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${(this.remaining / this.duration) * 100}%"></div>
        </div>
      </div>
    `;
  }

  styles() {
    return `
      .countdown {
        padding: 1rem;
        background: rgba(0, 0, 0, 0.7);
        border-radius: 8px;
        color: white;
        text-align: center;
      }

      .time-display {
        font-size: 2rem;
        font-family: 'Courier New', monospace;
        font-weight: bold;
        margin-bottom: 0.5rem;
      }

      .progress-bar {
        height: 8px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        overflow: hidden;
      }

      .progress-fill {
        height: 100%;
        background: currentColor;
        transition: width 0.1s linear;
      }

      .normal { color: #4ade80; }
      .caution { color: #fbbf24; }
      .warning {
        color: #fb923c;
        animation: pulse 1s ease-in-out infinite;
      }
      .critical {
        color: #ef4444;
        animation: pulse 0.5s ease-in-out infinite;
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }
    `;
  }
}

customElements.define("countdown-clock", CountdownClock);
```

### Audio Engine Component

```javascript
// shared/components/audio/audio-engine.js

import { BaseComponent } from "../base/base-component.js";
import * as AudioEngine from "../../services/audio-engine.js";
import { loadAudio } from "../../services/assets.js";

class AudioEngineElement extends BaseComponent {
  connectedCallback() {
    super.connectedCallback();

    // Listen for audio events
    this.on("server:audio.play", this.handlePlay);
    this.on("server:audio.stop", this.handleStop);
    this.on("server:audio.channel.volume", this.handleVolumeChange);

    // Listen for time scale changes
    this.subscribe("time.scale", (scale) => {
      AudioEngine.applyTimeScale(scale);
    });
  }

  async handlePlay(event) {
    const { channel, source, volume, loop, effects, respectTimeScale } =
      event.payload;

    try {
      const buffer = await loadAudio(source.ref);
      AudioEngine.play(channel, buffer, {
        volume,
        loop,
        effects,
        respectTimeScale,
      });
    } catch (error) {
      console.error("Failed to play audio:", error);
    }
  }

  handleStop(event) {
    const { channel } = event.payload;
    AudioEngine.stop(channel);
  }

  handleVolumeChange(event) {
    const { channel, volume } = event.payload;
    AudioEngine.setVolume(channel, volume);
  }

  // No visual rendering needed
  render() {}
}

customElements.define("audio-engine", AudioEngineElement);
```

### Connection Status Component

```javascript
// shared/components/base/connection-status.js

import { BaseComponent } from "./base-component.js";

class ConnectionStatus extends BaseComponent {
  constructor() {
    super();
    this.status = "disconnected";
  }

  connectedCallback() {
    super.connectedCallback();

    this.subscribe("connection.status", (status) => {
      this.status = status;
      this.render();
    });
  }

  render() {
    this.updateDOM();
  }

  getIcon() {
    switch (this.status) {
      case "connected":
        return "●";
      case "reconnecting":
        return "◐";
      default:
        return "○";
    }
  }

  getColor() {
    switch (this.status) {
      case "connected":
        return "#4ade80";
      case "reconnecting":
        return "#fbbf24";
      default:
        return "#ef4444";
    }
  }

  template() {
    return `
      <div class="status" style="color: ${this.getColor()}">
        <span class="icon">${this.getIcon()}</span>
        <span class="text">${this.status}</span>
      </div>
    `;
  }

  styles() {
    return `
      .status {
        position: fixed;
        top: 10px;
        right: 10px;
        padding: 8px 12px;
        border-radius: 4px;
        background: rgba(0, 0, 0, 0.7);
        font-size: 0.9rem;
        display: flex;
        align-items: center;
        gap: 8px;
        z-index: 10000;
      }
    `;
  }
}

customElements.define("connection-status", ConnectionStatus);
```

### Log Overlay Component

```javascript
// display/src/components/log-overlay.js

import { BaseComponent } from "../../shared/components/base/base-component.js";

class LogOverlay extends BaseComponent {
  constructor() {
    super();
    this.events = [];
    this.maxEvents = 10;
  }

  static get observedAttributes() {
    return ["data-max-events", "data-filter"];
  }

  connectedCallback() {
    super.connectedCallback();

    this.maxEvents = parseInt(this.dataset.maxEvents || "10");

    // Subscribe to log events
    this.on("server:log.write", this.handleLogEvent);
  }

  handleLogEvent(event) {
    const filter = this.dataset.filter?.split(",") || [];

    // Apply filter
    if (filter.length > 0) {
      const matches = filter.some((f) => event.payload.eventType.startsWith(f));
      if (!matches) return;
    }

    // Add event
    this.events.push(event.payload);

    // Limit to max
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    this.render();
  }

  formatEvent(event) {
    switch (event.eventType) {
      case "roll.attack":
        return `<strong>${event.data.character}</strong> rolled ${event.data.total} to hit`;
      case "combat.damage":
        return `<strong>${event.data.target}</strong> takes ${event.data.amount} damage`;
      default:
        return event.note || event.eventType;
    }
  }

  render() {
    this.updateDOM();
  }

  template() {
    return `
      <div class="log-overlay">
        ${this.events
          .map(
            (event) => `
          <div class="log-event ${event.eventType}">
            ${this.formatEvent(event)}
          </div>
        `,
          )
          .join("")}
      </div>
    `;
  }

  styles() {
    return `
      .log-overlay {
        position: fixed;
        bottom: 20px;
        left: 20px;
        right: 20px;
        pointer-events: none;
        z-index: 1000;
      }

      .log-event {
        background: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 8px 12px;
        margin: 4px 0;
        border-radius: 4px;
        animation: fadeIn 0.3s ease-in;
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `;
  }
}

customElements.define("log-overlay", LogOverlay);
```

## Display Client Application

### HTML Entry Point

```html
<!-- display/public/index.html -->

<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Squire - Display</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <!-- Connection status -->
    <connection-status></connection-status>

    <!-- Main display -->
    <div id="app">
      <!-- Visual layers -->
      <layer-stack></layer-stack>

      <!-- Countdown clocks -->
      <div id="clocks-container"></div>

      <!-- Log overlay -->
      <log-overlay data-max-events="5"></log-overlay>
    </div>

    <!-- Audio engine (no visual output) -->
    <audio-engine></audio-engine>

    <!-- Main script -->
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

### JavaScript Entry Point

```javascript
// display/src/main.js

import { createWebSocket } from "../shared/services/websocket.js";
import { store } from "../shared/services/state.js";
import { on } from "../shared/services/events.js";

// Import components (registers custom elements)
import "../shared/components/base/connection-status.js";
import "../shared/components/visual/layer-stack.js";
import "../shared/components/visual/layer-canvas.js";
import "../shared/components/audio/audio-engine.js";
import "../shared/components/clock/countdown-clock.js";
import "./components/log-overlay.js";

// Import event handlers
import "./handlers/visual-handler.js";
import "./handlers/audio-handler.js";
import "./handlers/clock-handler.js";
import "./handlers/time-handler.js";
import "./handlers/scene-handler.js";

// Configuration
const config = {
  serverUrl: import.meta.env?.VITE_SERVER_URL || "ws://localhost:3000/ws",
};

// Initialize WebSocket
const ws = createWebSocket(config.serverUrl);
ws.connect();

// Ready
console.log("Squire Display Client initialized");
```

### Event Handlers

```javascript
// display/src/handlers/clock-handler.js

import { on } from "../../shared/services/events.js";
import { store } from "../../shared/services/state.js";

// Handle clock creation
on("server:ui.clock.create", (event) => {
  const { id, duration, visibility, style } = event.payload;

  // Update state
  const clocks = store.getState("clocks.clocks");
  clocks.set(id, {
    id,
    remaining: duration,
    duration,
    running: true,
    visibility,
    style,
    createdAt: Date.now(),
  });
  store.setState("clocks.clocks", new Map(clocks));

  // Create DOM element
  const container = document.getElementById("clocks-container");
  if (!container) return;

  const clockElement = document.createElement("countdown-clock");
  clockElement.dataset.clockId = id;
  clockElement.dataset.remaining = duration;
  clockElement.dataset.running = "true";

  container.appendChild(clockElement);
});

// Handle clock destruction
on("server:ui.clock.destroy", (event) => {
  const { id } = event.payload;

  // Remove from state
  const clocks = store.getState("clocks.clocks");
  clocks.delete(id);
  store.setState("clocks.clocks", new Map(clocks));

  // Remove DOM element
  const clockElement = document.querySelector(
    `countdown-clock[data-clock-id="${id}"]`,
  );
  clockElement?.remove();
});

// Handle server tick (sync)
on("server:ui.clock.tick", (event) => {
  const { clockId, remaining } = event.payload;

  // Update state
  const clocks = store.getState("clocks.clocks");
  const clock = clocks.get(clockId);
  if (clock) {
    clock.remaining = remaining;
    store.setState("clocks.clocks", new Map(clocks));
  }
});
```

```javascript
// display/src/handlers/visual-handler.js

import { on } from "../../shared/services/events.js";
import { store } from "../../shared/services/state.js";

// Handle image set
on("server:visual.image.set", (event) => {
  const { layer, imageRef, aspectRatio, opacity, visible, blendMode, effects } =
    event.payload;

  const layers = store.getState("visual.layers");
  const existing = layers.get(layer);

  const newLayer = {
    alias: layer,
    zIndex: existing?.zIndex ?? layers.size,
    imageRef,
    aspectRatio: aspectRatio || "cover",
    opacity: opacity ?? 1.0,
    visible: visible ?? true,
    blendMode: blendMode || "normal",
    effects: effects || [],
  };

  layers.set(layer, newLayer);
  store.setState("visual.layers", new Map(layers));
});

// Handle image clear
on("server:visual.image.clear", (event) => {
  const { layer } = event.payload;

  const layers = store.getState("visual.layers");
  layers.delete(layer);
  store.setState("visual.layers", new Map(layers));
});

// Handle effects
on("server:visual.image.effect", (event) => {
  const { layer, effects, replace } = event.payload;

  const layers = store.getState("visual.layers");
  const layerState = layers.get(layer);

  if (layerState) {
    if (replace) {
      layerState.effects = effects;
    } else {
      layerState.effects = [...layerState.effects, ...effects];
    }
    store.setState("visual.layers", new Map(layers));
  }
});
```

```javascript
// display/src/handlers/time-handler.js

import { on } from "../../shared/services/events.js";
import { store } from "../../shared/services/state.js";

// Handle time scale changes
on("server:time.scale_changed", (event) => {
  const { scale } = event.payload;

  store.setState("time.scale", scale);
  store.setState("time.lastChange", Date.now());
});
```

## Build Configuration

### Vite Config

```javascript
// display/vite.config.js

import { defineConfig } from "vite";

export default defineConfig({
  root: "./public",

  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: "./public/index.html",
      },
    },
  },

  resolve: {
    alias: {
      "@shared": "/clients/shared",
      "@common": "/clients/common",
    },
  },

  server: {
    port: 5173,
    proxy: {
      "/ws": {
        target: "ws://localhost:3000",
        ws: true,
      },
    },
  },
});
```

### Package.json

```json
{
  "name": "@squire/display-webcomponents",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "devDependencies": {
    "vite": "^5.0.0"
  }
}
```

## Master Client Differences

Master client uses same components but adds controls:

```javascript
// master/src/components/controls/audio-mixer.js

import { BaseComponent } from "../../../shared/components/base/base-component.js";
import { store } from "../../../shared/services/state.js";

class AudioMixer extends BaseComponent {
  constructor() {
    super();
    this.channels = [];
  }

  connectedCallback() {
    super.connectedCallback();

    this.subscribe("audio.channels", (channels) => {
      this.channels = Array.from(channels.values());
      this.render();
    });
  }

  handleVolumeChange(channelId, event) {
    const volume = parseFloat(event.target.value);

    // Send to server
    import("../../../shared/services/websocket.js").then(({ send }) => {
      send({
        type: "audio.channel.volume",
        payload: { channel: channelId, volume },
      });
    });
  }

  handlePlay(channelId) {
    // Implementation for playing audio
  }

  render() {
    this.updateDOM();

    // Setup event listeners
    this.shadowRoot.querySelectorAll('input[type="range"]').forEach((input) => {
      input.addEventListener("input", (e) => {
        const channelId = e.target.dataset.channel;
        this.handleVolumeChange(channelId, e);
      });
    });
  }

  template() {
    return `
      <div class="audio-mixer">
        ${this.channels
          .map(
            (channel) => `
          <div class="channel">
            <h3>${channel.id}</h3>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value="${channel.volume}"
              data-channel="${channel.id}"
            >
            <span>${Math.round(channel.volume * 100)}%</span>
          </div>
        `,
          )
          .join("")}
      </div>
    `;
  }

  styles() {
    return `
      .audio-mixer {
        padding: 1rem;
        background: #1a1a1a;
        border-radius: 8px;
      }

      .channel {
        margin-bottom: 1rem;
      }

      .channel h3 {
        margin: 0 0 0.5rem 0;
        color: white;
        font-size: 0.9rem;
      }

      input[type="range"] {
        width: 100%;
      }
    `;
  }
}

customElements.define("audio-mixer", AudioMixer);
```

## Testing

### Unit Tests for Services

```javascript
// shared/services/__tests__/state.test.js

import { describe, it, expect, beforeEach } from "vitest";
import { createStore } from "../state.js";

describe("State Service", () => {
  let store;

  beforeEach(() => {
    store = createStore({ count: 0, user: { name: "Alice" } });
  });

  it("gets state", () => {
    expect(store.getState()).toEqual({ count: 0, user: { name: "Alice" } });
  });

  it("gets nested state", () => {
    expect(store.getState("user.name")).toBe("Alice");
  });

  it("sets state immutably", () => {
    const oldState = store.getState();
    store.setState("count", 1);
    expect(store.getState("count")).toBe(1);
    expect(oldState.count).toBe(0); // Old state unchanged
  });

  it("notifies subscribers", () => {
    let called = false;
    store.subscribe("count", (value) => {
      called = true;
      expect(value).toBe(1);
    });

    store.setState("count", 1);
    expect(called).toBe(true);
  });

  it("unsubscribes", () => {
    let callCount = 0;
    const unsubscribe = store.subscribe("count", () => callCount++);

    store.setState("count", 1);
    expect(callCount).toBe(1);

    unsubscribe();
    store.setState("count", 2);
    expect(callCount).toBe(1); // Not called again
  });
});
```

### Component Tests

```javascript
// shared/components/__tests__/countdown-clock.test.js

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "../clock/countdown-clock.js";
import { store } from "../../services/state.js";

describe("CountdownClock", () => {
  let element;

  beforeEach(() => {
    element = document.createElement("countdown-clock");
    element.dataset.clockId = "test-clock";
    document.body.appendChild(element);

    // Set up clock state
    const clocks = new Map();
    clocks.set("test-clock", {
      id: "test-clock",
      remaining: 30000,
      duration: 30000,
      running: true,
    });
    store.setState("clocks.clocks", clocks);
  });

  afterEach(() => {
    element.remove();
  });

  it("renders time", () => {
    const display = element.shadowRoot.querySelector(".time-display");
    expect(display.textContent).toContain("00:30");
  });

  it("updates progress bar", () => {
    const fill = element.shadowRoot.querySelector(".progress-fill");
    expect(fill.style.width).toBe("100%");
  });
});
```

## Performance Optimizations

### Lazy Component Loading

```javascript
// Lazy load components on demand
async function loadClock(clockId) {
  await import("../shared/components/clock/countdown-clock.js");

  const clock = document.createElement("countdown-clock");
  clock.dataset.clockId = clockId;
  document.getElementById("clocks-container").appendChild(clock);
}
```

### Debouncing

```javascript
// shared/utils/debounce.js

/**
 * Debounce function calls
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in ms
 * @returns {Function} Debounced function
 */
export function debounce(fn, delay) {
  let timeoutId;

  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}
```

### Request Animation Frame Batching

```javascript
// Batch DOM updates
let updateScheduled = false;
const updateQueue = [];

function scheduleUpdate(fn) {
  updateQueue.push(fn);

  if (!updateScheduled) {
    updateScheduled = true;
    requestAnimationFrame(() => {
      updateQueue.forEach((fn) => fn());
      updateQueue.length = 0;
      updateScheduled = false;
    });
  }
}
```

## Summary

This pure Web Components architecture provides:

- **Zero Framework**: Pure web standards, no dependencies
- **Functional Services**: Composable functions, not classes
- **Custom Elements**: Reusable, encapsulated components
- **Reactive State**: Lightweight observable pattern
- **Shared Code**: Maximum reuse between clients
- **Performance**: Native performance, minimal overhead
- **Modern Web**: ES Modules, Shadow DOM, Web Audio API
- **Maintainable**: Clear separation, simple patterns
- **Extensible**: Easy to add components and services

The functional approach to services keeps code simple and testable. Pure functions are easy to reason about and compose. Web Components provide encapsulation without framework lock-in. The state management is minimal but sufficient for reactive updates. Everything works with standard web APIs.
