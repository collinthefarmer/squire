# Audio Playback Feature - Conceptual Outline

## Core Concept

A multi-channel audio system capable of playing sounds from files, streams, or live sources, each independently controlled and processed through a chain of effects. Not just pressing play on a track - but orchestrating a soundscape where combat music swells, ambient tavern chatter murmurs beneath, spell effects crackle overhead, and the DM's voice feeds through with reverb for dramatic narration. All of it warped by time scale, all of it layered and mixed, all of it responsive to the unfolding game.

## Architecture Integration

### Channel-Based System

Audio organized into named channels rather than individual tracks:

- **Music**: Background scores, combat themes, ambient tracks
- **SFX**: One-shot sound effects (sword clash, spell cast, door creak)
- **Ambient**: Continuous environmental sounds (rain, fire, crowds)
- **Voice**: Live microphone input from DM or players
- **Custom**: User-defined channels for special purposes

Each channel has independent volume, effects chain, routing, and time-scale behavior.

### State Management

Server tracks audio state per channel:

- Currently playing source (file reference, stream URL, or live input ID)
- Playback position (for seekable sources)
- Play/pause/stop state
- Volume level and fade state
- Active effects and their parameters
- Loop mode and boundaries

Clients maintain local playback synchronized to server state, with periodic sync events preventing drift.
NOTE: wonder if it's possible to warp/lerp playback to sync up, rather than a hard cut...

### Event Types

Event category: `audio.*`

**Playback Control:**

- `audio.play` - Start audio on a channel
- `audio.pause` - Pause without clearing channel
- `audio.resume` - Resume paused audio
- `audio.stop` - Stop and clear channel
- `audio.seek` - Jump to timestamp (for files)
- `audio.fade` - Fade in/out over duration

**Source Management:**

- `audio.load` - Preload audio file to cache
- `audio.unload` - Clear from cache
- `audio.stream.start` - Begin streaming source
- `audio.stream.stop` - End stream
- `audio.live.connect` - Connect live input source
- `audio.live.disconnect` - Disconnect live input

**Channel Configuration:**

- `audio.volume` - Set channel volume
- `audio.mute` - Mute/unmute channel
- `audio.solo` - Solo this channel (mute all others)
- `audio.effect.add` - Add effect to channel's chain
- `audio.effect.remove` - Remove effect
- `audio.effect.update` - Modify effect parameters
- `audio.routing` - Set channel output routing

**Sync Events:**

- `audio.sync` - Server → clients periodic synchronization
- `audio.playback.ended` - Fired when audio completes naturally

### Event Payload Structure

```
{
  type: "audio.play",
  payload: {
    channel: "music",               // Channel identifier
    source: {
      type: "file",                 // or "stream", "live"
      ref: "combat-theme-01",       // Asset reference
      url: null,                    // For streams
      deviceId: null                // For live inputs
    },
    volume: 0.8,                    // 0.0 to 1.0
    loop: false,                    // Loop when complete
    loopStart: 0,                   // Loop region start (ms)
    loopEnd: null,                  // Loop region end (null = end of file)
    fadeIn: 2000,                   // Fade in duration (ms)
    startAt: 0,                     // Playback start position (ms)
    respectTimeScale: true,         // Affected by time scale
    effects: [                      // Initial effects chain
      {
        type: "reverb",
        params: { mix: 0.3, decay: 2.5 }
      }
    ]
  },
  metadata: {
    targetClients: null,            // null = all audio clients
    priority: "normal"              // or "high" for critical sounds
  }
}
```

## Audio Source Types

### File-Based Audio

Traditional audio file playback:

- **Formats**: MP3, OGG, WAV, FLAC (browser-supported formats)
- **Storage**: Local files, server-hosted, CDN, external URLs
- **Preloading**: Can preload into memory before playing
- **Seeking**: Supports random access for files
- **Metadata**: Can extract duration, artist, title from file tags

Use cases: Music tracks, pre-recorded sound effects, voiceovers

### Streaming Audio

Network streams for dynamic content:

- **HTTP Streams**: Icecast, Shoutcast, HLS streams
- **WebRTC Streams**: Peer-to-peer audio feeds
- **Low Latency**: Minimize buffering for real-time feel
- **Fallback**: Handle connection loss gracefully

Use cases: Internet radio, Spotify-like services, remote audio sources

### Live Input Sources

Real-time microphone or line-in capture:

- **Device Selection**: Choose from available input devices
- **Browser Permission**: Request microphone access
- **Monitoring**: Optional local playback preview
- **Latency**: Minimal processing delay
- **Routing**: Broadcast to all clients or subset

Use cases: DM narration with effects, player voice processing, live music performance

### Procedural Audio

Generated sounds (future extension):

- **Synthesis**: Simple tones, noise, waveforms
- **Algorithmic**: Procedurally generated ambient sounds
- **Reactive**: Audio that responds to game events in real-time

Use cases: Placeholder sounds, sci-fi effects, dynamic soundscapes

## Time Scale Integration

### Playback Rate Adjustment

When time scale changes, audio responds accordingly:

**For Sources with `respectTimeScale: true`:**

- Playback rate = base playback rate × time scale
- Time scale 0.5 → audio plays at half speed (lower pitch)
- Time scale 2.0 → audio plays at double speed (higher pitch)
- Time scale 0.0 → audio pauses

**For Sources with `respectTimeScale: false`:**

- Playback continues at normal rate regardless of time scale
- Useful for UI sounds, critical voice lines, menu music

### Pitch Preservation Option

Raw playback rate adjustment changes pitch (chipmunk effect when fast, deep when slow).

Optional pitch preservation:

- Use time-stretching algorithms to maintain original pitch
- Slower playback without lowering pitch
- Faster playback without raising pitch
- More CPU intensive, but musically cleaner
- Per-channel configuration

### Effect Parameter Scaling

Some effects have time-based parameters that should scale:

- Delay time: `delay(500ms)` becomes `delay(250ms)` at 2x time scale
- LFO rates: Chorus/flanger modulation speeds up/slows down
- Reverb decay: Can optionally scale with time (shorter decay = faster time)

Configuration per effect: `scaleWithTime: true/false`

### Crossfade During Scale Changes

When time scale changes abruptly (1.0 → 0.5), the pitch shift can be jarring.

Smooth transition option:

- Brief crossfade between old and new playback rates
- Overlap old audio (fading out) with new audio (fading in) for 100-500ms
- Creates seamless perception of time shift
- Configurable per channel or globally

## Audio Effects System

### Effect Chain Architecture

Each channel has an effects chain (processing pipeline):

```
Input Source → Effect 1 → Effect 2 → ... → Effect N → Channel Output → Master Output
```

Effects process in order, output of one feeds input of next.

Master client can:

- Add effects to end of chain
- Insert effects at specific positions
- Remove effects by ID or position
- Reorder effects (changes sound dramatically)
- Bypass individual effects without removing
- Bypass entire chain

### Effect Categories

**Dynamics:**

- **Compressor**: Reduce dynamic range, even out volume
- **Limiter**: Prevent clipping, maximize loudness
- **Gate**: Silence below threshold (remove background noise)
- **Expander**: Increase dynamic range

**Filters:**

- **Low-Pass**: Remove high frequencies (muffle, underwater effect)
- **High-Pass**: Remove low frequencies (tinny radio effect)
- **Band-Pass**: Keep only middle frequencies (telephone effect)
- **Notch**: Remove specific frequency (hum removal)
- **Parametric EQ**: Boost/cut specific frequency bands

**Time-Based:**

- **Reverb**: Simulate space/environment (cathedral, cave, room)
- **Delay/Echo**: Repeating copies with decay
- **Chorus**: Thicken sound with detuned copies
- **Flanger**: Sweeping comb filter (jet plane whoosh)
- **Phaser**: Similar to flanger, different character

**Pitch/Time:**

- **Pitch Shift**: Raise/lower pitch without speed change
- **Time Stretch**: Change speed without pitch change
- **Harmonizer**: Add harmony notes above/below

**Distortion/Saturation:**

- **Overdrive**: Warm, tube-like distortion
- **Distortion**: Harsh clipping (electric guitar)
- **Bit Crusher**: Digital degradation, lo-fi effect
- **Saturation**: Subtle harmonic enhancement

**Modulation:**

- **Tremolo**: Volume oscillation
- **Vibrato**: Pitch oscillation
- **Ring Modulator**: Metallic, robotic tones
- **Auto-Pan**: Stereo position movement

**Spatial:**

- **Stereo Width**: Narrow or widen stereo image
- **Panning**: Position in left-right field
- **Binaural**: 3D audio positioning (headphones)
- **Haas Effect**: Psychoacoustic widening

### Effect Presets

Common effect chains saved as presets:

- **"Cave Voice"**: Reverb + low-pass filter + slight delay
- **"Ghostly Whisper"**: High-pass + reverb + pitch down + tremolo
- **"Demonic"**: Pitch down + distortion + reverb
- **"Megaphone"**: Band-pass + bit crusher + compression
- **"Underwater"**: Low-pass + chorus + reverb (long decay)
- **"Dream Sequence"**: Reverb + flanger + slight delay

Apply preset, then tweak individual parameters.

### Real-Time Parameter Automation

Effect parameters can change over time:

```
{
  type: "audio.channel.effect.update",
  payload: {
    channel: "music",
    effectId: "reverb-1",
    params: {
      mix: {
        value: 0.8,           // Target value
        duration: 5000,       // Ramp over 5 seconds
        curve: "exponential"  // or "linear", "logarithmic"
      }
    }
  }
}
```

Enables dynamic mixing (fade in reverb during tense moment, fade out when action begins).

### Effect Visualization (Optional)

Master client can show effect processing:

- Waveform display
- Spectrum analyzer
- Real-time parameter meters (compression gain reduction, etc.)
- Helps dial in settings visually

## Channel Mixing and Routing

### Volume Control Hierarchy

Multiple volume levels multiply together:

1. **Source Volume**: Individual audio file/stream volume (payload)
2. **Channel Volume**: Overall channel level
3. **Group Volume**: Channel groups (all SFX, all music)
4. **Master Volume**: Final output level
5. **Client-Local Volume**: User's personal volume preference

Final volume = source × channel × group × master × local

### Ducking (Sidechain)

One channel can reduce volume of another:

- When DM speaks (voice channel), music ducks to 30%
- When SFX plays, ambient ducks slightly
- When combat music starts, exploration music fades out

Configuration:

```
{
  triggerChannel: "voice",
  targetChannels: ["music", "ambient"],
  duckAmount: 0.7,      // Reduce to 70%
  attackTime: 100,      // How fast to duck (ms)
  releaseTime: 500      // How fast to return (ms)
}
```

### Channel Groups

Channels can belong to groups for batch control:

- "All Music" group (background, combat, exploration music channels)
- "All SFX" group (individual effect channels)
- "All Ambient" group (environmental sound channels)

Change group volume → affects all member channels proportionally.

### Output Routing

Channels can route to different outputs:

- **Main Output**: Standard stereo to speakers/headphones
- **Client-Specific**: Only certain clients hear certain channels (DM-only audio)
- **Spatial Zones**: Different audio for different "areas" in virtual space (future)

### Crossfading Between Sources

When switching audio on same channel:

- **Cut**: Instant switch (old stops, new starts)
- **Crossfade**: Old fades out while new fades in simultaneously
- **Fade-Through-Black**: Old fades out → silence → new fades in
- **Beat-Matched**: Sync new audio to beat/tempo of old (music transitions)

Configurable duration and curve.

## Client-Side Implementation

### Web Audio API

Modern browsers provide powerful audio:

- **Audio Context**: Core audio engine
- **Source Nodes**: File buffers, streaming media, microphone input
- **Effect Nodes**: Native effects (gain, biquad filter, delay, convolver for reverb)
- **Custom Processors**: AudioWorklet for complex DSP
- **Routing Graph**: Connect nodes in arbitrary topologies

### Asset Loading

Audio files need efficient loading:

- **Preloading**: Load anticipated files before needed
- **Lazy Loading**: Fetch on-demand when requested
- **Caching**: Store decoded audio buffers for reuse
- **Streaming**: For large files, stream chunks instead of full download
- **Format Selection**: Serve OGG to Firefox, MP3 to Safari, etc.

### Latency Considerations

Different sources have different latency characteristics:

- **File Playback**: Near-instant start (if preloaded)
- **Streaming**: Buffer delay (1-5 seconds typical)
- **Live Input**: Minimal (10-50ms with good config)

Sync events account for latency to keep clients aligned.

### Mobile/Battery Considerations

Audio processing is CPU-intensive:

- **Effect Complexity**: Fewer effects on mobile/battery mode
- **Sample Rate**: Lower sample rates acceptable for some content
- **Channel Limits**: Reduce simultaneous playing sounds on weak devices
- **Background Behavior**: Handle browser tab backgrounding (may pause audio context)

## Integration with Other Systems

### Time Scale

Deep integration as discussed:

- Playback rate adjustment
- Effect parameter scaling
- Crossfade smoothing
- Respect/ignore flag per source

### Visual Synchronization

Audio can drive visuals:

- `visual.image.effect` triggers on audio beat detection
- Screen flash on thunder sound
- Particle effects pulse to music rhythm
- Spectrum analyzer drives visual layer opacity

### Countdown Clock

Clock alerts trigger audio:

- Warning chime at 10 seconds
- Tick-tock sound speeding up as time depletes
- Completion sound (bell, gong, explosion)

### Scene System

Scenes can include audio state:

- "Tavern scene" auto-loads tavern ambient + background music
- Scene changes can crossfade music tracks
- Scene presets include complete audio mix

### Log Events

Audio events can write to log:

- "Combat music started at 02:34:56"
- "DM applied 'Cave Voice' effect to narration"
- Session replay includes audio cues

## Extension Points

### Music Playlist System

Beyond single-track playback:

- Playlists of tracks with shuffle/repeat
- Smart transitions (beat-matched, key-matched)
- Mood-based selection (intense combat → exploration → tavern)
- Dynamic music (layers add/remove based on game state)

### Spatial Audio

3D positioning for immersive experiences:

- Sounds emanate from positions in virtual space
- HRTF (head-related transfer function) for binaural audio
- Distance attenuation (farther = quieter)
- Occlusion (walls muffle sound)
- Doppler effect for moving sources

### Adaptive Music System

Music responds to gameplay:

- Combat starts → add percussion layer
- Tension rises → add strings layer
- Victory → triumphant brass layer
- Seamless layering without stopping/starting

### Voice Transformation

Real-time voice effects for roleplay:

- DM voices NPC with demon effect (pitch down, distortion)
- Player voices familiar with filter
- Mask player voices (pitch shift for anonymity in mystery scenarios)

### Audio Macros

Composite audio actions:

- "Combat Start" → fade out exploration music, fade in combat music, play horn sfx
- "Stealth Mode" → duck all audio to 50%, add low-pass filter to music
- "Spell Cast" → play spell sfx, add echo to caster's voice for 5 seconds

### External Integration

Connect to external services:

- Spotify API (play licensed music)
- YouTube audio streams
- Soundboard apps
- MIDI controllers for live mixing

### Audio Analysis

Analyze playing audio:

- Beat detection (sync visuals to rhythm)
- Frequency analysis (spectrum display)
- Loudness metering (ensure consistent volume)
- Speech detection (trigger voice ducking automatically)

## UI Considerations for Master Client

### Mixer View

- Visual representation of all channels (vertical faders)
- Mute/solo buttons per channel
- Effect chain visualization per channel
- Master output meters
- Group busses

### Library/Browser

- Searchable audio file library
- Tag-based organization (combat, exploration, sad, intense, etc.)
- Preview playback before sending to clients
- Drag-and-drop to channels
- Recently used section

### Effect Rack

- Available effects with descriptions
- Drag to add to channel chain
- Visual effect parameters (knobs, sliders)
- Presets dropdown per effect
- A/B comparison (bypass on/off)

### Live Input Panel

- Input device selection
- Level meter (prevent clipping)
- Monitor toggle (hear yourself)
- Effect chain for live input
- Push-to-talk option

### Quick Actions

- Fade all music out (panic button)
- Mute all (pause scene for discussion)
- Volume presets ("Loud Combat", "Quiet Tavern")
- Recent audio quick-launch

## Questions to Consider

1. **Licensing**: How to handle copyrighted music? User responsibility or enforce royalty-free?
2. **Bandwidth**: Streaming audio to multiple clients from server - bandwidth limits? Client-side loading instead?
3. **Synchronization Tolerance**: How much drift is acceptable between clients? (50ms? 100ms?)
4. **Live Input Privacy**: Should DM voice always broadcast, or push-to-talk default?
5. **Effect CPU Limits**: Cap number of simultaneous effects for performance? Auto-bypass on weak devices?
6. **Audio Format**: Standardize on specific formats or support everything browser can handle?

## Extensibility Benefits

By treating audio as channel-based, effect-capable, and time-scale-aware:

- New audio sources slot into existing channel architecture
- Effects are composable and reusable across all channels
- Time scale integration works uniformly across all audio
- Clean separation between playback control (server) and rendering (client)
- Foundation for complex audio mixing and dynamic soundscapes
- Easy to add automation, macros, and intelligent audio behaviors
- Supports both simple playback and sophisticated audio production
- Can evolve into full DAW-like capabilities for advanced users

The architecture: server maintains abstract audio state (what's playing, where, with what effects), broadcasts changes and sync pulses, clients render audio using Web Audio API or equivalent. Master client controls playback, routing, and effects through intuitive mixing interface. Everything synchronized, everything time-scale-aware, everything extensible to professional-grade audio production.
