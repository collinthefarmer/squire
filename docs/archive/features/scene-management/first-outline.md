# Scene Management Feature - Conceptual Outline

## Core Concept

A comprehensive state capture and restoration system that freezes the entire moment - every visible layer, every playing sound, every ticking clock, the very flow of time itself - and preserves it as a named scene. Not merely bookmarks, but complete snapshots of reality that the DM can conjure at will. The tavern scene with its crackling fire and murmuring patrons. The combat scene with pulsing red overlay and urgent drums. The ritual chamber with arcane symbols slowly rotating and ominous chanting echoing. Each scene a world unto itself, each transition a shift between realities.

## Architecture Integration

### Scene as State Snapshot

A scene captures complete application state at a moment:

- **Visual State**: All image layers, their sources, effects, transformations, visibility
- **Audio State**: All channel playback states, sources, volumes, effects, positions
- **Time State**: Current time scale, all active countdown clocks and their remaining times
- **In-Game Time**: Fictional world time/date (if tracked)
- **Custom State**: Any additional game-specific data (HP, initiative order, etc.)
- **Metadata**: Scene name, description, tags, thumbnail, creation timestamp

Scenes are hierarchical state containers - they hold everything needed to recreate a specific moment.

### State Management on Server

Server maintains:

- **Current State**: The live, active state all clients see
- **Scene Library**: Collection of saved scenes
- **Scene History**: Undo/redo stack of recent states
- **Auto-Saves**: Periodic snapshots for recovery

When scene loads, server state updates and broadcasts changes to all clients simultaneously.

### Event Types

New event category: `scene.*`

**Scene Lifecycle:**

- `scene.save` - Capture current state as new scene
- `scene.load` - Restore scene to active state
- `scene.update` - Modify existing scene definition
- `scene.delete` - Remove scene from library
- `scene.duplicate` - Clone scene for variations

**Scene Transitions:**

- `scene.transition` - Animate transition between scenes
- `scene.crossfade` - Blend between current and target scene
- `scene.preset.apply` - Apply transition preset

**Scene Organization:**

- `scene.tag.add` - Add organizational tags
- `scene.group.create` - Create scene groupings (acts, locations, encounters)
- `scene.reorder` - Change scene ordering in library

**State Management:**

- `scene.autosave` - Background auto-save trigger
- `scene.snapshot` - Quick temporary snapshot (for undo/redo)
- `scene.compare` - Diff two scenes to see differences

### Event Payload Structure

```
{
  type: "scene.load",
  payload: {
    sceneId: "tavern-evening",       // Scene identifier
    transition: {
      type: "crossfade",             // or "cut", "fade-black", "custom"
      duration: 2000,                // Transition duration (ms)
      audioFade: true,               // Crossfade audio or cut
      preserveState: {               // Optional: don't restore certain state
        clocks: false,               // Keep current clocks running
        timeScale: false,            // Keep current time scale
        audio: ["voice"]             // Keep certain audio channels
      }
    }
  }
}
```

## Scene Content Structure

### State Capture Granularity

Scenes capture state in modular sections:

**Visual Section:**

```
{
  layers: [
    {
      alias: "background",
      imageRef: "tavern-interior-01",
      aspectRatio: "cover",
      position: { x: "center", y: "center" },
      opacity: 1.0,
      visible: true,
      effects: [...],
      blendMode: "normal",
      zIndex: 0
    },
    // ... more layers
  ]
}
```

**Audio Section:**

```
{
  channels: [
    {
      id: "music",
      source: {
        type: "file",
        ref: "tavern-ambience-loop"
      },
      playing: true,
      position: 45320,      // Current playback position (ms)
      volume: 0.7,
      loop: true,
      effects: [...],
      fadeState: null
    },
    // ... more channels
  ],
  masterVolume: 0.8,
  ducking: {...}
}
```

**Time Section:**

```
{
  scale: 1.0,
  clocks: [
    {
      id: "turn-timer",
      remaining: 18000,
      duration: 30000,
      running: true,
      visibility: "always",
      style: "dramatic",
      alerts: [...]
    }
  ],
  worldTime: {
    date: "15th of Mirtul, 1492 DR",
    timeOfDay: "evening",
    timestamp: 1650000000    // Arbitrary in-game time value
  }
}
```

**Custom Section:**

```
{
  gameState: {
    initiativeOrder: [...],
    activeEffects: [...],
    environmentalHazards: [...],
    // Any campaign-specific data
  }
}
```

### Partial Scenes

Not all scenes need to be complete:

- **Visual-Only Scene**: Only updates image layers, preserves audio/time
- **Audio-Only Scene**: Only changes music/ambient, preserves visuals
- **Overlay Scene**: Adds layers on top of existing scene without replacing
- **Modifier Scene**: Applies effects/changes to current state without replacing it

Allows mixing and matching - load tavern visuals, then overlay combat music, without creating every combination as separate scene.

### Scene Inheritance

Scenes can inherit from other scenes:

```
Base Scene: "Tavern - Day"
  ↓ inherits
Child Scene: "Tavern - Night"
  → Only stores differences (darker lighting layer, different ambient audio)
```

Benefits:

- Reduces redundancy
- Variations share common elements
- Update base → all children update
- Smaller storage footprint

## Scene Library Organization

### Hierarchical Structure

Scenes organized in nested groups:

```
Campaign
├── Act 1: The Gathering Storm
│   ├── Chapter 1: Humble Beginnings
│   │   ├── Tavern Scenes
│   │   │   ├── Tavern - Morning
│   │   │   ├── Tavern - Evening
│   │   │   └── Tavern - Fight Breaks Out
│   │   └── Forest Road Scenes
│   └── Chapter 2: Dark Omens
└── Act 2: Rising Conflict
```

Navigate by act/chapter/location, or flatten to list view.

### Tagging System

Scenes have multiple tags for flexible organization:

- **Location Tags**: "tavern", "forest", "dungeon", "city"
- **Mood Tags**: "tense", "peaceful", "mysterious", "epic"
- **Encounter Tags**: "combat", "roleplay", "exploration", "puzzle"
- **Time Tags**: "day", "night", "dawn", "dusk"
- **Custom Tags**: User-defined categories

Search and filter by tags: "Show me all tense dungeon combat scenes"

### Scene Metadata

Each scene includes:

- **Name**: "The Shattered Throne Room"
- **Description**: "After the lich's defeat, the throne room lies in ruins..."
- **Thumbnail**: Preview image (auto-generated or custom)
- **Duration Estimate**: Expected scene length (for session planning)
- **Notes**: DM reminders, trigger cues, NPC names
- **Usage Count**: How many times loaded (find favorites)
- **Last Used**: Timestamp of last load
- **Color Code**: Visual organization aid

### Smart Collections

Auto-updating scene collections based on criteria:

- **Recent**: Last 10 loaded scenes
- **Favorites**: Manually starred scenes
- **Frequently Used**: Most-loaded scenes
- **Unused**: Scenes never loaded (cleanup candidates)
- **By Date**: Scenes created this session, this week, etc.
- **By Tag**: Dynamic collections per tag

## Scene Transitions

### Transition Types

Different ways to move between scenes:

**Cut (Instant):**

- Old scene disappears, new scene appears immediately
- Jarring but dramatic, good for surprises
- Audio cuts abruptly

**Crossfade:**

- Old scene fades out while new scene fades in
- Smooth, professional
- Audio crossfades simultaneously
- Configurable overlap duration

**Fade to Black:**

- Fade out current scene to black screen
- Hold on black (optional)
- Fade in new scene
- Theatrical, creates sense of time passing

**Wipe/Swipe:**

- New scene sweeps across screen, replacing old
- Directional (left, right, up, down)
- Can be fast or slow
- Comic book panel feel

**Custom Animations:**

- Dissolve (noise-based transition)
- Blur transition (old blurs out, new sharpens in)
- Zoom (old zooms out, new zooms in)
- Spin transition (3D rotation effect)

### Transition Configuration

Transitions have detailed parameters:

```
{
  type: "crossfade",
  duration: 3000,              // Total transition time
  curve: "ease-in-out",        // Timing function
  audioFade: true,             // Crossfade audio or cut
  visualFade: true,            // Crossfade visuals or cut
  holdBlack: 0,                // Pause on black screen (ms)
  layerStagger: 100,           // Stagger layer transitions
  effects: {                   // Effects during transition
    blur: { max: 10, midpoint: 0.5 }  // Blur during middle of transition
  }
}
```

### Selective State Preservation

Sometimes you don't want to restore everything:

```
Load "Combat Arena" scene but:
  → Preserve current time scale (keep slow-mo active)
  → Keep voice channel playing (DM still narrating)
  → Don't reset world time (maintain continuous timeline)
```

Allows combining scene loading with manual state management.

### Transition Macros

Complex transition sequences:

```
"Epic Boss Entrance" Transition:
  1. Fade current audio to 50% over 2 seconds
  2. Play thunder SFX
  3. Flash screen white (visual layer)
  4. Cut to boss arena scene
  5. Start boss music with fade-in
  6. Trigger countdown clock
```

Multi-step choreographed transitions as reusable macros.

## Scene Templates

### Creating from Template

Templates are scene scaffolds:

- **Combat Template**: Pre-configured with initiative tracker, turn timer, combat music channel
- **Exploration Template**: Ambient sounds, slow music, no timers
- **Puzzle Template**: Countdown clock, tension music, hint system

Create new scene from template, then customize specifics.

### Template Library

Shared templates across campaigns:

- Built-in templates for common scenarios
- User-created templates
- Community-shared templates (import/export)

### Template Variables

Templates can have placeholders:

```
Template: "Generic Combat"
  Background: [LOCATION_IMAGE]
  Music: [COMBAT_MUSIC_TRACK]
  Clock Duration: [TURN_LENGTH]

Instantiate:
  → Background: "forest-clearing-01"
  → Music: "battle-drums-intense"
  → Clock Duration: 30000
```

One template generates many specific scenes.

## Auto-Save and History

### Auto-Save System

Background state preservation:

- **Interval Auto-Save**: Every N minutes, save current state
- **Event-Triggered Auto-Save**: Before major changes (scene loads, session end)
- **Recovery Auto-Save**: Periodic snapshots for crash recovery

Auto-saves don't clutter scene library - separate "recovery" section.

### Undo/Redo

Session history as navigable timeline:

- Undo last action (scene load, manual state change)
- Redo undone action
- Jump to specific point in history
- View timeline of session changes

Implemented as state snapshot stack, lightweight since only stores diffs.

### Version History

Scenes can have multiple versions:

```
"Throne Room - v1" (original)
"Throne Room - v2" (added fire effects)
"Throne Room - v3" (changed music)
```

Revert to previous version, compare versions, branch versions.

## Scene Scheduling and Automation

### Scene Playlist

Queue scenes for automatic progression:

```
Session Plan:
  1. Opening Scene (5 min)
  2. Travel Montage (2 min, auto-advance)
  3. Arrival at Village (wait for manual advance)
  4. Village Scenes (nested playlist)
```

DM can follow planned progression or deviate as needed.

### Conditional Scene Loading

Scenes load based on triggers:

- **Time-Based**: Load "Night Scene" when in-game time reaches evening
- **Event-Based**: Load "Trap Sprung" when specific log event occurs
- **State-Based**: Load "Low Health" visual overlay when HP < 25%
- **Clock-Based**: Load next scene when countdown completes

Automated cinematics without manual triggering.

### Scene Randomization

Random scene selection from pool:

- "Load random tavern ambience"
- "Load random combat music"
- Weighted randomization (some scenes more likely)

Variety without manual selection.

## Integration with Other Systems

### Image Layers

Scenes capture complete layer stack:

- All layer aliases and their configurations
- Effect chains on each layer
- Animations in progress
- Z-order and visibility

Loading scene reconstructs entire visual composition.

### Audio Channels

Scenes preserve audio state:

- What's playing on each channel
- Current playback position (resume mid-track)
- Effect chains and parameters
- Volume levels and ducking state

Seamless audio continuity or clean cuts, configurable.

### Time Scale

Scenes can include time scale:

- "Slow-Mo Combat Scene" has scale = 0.5 built in
- "Time Stop Puzzle" has scale = 0.0
- Or preserve current scale when loading

### Countdown Clocks

Scenes can include active clocks:

- Combat scene creates turn timer
- Ritual scene creates countdown to completion
- Or preserve existing clocks

### In-Game Time Tracking

Optional fictional timeline:

- Track world date/time
- Scenes can advance time ("Travel scene" adds 4 hours)
- Day/night cycle affects scene selection
- Rest periods reset certain state

## Client Synchronization

### Atomic Scene Loading

All clients receive scene state simultaneously:

- Server broadcasts complete scene payload
- Clients parse and apply all changes together
- Prevents partial/inconsistent state across clients
- Transition animations keep clients aligned during change

### State Reconciliation

When client reconnects mid-scene:

- Server sends current active scene
- Client loads scene from library or receives definition
- Client synchronizes to current playback positions/clock times
- Catches up to live state

### Bandwidth Optimization

Scenes can be large (many layers, complex state):

- Scene definitions stored locally on clients (library sync)
- Load events only send scene ID, not full definition
- Clients fetch scene from local library
- Differential updates for scene modifications

## Extension Points

### Scene Blending

Combine multiple scenes:

- Load visuals from Scene A
- Audio from Scene B
- Time settings from Scene C
- Creates hybrid scenes dynamically

### Scene Scripting

Script complex scene behaviors:

```
On Scene Load:
  → Wait 5 seconds
  → Add "smoke" layer with fade-in
  → Wait 3 seconds
  → Play scream SFX
  → Trigger "ghost appears" scene overlay
```

Automated sequences beyond simple state restoration.

### Scene Analytics

Track scene usage:

- Which scenes engage players most (duration, reactions)
- Scene flow patterns (common transitions)
- Unused scenes (cleanup opportunities)
- Session pacing (time spent in each scene)

### Multi-Scene States

Advanced state management:

- Picture-in-Picture (mini-scene in corner while main scene plays)
- Split-Screen (different clients see different scenes)
- Layered Scenes (base scene + overlay scenes)

### Scene Export/Import

Share scenes across campaigns:

- Export scene as JSON file
- Import community-created scenes
- Scene packs (thematic collections)
- Cloud sync across devices

### Dynamic Scene Generation

Procedural scene creation:

- "Generate random dungeon room scene"
- AI-assisted scene composition
- Template + parameters → unique scene

## UI Considerations for Master Client

### Scene Browser

- Grid view with thumbnails
- List view with metadata
- Search/filter by tags, name, date
- Hierarchical navigation (folders/groups)
- Preview on hover

### Scene Editor

- Visual layer configuration
- Audio channel setup
- Time settings
- Metadata editing (name, description, tags)
- Thumbnail selection/generation

### Quick Load Bar

- Recent scenes as horizontal thumbnails
- Hotkey assignment (F1-F12 for common scenes)
- Favorites section
- Current scene indicator

### Transition Designer

- Select transition type
- Preview transition
- Configure parameters
- Save custom transitions

### Session Timeline

- Visual timeline of scenes loaded during session
- Jump back to previous scene
- See duration in each scene
- Export session log with scenes

## Questions to Consider

1. **Scene Size Limits**: Maximum complexity per scene? (Layer count, audio channels, etc.)
2. **Storage**: Where do scenes persist? Local files, server database, cloud storage?
3. **Scene Conflicts**: What if scene references missing assets? Graceful degradation or error?
4. **State Scope**: Should scenes capture UI state (master client layout, client display settings)?
5. **Automatic Tagging**: Auto-tag scenes based on content (detect mood from music, etc.)?
6. **Scene Permissions**: Can players trigger scene changes, or DM-only?
7. **Real-Time Collaboration**: Can multiple DMs edit scene library simultaneously?

## Extensibility Benefits

By treating scenes as comprehensive state containers:

- Any new feature's state can be added to scene definition
- Scenes become increasingly powerful as features expand
- Clean abstraction for complex state management
- Foundation for session planning and automation
- Easy to build advanced tools (scene graphs, flowcharts, scripting)
- Enables session replay and recording capabilities
- Natural integration point for AI/procedural generation
- Supports both simple setups and complex productions

The architecture: server maintains scene library and current active state, scenes are serializable snapshots of complete application state, loading a scene atomically updates server state and broadcasts to clients, transitions provide smooth visual/audio changes between states. Master client manages library, creates scenes, triggers loads, designs transitions. Everything preserved, everything restorable, everything composable into larger narrative structures.
