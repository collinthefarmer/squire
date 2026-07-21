# Code Style

Rules that apply to all code in Squire — server and client. For domain-specific standards, see `SERVER_STANDARDS.md` and `CLIENT_STANDARDS.md`.

---

## 1. TypeScript

- `strict: true` in tsconfig — no exceptions
- `type` for discriminated unions and aliases, `interface` for object shapes
- `import type` for types to avoid circular dependencies
- No `any` — use `unknown` for truly dynamic types, type guards to narrow
- No type assertions (`as`) unless absolutely necessary — prefer type guards
- Type all parameters and return values explicitly
- Branded types for domain IDs: `type ChannelId = Brand<string, 'ChannelId'>` (defined in server types, re-exported to client via `@types`)

### Typed Dispatch Maps

For event handlers with 4+ cases, prefer a typed dispatch map over switch/case to get compiler-enforced exhaustiveness:

```typescript
type HandlerMap<U extends { type: string }> = {
    [K in U["type"]]: (event: Extract<U, { type: K }>) => void;
};

const handlers: HandlerMap<ClockEvent> = {
    "ui.clock.create": (e) => this.handleCreate(e),
    "ui.clock.start":  (e) => this.handleStart(e),
    // Compiler errors if a type is missing
};
```

For 2-3 cases, switch/case with cast is fine.

---

## 2. Naming

- **Files:** kebab-case (`audio-service.ts`)
- **Classes:** PascalCase (`AudioService`)
- **Interfaces/Types:** PascalCase (`AudioChannelState`, `IEventBus`)
- **Functions/Methods:** camelCase (`handlePlay`, `getChannel`)
- **Constants:** SCREAMING_SNAKE_CASE (`TOKENS`, `PUBLIC_DIR`)
- **Event types:** dot.notation (`audio.play`, `visual.image.set`)
- **Private members:** `private` keyword, no underscore prefix
- **Observables:** `$` suffix (`channels$`, `layers$`)
- **State helper prefixes:** `get*` (read), `set*` (create/replace), `update*` (transform), `remove*` (delete)
- **Reducer convention:** `apply{Domain}{Action}` (e.g., `applyAudioStop`)

---

## 3. Imports

Group in order, sort alphabetically within groups:
1. External packages (Bun, Zod, RxJS, lit-html)
2. Internal core infrastructure (`@core/`)
3. Internal modules (`@state/`, `@events/`, `@services/`, `@utils/`, etc.)
4. Internal types (`import type`)
5. Relative imports

Use `import type` for types. Avoid deep relative paths — use path aliases.

---

## 4. Functions

- Single responsibility — each function does one thing
- Early returns for error cases and guard clauses — keep happy path at lowest indentation
- `continue` in loops to skip early rather than nesting
- Max 3-4 parameters — use object parameter for more
- Prefer returning values over void + mutation
- Return `undefined` for "not found" (not `null`)
- Keep nesting to 2-3 levels max

---

## 5. Error Handling

- Try-catch for external I/O (WebSocket, file system, parsing)
- Keep try blocks sparse — only wrap code that could throw
- Validate user input with Zod — don't trust external data
- Log all caught errors with context using Logger
- Wrap event subscription callbacks in try/catch — a thrown error in an RxJS Subject terminates it permanently
- Use `Promise.allSettled()` for multiple async operations
- No empty catch blocks, no generic error messages without context

---

## 6. Logging

Use Logger class for all logging — no direct `console.*` calls.

```typescript
private logger = new Logger("AudioService");

this.logger.info("Playing audio", { channel, source: source.ref });
this.logger.error("Failed to process event", { error, channel });
```

**Levels:**
- `debug` — development diagnostics
- `info` — state transitions, significant events
- `warn` — recoverable issues, unexpected states
- `error` — failures and exceptions

---

## 7. Testing

- Use `bun test` with Bun's built-in runner
- Import from `bun:test`
- Co-locate tests: `foo.ts` → `foo.test.ts`
- Test state helpers and reducers in isolation (pure functions)
- Use shared test data factories: `make{Entity}(overrides?)` convention
- Descriptive names: `test("should pause channel when audio.pause received")`
- Group with `describe()`
- Don't test implementation details — test behavior

---

## 8. Organization

- Max 3-4 levels of directory nesting
- Files under 500 lines — split if larger
- One component/service per file
- White-space is meaningful — bookend related code between empty lines to convey grouping and importance
