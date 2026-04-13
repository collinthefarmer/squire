# Master Client Component Creation Workflow

This document defines a structured workflow for creating and integrating new Web Components into the Squire master client. The workflow encompasses four phases: Planning, Implementation, Refactor/Integration, and Server-Side Event Integration.

---

## Overview

The master client uses a **container + child component pattern** where:
- **Container components** (e.g., `AudioControls`, `ImageControls`) coordinate child components, aggregate state, and communicate with the server
- **Child components** (e.g., `ChannelSelector`, `VolumeControl`) handle specific UI concerns and emit CustomEvents upward

All components extend `BaseComponent`, use Shadow DOM for encapsulation, and follow the project's service-driven architecture.

---

## Phase 1: Planning

### 1.1 Define Component Purpose & Scope

Before writing code, answer these questions:

1. **What domain does this component serve?** (audio, image, timing, etc.)
2. **Is this a container or presentational component?**
   - Container: Coordinates children, aggregates state, sends server events
   - Presentational: Single-responsibility UI, emits CustomEvents
3. **What state does it manage?**
   - Local UI state (form values, selections)
   - Does it need service subscriptions? (rare in master client)
4. **What events does it emit or listen for?**
   - CustomEvents for parent communication
   - Server events via EventBuilder

### 1.2 Identify Existing Patterns to Follow

Reference these existing components as templates:

| Component Type | Example | Key Pattern |
|----------------|---------|-------------|
| Container | `AudioControls` | Event listener aggregation, EventBuilder usage |
| Selector/Dropdown | `ChannelSelector` | `<select>` with change events |
| Slider Control | `VolumeControl` | Range input with live value display |
| Button Group | `AudioPlaybackButtons` | Multiple action buttons |
| Asset Picker | `AudioAssetPicker` | Factory-based configurable component |

### 1.3 Plan File Structure

Determine where the component lives:

```
ts-web-client/src/master/components/
├── {domain}/                    # Domain folder (audio/, image/, etc.)
│   ├── {component-name}.ts      # Component file (kebab-case)
│   └── {container-name}.ts      # Container if needed
```

### 1.4 Define Component API

Document before implementing:

```typescript
/**
 * Component: <my-component>
 *
 * Attributes:
 *   - attribute-name: string - Description
 *
 * Events Emitted:
 *   - event-name: { detail: { key: type } } - When fired
 *
 * Events Listened:
 *   - (none / list from children)
 */
```

---

## Phase 2: Implementation

### 2.1 Component File Template

Create the component file following this structure:

```typescript
// ts-web-client/src/master/components/{domain}/{component-name}.ts

import { BaseComponent } from "@components/base/base-component";
import { ServiceRegistry } from "@services/service-registry";
import { labelStyles, selectStyles } from "@styles/common-styles";
import { colors, spacing } from "@styles/theme";

// Import types with type-only import
import type { ConnectionService } from "@services/connection-service";

/**
 * Brief description of component purpose.
 *
 * @fires event-name - Description of when fired
 */
export class MyComponent extends BaseComponent {
    // 1. Private state (local form values)
    private selectedValue = "default";

    // 2. Service references (if needed)
    private connectionService!: ConnectionService;

    // 3. connectedCallback - setup
    override connectedCallback(): void {
        super.connectedCallback();

        // Fetch services if needed
        this.connectionService = ServiceRegistry.get<ConnectionService>("ConnectionService");

        this.render();
        this.setupEventListeners();
    }

    // 4. render - Shadow DOM content
    protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.innerHTML = `
            ${this.styleTag(this.getStyles())}
            <div class="container">
                <!-- Component HTML -->
            </div>
        `;
    }

    // 5. getStyles - Component CSS
    protected override getStyles(): string {
        return `
            :host {
                display: block;
            }

            .container {
                display: flex;
                flex-direction: column;
                gap: ${spacing.sm};
            }

            ${labelStyles()}
            ${selectStyles()}
        `;
    }

    // 6. setupEventListeners - DOM event binding
    private setupEventListeners(): void {
        const select = this.shadowRoot?.querySelector("#my-select") as HTMLSelectElement;
        if (!select) {
            return;
        }

        select.addEventListener("change", () => {
            this.selectedValue = select.value;
            this.emitChange();
        });
    }

    // 7. Event emission helpers
    private emitChange(): void {
        this.dispatchEvent(
            new CustomEvent("value-change", {
                detail: { value: this.selectedValue },
                bubbles: true,
                composed: true,
            }),
        );
    }
}
```

### 2.2 Container Component Pattern

For container components that coordinate children:

```typescript
export class DomainControls extends BaseComponent {
    private connectionService!: ConnectionService;

    // Aggregated state from children
    private currentSelection = "default";
    private currentValue = 1.0;

    override connectedCallback(): void {
        super.connectedCallback();
        this.connectionService = ServiceRegistry.get<ConnectionService>("ConnectionService");
        this.render();
        this.setupEventListeners();
    }

    protected override render(): void {
        if (!this.shadowRoot) {
            return;
        }

        this.shadowRoot.innerHTML = `
            ${this.styleTag(this.getStyles())}
            <div class="container">
                <div class="section-header">Domain Controls</div>
                <div class="controls-grid">
                    <my-selector></my-selector>
                    <my-slider></my-slider>
                    <my-action-buttons></my-action-buttons>
                </div>
            </div>
        `;
    }

    private setupEventListeners(): void {
        if (!this.shadowRoot) {
            return;
        }

        // Listen for child events (bubbled through Shadow DOM)
        this.shadowRoot.addEventListener("selection-change", ((e: CustomEvent) => {
            this.currentSelection = e.detail.selection;
        }) as EventListener);

        this.shadowRoot.addEventListener("value-change", ((e: CustomEvent) => {
            this.currentValue = e.detail.value;
        }) as EventListener);

        this.shadowRoot.addEventListener("action-request", ((e: CustomEvent) => {
            this.handleAction(e.detail.action);
        }) as EventListener);
    }

    private handleAction(action: string): void {
        // Build and send server event
        const event = EventBuilder.domainAction({
            selection: this.currentSelection,
            value: this.currentValue,
            action,
        });
        this.connectionService.send(event);
    }
}
```

### 2.3 Register Component in main.ts

Add to `ts-web-client/src/master/main.ts`:

```typescript
// Import
import { MyComponent } from "./components/{domain}/{component-name}";

// Register (after service registration, before connection.connect())
customElements.define("my-component", MyComponent);
```

### 2.4 Style Integration

Use shared style utilities from `@styles/common-styles`:

```typescript
import {
    containerStyles,
    labelStyles,
    selectStyles,
    inputStyles,
    rangeInputStyles,
    primaryButtonStyles,
    secondaryButtonStyles,
    flexRow,
    flexColumn,
    sectionHeaderStyles,
} from "@styles/common-styles";

import { colors, spacing, borderRadius, transitions } from "@styles/theme";
```

Compose styles in `getStyles()`:

```typescript
protected override getStyles(): string {
    return `
        :host {
            display: block;
        }

        ${containerStyles()}
        ${sectionHeaderStyles()}
        ${labelStyles()}
        ${selectStyles()}
        ${primaryButtonStyles()}

        .custom-class {
            background: ${colors.gray[800]};
            padding: ${spacing.md};
            border-radius: ${borderRadius.md};
        }
    `;
}
```

---

## Phase 3: Refactor Pass

After initial implementation, perform these refactoring checks:

### 3.1 Code Reuse Audit

1. **Identify repeated patterns** - If the same HTML/CSS pattern appears in multiple components, consider:
   - Creating a shared component
   - Adding a style utility function to `common-styles.ts`
   - Creating a factory function (like `createAssetPickerClass`)

2. **Check for duplicated event logic** - If multiple containers handle similar events:
   - Extract to EventBuilder helper methods
   - Create shared handler utilities

3. **Review local state management** - If state logic is complex:
   - Extract to state helper functions in `@shared/utils/state-helpers.ts`
   - Follow naming conventions: `get*`, `set*`, `update*`, `remove*`

### 3.2 Testability Review

1. **Pure function extraction** - Extract testable logic from components:

```typescript
// Before: Logic embedded in component
private handleVolumeChange(value: number): void {
    this.volume = Math.max(0, Math.min(1, value));
    this.emitChange();
}

// After: Extract pure function
// In utils/validation-helpers.ts
export function clampVolume(value: number): number {
    return Math.max(0, Math.min(1, value));
}

// In component
private handleVolumeChange(value: number): void {
    this.volume = clampVolume(value);
    this.emitChange();
}
```

2. **Service dependencies** - Ensure services are accessed via ServiceRegistry for mockability

3. **Event contracts** - Document CustomEvent detail types for type-safe testing

### 3.3 Cohesiveness Checklist

- [ ] Component follows single responsibility principle
- [ ] Component name matches its purpose (kebab-case, descriptive)
- [ ] Events use consistent naming (`{noun}-{verb}` or `{action}-request`)
- [ ] Styles use theme tokens (no hardcoded colors/spacing)
- [ ] Guard clauses used for early returns
- [ ] No direct console.* calls (use Logger if needed)
- [ ] Whitespace used meaningfully to group related code
- [ ] Try blocks are sparse (only wrap code that can throw)

### 3.4 Documentation Requirements

Add JSDoc to the class:

```typescript
/**
 * Control for selecting audio channels.
 *
 * Provides a dropdown of available audio channels (ambient, music, effects, etc.)
 * and emits selection changes to parent containers.
 *
 * @fires channel-change - Emitted when user selects a different channel
 *   - detail.channel: string - The selected channel ID
 *
 * @example
 * ```html
 * <channel-selector></channel-selector>
 * ```
 */
export class ChannelSelector extends BaseComponent {
```

---

## Phase 4: Server-Side Event Integration (When Needed)

When a new component requires server communication beyond existing events, follow this process to add new event types.

### 4.1 Define Types in server/src/types.ts

Add TypeScript type definitions:

```typescript
// 1. Define payload interface
export interface MyActionPayload {
    targetId: string;
    value: number;
    options?: {
        loop?: boolean;
        duration?: number;
    };
}

// 2. Define event type using Event generic
export type MyActionEvent = Event<"domain.action", MyActionPayload>;

// 3. Add to domain union type
export type DomainEvent =
    | ExistingEvent1
    | ExistingEvent2
    | MyActionEvent;  // Add new event
```

### 4.2 Define Schemas in server/src/schemas.ts

Add Zod schemas for runtime validation:

```typescript
// 1. Define payload schema with constraints
export const myActionPayloadSchema = z.object({
    targetId: z.string().min(1),
    value: z.number().min(0).max(1),
    options: z.object({
        loop: z.boolean().optional(),
        duration: z.number().positive().optional(),
    }).optional(),
});

// 2. Define event schema
export const myActionEventSchema = z.object({
    type: z.literal("domain.action"),
    payload: myActionPayloadSchema,
    metadata: eventMetadataSchema,
});

// 3. Add to eventSchema discriminated union
export const eventSchema = z.discriminatedUnion("type", [
    // ... existing schemas
    myActionEventSchema,
]);
```

### 4.3 Create or Update Service (if needed)

If the event requires new server-side handling:

```typescript
// server/src/services/{domain}/{domain}-service.ts

export class DomainService {
    private logger = new Logger("DomainService");

    constructor(
        private eventBus: IEventBus,
        private stateStore: IStateStore,
        private clientRegistry: IClientRegistry,
    ) {
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        this.eventBus.on("domain.action", this.handleAction.bind(this));
    }

    private handleAction(event: MyActionEvent): void {
        const { targetId, value } = event.payload;

        this.logger.info("Handling action", { targetId, value });

        // Update state immutably
        this.stateStore.updateState((state) => {
            return updateDomainState(state, targetId, value);
        });

        // Broadcast to clients
        this.clientRegistry.broadcast(event);
    }
}
```

### 4.4 Register Service in server/src/main.ts

```typescript
// Add token to TOKENS in container.ts
export const TOKENS = {
    // ...existing tokens
    DomainService: Symbol("DomainService"),
};

// Register factory in main.ts
container.registerFactory(TOKENS.DomainService, () => {
    return new DomainService(
        container.resolve(TOKENS.EventBus),
        container.resolve(TOKENS.StateStore),
        container.resolve(TOKENS.ClientRegistry),
    );
});

// Resolve to initialize
container.resolve(TOKENS.DomainService);
```

### 4.5 Add EventBuilder Method (client-side)

Update `ts-web-client/src/master/services/event-builder.ts`:

```typescript
import type { MyActionEvent, MyActionPayload } from "@types";

export class EventBuilder {
    // ... existing methods

    static domainAction(payload: MyActionPayload): MyActionEvent {
        return {
            type: "domain.action",
            payload,
            metadata: this.createMetadata(),
        };
    }
}
```

### 4.6 Server-Side Checklist

- [ ] Types defined in `server/src/types.ts`
- [ ] Payload interface with all required fields
- [ ] Event type using `Event<"type", Payload>` generic
- [ ] Added to domain union type
- [ ] Schema defined in `server/src/schemas.ts`
- [ ] Payload schema with validation constraints
- [ ] Event schema with `z.literal("type")`
- [ ] Added to `eventSchema` discriminated union
- [ ] Service created/updated (if server-side handling needed)
- [ ] Service registered in DI container
- [ ] EventBuilder method added in client

---

## Quick Reference: Key Files

### Client-Side

| Purpose | File Path |
|---------|-----------|
| Base component class | `ts-web-client/src/shared/components/base/base-component.ts` |
| Service registry | `ts-web-client/src/shared/services/service-registry.ts` |
| Connection service | `ts-web-client/src/shared/services/connection-service.ts` |
| Event builder | `ts-web-client/src/master/services/event-builder.ts` |
| Common styles | `ts-web-client/src/shared/styles/common-styles.ts` |
| Theme tokens | `ts-web-client/src/shared/styles/theme.ts` |
| Master main.ts | `ts-web-client/src/master/main.ts` |
| Example container | `ts-web-client/src/master/components/audio/audio-controls.ts` |
| Example selector | `ts-web-client/src/master/components/audio/channel-selector.ts` |
| Example slider | `ts-web-client/src/master/components/audio/volume-control.ts` |

### Server-Side

| Purpose | File Path |
|---------|-----------|
| Type definitions | `server/src/types.ts` |
| Zod schemas | `server/src/schemas.ts` |
| DI container & tokens | `server/src/core/di/container.ts` |
| Server main.ts | `server/src/main.ts` |
| Example service | `server/src/services/audio/audio-service.ts` |
| State helpers | `server/src/utils/state-helpers.ts` |
| Logger utility | `server/src/utils/logger.ts` |

---

## Checklist Summary

### Before Implementation
- [ ] Defined component purpose (container vs presentational)
- [ ] Identified existing patterns to follow
- [ ] Planned file location
- [ ] Documented component API (attributes, events)

### During Implementation
- [ ] Extended BaseComponent
- [ ] Called `super.connectedCallback()`
- [ ] Used Shadow DOM via `this.shadowRoot`
- [ ] Used `styleTag()` helper for CSS
- [ ] Composed styles from common-styles utilities
- [ ] Used theme tokens for colors/spacing
- [ ] Emitted CustomEvents with `bubbles: true, composed: true`
- [ ] Used guard clauses for early returns
- [ ] Registered in main.ts

### After Implementation
- [ ] Extracted reusable patterns to shared utilities
- [ ] Extracted pure functions for testability
- [ ] Verified cohesiveness with existing components
- [ ] Added JSDoc documentation
- [ ] Verified no hardcoded values (use theme tokens)

### Server-Side (When New Events Needed)
- [ ] Payload interface in `server/src/types.ts`
- [ ] Event type using `Event<"domain.action", Payload>` generic
- [ ] Added to domain union type
- [ ] Payload schema with constraints in `server/src/schemas.ts`
- [ ] Event schema added to `eventSchema` discriminated union
- [ ] Service handler (if server processing needed)
- [ ] Service registered in DI container
- [ ] EventBuilder method added in client
