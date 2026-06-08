# Image Display Feature - Conceptual Outline

## Core Concept

A layered visual canvas where images can be composed, positioned, and manipulated across multiple depth planes. Not just showing a single background - but building scenes through stacked layers with independent aspect ratios, blend modes, effects, and transformations. The tavern background, the flickering firelight overlay, the rain effect on top, each on their own layer, each controllable, each aliased for easy reference.

## Architecture Integration

### State Management

- Server maintains the current layer stack for each connected display client (or globally)
- Layers have aliases (names) rather than just numeric indices
- Master client can manipulate layers by alias: "background", "weather", "overlay-vignette", "character-portrait"
- Clients render their local representation of the layer stack

### Event Types

New event category: `visual.image.*`

- `visual.image.set` - Set/replace image on a specific layer
- `visual.image.clear` - Remove image from a layer
- `visual.image.transform` - Apply transformations (position, scale, rotation)
- `visual.image.effect` - Apply or modify effects/shaders
- `visual.image.layer_config` - Configure layer properties (blend mode, opacity, z-index)
- `visual.image.transition` - Animated transition between images

### Event Payload Structure

```
{
  type: "visual.image.set",
  payload: {
    layer: "background",           // Alias for the layer
    imageRef: "tavern-interior-01", // Asset reference
    aspectRatio: "cover",           // or "contain", "fill", "custom"
    position: {                     // Optional positioning
      x: "center",                  // or pixel/percentage values
      y: "center"
    },
    transition: {                   // Optional fade-in/crossfade
      type: "crossfade",
      duration: 1000
    }
  },
  metadata: {
    targetClients: ["display-1"]    // Optional: specific client targeting
  }
}
```

## Layer Management

### Layer Aliasing System

Instead of brittle numeric indices, use semantic names:

- "background" - Primary scene image
- "midground" - Environmental elements, furniture
- "weather" - Rain, fog, snow effects
- "lighting" - Dynamic light overlays, shadows
- "foreground" - Close elements, frame effects
- "ui-overlay" - HUD elements, borders
- "effect-flash" - Temporary visual effects

Aliases map to actual render order (z-index), but DM thinks in terms of purpose rather than numbers.

### Layer Configuration

Each layer has properties:

- **Blend Mode**: normal, multiply, screen, overlay, add, etc.
- **Opacity**: 0.0 to 1.0
- **Z-Index**: Render order (auto-managed but overridable)
- **Visibility**: Show/hide without removing image
- **Lock**: Prevent accidental changes
- **Clip Region**: Optional masking/cropping

### Dynamic Layer Creation

Master client can create layers on-the-fly:

- "I want a new layer called 'spell-effect' between 'midground' and 'weather'"
- Server validates, creates, broadcasts to clients
- Clients add it to their render pipeline

## Aspect Ratio Handling

### Modes

Different layers might need different aspect ratio behaviors:

1. **Cover**: Image fills entire viewport, cropping edges if needed (typical for backgrounds)
2. **Contain**: Entire image visible, letterboxing if needed (portraits, maps)
3. **Fill**: Stretch to fill, distorting if necessary (usually avoid, but available)
4. **Native**: Display at image's natural size and aspect ratio
5. **Custom**: Explicit width/height constraints

### Responsive Behavior

Clients with different screen sizes/aspect ratios render the same layer stack differently:

- Projector (16:9) vs tablet (4:3) vs phone (tall) all get appropriate fitting
- Server doesn't dictate pixel dimensions, only intent
- Clients honor aspect ratio mode per their display characteristics

### Anchor Points

Images can anchor to different viewport positions:

- Center (default for most)
- Top/bottom (horizon lines, ground planes)
- Left/right (side elements)
- Custom coordinates for precise placement

## Effects and Shader System

### Effect Categories

Effects are modular, stackable, and parameterized:

1. **Color Adjustments**
   - Brightness, contrast, saturation
   - Hue shift, color grading
   - Tint overlays (sepia, night-vision green, etc.)

2. **Blur and Focus**
   - Gaussian blur (fog, depth of field)
   - Motion blur
   - Radial blur (speed lines, impact)

3. **Distortion**
   - Ripple (water, magic)
   - Wave (heat shimmer)
   - Pixelation (glitch, scrying)
   - Chromatic aberration

4. **Lighting**
   - Glow/bloom
   - Vignette (darken edges)
   - Light rays (god rays, beams)

5. **Atmospheric**
   - Film grain
   - Noise
   - Scan lines (magical wards)

6. **Composite**
   - Drop shadow
   - Outline/stroke
   - Masking

### Effect Payload Structure

```
{
  type: "visual.image.effect",
  payload: {
    layer: "background",
    effects: [
      {
        type: "blur",
        params: { radius: 5, quality: "high" }
      },
      {
        type: "tint",
        params: { color: "#4a5fb8", intensity: 0.3 }
      }
    ],
    replace: false  // If true, replace all effects; if false, add/merge
  }
}
```

### Shader Support

For advanced users, custom shaders:

- GLSL fragment shaders for WebGL clients
- Predefined shader library (fire, water, magic circles)
- Parameters exposed to master client (speed, intensity, colors)
- Graceful degradation for clients that can't render shaders (fall back to static image or simpler effect)

### Effect Presets

Common combinations saved as presets:

- "Underwater" = blue tint + ripple + blur
- "Hellscape" = red tint + heat shimmer + high contrast
- "Dream Sequence" = blur + glow + desaturate
- "Scrying Vision" = vignette + chromatic aberration + grain

Master client can apply preset with one action, modify parameters afterward.

## Animation and Transitions

### Image Transitions

When changing images on a layer:

- Crossfade (overlap old/new with opacity transition)
- Fade to black (fade out, swap, fade in)
- Wipe (directional replacement)
- Dissolve (noise-based transition)
- Cut (instant swap)

Duration, easing curves, and transition type all parameterized.

### Animated Effects

Effects can animate over time:

- Pulsing glow (breathing effect)
- Oscillating blur (dreamlike)
- Scrolling noise (energy field)
- Color cycling (magical auras)

Parameters include rate, loop mode, synchronization across clients.

### Layer Animations

Entire layers can animate:

- Parallax scrolling (clouds drifting)
- Rotation (spinning symbols)
- Scale pulsing (breathing environment)
- Position tweening (camera pan simulation)

## Client-Side Rendering

### Rendering Pipeline

Display clients need a compositing engine:

1. Load images from asset sources
2. Sort layers by z-index
3. Apply transformations (scale, position, rotation)
4. Apply effects/shaders
5. Composite with blend modes
6. Render to canvas

### Asset Caching

Images referenced by events should be cached locally:

- Preload common assets at session start
- Cache recently used images
- Lazy load on demand
- Handle missing assets gracefully (placeholder or skip layer)

### Performance Considerations

- Layers that haven't changed don't re-render (dirty checking)
- Effects can be computationally expensive - quality/performance trade-offs
- Option to disable effects on lower-end clients
- Progressive enhancement: baseline image always works, effects are bonuses

## Integration with Other Systems

### Scene System (`scene.*`)

- Scene changes can include full layer configurations
- Save/load scene presets (entire layer stack snapshots)
- "The tavern scene has background, firelight, and ambient-smoke layers pre-configured"

### Time Scale (`time.*`)

- Animated effects respect time scale
- Transitions slow down in slow-mo
- Animated layers adjust playback rate

### Audio Sync (`audio.*`)

- Visual effects can trigger in sync with audio
- Lightning flash when thunder sound plays
- Music beat-synced pulsing effects

### State Events (`state.*`)

- Game state can drive visual changes
- HP drops → red tint increases
- Boss phase change → environmental shift

## Extension Points

### Future Visual Features

1. **Video Layers**: Replace static images with video playback
2. **Live Feeds**: Webcam inputs, screen shares as layers
3. **Generative Art**: Procedural backgrounds, evolving patterns
4. **3D Elements**: Three.js scenes as layers (maps, models)
5. **Interactive Layers**: Click-to-reveal, draggable elements
6. **Particle Systems**: Emitters on layers (sparks, snow, leaves)

### Custom Effect Plugins

Third-party or user-created effects:

- Define effect interface (input image, parameters, output image)
- Register custom effects with clients
- Share effect definitions across installations

### Layer Templates

Save layer configurations as reusable templates:

- "Combat overlay" = initiative layer + effect flashes + vignette
- "Cinematic mode" = letterbox bars + film grain + color grade
- Apply template, then customize

## UI Considerations for Master Client

### Layer Panel

- Visual stack of current layers (thumbnail previews)
- Drag to reorder
- Toggle visibility with eye icon
- Adjust opacity with slider
- Quick access to common effects

### Effect Browser

- Categorized list of available effects
- Preview before applying
- Adjust parameters with sliders/inputs
- Save custom presets

### Scene Library

- Grid of saved scene configurations
- One-click to load entire visual setup
- Tag/search for quick access

### Quick Actions

- Hotkeys for common operations (flash layer, fade to black)
- Macro support (trigger multiple visual events in sequence)

## Questions to Consider

1. **Layer Limits**: Maximum number of simultaneous layers? (Performance vs flexibility)
2. **Asset Management**: Where do images live? Local, server, CDN, mixed?
3. **Client Capabilities**: How to handle varying client GPU power for effects?
4. **Layer Persistence**: Do layers persist when clients reconnect, or reset?
5. **Targeting**: Can different clients show different layer stacks simultaneously?
6. **Real-time Preview**: Should master client show preview of what displays see?

## Extensibility Benefits

By treating images as layered, aliased, effect-capable entities:

- New visual features slot into existing layer infrastructure
- Effects are composable and reusable across features
- Layer metaphor extends naturally (video layers, 3D layers, interactive layers)
- Clean separation between intent (event payload) and rendering (client implementation)
- Same system handles simple backgrounds and complex multi-layer compositions
- Easy to build scene presets, visual macros, and automated sequences

The architecture: server manages abstract layer state and broadcasts changes, clients interpret that state into rendered visuals using their available capabilities. Master client manipulates layers through semantic aliases rather than implementation details. Everything composable, everything extensible, everything responsive to different display contexts.
