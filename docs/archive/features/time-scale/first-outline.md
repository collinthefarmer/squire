# Time Scale Feature - Conceptual Outline

## Core Concept

A global time multiplier that warps the perceived passage of time across all connected clients. Not just pausing or playing - but bending time itself. Combat slows to half-speed, travel montages rush forward at 3x, dramatic moments freeze entirely.

## Architecture Integration

### State Management

- Time scale lives as server state (the single source of truth)
- Current scale value (0.0 = paused, 0.5 = half-speed, 1.0 = normal, 2.0 = double-speed, etc.)
- Master client can adjust it, server broadcasts changes
- Display clients receive updates and adjust their local time-dependent systems accordingly

### Event Types

New event category: `time.*`

- `time.scale_changed` - Broadcasts new scale value and transition mode
- `time.sync` - Periodic sync events to prevent drift across clients
- Optional: `time.pause`, `time.resume` as convenience wrappers

### Event Payload Structure

```
{
  type: "time.scale_changed",
  payload: {
    scale: 0.5,              // New multiplier
    transition: "immediate"   // or "smooth" for gradual shift
    transitionDuration: 1000  // ms for smooth transitions
  },
  metadata: {
    timestamp: ...            // Server time for sync
  }
}
```

## Client-Side Handling

### Handler Registration Pattern

Display clients register handlers that need time awareness:

- **Audio Handler**: Adjusts playback rate of currently playing audio (Web Audio API `playbackRate`)
- **Clock Handler**: Updates any visible countdown/countup timers with adjusted rate
- **Animation Handler**: Modifies CSS animation durations or JS animation frame timing
- **Timestamp Handler**: Adjusts in-game time calculations (if tracking fictional world time)

### Time-Aware Base Class

Provide a shared utility that handlers can extend:

- Converts real-world delta time to scaled game time
- Handles paused state (scale = 0)
- Manages smooth transitions between scales
- Provides hooks for when scale changes

## Extension Points

### Future Time-Dependent Features Can Hook In:

1. **Particle Systems**: Slow-mo spell effects, time-frozen environments
2. **Video Playback**: Cinematic sequences that respect time scale
3. **Automated Scene Elements**: Torch flickers, water animations, ambient movement
4. **Turn Timers**: Speed up or slow down player decision clocks
5. **Scheduled Events**: Delayed triggers that respect time dilation

### Per-Event Time Overrides

Some events might want to ignore global time scale:

- Critical UI sounds (button clicks) play at normal speed even when game is slowed
- Certain dramatic audio cues play at intended speed regardless of scale
- Payload flag: `respectTimeScale: false`

## Implementation Considerations

### Drift Prevention

- Clients can drift if they're doing their own time math
- Server sends periodic sync pulses with authoritative time
- Clients reconcile their local scaled time against server time
- Smooth corrections rather than jarring jumps

### Retroactive Time Scaling

- What happens to audio already playing when scale changes?
- Option 1: Adjust existing playback rates immediately
- Option 2: Let current audio finish, apply to next
- Make this configurable per handler

### Edge Cases

- Scale = 0 (pause): All time-dependent features halt
- Negative scale: Time reversal? (Probably out of scope, but architecture should gracefully ignore)
- Very high scales (10x+): May break audio playback quality, needs limits
- Very low scales (0.1x): Extended precision needed to avoid rounding errors

### UI Considerations for Master Client

- Slider or preset buttons (0.25x, 0.5x, 1x, 2x, etc.)
- Visual indicator of current time scale
- Quick pause/resume hotkey
- Presets for common scenarios ("Combat Slow-Mo", "Travel Speed", "Freeze Frame")

## Integration with Other Systems

### Audio Events (`audio.*`)

- All audio events check current time scale on playback
- Continuously playing ambient tracks adjust in real-time
- One-shot sounds can choose to respect or ignore scale

### Scene Changes (`scene.*`)

- Scene transitions might temporarily override time scale
- Flash-forward scenes could auto-adjust to faster time
- Flashback scenes could slow down

### State Events (`state.*`)

- Initiative tracker countdown respects time scale
- Spell duration timers affected by time dilation
- Could affect buff/debuff visual indicators

### Log Events (`log.*`)

- Timestamps written to log use scaled time or real time (configurable)
- Useful for session replay later

## Questions to Consider

1. **Time Persistence**: Should time scale persist across session restarts? Or reset to 1.0?
2. **Client Independence**: Can individual clients override global scale locally? (Probably no, breaks sync)
3. **Audio Quality**: What's the acceptable range before audio quality degrades? (Usually 0.25x - 4.0x)
4. **Time Display**: Do you want to show scaled time vs real time to players? To DM only?
5. **Retroactive Events**: If time scale changes, do queued events adjust their timing?

## Extensibility Benefits

By treating time scale as a first-class server state:

- New time-dependent features automatically have access to it
- Clients can query current scale before starting time-based operations
- Easy to add time-scale presets or automation (e.g., "slow time during crits")
- Could eventually link to other game state ("time slows when HP below 25%")
- Foundation for more complex time manipulation (regional time zones, time loops, etc.)

The architecture remains simple: server holds the value, broadcasts changes, clients interpret those changes according to their needs. Each handler decides how time affects it. Clean separation, infinite extensibility.
