# Event Logging Feature - Conceptual Outline

## Core Concept

A persistent chronicle of everything that transpires during the campaign - every die cast, every dramatic moment noted, every scene transition recorded, all timestamped in both the real world and the fictional realm. Not merely a chat log, but a structured narrative database where the wizard's critical hit at 9:47 PM on a Tuesday was also the final blow struck at dusk on the 15th of Mirtul against the lich. Search for all fire spells cast in Act 2. Export the combat log for review. Replay the session through its event timeline. The log remembers everything, indexes everything, makes everything searchable and meaningful.

## Architecture Integration

### Event as Fundamental Unit

Every logged entry is a structured event with:

- **Event Type**: Category and subcategory (roll.attack, note.dm, scene.loaded, combat.damage)
- **Payload**: Type-specific data (roll results, note text, scene name, damage amount)
- **Timestamps**: Real-world time and in-game time
- **Actor**: Who/what triggered the event (DM, player name, system automation)
- **Session Context**: Which session, which scene, what chapter/act
- **Visibility**: Who can see this event (all, DM-only, specific players)
- **Tags**: Searchable metadata tags
- **Relationships**: Links to related events (this damage follows from that attack roll)

### Server-Side Log Storage

Server maintains authoritative event log:

- **Active Session Log**: Currently accumulating events
- **Historical Logs**: Past session records
- **Structured Storage**: Database or structured files (JSON, SQLite, etc.)
- **Indexed Fields**: Fast searching by time, type, actor, tags
- **Append-Only**: Events never deleted, only marked hidden/redacted

### Event Types

New event category: `log.*`

**Logging Actions:**

- `log.write` - Create new log entry
- `log.edit` - Modify existing entry (append correction, not replace)
- `log.delete` - Mark entry as deleted (soft delete, preserves history)
- `log.tag` - Add tags to existing entry
- `log.link` - Create relationship between entries

**Query Actions:**

- `log.query` - Search/filter log entries
- `log.export` - Export log data
- `log.subscribe` - Real-time log updates to client

**Session Management:**

- `log.session.start` - Begin new logging session
- `log.session.end` - Close current session
- `log.session.merge` - Combine session logs

### Event Payload Structure

```
{
  type: "log.write",
  payload: {
    eventType: "roll.attack",       // Categorized event type
    data: {                          // Type-specific payload
      character: "Thorin Ironforge",
      roll: "1d20+5",
      result: 18,
      total: 23,
      target: "Goblin Archer",
      outcome: "hit"
    },
    note: "Critical moment - Thorin's strike connects!",  // Optional narrative
    tags: ["combat", "critical-moment", "thorin"],
    visibility: "all",               // or "dm", "player:Alice", etc.
    linkedEvents: ["evt_combat_start_123"],  // Related event IDs
    metadata: {
      scene: "Goblin Ambush",
      chapter: "Act 1 - Chapter 2",
      speaker: "DM",
      important: true                // Flag for highlighting
    }
  }
}
```

The log receives this, generates unique ID, adds timestamps, stores permanently.

## Timestamp System

### Dual Timestamp Architecture

Every event has two temporal anchors:

**Real-World Timestamp:**

- UTC timestamp (ISO 8601 format)
- Session elapsed time (how long into session)
- Allows correlation with real-world events ("we played that combat Tuesday night")

**In-Game Timestamp:**

- Fictional world date/time (if tracked)
- Scene context ("during the tavern scene")
- Relative time ("3 rounds into combat")
- Allows narrative reconstruction ("what happened on the 15th of Mirtul?")

**Example Entry:**

```
{
  id: "evt_attack_456",
  realTime: {
    utc: "2024-03-15T21:47:32.145Z",
    sessionElapsed: 5832000,  // 1 hour, 37 minutes, 12 seconds into session
    localTime: "9:47 PM"
  },
  gameTime: {
    worldDate: "15th of Mirtul, 1492 DR",
    timeOfDay: "dusk",
    sceneTime: 45000,  // 45 seconds into current scene
    combatRound: 3,
    initiative: 17
  }
}
```

### Time Scale Interaction

When time scale changes, in-game time advances at modified rate:

- Normal playback (1.0x): 1 real second = 1 game second
- Slow motion (0.5x): 2 real seconds = 1 game second
- Fast forward (2.0x): 0.5 real seconds = 1 game second

Log entries record current time scale at moment of creation, allowing reconstruction of how time flowed during session.

### Manual Time Adjustment

DM can manually advance in-game time:

- "8 hours pass during long rest" → in-game time jumps, real-time continues normally
- Log shows gap: "Time passed: 8 hours (long rest)"
- Subsequent events have advanced in-game timestamps

## Event Categories and Types

### Dice Rolls

Most common logged event type:

**Roll Types:**

- `roll.attack` - Attack rolls
- `roll.damage` - Damage rolls
- `roll.saving_throw` - Save attempts
- `roll.ability_check` - Skill checks, ability checks
- `roll.initiative` - Initiative rolls
- `roll.custom` - Any other roll

**Roll Data:**

```
{
  character: "Elara Moonwhisper",
  rollType: "attack",
  expression: "1d20+7",     // Dice notation
  diceResults: [15],        // Individual die results
  modifiers: [7],           // Applied modifiers
  total: 22,                // Final result
  advantage: false,         // Advantage/disadvantage
  critical: false,          // Natural 20 or critical success
  fumble: false,            // Natural 1 or critical failure
  target: "Orc Warrior",    // Target of roll
  outcome: "hit"            // Resolved outcome
}
```

### Custom Notes

Free-form narrative entries:

**Note Types:**

- `note.dm` - DM private notes
- `note.story` - Story beats, narrative moments
- `note.player` - Player-contributed notes
- `note.reminder` - Future reminders or TODOs
- `note.correction` - Retroactive corrections

**Note Data:**

```
{
  author: "DM",
  content: "The party discovers the ancient prophecy scroll. Mark for later reveal.",
  isPrivate: true,          // DM-only visibility
  richText: true,           // Supports markdown formatting
  attachments: ["prophecy.jpg"]  // Linked images/files
}
```

### Preset Events

Pre-configured event types for common occurrences:

**Combat Events:**

- `combat.start` - Combat begins
- `combat.end` - Combat concludes
- `combat.round_start` - New round begins
- `combat.turn_start` - Character's turn begins
- `combat.damage` - Damage dealt
- `combat.healing` - Healing applied
- `combat.condition` - Status effect applied/removed
- `combat.death` - Character/creature dies

**Social Events:**

- `social.dialogue` - Important conversation
- `social.persuasion` - Persuasion attempt
- `social.deception` - Deception attempt
- `social.insight` - Insight check
- `social.intimidation` - Intimidation attempt

**Exploration Events:**

- `exploration.discovery` - Something found
- `exploration.trap` - Trap triggered
- `exploration.secret` - Secret discovered
- `exploration.rest` - Rest taken

**Story Events:**

- `story.quest_start` - Quest begins
- `story.quest_complete` - Quest completed
- `story.plot_point` - Major story moment
- `story.reveal` - Important reveal
- `story.choice` - Significant player choice

### System Events

Automatically logged system actions:

**Scene Events:**

- `scene.loaded` - Scene changed
- `scene.saved` - Scene saved to library

**Audio Events:**

- `audio.track_started` - Music/audio began
- `audio.track_ended` - Audio completed

**Time Events:**

- `time.scale_changed` - Time dilation adjusted
- `time.advanced` - Manual time skip

**Session Events:**

- `session.start` - Session began
- `session.break` - Break taken
- `session.end` - Session concluded

These provide context for when other events occurred.

## Log Organization and Views

### Session Grouping

Events naturally group by session:

```
Campaign
├── Session 1 (March 1, 2024)
│   ├── 487 events
│   ├── Duration: 3 hours 42 minutes
│   └── Scenes: Tavern, Forest Road, Goblin Camp
├── Session 2 (March 8, 2024)
│   ├── 612 events
│   ├── Duration: 4 hours 15 minutes
│   └── Scenes: Goblin Camp, Return to Town
```

Each session is self-contained but cross-referenceable.

### Scene-Based View

Events grouped by which scene was active:

```
Session 5
├── Throne Room Approach
│   ├── 23 events
│   └── 12 minutes
├── Boss Combat
│   ├── 156 events
│   └── 47 minutes
└── Victory Aftermath
    ├── 31 events
    └── 18 minutes
```

Shows pacing and event density per scene.

### Timeline View

Linear chronological display:

```
[9:15 PM] Session Start
[9:17 PM] Scene: Throne Room Approach
[9:23 PM] Elara: Perception check (18) - Success
[9:24 PM] DM: "You notice the throne is occupied..."
[9:26 PM] Combat Start
[9:27 PM] Initiative: Thorin (18), Elara (15), Lich (12)
[9:28 PM] Thorin: Attack roll (23) - Hit!
[9:28 PM] Thorin: Damage (14 slashing)
...
```

Traditional log format, easy to follow narrative flow.

### Character-Centric View

Filter events by character:

```
Thorin Ironforge - Session 5
├── Rolls
│   ├── 12 attack rolls (avg: 16.3)
│   ├── 3 saving throws (2 success, 1 fail)
│   └── 4 ability checks
├── Damage
│   ├── Dealt: 87 total
│   └── Received: 43 total
└── Moments
    ├── "Thorin lands the killing blow on the lich"
    └── "Thorin claims the Crown of Kings"
```

Player-specific summaries and statistics.

### Tag-Based View

Group by tags:

```
Tag: "critical-moment"
├── 14 events across 3 sessions
├── Thorin's killing blow on lich
├── Elara's successful persuasion of king
└── Party's discovery of prophecy

Tag: "combat"
├── 487 events across 8 sessions
└── Average combat duration: 38 minutes
```

Thematic organization independent of chronology.

## Search and Filtering

### Query Interface

Powerful search capabilities:

**By Type:**

- "Show all attack rolls"
- "Show all story events"

**By Actor:**

- "Show all of Thorin's actions"
- "Show all DM notes"

**By Time Range:**

- "Show events from March 1-15"
- "Show events from last session"
- "Show events during 'Throne Room' scene"

**By Tag:**

- "Show all 'critical-moment' events"
- "Show combat AND boss-fight"

**By Content:**

- Full-text search within notes and event data
- "Find all mentions of 'prophecy'"
- "Find all events involving 'Goblin King'"

**Combined Queries:**

- "Show Elara's attack rolls during boss-fight scenes in March"
- "Show all critical hits by any player"

### Saved Queries

Frequently used searches saved as presets:

- "This Session's Combat Summary"
- "All Quest Progression Events"
- "DM Private Notes"
- "Last Hour of Events"

One-click access to common views.

## Real-Time Log Display

### Live Event Feed

Display clients can show real-time log updates:

- Recent events scroll on screen
- Filtered view (combat-only, rolls-only, etc.)
- Visual styling per event type (rolls in blue, damage in red)
- Auto-scroll or manual scroll
- Configurable retention (last 50 events, last 10 minutes, etc.)

### Log Overlay

Optional transparent overlay on display clients:

- Shows recent events without obscuring visuals
- Fades out after timeout
- Important events persist longer
- Position and size configurable

### Master Client Log Panel

DM sees comprehensive log view:

- All events including private
- Quick note entry
- Tag application
- Event editing/correction
- Real-time statistics (damage dealt this combat, etc.)

## Statistics and Analytics

### Session Statistics

Automatic calculation:

- Total events logged
- Event type breakdown (45% rolls, 30% combat, 15% notes, etc.)
- Session duration
- Time per scene
- Combat encounter count and average duration

### Character Statistics

Per-character aggregation:

- Roll averages (attack, saves, checks)
- Critical hit/fumble count
- Damage dealt/received
- Successful/failed checks
- Screen time (how much focus this character got)

### Campaign Analytics

Long-term trends:

- Combat frequency over time
- Average session length
- Character participation balance
- Story event density
- Most-used tags

### Custom Reports

User-defined aggregations:

- "All fire damage dealt across campaign"
- "Persuasion check success rate by character"
- "Boss fight durations"

Export as charts, tables, or raw data.

## Export and Sharing

### Export Formats

Multiple output formats:

**Structured Data:**

- JSON (complete event data)
- CSV (tabular data for spreadsheets)
- XML (for external tools)

**Human-Readable:**

- Markdown (narrative log with formatting)
- HTML (web page with styling)
- PDF (printable session summary)
- Plain Text (simple chronological list)

**Specialized:**

- D&D Beyond format (if compatible)
- Roll20/Foundry import format
- Custom templates

### Export Scope

Choose what to export:

- Single session
- Date range
- Filtered results (only combat events)
- Entire campaign
- Specific character's events

### Session Summaries

Auto-generated session recaps:

```
Session 5 Summary
Date: March 15, 2024
Duration: 3 hours 42 minutes

Story Beats:
- Party entered the Shattered Throne Room
- Boss combat against the Lich King (47 minutes)
- Thorin landed the killing blow
- Party claimed the Crown of Kings

Statistics:
- Combat encounters: 1
- Total damage dealt: 243
- Total damage received: 127
- Critical hits: 3
- Important discoveries: 2

MVP: Thorin (highest damage, killing blow)
```

Shareable with players, usable for campaign notes.

## Integration with Other Systems

### Scene Management

Logs tie to scenes:

- Events tagged with active scene
- Scene changes logged automatically
- Filter log by scene
- Replay session through scene timeline

### Audio System

Audio events logged:

- Track playback started/stopped
- Music changes during combat
- Audio cues for dramatic moments

Helps remember what music was playing during memorable moments.

### Time Scale

Time scale changes logged:

- "Time slowed to 0.5x for dramatic effect"
- In-game timestamps account for time dilation
- Replay can reconstruct time flow

### Countdown Clocks

Clock events logged:

- Clock created, started, completed
- Time remaining at key moments
- Links clock completion to subsequent events

### Dice Rolling

If dice roller integrated:

- Rolls automatically logged
- Rich roll data captured (advantage, modifiers, etc.)
- Physical dice can be manually logged

## Visibility and Privacy

### Visibility Levels

Events have access control:

**Public (All):**

- Rolls (usually)
- Combat events
- Story beats
- Scene changes

**DM-Only:**

- Private notes
- Planning reminders
- Hidden rolls
- Sensitive story information

**Player-Specific:**

- Private messages to individual player
- Character-specific secrets
- Perception checks (only successful character sees result)

**Hidden:**

- Redacted events (removed from view but preserved in data)
- Spoiler-tagged (revealed later)

### Retroactive Visibility Changes

DM can change visibility after creation:

- Make private note public when revealed
- Hide event that was mistakenly shown
- Create secret events retroactively

Maintains flexible narrative control.

## Extension Points

### Custom Event Types

Users define campaign-specific events:

- `spell.fireball` - Track fireball casts specifically
- `loot.magic_item` - Log magic item acquisition
- `faction.reputation` - Track faction standing changes

Custom types integrate seamlessly with existing log infrastructure.

### Event Triggers

Events can trigger actions:

- When "combat.start" logged → automatically start turn timer
- When character damage exceeds threshold → log "bloodied" event
- When quest completed → play victory music

Reactive event-driven automation.

### AI-Generated Summaries

Future AI integration:

- Auto-generate session recap from raw log
- Identify key moments automatically
- Generate character spotlights
- Create campaign timeline visualization

### Voice-to-Log

Speech recognition integration:

- DM narrates, system logs automatically
- "Combat starts" → creates combat.start event
- "Thorin rolls 18 to hit" → creates roll event

Hands-free logging during active play.

### Live Streaming Integration

Overlay log on stream:

- Recent rolls visible to viewers
- Combat damage tracking
- Dramatic moments highlighted
- Spoiler filtering for pre-recorded content

### Campaign Wiki Integration

Events link to wiki entries:

- "Lich King" in log links to NPC wiki page
- "Crown of Kings" links to artifact description
- Build wiki from log data (all NPCs mentioned)

### Multi-Campaign Analysis

Compare logs across campaigns:

- "I roll higher in Campaign A than Campaign B"
- "Combats are longer in homebrew vs published adventures"
- DM style comparisons

## UI Considerations for Master Client

### Quick Log Panel

- Recent events (scrolling list)
- Quick note entry field
- Preset event buttons ("Combat Start", "Short Rest", etc.)
- Tag suggestions as you type
- Visibility toggle

### Log Browser

- Full-featured search interface
- Filter controls (type, actor, date, tags)
- Column customization
- Sort options
- Bulk operations (tag multiple, export selection)

### Session Dashboard

- Live statistics during session
- Event count ticker
- Recent highlights
- Time tracking (session duration, scene duration)

### Analytics View

- Charts and graphs
- Character comparison
- Trend analysis over time
- Export reports

### Event Editor

- Edit existing events (adds correction note)
- Add retroactive events (backfill forgotten moments)
- Link related events
- Attach files/images

## Questions to Consider

1. **Log Size**: How to handle very long campaigns with millions of events? Archival strategy?
2. **Real-Time vs Batch**: Log events immediately or batch periodically? (Trade-off: latency vs performance)
3. **Privacy Compliance**: If players have access, respect data privacy/deletion requests?
4. **Backup**: How to ensure logs aren't lost? Auto-backup to cloud?
5. **Editing History**: Track edits to log entries? Full audit trail or just latest version?
6. **Cross-Campaign**: Should characters carry statistics across campaigns?
7. **Public Sharing**: Support for publishing campaign logs publicly (blog-style)?

## Extensibility Benefits

By treating logging as structured, typed, searchable events:

- Any system event can be logged automatically
- Rich querying enables powerful analysis
- Foundation for AI/ML features (predict outcomes, generate content)
- Session replay and visualization possibilities
- Clean data for external tools and integrations
- Natural documentation of campaign history
- Supports both casual play and detailed record-keeping
- Can evolve into full campaign management system

The architecture: server maintains append-only event log with structured data, events have dual timestamps and rich metadata, clients can query/filter/export log data, special event types for common occurrences, extensible to arbitrary custom event types. Master client provides logging interface, analytics, and export tools. Everything recorded, everything searchable, everything meaningful for understanding campaign narrative and mechanics.
