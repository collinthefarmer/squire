# Display Client Implementation Architecture - TypeScript Web Components

## Core Architectural Principles

### TypeScript + Web Standards

Built entirely on web platform APIs with full TypeScript type safety. Zero frameworks, maximum type inference.

**Key Technologies:**

- **TypeScript**: Full type safety and inference
- **Custom Elements**: Type-safe component definitions
- **ES Modules**: Native module system with types
- **Bun**: Fast bundler and dev server
- **Web Standards**: Canvas, Web Audio, WebSocket APIs

### Functional Services with Types

Services are pure functions with explicit type signatures. All state transformations are typed.

**Type Safety:**

- **Strict Types**: `strict: true` in tsconfig
- **No Any**: Avoid `any`, use `unknown` when needed
- **Type Inference**: Let TypeScript infer when obvious
- **Branded Types**: Use branded types for IDs and special strings
- **Discriminated Unions**: Type-safe event handling

## Project Structure

```
clients/
├── shared/
│   ├── services/                  # Functional services
│   │   ├── websocket.ts
│   │   ├── state.ts
│   │   ├── events.ts
│   │   ├── assets.ts
│   │   ├── audio-engine.ts
│   │   ├── time.ts
│   │   └── effects.ts
│   │
│   ├── components/                # Typed Web Components
│   │   ├── base/
│   │   │   ├── base-component.ts
│   │   │   └── connection-status.ts
│   │   │
│   │   ├── visual/
│   │   │   ├── layer-stack.ts
│   │   │   ├── layer-canvas.ts
│   │   │   └── effects/
│   │   │
│   │   ├── audio/
│   │   │   ├── audio-engine.ts
│   │   │   └── audio-visualizer.ts
│   │   │
│   │   └── clock/
│   │       ├── countdown-clock.ts
│   │       ├── digital-display.ts
│   │       └── analog-display.ts
│   │
│   ├── types/                     # Type definitions
│   │   ├── events.ts              # Event types
│   │   ├── state.ts               # State types
│   │   ├── components.ts          # Component types
│   │   └── branded.ts             # Branded types
│   │
│   └── utils/
│       ├── dom.ts
│       ├── canvas.ts
│       └── logger.ts
│
├── display/
│   ├── src/
│   │   ├── main.ts
│   │   ├── components/
│   │   │   ├── display-view.ts
│   │   │   ├── log-overlay.ts
│   │   │   └── clock-container.ts
│   │   ├── handlers/
│   │   │   ├── visual-handler.ts
│   │   │   ├── audio-handler.ts
│   │   │   ├── clock-handler.ts
│   │   │   ├── time-handler.ts
│   │   │   └── scene-handler.ts
│   │   └── config.ts
│   │
│   ├── public/
│   │   └── index.html
│   │
│   ├── tsconfig.json
│   ├── bunfig.toml
│   └── package.json
│
├── master/
│   ├── src/
│   │   ├── main.ts
│   │   ├── components/
│   │   └── handlers/
│   │
│   └── tsconfig.json
│
└── common/                        # Shared with server
    ├── events.ts
    ├── state.ts
    └── protocols.ts
```

## Type Definitions

### Branded Types

```typescript
// shared/types/branded.ts

/**
 * Branded type for type-safe IDs
 */
export type Brand<K, T> = K & { __brand: T };

export type ClientId = Brand<string, "ClientId">;
export type ChannelId = Brand<string, "ChannelId">;
export type LayerId = Brand<string, "LayerId">;
export type ClockId = Brand<string, "ClockId">;
export type SceneId = Brand<string, "SceneId">;
export type AssetRef = Brand<string, "AssetRef">;

/**
 * Create branded value
 */
export function brand<T extends string>(value: string): Brand<string, T> {
  return value as Brand<string, T>;
}

/**
 * Extract raw value from branded type
 */
export function unbrand<K, T>(value: Brand<K, T>): K {
  return value as K;
}
```

### Event Types

```typescript
// shared/types/events.ts

import type { ChannelId, LayerId, ClockId, AssetRef } from "./branded";

/**
 * Base event structure
 */
export interface BaseEvent<T extends string = string, P = unknown> {
  type: T;
  payload: P;
  metadata: EventMetadata;
}

export interface EventMetadata {
  timestamp: number;
  source: string;
  targetClients?: string[];
  priority?: "low" | "normal" | "high";
}

/**
 * Audio events
 */
export interface AudioPlayPayload {
  channel: ChannelId;
  source: {
    type: "file" | "stream" | "live";
    ref: AssetRef;
  };
  volume: number;
  loop: boolean;
  effects?: AudioEffect[];
  respectTimeScale: boolean;
}

export interface AudioEffect {
  type: "reverb" | "filter" | "delay" | "distortion";
  params: Record<string, unknown>;
}

export type AudioPlayEvent = BaseEvent<"audio.play", AudioPlayPayload>;
export type AudioPauseEvent = BaseEvent<"audio.pause", { channel: ChannelId }>;
export type AudioStopEvent = BaseEvent<"audio.stop", { channel: ChannelId }>;

export type AudioEvent = AudioPlayEvent | AudioPauseEvent | AudioStopEvent;

/**
 * Visual events
 */
export interface ImageSetPayload {
  layer: LayerId;
  imageRef: AssetRef;
  aspectRatio: "cover" | "contain" | "fill";
  position: { x: string; y: string };
  opacity: number;
  visible: boolean;
  blendMode: string;
  effects: VisualEffect[];
}

export interface VisualEffect {
  type: "blur" | "tint" | "brightness" | "contrast";
  params: Record<string, unknown>;
}

export type ImageSetEvent = BaseEvent<"visual.image.set", ImageSetPayload>;
export type ImageClearEvent = BaseEvent<
  "visual.image.clear",
  { layer: LayerId }
>;

export type VisualEvent = ImageSetEvent | ImageClearEvent;

/**
 * Clock events
 */
export interface ClockCreatePayload {
  id: ClockId;
  duration: number;
  autoStart: boolean;
  visibility: "always" | "auto" | "hidden" | "dm-only";
  style: string;
  alerts: ClockAlert[];
}

export interface ClockAlert {
  at: number;
  effect: string;
  audio?: string;
  message?: string;
}

export type ClockCreateEvent = BaseEvent<"ui.clock.create", ClockCreatePayload>;
export type ClockDestroyEvent = BaseEvent<"ui.clock.destroy", { id: ClockId }>;

export type ClockEvent = ClockCreateEvent | ClockDestroyEvent;

/**
 * Time events
 */
export interface TimeScalePayload {
  scale: number;
  transition?: "immediate" | "smooth";
  transitionDuration?: number;
}

export type TimeScaleEvent = BaseEvent<"time.scale_changed", TimeScalePayload>;

/**
 * All server events
 */
export type ServerEvent =
  | AudioEvent
  | VisualEvent
  | ClockEvent
  | TimeScaleEvent;

/**
 * Event type map for type-safe event handling
 */
export interface EventTypeMap {
  "audio.play": AudioPlayEvent;
  "audio.pause": AudioPauseEvent;
  "audio.stop": AudioStopEvent;
  "visual.image.set": ImageSetEvent;
  "visual.image.clear": ImageClearEvent;
  "ui.clock.create": ClockCreateEvent;
  "ui.clock.destroy": ClockDestroyEvent;
  "time.scale_changed": TimeScaleEvent;
}
```

### State Types

```typescript
// shared/types/state.ts

import type { ChannelId, LayerId, ClockId, AssetRef } from "./branded";
import type { AudioEffect, VisualEffect, ClockAlert } from "./events";

/**
 * Application state shape
 */
export interface ApplicationState {
  audio: AudioState;
  visual: VisualState;
  clocks: ClocksState;
  time: TimeState;
  connection: ConnectionState;
  logs: LogsState;
}

/**
 * Audio state
 */
export interface AudioState {
  channels: Map<ChannelId, AudioChannelState>;
  masterVolume: number;
}

export interface AudioChannelState {
  id: ChannelId;
  source: {
    type: "file" | "stream" | "live";
    ref: AssetRef;
  } | null;
  playing: boolean;
  position: number;
  volume: number;
  loop: boolean;
  effects: AudioEffect[];
  respectTimeScale: boolean;
}

/**
 * Visual state
 */
export interface VisualState {
  layers: Map<LayerId, LayerState>;
}

export interface LayerState {
  alias: LayerId;
  zIndex: number;
  imageRef: AssetRef | null;
  aspectRatio: "cover" | "contain" | "fill";
  position: { x: string; y: string };
  opacity: number;
  visible: boolean;
  blendMode: string;
  effects: VisualEffect[];
}

/**
 * Clocks state
 */
export interface ClocksState {
  clocks: Map<ClockId, ClockState>;
}

export interface ClockState {
  id: ClockId;
  remaining: number;
  duration: number;
  running: boolean;
  visibility: "always" | "auto" | "hidden" | "dm-only";
  style: string;
  alerts: ClockAlert[];
  createdAt: number;
}

/**
 * Time state
 */
export interface TimeState {
  scale: number;
  lastChange: number;
}

/**
 * Connection state
 */
export interface ConnectionState {
  status: "connected" | "disconnected" | "reconnecting";
  error: string | null;
}

/**
 * Logs state
 */
export interface LogsState {
  events: LogEvent[];
}

export interface LogEvent {
  id: string;
  eventType: string;
  data: unknown;
  note?: string;
  timestamp: number;
}
```

## Functional Services

### State Service

```typescript
// shared/services/state.ts

import type { ApplicationState } from "../types/state";

type StateListener<T = unknown> = (value: T, path: string) => void;
type Unsubscribe = () => void;

/**
 * State store interface
 */
export interface Store<T extends object = ApplicationState> {
  getState(): T;
  getState<K extends keyof T>(key: K): T[K];
  getState(path: string): unknown;
  setState<K extends keyof T>(key: K, value: T[K]): void;
  setState(path: string, value: unknown): void;
  subscribe<V = unknown>(path: string, callback: StateListener<V>): Unsubscribe;
}

/**
 * Create reactive state store
 */
export function createStore<T extends object>(initialState: T): Store<T> {
  let state = initialState;
  const listeners = new Map<string, Set<StateListener>>();

  function getState(): T;
  function getState<K extends keyof T>(key: K): T[K];
  function getState(path: string): unknown;
  function getState(pathOrKey?: string | keyof T): unknown {
    if (!pathOrKey) return state;

    const path = String(pathOrKey);
    return path.split(".").reduce((obj: any, key) => obj?.[key], state);
  }

  function setState<K extends keyof T>(key: K, value: T[K]): void;
  function setState(path: string, value: unknown): void;
  function setState(pathOrKey: string | keyof T, value: unknown): void {
    const path = String(pathOrKey);
    state = updatePath(state, path, value);
    notify(path, value);
  }

  function subscribe<V = unknown>(
    path: string,
    callback: StateListener<V>,
  ): Unsubscribe {
    if (!listeners.has(path)) {
      listeners.set(path, new Set());
    }
    listeners.get(path)!.add(callback as StateListener);

    return () => {
      listeners.get(path)?.delete(callback as StateListener);
    };
  }

  function notify(path: string, value: unknown): void {
    // Notify exact path
    listeners.get(path)?.forEach((cb) => cb(value, path));

    // Notify wildcard
    listeners.get("*")?.forEach((cb) => cb(value, path));

    // Notify parent paths
    const parts = path.split(".");
    for (let i = parts.length - 1; i > 0; i--) {
      const parentPath = parts.slice(0, i).join(".");
      listeners.get(parentPath)?.forEach((cb) => cb(value, path));
    }
  }

  function updatePath<T extends object>(
    obj: T,
    path: string,
    value: unknown,
  ): T {
    const keys = path.split(".");
    const lastKey = keys.pop()!;

    let current: any = obj;
    const newObj = { ...obj } as any;
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
  } as Store<T>;
}

// Global store instance
export const store = createStore<ApplicationState>({
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

```typescript
// shared/services/websocket.ts

import { store } from "./state";
import { emit } from "./events";
import type { ServerEvent } from "../types/events";

export interface WebSocketClient {
  connect(): void;
  send(event: ServerEvent): void;
  disconnect(): void;
  readonly isConnected: boolean;
}

/**
 * Create WebSocket client
 */
export function createWebSocket(url: string): WebSocketClient {
  let ws: WebSocket | null = null;
  let reconnectAttempts = 0;
  let reconnectTimer: number | null = null;
  const messageQueue: ServerEvent[] = [];

  function connect(): void {
    ws = new WebSocket(url);

    ws.onopen = handleOpen;
    ws.onmessage = handleMessage;
    ws.onclose = handleClose;
    ws.onerror = handleError;
  }

  function send(event: ServerEvent): void {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
    } else {
      messageQueue.push(event);
    }
  }

  function disconnect(): void {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    ws?.close();
  }

  function handleOpen(): void {
    store.setState("connection.status", "connected");
    reconnectAttempts = 0;

    // Flush queue
    while (messageQueue.length > 0) {
      const message = messageQueue.shift()!;
      send(message);
    }

    emit("connection:open", {});
  }

  function handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data) as ServerEvent;
      routeEvent(message);
    } catch (error) {
      console.error("Failed to parse message:", error);
    }
  }

  function handleClose(): void {
    store.setState("connection.status", "disconnected");
    emit("connection:close", {});
    scheduleReconnect();
  }

  function handleError(error: Event): void {
    console.error("WebSocket error:", error);
    store.setState("connection.error", "Connection error");
    emit("connection:error", { error });
  }

  function scheduleReconnect(): void {
    const delay = Math.min(1000 * 2 ** reconnectAttempts, 30000);
    reconnectAttempts++;

    store.setState("connection.status", "reconnecting");

    reconnectTimer = setTimeout(() => {
      connect();
    }, delay) as unknown as number;
  }

  function routeEvent(event: ServerEvent): void {
    emit(`server:${event.type}`, event);
  }

  return {
    connect,
    send,
    disconnect,
    get isConnected() {
      return ws?.readyState === WebSocket.OPEN;
    },
  };
}
```

### Events Service

```typescript
// shared/services/events.ts

import type { EventTypeMap } from "../types/events";

type EventHandler<T = unknown> = (data: T, eventType: string) => void;
type Unsubscribe = () => void;

const listeners = new Map<string, Set<EventHandler>>();

/**
 * Subscribe to events (type-safe)
 */
export function on<K extends keyof EventTypeMap>(
  eventType: K,
  handler: EventHandler<EventTypeMap[K]>,
): Unsubscribe;

/**
 * Subscribe to events (generic)
 */
export function on<T = unknown>(
  eventType: string,
  handler: EventHandler<T>,
): Unsubscribe;

export function on<T = unknown>(
  eventType: string,
  handler: EventHandler<T>,
): Unsubscribe {
  if (!listeners.has(eventType)) {
    listeners.set(eventType, new Set());
  }

  listeners.get(eventType)!.add(handler as EventHandler);

  return () => off(eventType, handler);
}

/**
 * Unsubscribe from events
 */
export function off<T = unknown>(
  eventType: string,
  handler: EventHandler<T>,
): void {
  listeners.get(eventType)?.delete(handler as EventHandler);
}

/**
 * Emit event (type-safe)
 */
export function emit<K extends keyof EventTypeMap>(
  eventType: K,
  data: EventTypeMap[K],
): void;

/**
 * Emit event (generic)
 */
export function emit<T = unknown>(eventType: string, data: T): void;

export function emit<T = unknown>(eventType: string, data: T): void {
  // Exact match
  listeners.get(eventType)?.forEach((handler) => {
    try {
      handler(data, eventType);
    } catch (error) {
      console.error(`Error in handler for ${eventType}:`, error);
    }
  });

  // Wildcard match
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
 * Subscribe once
 */
export function once<K extends keyof EventTypeMap>(
  eventType: K,
  handler: EventHandler<EventTypeMap[K]>,
): Unsubscribe;

export function once<T = unknown>(
  eventType: string,
  handler: EventHandler<T>,
): Unsubscribe;

export function once<T = unknown>(
  eventType: string,
  handler: EventHandler<T>,
): Unsubscribe {
  const unsubscribe = on(eventType, (data: T) => {
    handler(data, eventType);
    unsubscribe();
  });
  return unsubscribe;
}
```

### Assets Service

```typescript
// shared/services/assets.ts

import type { AssetRef } from "../types/branded";

const imageCache = new Map<string, HTMLImageElement>();
const audioCache = new Map<string, AudioBuffer>();
const audioContext = new AudioContext();

export interface PreloadAssets {
  images?: AssetRef[];
  audio?: AssetRef[];
}

export type ProgressCallback = (progress: number) => void;

/**
 * Load image
 */
export async function loadImage(url: AssetRef): Promise<HTMLImageElement> {
  const urlString = String(url);

  if (imageCache.has(urlString)) {
    return imageCache.get(urlString)!;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imageCache.set(urlString, img);
      resolve(img);
    };
    img.onerror = reject;
    img.src = urlString;
  });
}

/**
 * Load audio buffer
 */
export async function loadAudio(url: AssetRef): Promise<AudioBuffer> {
  const urlString = String(url);

  if (audioCache.has(urlString)) {
    return audioCache.get(urlString)!;
  }

  const response = await fetch(urlString);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = await audioContext.decodeAudioData(arrayBuffer);

  audioCache.set(urlString, buffer);
  return buffer;
}

/**
 * Preload multiple assets
 */
export async function preloadAssets(
  assets: PreloadAssets,
  onProgress?: ProgressCallback,
): Promise<void> {
  const total = (assets.images?.length || 0) + (assets.audio?.length || 0);
  let loaded = 0;

  const updateProgress = (): void => {
    loaded++;
    onProgress?.(loaded / total);
  };

  const promises: Promise<unknown>[] = [];

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
export function clearCache(): void {
  imageCache.clear();
  audioCache.clear();
}

/**
 * Get audio context
 */
export function getAudioContext(): AudioContext {
  return audioContext;
}
```

### Audio Engine Service

```typescript
// shared/services/audio-engine.ts

import { getAudioContext } from "./assets";
import { store } from "./state";
import type { ChannelId } from "../types/branded";
import type { AudioEffect } from "../types/events";

const audioContext = getAudioContext();
const masterGain = audioContext.createGain();
masterGain.connect(audioContext.destination);

interface ChannelNode {
  sourceNode: AudioBufferSourceNode | null;
  gainNode: GainNode;
  effectNodes: AudioNode[];
  respectsTimeScale: boolean;
  startTime: number;
}

const channels = new Map<ChannelId, ChannelNode>();

export interface PlayOptions {
  volume?: number;
  loop?: boolean;
  effects?: AudioEffect[];
  respectTimeScale?: boolean;
}

/**
 * Play audio on channel
 */
export function play(
  channelId: ChannelId,
  buffer: AudioBuffer,
  options: PlayOptions = {},
): void {
  const {
    volume = 1.0,
    loop = false,
    effects = [],
    respectTimeScale = true,
  } = options;

  // Stop existing
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

  const channel = channels.get(channelId)!;

  // Create source
  const sourceNode = audioContext.createBufferSource();
  sourceNode.buffer = buffer;
  sourceNode.loop = loop;

  // Apply time scale
  if (channel.respectsTimeScale) {
    const timeScale = store.getState("time").scale;
    sourceNode.playbackRate.value = timeScale;
  }

  // Set volume
  channel.gainNode.gain.value = volume;

  // Build effect chain
  let currentNode: AudioNode = sourceNode;

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
 */
export function stop(channelId: ChannelId): void {
  const channel = channels.get(channelId);
  if (!channel?.sourceNode) return;

  channel.sourceNode.stop();
  channel.sourceNode = null;
  channel.effectNodes.forEach((node) => node.disconnect());
  channel.effectNodes = [];
}

/**
 * Set channel volume
 */
export function setVolume(channelId: ChannelId, volume: number): void {
  const channel = channels.get(channelId);
  if (!channel) return;

  channel.gainNode.gain.value = volume;
}

/**
 * Set master volume
 */
export function setMasterVolume(volume: number): void {
  masterGain.gain.value = volume;
}

/**
 * Apply time scale to all channels
 */
export function applyTimeScale(scale: number): void {
  channels.forEach((channel) => {
    if (channel.respectsTimeScale && channel.sourceNode) {
      channel.sourceNode.playbackRate.value = scale;
    }
  });
}

/**
 * Create effect node
 */
function createEffectNode(effect: AudioEffect): AudioNode {
  switch (effect.type) {
    case "filter": {
      const filter = audioContext.createBiquadFilter();
      const params = effect.params as {
        filterType?: BiquadFilterType;
        frequency?: number;
        q?: number;
      };
      filter.type = params.filterType || "lowpass";
      filter.frequency.value = params.frequency || 1000;
      filter.Q.value = params.q || 1;
      return filter;
    }

    case "delay": {
      const delay = audioContext.createDelay();
      const params = effect.params as { delayTime?: number };
      delay.delayTime.value = (params.delayTime || 500) / 1000;
      return delay;
    }

    case "reverb": {
      const convolver = audioContext.createConvolver();
      // Load impulse response
      return convolver;
    }

    default:
      return audioContext.createGain();
  }
}
```

### Time Service

```typescript
// shared/services/time.ts

import { store } from "./state";

/**
 * Calculate scaled duration
 */
export function calculateScaledDuration(realDuration: number): number {
  const scale = store.getState("time").scale;
  return realDuration * scale;
}

/**
 * Format duration as MM:SS
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Get current time scale
 */
export function getTimeScale(): number {
  return store.getState("time").scale;
}

/**
 * Check if time is paused
 */
export function isPaused(): boolean {
  return getTimeScale() === 0;
}
```

### Effects Service

```typescript
// shared/services/effects.ts

import type { VisualEffect } from "../types/events";

/**
 * Aspect ratio calculation result
 */
export interface AspectRatioDimensions {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Apply visual effect to canvas context
 */
export function applyVisualEffect(
  ctx: CanvasRenderingContext2D,
  effect: VisualEffect,
): void {
  switch (effect.type) {
    case "blur": {
      const params = effect.params as { radius: number };
      ctx.filter = `blur(${params.radius}px)`;
      break;
    }

    case "tint": {
      const params = effect.params as { color: string; intensity?: number };
      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = params.color;
      ctx.globalAlpha = params.intensity || 1;
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.restore();
      break;
    }

    case "brightness": {
      const params = effect.params as { amount: number };
      ctx.filter = `brightness(${params.amount})`;
      break;
    }

    case "contrast": {
      const params = effect.params as { amount: number };
      ctx.filter = `contrast(${params.amount})`;
      break;
    }

    default:
      console.warn("Unknown effect type:", effect.type);
  }
}

/**
 * Calculate aspect ratio draw dimensions
 */
export function calculateAspectRatio(
  canvasWidth: number,
  canvasHeight: number,
  imageWidth: number,
  imageHeight: number,
  mode: "cover" | "contain" | "fill",
): AspectRatioDimensions {
  const canvasRatio = canvasWidth / canvasHeight;
  const imageRatio = imageWidth / imageHeight;

  let width = 0;
  let height = 0;
  let x = 0;
  let y = 0;

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
    width = canvasWidth;
    height = canvasHeight;
    x = 0;
    y = 0;
  }

  return { x, y, width, height };
}
```

## Typed Web Components

### Base Component

```typescript
// shared/components/base/base-component.ts

import { store } from "../../services/state";
import { on } from "../../services/events";
import type { Store } from "../../services/state";

type Unsubscribe = () => void;

/**
 * Base class for typed custom elements
 */
export abstract class BaseComponent extends HTMLElement {
  protected shadowRoot!: ShadowRoot;
  private _unsubscribers: Unsubscribe[] = [];

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback(): void {
    this.render();
    this.setupListeners();
  }

  disconnectedCallback(): void {
    this.cleanup();
  }

  /**
   * Override in subclass
   */
  protected abstract render(): void;

  /**
   * Override in subclass
   */
  protected setupListeners(): void {}

  /**
   * Cleanup subscriptions
   */
  protected cleanup(): void {
    this._unsubscribers.forEach((unsub) => unsub());
    this._unsubscribers = [];
  }

  /**
   * Subscribe to state changes
   */
  protected subscribe<T = unknown>(
    path: string,
    callback: (value: T, path: string) => void,
  ): void {
    const unsub = store.subscribe(path, callback.bind(this));
    this._unsubscribers.push(unsub);
  }

  /**
   * Subscribe to events
   */
  protected on<T = unknown>(
    eventType: string,
    handler: (data: T, eventType: string) => void,
  ): void {
    const unsub = on(eventType, handler.bind(this));
    this._unsubscribers.push(unsub);
  }

  /**
   * Emit custom event
   */
  protected emit<T = unknown>(eventType: string, detail: T): void {
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
   */
  protected abstract template(): string;

  /**
   * Get styles
   */
  protected abstract styles(): string;

  /**
   * Update shadow DOM
   */
  protected updateDOM(): void {
    this.shadowRoot.innerHTML = `
      <style>${this.styles()}</style>
      ${this.template()}
    `;
  }
}
```

### Layer Stack Component

```typescript
// shared/components/visual/layer-stack.ts

import { BaseComponent } from "../base/base-component";
import type { LayerState } from "../../types/state";
import "./layer-canvas";

class LayerStack extends BaseComponent {
  private layers: LayerState[] = [];

  connectedCallback(): void {
    super.connectedCallback();

    this.subscribe<Map<string, LayerState>>("visual.layers", (layers) => {
      this.layers = Array.from(layers.values()).sort(
        (a, b) => a.zIndex - b.zIndex,
      );
      this.render();
    });
  }

  protected render(): void {
    this.updateDOM();
  }

  protected template(): string {
    return `
      <div class="layer-stack">
        ${this.layers.map((layer) => this.renderLayer(layer)).join("")}
      </div>
    `;
  }

  private renderLayer(layer: LayerState): string {
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

  protected styles(): string {
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

```typescript
// shared/components/visual/layer-canvas.ts

import { BaseComponent } from "../base/base-component";
import { loadImage } from "../../services/assets";
import {
  applyVisualEffect,
  calculateAspectRatio,
} from "../../services/effects";
import type { AssetRef } from "../../types/branded";
import type { VisualEffect } from "../../types/events";

class LayerCanvas extends BaseComponent {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private image: HTMLImageElement | null = null;
  private resizeObserver: ResizeObserver | null = null;

  static get observedAttributes(): string[] {
    return ["data-src", "data-opacity", "data-effects", "data-aspect-ratio"];
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.render();
    this.setupCanvas();
    this.loadImage();
    this.observeResize();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
  }

  attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null,
  ): void {
    if (oldValue === newValue) return;

    if (name === "data-src") {
      this.loadImage();
    } else {
      this.draw();
    }
  }

  protected render(): void {
    this.updateDOM();
    this.canvas = this.shadowRoot.querySelector("canvas");
    this.ctx = this.canvas?.getContext("2d") ?? null;
  }

  private setupCanvas(): void {
    if (!this.canvas) return;

    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
  }

  private async loadImage(): Promise<void> {
    const src = this.dataset.src;
    if (!src) return;

    try {
      this.image = await loadImage(src as AssetRef);
      this.draw();
    } catch (error) {
      console.error("Failed to load image:", error);
    }
  }

  private draw(): void {
    if (!this.canvas || !this.ctx || !this.image) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const aspectRatio = (this.dataset.aspectRatio || "cover") as
      | "cover"
      | "contain"
      | "fill";
    const { x, y, width, height } = calculateAspectRatio(
      this.canvas.width,
      this.canvas.height,
      this.image.width,
      this.image.height,
      aspectRatio,
    );

    this.ctx.save();

    const effects: VisualEffect[] = JSON.parse(this.dataset.effects || "[]");
    effects.forEach((effect) => {
      applyVisualEffect(this.ctx!, effect);
    });

    this.ctx.drawImage(this.image, x, y, width, height);
    this.ctx.restore();
  }

  private observeResize(): void {
    if (!this.canvas) return;

    this.resizeObserver = new ResizeObserver(() => {
      this.setupCanvas();
      this.draw();
    });

    this.resizeObserver.observe(this.canvas);
  }

  protected template(): string {
    return `
      <canvas
        style="
          opacity: ${this.dataset.opacity || 1};
          mix-blend-mode: ${this.dataset.blendMode || "normal"};
        "
      ></canvas>
    `;
  }

  protected styles(): string {
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

```typescript
// shared/components/clock/countdown-clock.ts

import { BaseComponent } from "../base/base-component";
import { formatDuration, getTimeScale } from "../../services/time";
import type { ClockState } from "../../types/state";
import type { ClockId } from "../../types/branded";

class CountdownClock extends BaseComponent {
  private remaining = 0;
  private duration = 0;
  private running = false;
  private lastUpdate = 0;
  private animationFrame: number | null = null;

  static get observedAttributes(): string[] {
    return ["data-clock-id", "data-remaining", "data-running"];
  }

  connectedCallback(): void {
    super.connectedCallback();

    const clockId = this.dataset.clockId as ClockId;

    this.subscribe<ClockState>(`clocks.clocks.${clockId}`, (clock) => {
      if (clock) {
        this.remaining = clock.remaining;
        this.duration = clock.duration;
        this.running = clock.running;
        this.render();
      }
    });

    this.subscribe<number>("time.scale", () => {
      // Time scale affects tick rate
    });

    this.startTicking();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
    }
  }

  private startTicking(): void {
    this.lastUpdate = performance.now();

    const tick = (now: number): void => {
      if (this.running) {
        const deltaMs = now - this.lastUpdate;
        this.lastUpdate = now;

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

  private handleComplete(): void {
    this.running = false;
    this.emit("countdown:complete", { clockId: this.dataset.clockId });
  }

  private getUrgencyClass(): string {
    const progress = (this.remaining / this.duration) * 100;
    if (progress < 10) return "critical";
    if (progress < 25) return "warning";
    if (progress < 50) return "caution";
    return "normal";
  }

  protected render(): void {
    this.updateDOM();
  }

  protected template(): string {
    const progress = (this.remaining / this.duration) * 100;

    return `
      <div class="countdown ${this.getUrgencyClass()}">
        <div class="time-display">
          ${formatDuration(this.remaining)}
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${progress}%"></div>
        </div>
      </div>
    `;
  }

  protected styles(): string {
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

## Display Client

### Main Entry Point

```typescript
// display/src/main.ts

import { createWebSocket } from "../shared/services/websocket";
import { store } from "../shared/services/state";

// Import components
import "../shared/components/base/connection-status";
import "../shared/components/visual/layer-stack";
import "../shared/components/visual/layer-canvas";
import "../shared/components/audio/audio-engine";
import "../shared/components/clock/countdown-clock";
import "./components/log-overlay";

// Import handlers
import "./handlers/visual-handler";
import "./handlers/audio-handler";
import "./handlers/clock-handler";
import "./handlers/time-handler";
import "./handlers/scene-handler";

// Configuration
interface Config {
  serverUrl: string;
}

const config: Config = {
  serverUrl: import.meta.env.VITE_SERVER_URL || "ws://localhost:3000/ws",
};

// Initialize WebSocket
const ws = createWebSocket(config.serverUrl);
ws.connect();

console.log("Squire Display Client initialized");
```

### Event Handlers

```typescript
// display/src/handlers/clock-handler.ts

import { on } from "../../shared/services/events";
import { store } from "../../shared/services/state";
import type {
  ClockCreateEvent,
  ClockDestroyEvent,
} from "../../shared/types/events";
import type { ClockId } from "../../shared/types/branded";

on<ClockCreateEvent>("server:ui.clock.create", (event) => {
  const { id, duration, visibility, style } = event.payload;

  const clocks = store.getState("clocks").clocks;
  clocks.set(id, {
    id,
    remaining: duration,
    duration,
    running: true,
    visibility,
    style,
    alerts: event.payload.alerts,
    createdAt: Date.now(),
  });
  store.setState("clocks.clocks", new Map(clocks));

  const container = document.getElementById("clocks-container");
  if (!container) return;

  const clockElement = document.createElement("countdown-clock");
  clockElement.dataset.clockId = id;
  clockElement.dataset.remaining = String(duration);
  clockElement.dataset.running = "true";

  container.appendChild(clockElement);
});

on<ClockDestroyEvent>("server:ui.clock.destroy", (event) => {
  const { id } = event.payload;

  const clocks = store.getState("clocks").clocks;
  clocks.delete(id);
  store.setState("clocks.clocks", new Map(clocks));

  const clockElement = document.querySelector(
    `countdown-clock[data-clock-id="${id}"]`,
  );
  clockElement?.remove();
});
```

## Build Configuration

### TypeScript Config

```json
// display/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "moduleResolution": "bundler",
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["../shared/*"],
      "@common/*": ["../common/*"]
    }
  },
  "include": ["src/**/*", "../shared/**/*", "../common/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Bun Build Script

```typescript
// display/build.ts

import { build } from "bun";

await build({
  entrypoints: ["./src/main.ts"],
  outdir: "./dist",
  target: "browser",
  minify: true,
  sourcemap: "external",
  splitting: true,
  naming: "[dir]/[name].[hash].[ext]",
});

console.log("Build complete");
```

### Package.json

```json
{
  "name": "@squire/display-webcomponents",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "bun run --watch src/main.ts",
    "build": "bun run build.ts",
    "type-check": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.3.0"
  }
}
```

### Bun Config

```toml
# bunfig.toml

[install]
auto = "always"
exact = false

[build]
target = "browser"
```

## Summary

This TypeScript implementation provides:

- **Full Type Safety**: Strict types throughout
- **Type Inference**: TypeScript infers most types
- **Branded Types**: Type-safe IDs and references
- **Discriminated Unions**: Type-safe event handling
- **Web Standards**: Pure web APIs, no frameworks
- **Functional Services**: Typed pure functions
- **Typed Components**: Custom elements with type safety
- **Bun Performance**: Fast builds and dev server
- **Shared Code**: Maximum reuse with types
- **Zero Runtime**: Types compile away

The TypeScript version maintains all the benefits of the JavaScript version while adding compile-time type safety, better IDE support, and refactoring confidence.
