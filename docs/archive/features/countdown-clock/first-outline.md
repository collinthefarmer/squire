# Countdown Clock Feature - Conceptual Outline

## Core Concept

A visible timer that counts down from a specified duration, its progression warped by the global time scale, its appearance shifting as urgency mounts. Not merely a static number ticking away - but a dynamic visual element that pulses red as seconds dwindle, freezes when time stops, races when time accelerates. Turn timers, ritual countdowns, bomb defusals, all driven by the same flexible clock system.

## Architecture Integration

### State Management

- Server maintains authoritative clock state
- Multiple named clocks can exist simultaneously ("turn-timer", "ritual-countdown", "doomsday-clock")
- Each clock tracks: remaining time, initial duration, running state, creation timestamp
- Server calculates elapsed time accounting for time scale changes
- Broadcasts clock updates to subscribed clients

### Event Types

New event category: `ui.clock.*`

- `ui.clock.create` - Initialize a new countdown clock
- `ui.clock.start` - Begin countdown (or resume)
- `ui.clock.pause` - Pause without destroying
- `ui.clock.reset` - Return to initial duration
- `ui.clock.adjust` - Add/subtract time while running
- `ui.clock.destroy` - Remove clock entirely
- `ui.clock.tick` - Periodic sync event (server → clients)
- `ui.clock.complete` - Fired when countdown reaches zero

### Event Payload Structure

```
{
  type: "ui.clock.create",
  payload: {
    id: "turn-timer",              // Unique identifier
    duration: 30000,                // Milliseconds
    autoStart: true,                // Start immediately or wait for start event
    visibility: "always",           // or "auto", "hidden", "dm-only"
    position: "top-center",         // Screen position
    style: "dramatic",              // Visual theme/preset
    alerts: [                       // Warning thresholds
      { at: 10000, effect: "pulse" },
      { at: 5000, effect: "flash-red" },
      { at: 0, effect: "explosion" }
    ]
  }
}
```

## Time Scale Integration

### Scaled Progression

The clock's countdown rate multiplies by current time scale:

- Time scale 1.0: Clock counts down normally (1 real second = 1 clock second)
- Time scale 0.5: Clock counts down at half speed (2 real seconds = 1 clock second)
- Time scale 2.0: Clock counts down at double speed (0.5 real seconds = 1 clock second)
- Time scale 0.0: Clock pauses completely

### Server-Side Calculation

Server maintains accurate time accounting despite scale changes:

```
When calculating remaining time:
1. Track last update timestamp and time scale at that moment
2. On time scale change, calculate elapsed scaled time since last update
3. Subtract elapsed scaled time from remaining time
4. Update last update timestamp and current scale
5. Broadcast new remaining time to clients
```

This prevents drift and ensures all clients see synchronized time, regardless of when they joined or reconnected.

### Visual Feedback for Time Scale Changes

When time scale changes, clock provides visual indication:

- **Acceleration**: Brief speed lines, blur effect, higher pitch sound
- **Deceleration**: Ripple effect, lower pitch sound, brief glow
- **Pause**: Freeze frame effect, pulse outline, muted colors
- **Resume**: Flash, return to normal colors, emphasis pulse

These effects help players understand when time manipulation occurs without explicit announcement.

## Visibility System

### Visibility Modes

1. **Always**: Clock visible at all times while active
2. **Auto**: Shows automatically at specific thresholds (last 30 seconds, etc.)
3. **Hidden**: Running but not displayed (server still tracks, can reveal later)
4. **DM-Only**: Only master client sees it (turn planning, hidden timers)
5. **Conditional**: Visibility based on game state predicates

### Dynamic Show/Hide

Master client can toggle visibility without destroying the clock:

- Players don't know a timer is running until DM reveals it
- Dramatic reveal when ritual countdown becomes visible
- Hide during non-critical moments, show during pressure situations

### Auto-Hide on Complete

Configurable behavior when clock reaches zero:

- Persist and show "00:00" until manually dismissed
- Auto-hide after completion (fade out)
- Auto-destroy and trigger follow-up event
- Loop/restart (recurring timers)

## Visual Presentation

### Display Formats

Time can render in multiple formats:

- **Digital**: `01:34` or `1:34.5` (minutes:seconds, with optional decimals)
- **Analog**: Circular progress indicator (pie chart fills/empties)
- **Progress Bar**: Linear bar depleting left-to-right or top-to-bottom
- **Numeric**: Simple number with units (`94 seconds`, `1.5 minutes`)
- **Hybrid**: Combination (analog ring around digital display)

### Position Options

Clock can position anywhere on screen:

- **Preset Positions**: top-left, top-center, top-right, center, bottom-left, etc.
- **Custom Coordinates**: Pixel or percentage-based positioning
- **Layer Integration**: Exists as special UI layer in image system (appears above/below other visual layers)
- **Per-Client Positioning**: Different displays can show clock in different positions

### Style Themes

Pre-designed visual themes:

- **Minimal**: Clean, small, unobtrusive
- **Dramatic**: Large, bold, high contrast
- **Arcane**: Magical glyphs, particle effects, mystical aesthetic
- **Tech**: Digital, sci-fi, holographic appearance
- **Diegetic**: In-world appearance (hourglass, sundial, burning fuse)

Each theme responds to urgency differently - arcane theme glows brighter, tech theme flickers, etc.

## Dynamic Effects Based on Time

### Urgency Scaling

As time depletes, visual intensity increases:

**Time Remaining Thresholds:**

- **100-50%**: Calm, steady, subtle presence
- **50-25%**: Color shift toward yellow/orange, slight pulsing begins
- **25-10%**: Orange to red transition, faster pulsing, size increase
- **10-0%**: Intense red, rapid pulsing, shake/vibration, audio alerts

Effects smoothly interpolate between thresholds rather than stepping abruptly.

### Alert System

Custom alerts at specific time values:

```
{
  at: 10000,              // Trigger when 10 seconds remain
  effect: "flash-red",    // Visual effect type
  audio: "bell-chime",    // Optional audio cue
  message: "10 seconds!", // Optional text overlay
  vibrate: true           // Optional haptic feedback (if supported)
}
```

Multiple alerts can stack, creating escalating tension.

### Completion Effects

When countdown reaches zero, dramatic culmination:

- **Visual**: Explosion effect, flash, fade to white, shatter, etc.
- **Audio**: Bell, gong, alarm, explosion sound
- **Screen Effect**: Full-screen flash, shake, color overlay
- **Trigger Event**: Fire additional game events (damage, scene change, etc.)

Master client can configure completion behavior per clock instance.

## Integration with Other Systems

### Time Scale Effects

Clock subscribes to `time.*` events:

- Receives time scale changes and adjusts countdown rate
- Visual effects indicate scale changes
- Can be configured to ignore time scale (`respectTimeScale: false`) for real-world timers

### Audio Synchronization

Clock can sync with audio system:

- Ticking sounds that respect time scale (faster ticks = higher pitch)
- Silence when paused
- Warning sounds at thresholds
- Completion sound when reaching zero

### Visual Layer System

Clock renders as special UI layer:

- Can appear above or below other visual layers
- Can have effects applied (though typically exempt from scene-wide effects)
- Multiple clocks can exist simultaneously with different z-indices

### Event Triggering

Clock completion can trigger other events:

```
When "bomb-timer" reaches zero:
  → Trigger visual.image.set (explosion background)
  → Trigger audio.sfx (explosion sound)
  → Trigger log.event (combat damage)
  → Trigger ui.message (display result text)
```

This allows complex sequences choreographed around timing.

### State Events

Clock state can drive other game state:

- Initiative timer completion advances to next turn
- Ritual timer completion triggers story event
- Buff/debuff duration tracking with visual countdown
- Environmental hazard cycles (lava pulses every 30 seconds)

## Multiple Concurrent Clocks

### Independent Timers

Multiple clocks can run simultaneously:

- Turn timer for each player in initiative order
- Ritual countdown in background
- Buff duration indicators
- Environmental event cycles

Each maintains independent state, duration, visibility, and styling.

### Clock Coordination

Master client can orchestrate multiple clocks:

- Start all simultaneously
- Chain completion (clock-1 finishes → clock-2 starts)
- Synchronized resets (all turn timers restart together)
- Grouped visibility (show/hide all combat timers at once)

### Visual Stacking

When multiple clocks visible:

- Automatic layout prevents overlap (stack vertically, spread horizontally)
- Configurable priority (which clock appears most prominent)
- Optional compact mode (smaller representations when many active)

## Extension Points

### Custom Clock Behaviors

Beyond simple countdown:

1. **Count-Up**: Elapsed time tracker (how long has combat lasted?)
2. **Interval Pulse**: Triggers event every N seconds (environmental hazard)
3. **Random Duration**: Clock starts with unknown time, revealed later
4. **Conditional Progression**: Clock only advances when conditions met (while player is in zone)
5. **Asymmetric Time**: Different clients see different remaining times (perception effects)

### Programmable Alerts

Alert system can trigger arbitrary actions:

- Visual effects on specific layers
- Audio changes (music intensity increases)
- Game state modifications (enemies spawn when timer < 10s)
- Messages to specific clients
- Chained clock creation (sub-timers spawn from main timer)

### Visual Customization

Users can create custom clock appearances:

- Custom CSS/styling
- Animated backgrounds
- Particle effects around clock
- Custom fonts and icons
- Integration with campaign theming

### Time Manipulation Effects

Special interactions with time scale:

- Clock that counts _up_ when time scale reversed (exotic mechanic)
- Clock that ignores pause (real-world tournament timer)
- Clock that scales non-linearly (accelerates as time depletes)
- Clock that transfers time between players (one's loss is another's gain)

## UI Considerations for Master Client

### Clock Creation Panel

- Quick-create presets (30s turn, 5min ritual, custom)
- Duration input with unit selection (seconds, minutes, hours)
- Visual theme picker with live preview
- Alert configuration interface
- Visibility and positioning controls

### Active Clock Dashboard

- List of all active clocks with status
- Remaining time display
- Play/pause/reset controls per clock
- Quick adjust (add/remove time on the fly)
- Visibility toggles
- Delete/destroy actions

### Templates and Presets

- Save common configurations ("Standard Turn", "Boss Ritual")
- Share templates across campaigns
- Import community-created templates

### Real-Time Preview

- See clock as players see it
- Preview alert effects before they trigger
- Test completion behavior without waiting

## Questions to Consider

1. **Persistence**: Do clocks survive session disconnects? Resume or reset?
2. **Client Authority**: Can players see different times due to latency? How to handle sync?
3. **Audio Clutter**: Multiple clocks ticking simultaneously - mute some automatically?
4. **Time Precision**: Display milliseconds for very short timers (sub-10 seconds)?
5. **Overtime Handling**: Can clocks go negative? Show "-00:03" or stop at "00:00"?
6. **Historical Tracking**: Log when clocks were created, paused, completed for session review?

## Extensibility Benefits

By treating countdown clocks as first-class, time-scale-aware entities:

- Any time-sensitive mechanic can leverage clock system (buffs, hazards, turns)
- Visual consistency across all timing UI
- Time scale integration automatic for all clocks
- Easy to add new clock types and behaviors
- Clean separation between clock logic (server) and presentation (client)
- Foundation for complex time-based game mechanics
- Can evolve into full scheduling system (event timeline, automated DM actions)

The architecture: server maintains authoritative time state accounting for time scale changes, broadcasts updates to clients, clients render clocks according to their configuration and apply dynamic effects based on remaining time. Master client controls creation, configuration, and lifecycle. Everything synchronized, everything time-scale-aware, everything extensible to more complex timing mechanics.
