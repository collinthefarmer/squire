# Display Client Implementation Architecture - Vue

## Core Architectural Principles

### Vue Component Model

Vue 3 with Composition API provides reactive, composable components. Each feature (layer renderer, audio player, countdown clock) is a Vue component.

**Key Concepts:**

- **Single-File Components**: `.vue` files with template, script, and style
- **Composition API**: Reusable logic via composables
- **Reactive State**: `ref`, `reactive`, `computed` for automatic reactivity
- **Lifecycle Hooks**: `onMounted`, `onUnmounted`, etc.
- **TypeScript**: Full type safety with `<script setup lang="ts">`

### Pinia for State Management

Pinia is Vue's official state management solution - lightweight, type-safe, and intuitive.

**Store Characteristics:**

- **Feature Stores**: One store per feature (audio, visual, clocks, etc.)
- **Type Safety**: Full TypeScript inference
- **Reactivity**: Automatic reactive updates
- **Devtools**: Vue DevTools integration
- **Composable**: Use stores in components via `useStore()`

### Composables for Shared Logic

Composables are reusable functions that encapsulate stateful logic.

**Composable Patterns:**

- **useWebSocket**: WebSocket connection and event handling
- **useTimeScale**: Time scale calculations
- **useAssetLoader**: Asset loading and caching
- **useEventBus**: Event bus integration
- **useAudioEngine**: Web Audio API wrapper

### Shared Architecture with Master Client

Display and master clients share:

- **Composables**: All shared logic in composables
- **Stores**: Pinia stores used by both clients
- **Components**: Base components shared, specialized per client
- **Types**: Common type definitions
- **Utilities**: Helper functions

Differences:

- **Display Client**: Read-only components, no control panels
- **Master Client**: Includes control panels, editors, event emission

## Project Structure

```
clients/
├── shared/                        # Shared Vue code
│   ├── composables/               # Shared composables
│   │   ├── useWebSocket.ts        # WebSocket connection
│   │   ├── useEventBus.ts         # Event bus integration
│   │   ├── useAssetLoader.ts      # Asset loading
│   │   ├── useTimeScale.ts        # Time calculations
│   │   ├── useAudioEngine.ts      # Web Audio wrapper
│   │   └── useEffects.ts          # Visual/audio effects
│   │
│   ├── stores/                    # Pinia stores
│   │   ├── audio.ts               # Audio state store
│   │   ├── visual.ts              # Visual state store
│   │   ├── clocks.ts              # Clocks state store
│   │   ├── time.ts                # Time scale store
│   │   ├── scenes.ts              # Scenes store
│   │   ├── logs.ts                # Log events store
│   │   └── connection.ts          # Connection status store
│   │
│   ├── components/                # Shared components
│   │   ├── visual/
│   │   │   ├── LayerStack.vue     # Layer stack renderer
│   │   │   ├── Layer.vue          # Single layer
│   │   │   ├── LayerCanvas.vue    # Canvas-based layer
│   │   │   └── effects/           # Effect components
│   │   │       ├── BlurEffect.vue
│   │   │       ├── TintEffect.vue
│   │   │       └── ...
│   │   │
│   │   ├── audio/
│   │   │   ├── AudioEngine.vue    # Audio engine component
│   │   │   ├── AudioChannel.vue   # Single audio channel
│   │   │   └── AudioVisualizer.vue
│   │   │
│   │   ├── clock/
│   │   │   ├── Countdown.vue      # Countdown clock
│   │   │   ├── DigitalClock.vue   # Digital format
│   │   │   ├── AnalogClock.vue    # Analog format
│   │   │   └── ProgressBar.vue    # Progress bar format
│   │   │
│   │   └── base/
│   │       ├── ConnectionStatus.vue
│   │       └── LoadingSpinner.vue
│   │
│   ├── utils/                     # Shared utilities
│   │   ├── time.ts
│   │   ├── logger.ts
│   │   ├── audio.ts
│   │   └── canvas.ts
│   │
│   └── styles/
│       ├── variables.css
│       ├── base.css
│       └── animations.css
│
├── display/                       # Display client (player view)
│   ├── src/
│   │   ├── main.ts                # Entry point
│   │   ├── App.vue                # Root component
│   │   │
│   │   ├── components/
│   │   │   ├── DisplayView.vue    # Main display view
│   │   │   ├── LogOverlay.vue     # Event log overlay
│   │   │   └── ClockContainer.vue # Clock layout
│   │   │
│   │   ├── composables/           # Display-specific composables
│   │   │   └── useDisplayLayout.ts
│   │   │
│   │   └── config.ts              # Display client config
│   │
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
│
├── master/                        # Master client (DM view)
│   ├── src/
│   │   ├── main.ts
│   │   ├── App.vue
│   │   │
│   │   ├── components/
│   │   │   ├── MasterView.vue
│   │   │   ├── controls/
│   │   │   │   ├── AudioMixer.vue
│   │   │   │   ├── LayerPanel.vue
│   │   │   │   ├── ClockPanel.vue
│   │   │   │   └── SceneBrowser.vue
│   │   │   └── editors/
│   │   │       ├── SceneEditor.vue
│   │   │       └── EffectEditor.vue
│   │   │
│   │   ├── composables/
│   │   │   └── useMasterControls.ts
│   │   │
│   │   └── config.ts
│   │
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
│
└── common/                        # Type definitions (from server)
    ├── events.ts
    ├── state.ts
    └── protocols.ts
```

## Core Infrastructure

### WebSocket Composable

**Responsibilities:**

- Establish WebSocket connection
- Handle reconnection with exponential backoff
- Send events to server
- Receive events and update stores
- Emit connection status

**Implementation:**

```typescript
// shared/composables/useWebSocket.ts

import { ref, onUnmounted } from "vue";
import { useConnectionStore } from "../stores/connection";
import type { Event } from "../../common/events";

export function useWebSocket(url: string) {
  const ws = ref<WebSocket | null>(null);
  const connectionStore = useConnectionStore();
  const reconnectAttempts = ref(0);
  const messageQueue = ref<Event[]>([]);

  function connect() {
    ws.value = new WebSocket(url);

    ws.value.onopen = () => {
      connectionStore.setConnected(true);
      reconnectAttempts.value = 0;
      flushMessageQueue();
    };

    ws.value.onmessage = (event) => {
      const message = JSON.parse(event.data) as Event;
      handleServerEvent(message);
    };

    ws.value.onclose = () => {
      connectionStore.setConnected(false);
      scheduleReconnect();
    };

    ws.value.onerror = (error) => {
      console.error("WebSocket error:", error);
      connectionStore.setError(error);
    };
  }

  function send(event: Event) {
    if (ws.value?.readyState === WebSocket.OPEN) {
      ws.value.send(JSON.stringify(event));
    } else {
      messageQueue.value.push(event);
    }
  }

  function handleServerEvent(event: Event) {
    // Route event to appropriate store
    const [category] = event.type.split(".");

    switch (category) {
      case "audio":
        useAudioStore().handleEvent(event);
        break;
      case "visual":
        useVisualStore().handleEvent(event);
        break;
      case "ui":
        if (event.type.startsWith("ui.clock")) {
          useClocksStore().handleEvent(event);
        }
        break;
      case "time":
        useTimeStore().handleEvent(event);
        break;
      case "scene":
        useScenesStore().handleEvent(event);
        break;
      case "log":
        useLogsStore().handleEvent(event);
        break;
    }
  }

  function flushMessageQueue() {
    messageQueue.value.forEach((msg) => send(msg));
    messageQueue.value = [];
  }

  function scheduleReconnect() {
    const delay = Math.min(1000 * 2 ** reconnectAttempts.value, 30000);
    setTimeout(() => {
      reconnectAttempts.value++;
      connect();
    }, delay);
  }

  function disconnect() {
    ws.value?.close();
  }

  // Auto-connect on composable creation
  connect();

  // Cleanup on component unmount
  onUnmounted(() => {
    disconnect();
  });

  return {
    ws,
    send,
    disconnect,
    isConnected: computed(() => connectionStore.isConnected),
  };
}
```

### Asset Loader Composable

**Responsibilities:**

- Load and cache images
- Load and cache audio buffers
- Preload assets
- Track loading state

**Implementation:**

```typescript
// shared/composables/useAssetLoader.ts

import { ref } from "vue";

interface AssetCache {
  images: Map<string, HTMLImageElement>;
  audio: Map<string, AudioBuffer>;
}

const cache: AssetCache = {
  images: new Map(),
  audio: new Map(),
};

const audioContext = new AudioContext();

export function useAssetLoader() {
  const isLoading = ref(false);
  const loadingProgress = ref(0);

  async function loadImage(url: string): Promise<HTMLImageElement> {
    if (cache.images.has(url)) {
      return cache.images.get(url)!;
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        cache.images.set(url, img);
        resolve(img);
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  async function loadAudio(url: string): Promise<AudioBuffer> {
    if (cache.audio.has(url)) {
      return cache.audio.get(url)!;
    }

    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = await audioContext.decodeAudioData(arrayBuffer);

    cache.audio.set(url, buffer);
    return buffer;
  }

  async function preload(assets: { images?: string[]; audio?: string[] }) {
    isLoading.value = true;
    const total = (assets.images?.length || 0) + (assets.audio?.length || 0);
    let loaded = 0;

    const updateProgress = () => {
      loaded++;
      loadingProgress.value = (loaded / total) * 100;
    };

    const promises: Promise<any>[] = [];

    assets.images?.forEach((url) => {
      promises.push(loadImage(url).then(updateProgress));
    });

    assets.audio?.forEach((url) => {
      promises.push(loadAudio(url).then(updateProgress));
    });

    await Promise.allSettled(promises);
    isLoading.value = false;
  }

  function clearCache() {
    cache.images.clear();
    cache.audio.clear();
  }

  return {
    loadImage,
    loadAudio,
    preload,
    clearCache,
    isLoading,
    loadingProgress,
    audioContext,
  };
}
```

### Audio Engine Composable

**Responsibilities:**

- Manage Web Audio API context
- Create and manage audio channels
- Apply time scale to playback
- Handle effects

**Implementation:**

```typescript
// shared/composables/useAudioEngine.ts

import { ref, watch } from "vue";
import { useTimeStore } from "../stores/time";
import { useAssetLoader } from "./useAssetLoader";
import type { AudioEffect } from "../../common/state";

interface AudioChannelNode {
  sourceNode: AudioBufferSourceNode | null;
  gainNode: GainNode;
  effectNodes: AudioNode[];
  respectsTimeScale: boolean;
  startTime: number;
  pauseTime: number;
}

export function useAudioEngine() {
  const { audioContext } = useAssetLoader();
  const timeStore = useTimeStore();

  const masterGain = audioContext.createGain();
  masterGain.connect(audioContext.destination);

  const channels = ref<Map<string, AudioChannelNode>>(new Map());

  // Watch time scale changes
  watch(
    () => timeStore.scale,
    (newScale) => {
      channels.value.forEach((channel, id) => {
        if (channel.respectsTimeScale && channel.sourceNode) {
          channel.sourceNode.playbackRate.value = newScale;
        }
      });
    },
  );

  async function play(
    channelId: string,
    buffer: AudioBuffer,
    options: {
      volume?: number;
      loop?: boolean;
      effects?: AudioEffect[];
      respectTimeScale?: boolean;
    } = {},
  ) {
    // Stop existing playback on this channel
    stop(channelId);

    // Create channel if doesn't exist
    if (!channels.value.has(channelId)) {
      const gainNode = audioContext.createGain();
      channels.value.set(channelId, {
        sourceNode: null,
        gainNode,
        effectNodes: [],
        respectsTimeScale: options.respectTimeScale ?? true,
        startTime: 0,
        pauseTime: 0,
      });
    }

    const channel = channels.value.get(channelId)!;

    // Create source node
    const sourceNode = audioContext.createBufferSource();
    sourceNode.buffer = buffer;
    sourceNode.loop = options.loop ?? false;

    // Apply time scale if needed
    if (channel.respectsTimeScale) {
      sourceNode.playbackRate.value = timeStore.scale;
    }

    // Set volume
    channel.gainNode.gain.value = options.volume ?? 1.0;

    // Build effect chain
    let currentNode: AudioNode = sourceNode;

    options.effects?.forEach((effect) => {
      const effectNode = createEffectNode(effect);
      currentNode.connect(effectNode);
      currentNode = effectNode;
      channel.effectNodes.push(effectNode);
    });

    // Connect to output
    currentNode.connect(channel.gainNode);
    channel.gainNode.connect(masterGain);

    // Store source node
    channel.sourceNode = sourceNode;
    channel.startTime = audioContext.currentTime;

    // Start playback
    sourceNode.start();
  }

  function pause(channelId: string) {
    const channel = channels.value.get(channelId);
    if (!channel?.sourceNode) return;

    channel.pauseTime = audioContext.currentTime - channel.startTime;
    channel.sourceNode.stop();
  }

  function resume(channelId: string) {
    // Web Audio doesn't support pause/resume directly
    // Would need to track position and restart with offset
    // Implementation depends on requirements
  }

  function stop(channelId: string) {
    const channel = channels.value.get(channelId);
    if (!channel?.sourceNode) return;

    channel.sourceNode.stop();
    channel.sourceNode = null;
    channel.effectNodes.forEach((node) => node.disconnect());
    channel.effectNodes = [];
  }

  function setVolume(channelId: string, volume: number) {
    const channel = channels.value.get(channelId);
    if (!channel) return;

    channel.gainNode.gain.value = volume;
  }

  function setMasterVolume(volume: number) {
    masterGain.gain.value = volume;
  }

  function createEffectNode(effect: AudioEffect): AudioNode {
    switch (effect.type) {
      case "reverb": {
        const convolver = audioContext.createConvolver();
        // Load impulse response
        // convolver.buffer = ...
        return convolver;
      }

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

      default:
        // Pass-through
        return audioContext.createGain();
    }
  }

  return {
    play,
    pause,
    resume,
    stop,
    setVolume,
    setMasterVolume,
    channels,
  };
}
```

## Pinia Stores

### Audio Store

**Responsibilities:**

- Hold audio state (channels, volumes, effects)
- Handle audio events from server
- Provide getters for component access
- Coordinate with audio engine

**Implementation:**

```typescript
// shared/stores/audio.ts

import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { AudioChannelState, AudioEvent } from "../../common/state";
import { useAudioEngine } from "../composables/useAudioEngine";
import { useAssetLoader } from "../composables/useAssetLoader";

export const useAudioStore = defineStore("audio", () => {
  // State
  const channels = ref<Map<string, AudioChannelState>>(new Map());
  const masterVolume = ref(1.0);

  // Composables
  const audioEngine = useAudioEngine();
  const assetLoader = useAssetLoader();

  // Getters
  const allChannels = computed(() => Array.from(channels.value.values()));
  const playingChannels = computed(() =>
    allChannels.value.filter((ch) => ch.playing),
  );

  // Actions
  async function handleEvent(event: AudioEvent) {
    switch (event.type) {
      case "audio.play":
        await handlePlay(event.payload);
        break;
      case "audio.pause":
        handlePause(event.payload);
        break;
      case "audio.stop":
        handleStop(event.payload);
        break;
      case "audio.channel.volume":
        handleVolumeChange(event.payload);
        break;
    }
  }

  async function handlePlay(payload: any) {
    const { channel, source, volume, loop, effects, respectTimeScale } =
      payload;

    // Update state
    channels.value.set(channel, {
      id: channel,
      source,
      playing: true,
      position: 0,
      volume,
      loop,
      effects,
      respectTimeScale,
    });

    // Load audio buffer
    const buffer = await assetLoader.loadAudio(source.ref);

    // Play via audio engine
    await audioEngine.play(channel, buffer, {
      volume,
      loop,
      effects,
      respectTimeScale,
    });
  }

  function handlePause(payload: { channel: string }) {
    const channel = channels.value.get(payload.channel);
    if (!channel) return;

    channel.playing = false;
    audioEngine.pause(payload.channel);
  }

  function handleStop(payload: { channel: string }) {
    const channel = channels.value.get(payload.channel);
    if (!channel) return;

    channel.playing = false;
    channel.position = 0;
    audioEngine.stop(payload.channel);
  }

  function handleVolumeChange(payload: { channel: string; volume: number }) {
    const channel = channels.value.get(payload.channel);
    if (!channel) return;

    channel.volume = payload.volume;
    audioEngine.setVolume(payload.channel, payload.volume);
  }

  function setMasterVolume(volume: number) {
    masterVolume.value = volume;
    audioEngine.setMasterVolume(volume);
  }

  return {
    // State
    channels,
    masterVolume,

    // Getters
    allChannels,
    playingChannels,

    // Actions
    handleEvent,
    setMasterVolume,
  };
});
```

### Visual Store

**Responsibilities:**

- Hold visual state (layers, effects, transitions)
- Handle visual events from server
- Provide layer data to components

**Implementation:**

```typescript
// shared/stores/visual.ts

import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { LayerState, VisualEvent } from "../../common/state";

export const useVisualStore = defineStore("visual", () => {
  // State
  const layers = ref<Map<string, LayerState>>(new Map());

  // Getters
  const allLayers = computed(() => Array.from(layers.value.values()));
  const visibleLayers = computed(() =>
    allLayers.value.filter((layer) => layer.visible),
  );
  const sortedLayers = computed(() =>
    [...allLayers.value].sort((a, b) => a.zIndex - b.zIndex),
  );

  // Actions
  function handleEvent(event: VisualEvent) {
    switch (event.type) {
      case "visual.image.set":
        handleImageSet(event.payload);
        break;
      case "visual.image.clear":
        handleImageClear(event.payload);
        break;
      case "visual.image.effect":
        handleEffect(event.payload);
        break;
      case "visual.image.layer_config":
        handleLayerConfig(event.payload);
        break;
    }
  }

  function handleImageSet(payload: any) {
    const existing = layers.value.get(payload.layer);

    const newLayer: LayerState = {
      alias: payload.layer,
      zIndex: existing?.zIndex ?? layers.value.size,
      imageRef: payload.imageRef,
      aspectRatio: payload.aspectRatio || "cover",
      position: payload.position || { x: "center", y: "center" },
      opacity: payload.opacity ?? 1.0,
      visible: payload.visible ?? true,
      blendMode: payload.blendMode || "normal",
      effects: payload.effects || [],
      transform: payload.transform || {},
    };

    layers.value.set(payload.layer, newLayer);
  }

  function handleImageClear(payload: { layer: string }) {
    layers.value.delete(payload.layer);
  }

  function handleEffect(payload: any) {
    const layer = layers.value.get(payload.layer);
    if (!layer) return;

    if (payload.replace) {
      layer.effects = payload.effects;
    } else {
      layer.effects = [...layer.effects, ...payload.effects];
    }
  }

  function handleLayerConfig(payload: any) {
    const layer = layers.value.get(payload.layer);
    if (!layer) return;

    Object.assign(layer, payload);
  }

  function createLayer(alias: string, config: Partial<LayerState>) {
    const layer: LayerState = {
      alias,
      zIndex: layers.value.size,
      imageRef: null,
      aspectRatio: "cover",
      position: { x: "center", y: "center" },
      opacity: 1.0,
      visible: true,
      blendMode: "normal",
      effects: [],
      transform: {},
      ...config,
    };

    layers.value.set(alias, layer);
  }

  function deleteLayer(alias: string) {
    layers.value.delete(alias);
  }

  return {
    // State
    layers,

    // Getters
    allLayers,
    visibleLayers,
    sortedLayers,

    // Actions
    handleEvent,
    createLayer,
    deleteLayer,
  };
});
```

### Clocks Store

**Responsibilities:**

- Hold countdown clock state
- Handle clock events from server
- Provide clock data to components
- Manage client-side clock ticking

**Implementation:**

```typescript
// shared/stores/clocks.ts

import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { ClockState, ClockEvent } from "../../common/state";

export const useClocksStore = defineStore("clocks", () => {
  // State
  const clocks = ref<Map<string, ClockState>>(new Map());

  // Getters
  const allClocks = computed(() => Array.from(clocks.value.values()));
  const runningClocks = computed(() =>
    allClocks.value.filter((clock) => clock.running),
  );

  // Actions
  function handleEvent(event: ClockEvent) {
    switch (event.type) {
      case "ui.clock.create":
        handleCreate(event.payload);
        break;
      case "ui.clock.start":
        handleStart(event.payload);
        break;
      case "ui.clock.pause":
        handlePause(event.payload);
        break;
      case "ui.clock.destroy":
        handleDestroy(event.payload);
        break;
      case "ui.clock.tick":
        handleTick(event.payload);
        break;
    }
  }

  function handleCreate(payload: any) {
    const clock: ClockState = {
      id: payload.id,
      remaining: payload.duration,
      duration: payload.duration,
      running: payload.autoStart ?? false,
      visibility: payload.visibility || "always",
      style: payload.style || "digital",
      alerts: payload.alerts || [],
      createdAt: Date.now(),
    };

    clocks.value.set(payload.id, clock);
  }

  function handleStart(payload: { id: string }) {
    const clock = clocks.value.get(payload.id);
    if (clock) {
      clock.running = true;
    }
  }

  function handlePause(payload: { id: string }) {
    const clock = clocks.value.get(payload.id);
    if (clock) {
      clock.running = false;
    }
  }

  function handleDestroy(payload: { id: string }) {
    clocks.value.delete(payload.id);
  }

  function handleTick(payload: { clockId: string; remaining: number }) {
    const clock = clocks.value.get(payload.clockId);
    if (clock) {
      clock.remaining = payload.remaining;
    }
  }

  function updateRemaining(id: string, remaining: number) {
    const clock = clocks.value.get(id);
    if (clock) {
      clock.remaining = remaining;
    }
  }

  return {
    // State
    clocks,

    // Getters
    allClocks,
    runningClocks,

    // Actions
    handleEvent,
    updateRemaining,
  };
});
```

### Time Store

**Responsibilities:**

- Hold time scale state
- Handle time scale events
- Provide time calculation utilities

**Implementation:**

```typescript
// shared/stores/time.ts

import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { TimeEvent } from "../../common/events";

export const useTimeStore = defineStore("time", () => {
  // State
  const scale = ref(1.0);
  const lastScaleChange = ref(Date.now());

  // Getters
  const isPaused = computed(() => scale.value === 0);
  const isSlowed = computed(() => scale.value < 1 && scale.value > 0);
  const isFast = computed(() => scale.value > 1);

  // Actions
  function handleEvent(event: TimeEvent) {
    if (event.type === "time.scale_changed") {
      handleScaleChange(event.payload);
    }
  }

  function handleScaleChange(payload: { scale: number }) {
    scale.value = payload.scale;
    lastScaleChange.value = Date.now();
  }

  function calculateScaledDuration(realDuration: number): number {
    return realDuration * scale.value;
  }

  return {
    // State
    scale,
    lastScaleChange,

    // Getters
    isPaused,
    isSlowed,
    isFast,

    // Actions
    handleEvent,
    calculateScaledDuration,
  };
});
```

## Vue Components

### Layer Stack Component

**Responsibilities:**

- Render all layers in z-index order
- Handle layer transitions
- Responsive sizing

**Implementation:**

```vue
<!-- shared/components/visual/LayerStack.vue -->

<script setup lang="ts">
import { computed } from "vue";
import { useVisualStore } from "../../stores/visual";
import Layer from "./Layer.vue";

const visualStore = useVisualStore();

const sortedLayers = computed(() => visualStore.sortedLayers);
</script>

<template>
  <div class="layer-stack">
    <Layer v-for="layer in sortedLayers" :key="layer.alias" :layer="layer" />
  </div>
</template>

<style scoped>
.layer-stack {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
</style>
```

### Layer Component

**Responsibilities:**

- Render single layer with image
- Apply effects
- Handle aspect ratio

**Implementation:**

```vue
<!-- shared/components/visual/Layer.vue -->

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useAssetLoader } from "../../composables/useAssetLoader";
import type { LayerState } from "../../../common/state";

interface Props {
  layer: LayerState;
}

const props = defineProps<Props>();

const { loadImage } = useAssetLoader();
const canvasRef = ref<HTMLCanvasElement>();
const image = ref<HTMLImageElement>();

const layerStyle = computed(() => ({
  opacity: props.layer.opacity,
  zIndex: props.layer.zIndex,
  display: props.layer.visible ? "block" : "none",
  mixBlendMode: props.layer.blendMode,
}));

async function loadLayerImage() {
  if (!props.layer.imageRef) return;

  try {
    image.value = await loadImage(props.layer.imageRef);
    drawCanvas();
  } catch (error) {
    console.error("Failed to load image:", error);
  }
}

function drawCanvas() {
  if (!canvasRef.value || !image.value) return;

  const canvas = canvasRef.value;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Set canvas size to match container
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;

  // Calculate draw dimensions based on aspect ratio mode
  const { drawX, drawY, drawWidth, drawHeight } = calculateDrawDimensions(
    canvas.width,
    canvas.height,
    image.value.width,
    image.value.height,
    props.layer.aspectRatio,
  );

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw image
  ctx.drawImage(image.value, drawX, drawY, drawWidth, drawHeight);

  // Apply effects
  applyEffects(ctx);
}

function calculateDrawDimensions(
  canvasWidth: number,
  canvasHeight: number,
  imageWidth: number,
  imageHeight: number,
  mode: string,
) {
  const canvasRatio = canvasWidth / canvasHeight;
  const imageRatio = imageWidth / imageHeight;

  let drawWidth = 0,
    drawHeight = 0,
    drawX = 0,
    drawY = 0;

  if (mode === "cover") {
    if (canvasRatio > imageRatio) {
      drawWidth = canvasWidth;
      drawHeight = drawWidth / imageRatio;
      drawX = 0;
      drawY = (canvasHeight - drawHeight) / 2;
    } else {
      drawHeight = canvasHeight;
      drawWidth = drawHeight * imageRatio;
      drawX = (canvasWidth - drawWidth) / 2;
      drawY = 0;
    }
  } else if (mode === "contain") {
    if (canvasRatio > imageRatio) {
      drawHeight = canvasHeight;
      drawWidth = drawHeight * imageRatio;
      drawX = (canvasWidth - drawWidth) / 2;
      drawY = 0;
    } else {
      drawWidth = canvasWidth;
      drawHeight = drawWidth / imageRatio;
      drawX = 0;
      drawY = (canvasHeight - drawHeight) / 2;
    }
  } else {
    // fill
    drawWidth = canvasWidth;
    drawHeight = canvasHeight;
    drawX = 0;
    drawY = 0;
  }

  return { drawX, drawY, drawWidth, drawHeight };
}

function applyEffects(ctx: CanvasRenderingContext2D) {
  props.layer.effects.forEach((effect) => {
    switch (effect.type) {
      case "blur":
        ctx.filter = `blur(${effect.params.radius}px)`;
        break;
      case "tint":
        ctx.globalCompositeOperation = "multiply";
        ctx.fillStyle = effect.params.color;
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.globalCompositeOperation = "source-over";
        break;
      // ... more effects
    }
  });
}

// Watch for layer changes
watch(() => props.layer.imageRef, loadLayerImage);
watch(() => props.layer.effects, drawCanvas, { deep: true });

onMounted(() => {
  loadLayerImage();
  // Redraw on resize
  window.addEventListener("resize", drawCanvas);
});
</script>

<template>
  <canvas ref="canvasRef" class="layer" :style="layerStyle" />
</template>

<style scoped>
.layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
</style>
```

### Countdown Clock Component

**Responsibilities:**

- Display countdown in specified format
- Update based on time scale
- Trigger visual effects

**Implementation:**

```vue
<!-- shared/components/clock/Countdown.vue -->

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useTimeStore } from "../../stores/time";
import { useClocksStore } from "../../stores/clocks";
import type { ClockState } from "../../../common/state";

interface Props {
  clockId: string;
}

const props = defineProps<Props>();

const timeStore = useTimeStore();
const clocksStore = useClocksStore();

const clock = computed(() => clocksStore.clocks.get(props.clockId));
const remaining = ref(0);
const lastUpdate = ref(0);
let animationFrame: number | null = null;

const formattedTime = computed(() => {
  const seconds = Math.max(0, Math.floor(remaining.value / 1000));
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
});

const progress = computed(() => {
  if (!clock.value) return 0;
  return (remaining.value / clock.value.duration) * 100;
});

const urgencyClass = computed(() => {
  const percent = progress.value;
  if (percent < 10) return "critical";
  if (percent < 25) return "warning";
  if (percent < 50) return "caution";
  return "normal";
});

function tick(now: number) {
  if (!clock.value?.running) {
    animationFrame = requestAnimationFrame(tick);
    return;
  }

  const deltaMs = now - lastUpdate.value;
  lastUpdate.value = now;

  // Apply time scale
  const scaledDelta = deltaMs * timeStore.scale;
  remaining.value = Math.max(0, remaining.value - scaledDelta);

  // Update store
  clocksStore.updateRemaining(props.clockId, remaining.value);

  // Check for completion
  if (remaining.value <= 0) {
    handleCompletion();
  }

  animationFrame = requestAnimationFrame(tick);
}

function handleCompletion() {
  // Could emit event, trigger effect, etc.
  console.log("Clock completed:", props.clockId);
}

watch(
  clock,
  (newClock) => {
    if (newClock) {
      remaining.value = newClock.remaining;
    }
  },
  { immediate: true },
);

onMounted(() => {
  lastUpdate.value = performance.now();
  animationFrame = requestAnimationFrame(tick);
});

onUnmounted(() => {
  if (animationFrame !== null) {
    cancelAnimationFrame(animationFrame);
  }
});
</script>

<template>
  <div
    v-if="clock && clock.visibility === 'always'"
    class="countdown"
    :class="[clock.style, urgencyClass]"
  >
    <div class="time-display">
      {{ formattedTime }}
    </div>
    <div class="progress-bar">
      <div class="progress-fill" :style="{ width: `${progress}%` }" />
    </div>
  </div>
</template>

<style scoped>
.countdown {
  padding: 1rem;
  background: rgba(0, 0, 0, 0.7);
  border-radius: 8px;
  color: white;
  text-align: center;
}

.time-display {
  font-size: 2rem;
  font-family: "Courier New", monospace;
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

.normal {
  color: #4ade80;
}

.caution {
  color: #fbbf24;
}

.warning {
  color: #fb923c;
  animation: pulse 1s ease-in-out infinite;
}

.critical {
  color: #ef4444;
  animation: pulse 0.5s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}
</style>
```

### Audio Engine Component

**Implementation:**

```vue
<!-- shared/components/audio/AudioEngine.vue -->

<script setup lang="ts">
import { watch } from "vue";
import { useAudioStore } from "../../stores/audio";
import { useAudioEngine } from "../../composables/useAudioEngine";

const audioStore = useAudioStore();
const audioEngine = useAudioEngine();

// Watch for master volume changes
watch(
  () => audioStore.masterVolume,
  (volume) => {
    audioEngine.setMasterVolume(volume);
  },
);

// This component doesn't render anything visible
// It just manages the audio engine lifecycle
</script>

<template>
  <!-- No visual output -->
</template>
```

### Log Overlay Component

**Implementation:**

```vue
<!-- display/src/components/LogOverlay.vue -->

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useLogsStore } from "../../shared/stores/logs";
import type { LogEvent } from "../../common/state";

interface Props {
  maxEvents?: number;
  filter?: string[];
  autoFade?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  maxEvents: 10,
  autoFade: true,
});

const logsStore = useLogsStore();

const recentEvents = computed(() => {
  let events = logsStore.recentEvents;

  // Apply filter
  if (props.filter && props.filter.length > 0) {
    events = events.filter((event) =>
      props.filter!.some((f) => event.eventType.startsWith(f)),
    );
  }

  // Limit to max
  return events.slice(-props.maxEvents);
});

function formatEvent(event: LogEvent): string {
  switch (event.eventType) {
    case "roll.attack":
      return `<strong>${event.data.character}</strong> rolled ${event.data.total} to hit`;
    case "combat.damage":
      return `<strong>${event.data.target}</strong> takes ${event.data.amount} damage`;
    default:
      return event.note || event.eventType;
  }
}
</script>

<template>
  <div class="log-overlay">
    <TransitionGroup name="fade">
      <div
        v-for="event in recentEvents"
        :key="event.id"
        class="log-event"
        :class="event.eventType"
        v-html="formatEvent(event)"
      />
    </TransitionGroup>
  </div>
</template>

<style scoped>
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
}

.fade-enter-active,
.fade-leave-active {
  transition: all 0.3s ease;
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.fade-leave-to {
  opacity: 0;
}
</style>
```

### Connection Status Component

**Implementation:**

```vue
<!-- shared/components/base/ConnectionStatus.vue -->

<script setup lang="ts">
import { computed } from "vue";
import { useConnectionStore } from "../../stores/connection";

const connectionStore = useConnectionStore();

const statusText = computed(() => {
  if (connectionStore.isConnected) return "Connected";
  if (connectionStore.isReconnecting) return "Reconnecting...";
  return "Disconnected";
});

const statusColor = computed(() => {
  if (connectionStore.isConnected) return "green";
  if (connectionStore.isReconnecting) return "yellow";
  return "red";
});

const statusIcon = computed(() => {
  if (connectionStore.isConnected) return "●";
  if (connectionStore.isReconnecting) return "◐";
  return "○";
});
</script>

<template>
  <div class="connection-status" :class="statusColor">
    <span class="icon">{{ statusIcon }}</span>
    <span class="text">{{ statusText }}</span>
  </div>
</template>

<style scoped>
.connection-status {
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
}

.green {
  color: #4ade80;
}

.yellow {
  color: #fbbf24;
}

.red {
  color: #ef4444;
}
</style>
```

## Display Client Application

### Main Entry Point

**display/src/main.ts:**

```typescript
import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import { useWebSocket } from "../shared/composables/useWebSocket";

// Import shared styles
import "../shared/styles/base.css";
import "../shared/styles/animations.css";

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.mount("#app");

// Initialize WebSocket after app is mounted
const config = {
  serverUrl: import.meta.env.VITE_SERVER_URL || "ws://localhost:3000/ws",
};

useWebSocket(config.serverUrl);
```

### Root Component

**display/src/App.vue:**

```vue
<script setup lang="ts">
import DisplayView from "./components/DisplayView.vue";
import ConnectionStatus from "../shared/components/base/ConnectionStatus.vue";
import AudioEngine from "../shared/components/audio/AudioEngine.vue";
</script>

<template>
  <div id="app">
    <ConnectionStatus />
    <DisplayView />
    <AudioEngine />
  </div>
</template>

<style>
#app {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: black;
}
</style>
```

### Display View Component

**display/src/components/DisplayView.vue:**

```vue
<script setup lang="ts">
import { computed } from "vue";
import LayerStack from "../../shared/components/visual/LayerStack.vue";
import Countdown from "../../shared/components/clock/Countdown.vue";
import LogOverlay from "./LogOverlay.vue";
import { useClocksStore } from "../../shared/stores/clocks";

const clocksStore = useClocksStore();

const visibleClocks = computed(() =>
  clocksStore.allClocks.filter((clock) => clock.visibility === "always"),
);
</script>

<template>
  <div class="display-view">
    <!-- Visual layers -->
    <LayerStack />

    <!-- Countdown clocks -->
    <div class="clocks-container">
      <Countdown
        v-for="clock in visibleClocks"
        :key="clock.id"
        :clock-id="clock.id"
      />
    </div>

    <!-- Log overlay -->
    <LogOverlay :max-events="5" :auto-fade="true" />
  </div>
</template>

<style scoped>
.display-view {
  position: relative;
  width: 100%;
  height: 100%;
}

.clocks-container {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 1rem;
  z-index: 100;
}
</style>
```

## Build Configuration

### Vite Config

**display/vite.config.ts:**

```typescript
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [vue()],

  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@shared": fileURLToPath(new URL("../shared", import.meta.url)),
      "@common": fileURLToPath(new URL("../common", import.meta.url)),
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

  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
```

### TypeScript Config

**display/tsconfig.json:**

```json
{
  "extends": "@vue/tsconfig/tsconfig.dom.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@shared/*": ["../shared/*"],
      "@common/*": ["../common/*"]
    },
    "strict": true,
    "jsx": "preserve"
  },
  "include": ["src/**/*", "../shared/**/*", "../common/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Package.json

**display/package.json:**

```json
{
  "name": "@squire/display",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc && vite build",
    "preview": "vite preview",
    "type-check": "vue-tsc --noEmit"
  },
  "dependencies": {
    "vue": "^3.4.0",
    "pinia": "^2.1.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.0",
    "@vue/tsconfig": "^0.5.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "vue-tsc": "^1.8.0"
  }
}
```

## Testing

### Component Tests with Vitest

```typescript
// shared/components/clock/Countdown.test.ts

import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import Countdown from "./Countdown.vue";
import { useClocksStore } from "../../stores/clocks";

describe("Countdown", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("renders countdown time", async () => {
    const clocksStore = useClocksStore();
    clocksStore.handleEvent({
      type: "ui.clock.create",
      payload: {
        id: "test-clock",
        duration: 30000,
        visibility: "always",
        style: "digital",
      },
    });

    const wrapper = mount(Countdown, {
      props: { clockId: "test-clock" },
    });

    expect(wrapper.text()).toContain("00:30");
  });

  it("updates when time scale changes", async () => {
    // Test time scale integration
  });
});
```

### Store Tests

```typescript
// shared/stores/audio.test.ts

import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useAudioStore } from "./audio";

describe("Audio Store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("handles play event", async () => {
    const audioStore = useAudioStore();

    await audioStore.handleEvent({
      type: "audio.play",
      payload: {
        channel: "music",
        source: { type: "file", ref: "test.mp3" },
        volume: 0.8,
        loop: true,
      },
    });

    const channel = audioStore.channels.get("music");
    expect(channel).toBeDefined();
    expect(channel?.playing).toBe(true);
    expect(channel?.volume).toBe(0.8);
  });
});
```

### E2E Tests with Playwright

```typescript
import { test, expect } from "@playwright/test";

test("display client renders scene", async ({ page }) => {
  await page.goto("http://localhost:5173");

  // Wait for connection
  await expect(page.locator(".connection-status.green")).toBeVisible();

  // Check layer stack rendered
  await expect(page.locator(".layer-stack")).toBeVisible();
});
```

## Master Client Differences

The master client shares all the same stores and base components, but adds:

### Control Components

**master/src/components/controls/AudioMixer.vue:**

```vue
<script setup lang="ts">
import { useAudioStore } from "../../../shared/stores/audio";
import { useWebSocket } from "../../../shared/composables/useWebSocket";

const audioStore = useAudioStore();
const { send } = useWebSocket(config.serverUrl);

function handlePlay(channel: string) {
  send({
    type: "audio.play",
    payload: {
      channel,
      source: { type: "file", ref: selectedTrack.value },
      volume: 0.8,
      loop: false,
    },
  });
}

function handleVolumeChange(channel: string, volume: number) {
  send({
    type: "audio.channel.volume",
    payload: { channel, volume },
  });
}
</script>

<template>
  <div class="audio-mixer">
    <div
      v-for="channel in audioStore.allChannels"
      :key="channel.id"
      class="channel"
    >
      <h3>{{ channel.id }}</h3>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        :value="channel.volume"
        @input="handleVolumeChange(channel.id, $event.target.value)"
      />
      <button @click="handlePlay(channel.id)">Play</button>
    </div>
  </div>
</template>
```

## Performance Optimizations

### Lazy Component Loading

```typescript
// Display/src/App.vue
import { defineAsyncComponent } from "vue";

const LogOverlay = defineAsyncComponent(
  () => import("./components/LogOverlay.vue"),
);
```

### Virtual Scrolling for Logs

```vue
<script setup lang="ts">
import { useVirtualList } from "@vueuse/core";

const { list, containerProps, wrapperProps } = useVirtualList(
  logsStore.allEvents,
  { itemHeight: 40 },
);
</script>

<template>
  <div v-bind="containerProps" class="log-list">
    <div v-bind="wrapperProps">
      <div v-for="{ data, index } in list" :key="index" class="log-item">
        {{ formatEvent(data) }}
      </div>
    </div>
  </div>
</template>
```

### Debounced Updates

```typescript
import { watchDebounced } from "@vueuse/core";

watchDebounced(
  () => audioStore.masterVolume,
  (volume) => {
    audioEngine.setMasterVolume(volume);
  },
  { debounce: 100 },
);
```

## Summary

This Vue architecture provides:

- **Reactive State**: Pinia stores with automatic reactivity
- **Composable Logic**: Reusable composables for shared behavior
- **Type Safety**: Full TypeScript integration
- **Component Encapsulation**: Single-file components with scoped styles
- **Shared Code**: Maximum reuse between display and master clients
- **Developer Experience**: Vue DevTools, hot reload, excellent DX
- **Performance**: Virtual lists, lazy loading, optimized rendering
- **Maintainability**: Clear separation of concerns, testable architecture

The Vue approach provides a more opinionated but cohesive developer experience compared to Web Components, with excellent tooling and a mature ecosystem. Pinia provides lightweight, intuitive state management, while composables enable clean code reuse. The Composition API makes components readable and testable.
