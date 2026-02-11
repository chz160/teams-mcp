# Function Signature Contracts: Read-Only Permissions Mode

**Branch**: `001-read-only-mode` | **Date**: 2026-02-11

## Modified Function Signatures

This feature does not introduce API endpoints (REST/GraphQL). It modifies internal TypeScript function signatures and adds a helper function. All contracts below are internal module interfaces.

### 1. `isReadOnlyMode()` — NEW helper function

**Location**: `src/index.ts` (module-level utility)

```typescript
function isReadOnlyMode(): boolean
```

**Behavior**: Reads `process.env.TEAMS_MCP_READ_ONLY`, trims whitespace, converts to lowercase, and returns `true` if the value is `"true"`, `"1"`, or `"yes"`. Returns `false` for all other values including `undefined`.

### 2. `getDelegatedScopes()` — NEW helper function

**Location**: `src/index.ts` and `src/services/graph.ts`

```typescript
function getDelegatedScopes(readOnly: boolean): string[]
```

**Behavior**: Returns the appropriate Microsoft Graph permission scopes array based on the mode.

- `readOnly = false`: Returns current full scope set (unchanged)
- `readOnly = true`: Returns scope set with `ChannelMessage.Send` removed and `Chat.ReadWrite` replaced by `Chat.Read`

### 3. `registerChatTools()` — MODIFIED signature

**Location**: `src/tools/chats.ts`

```typescript
// Before
export function registerChatTools(server: McpServer, graphService: GraphService): void

// After
export function registerChatTools(server: McpServer, graphService: GraphService, readOnly?: boolean): void
```

**Behavior change**: When `readOnly` is `true`, skips registration of `send_chat_message` and `create_chat`.

### 4. `registerTeamsTools()` — MODIFIED signature

**Location**: `src/tools/teams.ts`

```typescript
// Before
export function registerTeamsTools(server: McpServer, graphService: GraphService): void

// After
export function registerTeamsTools(server: McpServer, graphService: GraphService, readOnly?: boolean): void
```

**Behavior change**: When `readOnly` is `true`, skips registration of `send_channel_message` and `reply_to_channel_message`.

### 5. `registerAuthTools()` — MODIFIED signature

**Location**: `src/tools/auth.ts`

```typescript
// Before
export function registerAuthTools(server: McpServer, graphService: GraphService): void

// After
export function registerAuthTools(server: McpServer, graphService: GraphService, readOnly?: boolean): void
```

**Behavior change**: When `readOnly` is `true`, the `auth_status` tool response appends ` [Read-Only Mode]` to the success message.

### 6. `startMcpServer()` — MODIFIED

**Location**: `src/index.ts`

```typescript
// No signature change (still takes no arguments)
async function startMcpServer(): Promise<void>
```

**Behavior change**: Reads `isReadOnlyMode()` at startup, passes result to all `register*Tools()` calls, and emits mode-specific startup log.

### 7. `authenticate()` — MODIFIED

**Location**: `src/index.ts`

```typescript
// No signature change (still takes no arguments)
async function authenticate(): Promise<void>
```

**Behavior change**: Uses `getDelegatedScopes(isReadOnlyMode())` instead of the static `DELEGATED_SCOPES` constant.

## Unchanged Signatures

The following register functions do NOT change (they contain only read tools):

- `registerUsersTools(server, graphService)` — all 3 tools are read-only
- `registerSearchTools(server, graphService)` — both tools are read-only
