# Feature Status

Current state of each feature domain as of June 2026.

| Domain | Status | Summary |
|--------|--------|---------|
| **Audio Playback** | Shipped | Multi-channel audio with play/pause/resume/stop/volume. Per-channel track management, effects, time-scale awareness. Server service, shared reducers, display renderer, master controls all complete. |
| **Image Display** | Shipped | Multi-layer image system with set/clear/transform/effect/layer_config events. Aspect ratio modes (cover/contain), blend modes, opacity, z-index. Drag-to-position via canvas overlay. |
| **Countdown Clocks** | Shipped | Create/start/pause/adjust/destroy lifecycle. Client-computed remaining time (no server ticks). Visual renderer on display, clock controls on master, canvas overlay integration for positioning. |
| **Time Scale** | Shipped | Global time scale factor that affects clock tick rates. `time.scale_changed` event, master controls for adjusting scale. |
| **Scene Management** | Partial | Master client has save/load UI (scene-panel, scene-list, scene-save-form components). Captures current audio + image + clock state as named snapshots. No dedicated server event types yet — operates through replaying constituent events. |
| **Event Logging** | Not implemented | Planned as a session history / event replay viewer. No server service, no client components. The EventStore provides the underlying infrastructure but no UI exists. |

## Planned / Aspirational

These features appeared in early design docs but have no implementation:

- **Smart lighting integration** (IoT device control via events)
- **Initiative tracker** (combat turn order)
- **Dice roll logging** (combat events, story beats)
- **Remote player support** (cloud deployment for non-local sessions)
